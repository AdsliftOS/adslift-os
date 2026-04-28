import { useMemo, useRef, useEffect, useState } from "react";
import {
  format,
  parseISO,
  differenceInDays,
  addDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameMonth,
  isSameDay,
  getDay,
  isToday,
  getISOWeek,
  isWeekend,
  subDays,
} from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Locate, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  Box as BoxIcon,
  Users,
  Gift,
  Settings,
  Megaphone,
  Linkedin,
  Activity,
  Sparkles,
} from "lucide-react";
import type { ProjectStep } from "@/store/pipeline";
import type { Campaign } from "@/lib/meta-ads-project";

type GanttBar = {
  id: string;
  name: string;
  icon: string;
  status: "todo" | "active" | "done" | "skipped";
  startedAt: string | null;
  completedAt: string | null;
};

const ICONS: Record<string, typeof BoxIcon> = {
  box: BoxIcon, users: Users, gift: Gift, settings: Settings,
  megaphone: Megaphone, linkedin: Linkedin, activity: Activity, sparkles: Sparkles,
};

type ViewMode = "day" | "week" | "month";

// Fixed pixel widths for zoom levels that scroll horizontally.
// Month mode is special — see `dayWidth` calc below: it fits the full year
// into whatever width the container has (auto-fit).
const FIXED_DAY_WIDTH: Record<ViewMode, number | "auto"> = {
  day: 64,    // full detail — scrolls horizontally
  week: 32,   // ~quarter visible — scrolls horizontally
  month: "auto", // full year fits container width — no scroll
};

const TRACK_HEIGHT = 44;
const TRACK_LABEL_WIDTH = 220;

export function PipelineGantt({
  steps,
  campaigns = [],
}: {
  steps: ProjectStep[];
  campaigns?: Campaign[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [source, setSource] = useState<"steps" | "campaigns" | "both">(
    campaigns.length > 0 ? "campaigns" : "steps",
  );
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Always show a full calendar year. User can navigate years with arrows.
  // Auto-jumps to year of earliest active item on mount.
  useEffect(() => {
    const allWithStart = [
      ...steps.filter((s) => s.startedAt).map((s) => s.startedAt!),
      ...campaigns
        .map((c) => c.startTime || c.createdTime)
        .filter(Boolean) as string[],
    ];
    if (allWithStart.length === 0) return;
    const earliestYear = Math.min(...allWithStart.map((d) => parseISO(d).getFullYear()));
    if (earliestYear < currentYear) setCurrentYear(earliestYear);
  }, [steps, campaigns]);

  const range = useMemo(() => {
    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(yearStart);
    return { start: yearStart, end: yearEnd };
  }, [currentYear]);

  const totalDays = differenceInDays(range.end, range.start) + 1;
  const today = startOfDay(new Date());

  // Track scroller width so month mode can auto-fit
  const [scrollerWidth, setScrollerWidth] = useState<number>(0);
  useEffect(() => {
    if (!scrollerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScrollerWidth(entry.contentRect.width);
      }
    });
    ro.observe(scrollerRef.current);
    return () => ro.disconnect();
  }, []);

  const fixed = FIXED_DAY_WIDTH[viewMode];
  const dayWidth =
    fixed === "auto"
      ? Math.max(2, (scrollerWidth - TRACK_LABEL_WIDTH) / totalDays)
      : fixed;
  const totalWidth = totalDays * dayWidth;

  // Build day grid
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      arr.push(addDays(range.start, i));
    }
    return arr;
  }, [range, totalDays]);

  // Group days into months for the top header
  const monthGroups = useMemo(() => {
    const groups: { start: number; count: number; date: Date }[] = [];
    let current: { start: number; count: number; date: Date } | null = null;
    days.forEach((d, i) => {
      if (!current || !isSameMonth(current.date, d)) {
        current = { start: i, count: 1, date: d };
        groups.push(current);
      } else {
        current.count++;
      }
    });
    return groups;
  }, [days]);

  // Group days into ISO weeks for the secondary header
  const weekGroups = useMemo(() => {
    const groups: { start: number; count: number; week: number; date: Date }[] = [];
    let current: { start: number; count: number; week: number; date: Date } | null = null;
    days.forEach((d, i) => {
      const w = getISOWeek(d);
      if (!current || current.week !== w) {
        current = { start: i, count: 1, week: w, date: d };
        groups.push(current);
      } else {
        current.count++;
      }
    });
    return groups;
  }, [days]);

  // Auto-scroll to today (or year start if today not in range)
  useEffect(() => {
    if (!scrollerRef.current) return;
    const todayOffset = differenceInDays(today, range.start);
    if (todayOffset >= 0 && todayOffset <= totalDays) {
      const targetX = todayOffset * dayWidth - scrollerRef.current.clientWidth / 3;
      scrollerRef.current.scrollLeft = Math.max(0, targetX);
    } else {
      scrollerRef.current.scrollLeft = 0;
    }
  }, [viewMode, currentYear]);

  const scrollToToday = () => {
    if (!scrollerRef.current) return;
    if (today.getFullYear() !== currentYear) {
      setCurrentYear(today.getFullYear());
      return;
    }
    const todayOffset = differenceInDays(today, range.start);
    const targetX = todayOffset * dayWidth - scrollerRef.current.clientWidth / 2;
    scrollerRef.current.scrollTo({ left: Math.max(0, targetX), behavior: "smooth" });
  };

  // Build the bars list based on source toggle
  const bars: GanttBar[] = useMemo(() => {
    const stepBars: GanttBar[] = steps.map((s) => ({
      id: `step-${s.id}`,
      name: s.name,
      icon: s.icon,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    }));
    const campaignBars: GanttBar[] = campaigns.map((c) => ({
      id: `cmp-${c.id}`,
      name: c.name,
      icon: "megaphone",
      status:
        c.effectiveStatus === "ACTIVE"
          ? "active"
          : c.effectiveStatus === "PAUSED"
          ? "skipped"
          : c.effectiveStatus === "ARCHIVED" || c.effectiveStatus === "DELETED"
          ? "done"
          : "todo",
      startedAt: c.startTime || c.createdTime || null,
      completedAt: c.stopTime,
    }));

    if (source === "steps") return stepBars;
    if (source === "campaigns") return campaignBars;
    return [...campaignBars, ...stepBars];
  }, [source, steps, campaigns]);

  const stepsToRender = bars; // for layout

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 border-b bg-gradient-to-r from-blue-500/[0.08] via-transparent to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentYear((y) => y - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="text-center min-w-[80px]">
              <div className="text-base font-bold leading-none tabular-nums">{currentYear}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{totalDays} Tage</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentYear((y) => y + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source toggle — only when both available */}
          {(steps.length > 0 || campaigns.length > 0) && campaigns.length > 0 && (
            <ToggleGroup
              type="single"
              value={source}
              onValueChange={(v) => v && setSource(v as any)}
              size="sm"
            >
              <ToggleGroupItem value="campaigns" className="text-xs px-2.5">
                Campaigns ({campaigns.length})
              </ToggleGroupItem>
              <ToggleGroupItem value="steps" className="text-xs px-2.5">
                Steps ({steps.length})
              </ToggleGroupItem>
              <ToggleGroupItem value="both" className="text-xs px-2.5">
                Beide
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            size="sm"
          >
            <ToggleGroupItem value="day" className="text-xs px-3">Tag</ToggleGroupItem>
            <ToggleGroupItem value="week" className="text-xs px-3">Woche</ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-3">Monat</ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" variant="outline" onClick={scrollToToday}>
            <Locate className="h-3.5 w-3.5 mr-1" /> Heute
          </Button>
        </div>
      </div>

      {/* Gantt scroller */}
      <div className="relative">
        <div
          ref={scrollerRef}
          className="overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded"
        >
          <div className="flex">
            {/* Sticky left label column */}
            <div
              className="sticky left-0 z-30 bg-card border-r shrink-0"
              style={{ width: TRACK_LABEL_WIDTH }}
            >
              {/* Spacer matching header height — month-mode hides the KW row */}
              <div
                className="border-b bg-muted/30 flex items-end px-3 pb-1.5"
                style={{ height: viewMode === "month" ? 64 : 88 }}
              >
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                  Steps · {stepsToRender.length}
                </span>
              </div>
              {stepsToRender.map((s, i) => {
                const Icon = ICONS[s.icon] || BoxIcon;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 px-3 border-b",
                      i % 2 === 1 && "bg-muted/[0.04]",
                    )}
                    style={{ height: TRACK_HEIGHT }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground/60 w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div
                      className={cn(
                        "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                        s.status === "active" && "bg-blue-500/15 text-blue-500",
                        s.status === "done" && "bg-emerald-500/15 text-emerald-500",
                        s.status === "todo" && "bg-muted text-muted-foreground",
                        s.status === "skipped" && "bg-rose-500/15 text-rose-500",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium truncate">{s.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Right grid */}
            <div className="relative shrink-0" style={{ width: totalWidth }}>
              {/* Header — months */}
              <div className="flex h-7 border-b bg-muted/30">
                {monthGroups.map((g) => (
                  <div
                    key={g.start}
                    className="flex items-center px-2 text-[11px] font-semibold border-r text-foreground/80"
                    style={{ width: g.count * dayWidth }}
                  >
                    {format(g.date, "MMMM yyyy", { locale: de })}
                  </div>
                ))}
              </div>

              {/* Header — weeks (hidden in month view to avoid clutter) */}
              {viewMode !== "month" && (
                <div className="flex h-6 border-b bg-muted/15">
                  {weekGroups.map((g) => (
                    <div
                      key={`${g.week}-${g.start}`}
                      className="flex items-center justify-center text-[10px] font-mono text-muted-foreground border-r"
                      style={{ width: g.count * dayWidth }}
                    >
                      KW {g.week}
                    </div>
                  ))}
                </div>
              )}

              {/* Header — days */}
              <div className="flex h-[32px] border-b bg-card relative">
                {days.map((d, i) => {
                  const isFirstOfMonth = d.getDate() === 1;
                  const weekend = isWeekend(d);
                  const todayCell = isToday(d);
                  // Month mode: skip per-day labels (too cramped) — show
                  // only every-7th day number subtly
                  const showLabel = viewMode !== "month" || d.getDay() === 1; // Mondays only in month
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-center text-[9px] tabular-nums shrink-0",
                        weekend && "bg-muted/30",
                        isFirstOfMonth && "border-l border-l-foreground/25",
                        todayCell && "bg-rose-500/10",
                        // Only show right border in day view; week/month would be too dense
                        viewMode === "day" && "border-r",
                      )}
                      style={{ width: dayWidth }}
                    >
                      {viewMode === "day" && (
                        <span className="font-mono uppercase text-[8px] text-muted-foreground/70">
                          {format(d, "EEEEE", { locale: de })}
                        </span>
                      )}
                      {showLabel && (
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            viewMode === "month" && "text-[8px] text-muted-foreground/50",
                            todayCell && "text-rose-500 font-bold",
                            weekend && !todayCell && viewMode === "day" && "text-muted-foreground/60",
                          )}
                        >
                          {d.getDate()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Track rows + bars */}
              <div className="relative">
                {/* Background grid: weekend stripes + month dividers */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((d, i) => {
                    const weekend = isWeekend(d);
                    const isFirstOfMonth = d.getDate() === 1;
                    return (
                      <div
                        key={i}
                        className={cn(
                          weekend && viewMode !== "month" && "bg-muted/20",
                          // Only Sundays get a faint divider in week view
                          viewMode === "week" && d.getDay() === 0 && "border-r border-r-muted-foreground/10",
                          // Day view: divider every day
                          viewMode === "day" && "border-r border-r-muted-foreground/10",
                          // Month view: only first-of-month divider
                          isFirstOfMonth && "border-l border-l-foreground/15",
                        )}
                        style={{ width: dayWidth }}
                      />
                    );
                  })}
                </div>

                {/* Today vertical line */}
                {(() => {
                  const todayOffset = differenceInDays(today, range.start);
                  if (todayOffset < 0 || todayOffset > totalDays) return null;
                  const left = todayOffset * dayWidth + dayWidth / 2;
                  return (
                    <div
                      className="absolute top-0 bottom-0 z-10 pointer-events-none"
                      style={{ left }}
                    >
                      <div className="absolute top-0 bottom-0 w-px bg-rose-500/70" />
                      <div className="absolute -top-[2px] -translate-x-1/2 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    </div>
                  );
                })()}

                {/* Bars */}
                {stepsToRender.map((s, i) => {
                  const start = s.startedAt ? parseISO(s.startedAt) : null;
                  const end = s.completedAt
                    ? parseISO(s.completedAt)
                    : s.status === "active"
                    ? today
                    : null;

                  const hasRange = start && end;

                  return (
                    <div
                      key={s.id}
                      className={cn("relative border-b", i % 2 === 1 && "bg-muted/[0.04]")}
                      style={{ height: TRACK_HEIGHT }}
                    >
                      {hasRange && (() => {
                        const startOffset = differenceInDays(start, range.start);
                        const duration = Math.max(differenceInDays(end, start), 0.5);
                        const left = startOffset * dayWidth;
                        const width = Math.max(duration * dayWidth, dayWidth / 2);
                        const tooltip = `${s.name}\n${format(start, "dd.MM.yyyy")} – ${format(
                          end,
                          "dd.MM.yyyy",
                        )} (${Math.round(duration)} Tage)`;

                        return (
                          <div
                            title={tooltip}
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 rounded-lg shadow-md border overflow-hidden flex items-center px-2 cursor-help group",
                              s.status === "done" &&
                                "bg-gradient-to-r from-emerald-500 to-emerald-400 border-emerald-600/30 text-white",
                              s.status === "active" &&
                                "bg-gradient-to-r from-blue-500 to-blue-400 border-blue-600/30 text-white animate-pulse",
                              s.status === "todo" &&
                                "bg-gradient-to-r from-slate-400 to-slate-300 border-slate-500/20 text-white",
                              s.status === "skipped" &&
                                "bg-gradient-to-r from-rose-400 to-rose-300 border-rose-500/20 text-white opacity-60",
                            )}
                            style={{
                              left,
                              width,
                              height: TRACK_HEIGHT - 14,
                            }}
                          >
                            <span className="text-[10px] font-semibold truncate drop-shadow-sm">
                              {s.name}
                            </span>
                            <span className="ml-auto text-[9px] tabular-nums opacity-80 hidden group-hover:inline shrink-0 pl-2">
                              {Math.round(duration)}d
                            </span>
                          </div>
                        );
                      })()}

                      {/* No-range hint for steps without dates */}
                      {!hasRange && s.status === "todo" && (() => {
                        // Optional: show a ghost where it would land if started today
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div className="px-5 py-2.5 border-t bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <LegendDot color="bg-blue-500" label="Aktiv (pulsiert)" />
        <LegendDot color="bg-emerald-500" label="Erledigt" />
        <LegendDot color="bg-slate-400" label="Offen / kein Start" />
        <LegendDot color="bg-rose-500" label="Heute" round />
        <span className="ml-auto">Hover über Bar für Details · Drag horizontal zum Scrollen</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label, round }: { color: string; label: string; round?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5", color, round ? "rounded-full" : "rounded-sm")} />
      {label}
    </span>
  );
}

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

// Fixed pixel widths for zoom levels.
const FIXED_DAY_WIDTH: Record<ViewMode, number | "auto"> = {
  day: 64,    // full detail — scrolls horizontally
  week: 32,   // ~quarter visible — scrolls horizontally
  month: "auto", // auto-fit full year (with min readability)
};

// Month mode strictly auto-fits the full year into the available viewport
// width — no horizontal scroll. Daily granularity stays via the day-tick
// row in the month header.
const MIN_MONTH_DAY_WIDTH = 1;

const TRACK_HEIGHT_DEFAULT = 56;
const TRACK_HEIGHT_MONTH = 80; // taller rows in year view so bars stay prominent
const TRACK_LABEL_WIDTH = 240;

export function PipelineGantt({
  steps,
  campaigns = [],
  defaultSource,
}: {
  steps: ProjectStep[];
  campaigns?: Campaign[];
  /** "steps" | "campaigns" | "both" — initial source. Falls back to whatever
   * is available if the requested source has no data. */
  defaultSource?: "steps" | "campaigns" | "both";
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [source, setSource] = useState<"steps" | "campaigns" | "both">(
    defaultSource || (campaigns.length > 0 ? "campaigns" : "steps"),
  );
  const [campaignFilter, setCampaignFilter] = useState<"active" | "all">("active");
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Always honor the caller's explicit defaultSource — campaigns load async
  // so we should NOT fall back to steps just because the array is briefly
  // empty on first render. If the requested source ends up empty, the
  // empty-state UI handles it.
  useEffect(() => {
    if (defaultSource) setSource(defaultSource);
  }, [defaultSource]);

  // Auto-jump to a year that contains data (earliest if past, today's
  // year if data spans, or earliest future year). Runs once when data
  // appears so the user lands on a populated year by default.
  const didAutoJumpRef = useRef(false);
  useEffect(() => {
    if (didAutoJumpRef.current) return;
    const allWithStart = [
      ...steps.filter((s) => s.startedAt).map((s) => s.startedAt!),
      ...campaigns
        .map((c) => c.startTime || c.createdTime)
        .filter(Boolean) as string[],
    ];
    if (allWithStart.length === 0) return;
    const years = allWithStart.map((d) => parseISO(d).getFullYear());
    const todayYear = new Date().getFullYear();
    // Prefer current year if any data is in it, else earliest year with data
    const target = years.includes(todayYear)
      ? todayYear
      : Math.min(...years);
    if (target !== currentYear) setCurrentYear(target);
    didAutoJumpRef.current = true;
  }, [steps, campaigns, currentYear]);

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
  // Month mode uses pure CSS flex (right grid = 100% width, bars in %).
  // dayWidth is only used for legacy pixel calculations in day/week modes.
  const isFlex = fixed === "auto";
  const dayWidth = isFlex ? 1 : (fixed as number);
  const totalWidth = totalDays * dayWidth; // unused when isFlex
  const trackHeight = viewMode === "month" ? TRACK_HEIGHT_MONTH : TRACK_HEIGHT_DEFAULT;

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
    const filteredCampaigns =
      campaignFilter === "active"
        ? campaigns.filter((c) => c.effectiveStatus === "ACTIVE")
        : campaigns;
    const campaignBars: GanttBar[] = filteredCampaigns.map((c) => ({
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
  }, [source, steps, campaigns, campaignFilter]);

  const stepsToRender = bars; // for layout

  // Count bars actually visible in the current year so we can hint if data
  // lives in another year
  const barsInYear = bars.filter((b) => {
    if (!b.startedAt) return false;
    const s = parseISO(b.startedAt);
    const e = b.completedAt ? parseISO(b.completedAt) : new Date();
    return s <= range.end && e >= range.start;
  }).length;
  const dataYears = Array.from(
    new Set(
      bars
        .filter((b) => b.startedAt)
        .map((b) => parseISO(b.startedAt!).getFullYear()),
    ),
  ).sort();

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-blue-500/[0.10] via-blue-500/[0.04] to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-primary/10"
                onClick={() => setCurrentYear((y) => y - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="text-center min-w-[64px]">
                <div className="text-xl font-black leading-none tabular-nums tracking-tight">{currentYear}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-primary/10"
                onClick={() => setCurrentYear((y) => y + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-wider">
              Timeline · {totalDays} Tage
            </div>
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
          {/* Campaign status filter — only when campaigns are part of the view */}
          {(source === "campaigns" || source === "both") && campaigns.length > 0 && (() => {
            const activeCount = campaigns.filter((c) => c.effectiveStatus === "ACTIVE").length;
            return (
              <ToggleGroup
                type="single"
                value={campaignFilter}
                onValueChange={(v) => v && setCampaignFilter(v as any)}
                size="sm"
              >
                <ToggleGroupItem value="active" className="text-xs px-2.5">
                  Nur aktiv ({activeCount})
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="text-xs px-2.5">
                  Alle ({campaigns.length})
                </ToggleGroupItem>
              </ToggleGroup>
            );
          })()}
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

      {/* Hint when current year has no bars but other years do */}
      {bars.length > 0 && barsInYear === 0 && dataYears.length > 0 && (
        <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs flex items-center gap-2 flex-wrap">
          <span className="text-amber-600 font-medium">In {currentYear} liegen keine Daten.</span>
          <span className="text-muted-foreground">Springe zu:</span>
          {dataYears.map((y) => (
            <Button
              key={y}
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              onClick={() => setCurrentYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>
      )}

      {/* Empty state when nothing to render at all */}
      {bars.length === 0 && (
        <div className="text-center py-12 px-6 space-y-2">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">Keine Timeline-Daten</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Sobald Steps "Aktiv" gesetzt werden oder Kampagnen aus Meta geladen sind, erscheinen hier die Bars.
          </p>
        </div>
      )}

      {/* Gantt scroller */}
      {bars.length > 0 && <div className="relative">
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
              {/* Spacer matching header height. In month mode only the month
                  row exists (40px); otherwise month + week + day = 98px. */}
              <div
                className="border-b bg-gradient-to-b from-muted/40 to-muted/10 flex items-end px-4 pb-2"
                style={{ height: viewMode === "month" ? 40 : 98 }}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 font-semibold">
                  {source === "campaigns"
                    ? `${stepsToRender.length} Kampagnen`
                    : source === "steps"
                    ? `${stepsToRender.length} Steps`
                    : `${stepsToRender.length} Einträge`}
                </span>
              </div>
              {stepsToRender.map((s, i) => {
                const isCampaign = s.id.startsWith("cmp-");
                const Icon = ICONS[s.icon] || BoxIcon;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 px-3 border-b border-border/20",
                      i % 2 === 1 && "bg-muted/[0.04]",
                    )}
                    style={{ height: trackHeight }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground/60 w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div
                      className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                        isCampaign && "bg-[#0866FF]/10 ring-1 ring-[#0866FF]/30",
                        !isCampaign && s.status === "active" && "bg-blue-500/15 text-blue-500",
                        !isCampaign && s.status === "done" && "bg-emerald-500/15 text-emerald-500",
                        !isCampaign && s.status === "todo" && "bg-muted text-muted-foreground",
                        !isCampaign && s.status === "skipped" && "bg-rose-500/15 text-rose-500",
                      )}
                    >
                      {isCampaign ? (
                        <img
                          src="https://cdn.simpleicons.org/meta/0866FF"
                          alt="Meta"
                          className="h-4 w-4"
                          loading="lazy"
                        />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span className="text-xs font-medium truncate">{s.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Right grid */}
            <div
              className="relative shrink-0"
              style={isFlex ? { width: "100%", flex: 1 } : { width: totalWidth }}
            >
              {/* Header — months (glass, with subtle day ticks underneath) */}
              <div className="flex h-12 border-b border-border/30 backdrop-blur-md bg-gradient-to-b from-white/[0.04] via-white/[0.02] to-transparent relative">
                {monthGroups.map((g) => {
                  const month = g.date.getMonth(); // 0-11
                  const isQuarterStart = month % 3 === 0;
                  const isCurrentMonth =
                    g.date.getMonth() === today.getMonth() &&
                    g.date.getFullYear() === today.getFullYear();
                  return (
                    <div
                      key={g.start}
                      className={cn(
                        "flex items-center justify-center text-xs font-semibold tracking-tight relative",
                        !isFlex && "shrink-0",
                        "border-r border-border/20",
                        isQuarterStart && "border-l-2 border-l-primary/40",
                        isCurrentMonth && "bg-primary/[0.06]",
                      )}
                      style={isFlex ? { flex: g.count, minWidth: 0 } : { width: g.count * dayWidth }}
                    >
                      <span
                        className={cn(
                          "truncate px-2 relative z-10",
                          isCurrentMonth ? "text-primary" : "text-foreground/85",
                        )}
                      >
                        {dayWidth >= 30
                          ? format(g.date, "MMMM yyyy", { locale: de })
                          : dayWidth >= 12
                          ? format(g.date, "MMMM", { locale: de })
                          : format(g.date, "MMM", { locale: de })}
                      </span>
                      {isQuarterStart && (
                        <span className="absolute top-0.5 left-1.5 text-[8px] font-mono text-primary/60 uppercase tracking-wider">
                          Q{Math.floor(month / 3) + 1}
                        </span>
                      )}
                      {/* Subtle day ticks at the bottom of the month box (only in month view) */}
                      {viewMode === "month" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 flex pointer-events-none">
                          {Array.from({ length: g.count }).map((_, i) => {
                            const d = addDays(g.date, i);
                            const isMonday = d.getDay() === 1;
                            const isTodayTick =
                              d.getFullYear() === today.getFullYear() &&
                              d.getMonth() === today.getMonth() &&
                              d.getDate() === today.getDate();
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "border-r",
                                  isTodayTick
                                    ? "border-rose-500/80"
                                    : isMonday
                                    ? "border-foreground/20"
                                    : "border-foreground/[0.06]",
                                )}
                                style={isFlex ? { flex: 1, minWidth: 0 } : { width: dayWidth }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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

              {/* Header — days (skipped entirely in month mode for clean look) */}
              {viewMode !== "month" && (
                <div className="flex h-[34px] border-b bg-card relative">
                  {days.map((d, i) => {
                    const isFirstOfMonth = d.getDate() === 1;
                    const weekend = isWeekend(d);
                    const todayCell = isToday(d);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex flex-col items-center justify-center text-[9px] tabular-nums shrink-0",
                          weekend && "bg-muted/30",
                          isFirstOfMonth && "border-l border-l-foreground/25",
                          todayCell && "bg-rose-500/10",
                          viewMode === "day" && "border-r border-r-border/30",
                        )}
                        style={{ width: dayWidth }}
                      >
                        {viewMode === "day" && (
                          <span className="font-mono uppercase text-[8px] text-muted-foreground/70">
                            {format(d, "EEEEE", { locale: de })}
                          </span>
                        )}
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            todayCell && "text-rose-500",
                            weekend && !todayCell && "text-muted-foreground/60",
                          )}
                        >
                          {d.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Track rows + bars */}
              <div className="relative">
                {/* Background grid: weekend stripes + month dividers */}
                {!isFlex && (
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((d, i) => {
                      const weekend = isWeekend(d);
                      const isFirstOfMonth = d.getDate() === 1;
                      return (
                        <div
                          key={i}
                          className={cn(
                            weekend && viewMode !== "month" && "bg-muted/20",
                            viewMode === "week" && d.getDay() === 0 && "border-r border-r-muted-foreground/10",
                            viewMode === "day" && "border-r border-r-muted-foreground/10",
                            isFirstOfMonth && "border-l border-l-foreground/15",
                          )}
                          style={{ width: dayWidth }}
                        />
                      );
                    })}
                  </div>
                )}
                {/* Flex-mode: month dividers via flex with proportional widths */}
                {isFlex && (
                  <div className="absolute inset-0 flex pointer-events-none">
                    {monthGroups.map((g) => (
                      <div
                        key={g.start}
                        className="border-l border-l-foreground/10 first:border-l-0"
                        style={{ flex: g.count, minWidth: 0 }}
                      />
                    ))}
                  </div>
                )}

                {/* Today vertical line — prominent + animated */}
                {(() => {
                  const todayOffset = differenceInDays(today, range.start);
                  if (todayOffset < 0 || todayOffset > totalDays) return null;
                  const leftStyle = isFlex
                    ? { left: `${((todayOffset + 0.5) / totalDays) * 100}%` }
                    : { left: todayOffset * dayWidth + dayWidth / 2 };
                  return (
                    <div
                      className="absolute top-0 bottom-0 z-10 pointer-events-none"
                      style={leftStyle}
                    >
                      <div className="absolute top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-rose-500 via-rose-500/80 to-rose-500/20" />
                      <div className="absolute -top-1 -translate-x-1/2 flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-500/30 animate-pulse" />
                      </div>
                    </div>
                  );
                })()}

                {/* Bars */}
                {stepsToRender.map((s, i) => {
                  const start = s.startedAt ? parseISO(s.startedAt) : null;
                  const isOngoing = !s.completedAt && s.status === "active";
                  // Bar visually extends through today's cell when ongoing.
                  // Tooltip shows the actual "end" (today) without the +1 trick.
                  const tooltipEnd = s.completedAt
                    ? parseISO(s.completedAt)
                    : isOngoing
                    ? today
                    : null;
                  const end = s.completedAt
                    ? parseISO(s.completedAt)
                    : isOngoing
                    ? addDays(today, 1)
                    : null;

                  const hasRange = start && end;

                  return (
                    <div
                      key={s.id}
                      className={cn("relative border-b", i % 2 === 1 && "bg-muted/[0.04]")}
                      style={{ height: trackHeight }}
                    >
                      {hasRange && (() => {
                        const startOffset = differenceInDays(start, range.start);
                        const duration = Math.max(differenceInDays(end, start), 0.5);
                        // Inclusive day count for the tooltip
                        const inclusiveDays = tooltipEnd
                          ? Math.max(differenceInDays(tooltipEnd, start) + 1, 1)
                          : Math.round(duration);
                        // Position via percent in flex mode, pixels in scroll modes
                        const positionStyle = isFlex
                          ? {
                              left: `${(startOffset / totalDays) * 100}%`,
                              width: `${Math.max((duration / totalDays) * 100, 0.5)}%`,
                              height: trackHeight - 16,
                            }
                          : {
                              left: startOffset * dayWidth,
                              width: Math.max(duration * dayWidth, dayWidth / 2),
                              height: trackHeight - 16,
                            };
                        const endLabel = tooltipEnd
                          ? format(tooltipEnd, "dd.MM.yyyy")
                          : "läuft";
                        const tooltip = `${s.name}\n${format(start, "dd.MM.yyyy")} – ${endLabel} (${inclusiveDays} Tage)`;

                        return (
                          <div
                            title={tooltip}
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 rounded-md overflow-hidden flex items-center px-2.5 cursor-help group backdrop-blur-md border transition-colors",
                              s.status === "done" &&
                                "bg-emerald-500/15 border-emerald-400/40 text-emerald-100",
                              s.status === "active" &&
                                "bg-blue-500/20 border-blue-400/50 text-blue-50",
                              s.status === "todo" &&
                                "bg-slate-500/12 border-slate-400/30 text-slate-100",
                              s.status === "skipped" &&
                                "bg-rose-500/12 border-rose-400/30 text-rose-100 opacity-60",
                            )}
                            style={positionStyle}
                          >
                            {/* subtle glass highlight */}
                            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                            {/* leading colored dot */}
                            <div
                              className={cn(
                                "relative h-1.5 w-1.5 rounded-full mr-2 shrink-0",
                                s.status === "done" && "bg-emerald-400",
                                s.status === "active" && "bg-blue-400 animate-pulse",
                                s.status === "todo" && "bg-slate-300",
                                s.status === "skipped" && "bg-rose-400",
                              )}
                            />
                            <span className="relative text-[11px] font-semibold truncate tracking-tight">
                              {s.name}
                            </span>
                            <span className="relative ml-auto text-[9px] tabular-nums opacity-80 hidden group-hover:inline shrink-0 pl-2 font-mono">
                              {inclusiveDays}d
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
      </div>}

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

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

const ICONS: Record<string, typeof BoxIcon> = {
  box: BoxIcon, users: Users, gift: Gift, settings: Settings,
  megaphone: Megaphone, linkedin: Linkedin, activity: Activity, sparkles: Sparkles,
};

type ViewMode = "day" | "week" | "month";

const DAY_WIDTH: Record<ViewMode, number> = {
  day: 56,
  week: 28,
  month: 12,
};

const TRACK_HEIGHT = 44;
const TRACK_LABEL_WIDTH = 220;

export function PipelineGantt({ steps }: { steps: ProjectStep[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Determine timeline range
  const range = useMemo(() => {
    const today = startOfDay(new Date());
    const stepsWithStart = steps.filter((s) => s.startedAt);
    if (stepsWithStart.length === 0) {
      // No active steps — show 30 days centered on today
      return {
        start: subDays(today, 14),
        end: addDays(today, 16),
      };
    }
    const earliest = stepsWithStart
      .map((s) => parseISO(s.startedAt!))
      .reduce((a, b) => (a < b ? a : b));
    const latest = stepsWithStart
      .map((s) => (s.completedAt ? parseISO(s.completedAt) : today))
      .reduce((a, b) => (a > b ? a : b));
    return {
      start: subDays(startOfDay(earliest), 3),
      end: addDays(startOfDay(latest), 7),
    };
  }, [steps]);

  const totalDays = differenceInDays(range.end, range.start) + 1;
  const today = startOfDay(new Date());
  const dayWidth = DAY_WIDTH[viewMode];
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

  // Auto-scroll to today on mount
  useEffect(() => {
    if (!scrollerRef.current) return;
    const todayOffset = differenceInDays(today, range.start);
    if (todayOffset >= 0 && todayOffset <= totalDays) {
      const targetX = todayOffset * dayWidth - 200;
      scrollerRef.current.scrollLeft = Math.max(0, targetX);
    }
  }, [viewMode]);

  const scrollToToday = () => {
    if (!scrollerRef.current) return;
    const todayOffset = differenceInDays(today, range.start);
    const targetX = todayOffset * dayWidth - scrollerRef.current.clientWidth / 2;
    scrollerRef.current.scrollTo({ left: Math.max(0, targetX), behavior: "smooth" });
  };

  const stepsToRender = steps; // show all in order

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3 border-b bg-gradient-to-r from-blue-500/[0.08] via-transparent to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Timeline</h3>
            <p className="text-[10px] text-muted-foreground">
              {format(range.start, "dd.MM.yyyy", { locale: de })} – {format(range.end, "dd.MM.yyyy", { locale: de })} · {totalDays} Tage
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
              {/* Spacer matching header height (month + week + day) */}
              <div className="h-[78px] border-b bg-muted/30 flex items-end px-3 pb-1.5">
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

              {/* Header — weeks */}
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

              {/* Header — days */}
              <div className="flex h-[32px] border-b bg-card relative">
                {days.map((d, i) => {
                  const isFirstOfMonth = d.getDate() === 1;
                  const weekend = isWeekend(d);
                  const todayCell = isToday(d);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-center border-r text-[9px] tabular-nums shrink-0",
                        weekend && "bg-muted/30",
                        isFirstOfMonth && "border-l border-l-foreground/20",
                        todayCell && "bg-rose-500/10",
                      )}
                      style={{ width: dayWidth }}
                    >
                      {viewMode !== "month" && (
                        <span className="font-mono uppercase text-[8px] text-muted-foreground/70">
                          {format(d, "EEEEE", { locale: de })}
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          todayCell && "text-rose-500 font-bold",
                          weekend && !todayCell && "text-muted-foreground/60",
                        )}
                      >
                        {d.getDate()}
                      </span>
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
                          "border-r",
                          weekend && "bg-muted/20",
                          isFirstOfMonth && "border-l border-l-foreground/15",
                          i === days.length - 1 && "border-r-0",
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

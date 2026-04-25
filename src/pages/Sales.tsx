import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp, Trash2, Target, Calendar, ChevronLeft, ChevronRight, ArrowRight, UserPlus, PhoneCall, PhoneForwarded, Handshake, DollarSign, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, isWithinInterval, startOfMonth, endOfMonth, addMonths, addYears } from "date-fns";
import { de } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { useSalesWeeks, addSalesWeek, updateSalesWeek, deleteSalesWeek } from "@/store/sales";
import type { SalesWeek } from "@/store/sales";
import { useAllCalendarEvents } from "@/store/calendar";
import { useNoShows } from "@/store/noshows";
import { isSalesMeeting } from "@/lib/sales-meetings";
import { getLeadsCreatedBetween } from "@/lib/close-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/store/teamMembers";

// SalesWeek type imported from @/store/sales

function fmt(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

// Parse date string without timezone issues (avoids UTC midnight → previous day in CET)
function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes("T")) return new Date(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getWeekLabel(date: Date) {
  const ws = startOfWeek(date, { weekStartsOn: 1 });
  const we = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(ws, "dd.MM.", { locale: de })} – ${format(we, "dd.MM.yyyy", { locale: de })}`;
}

const now = new Date();


type FilterMode = "week" | "month" | "year";

const funnelSteps = [
  { key: "newLeads", label: "Neue Leads", icon: UserPlus, color: "bg-blue-500" },
  { key: "scheduled", label: "Terminiert", icon: PhoneForwarded, color: "bg-amber-500" },
  { key: "showed", label: "Erschienen", icon: Handshake, color: "bg-cyan-500" },
  { key: "closed", label: "Deal", icon: DollarSign, color: "bg-emerald-500" },
];

export default function Sales() {
  const [appSettings] = useSettings();
  const [weeks] = useSalesWeeks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [form, setForm] = useState({ closed: "", dealVolume: "", closerEmail: "" });
  const teamMembers = useTeamMembers();
  const calendarEvents = useAllCalendarEvents();
  const noshowList = useNoShows();
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [closeLeads, setCloseLeads] = useState<number>(0);
  const [closeLoading, setCloseLoading] = useState(false);
  const [filterOffset, setFilterOffset] = useState(0);

  // Edit week dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState<SalesWeek | null>(null);
  const [editForm, setEditForm] = useState({ newLeads: "", closed: "", dealVolume: "", closerEmail: "" });

  const filterRange = useMemo(() => {
    const base = new Date();
    if (filterMode === "week") { const ref = addWeeks(base, filterOffset); return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) }; }
    if (filterMode === "month") { const ref = addMonths(base, filterOffset); return { start: startOfMonth(ref), end: endOfMonth(ref) }; }
    const ref = addYears(base, filterOffset);
    return { start: new Date(ref.getFullYear(), 0, 1), end: new Date(ref.getFullYear(), 11, 31) };
  }, [filterMode, filterOffset]);

  const filterLabel = useMemo(() => {
    if (filterMode === "week") return `KW ${getISOWeek(filterRange.start)} · ${format(filterRange.start, "dd.MM.", { locale: de })} – ${format(filterRange.end, "dd.MM.yyyy", { locale: de })}`;
    if (filterMode === "month") return format(filterRange.start, "MMMM yyyy", { locale: de });
    return filterRange.start.getFullYear().toString();
  }, [filterMode, filterRange]);

  // Fetch new leads from Close for current filter range
  useEffect(() => {
    setCloseLoading(true);
    const dateFrom = format(filterRange.start, "yyyy-MM-dd");
    const dateTo = format(filterRange.end, "yyyy-MM-dd");
    getLeadsCreatedBetween(dateFrom, dateTo)
      .then((count) => setCloseLeads(count))
      .catch(() => setCloseLeads(0))
      .finally(() => setCloseLoading(false));
  }, [filterRange]);

  const filtered = useMemo(() => weeks.filter((e) => {
    const ws = parseLocalDate(e.weekStart);
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    return isWithinInterval(ws, filterRange) || isWithinInterval(we, filterRange);
  }), [weeks, filterRange]);

  // Auto-calculate scheduled/showed per week from Google Calendar
  const noshowIds = useMemo(() => new Set(noshowList.map((n) => n.eventId)), [noshowList]);
  const allSalesMeetings = useMemo(() => calendarEvents.filter((e) => isSalesMeeting(e)), [calendarEvents]);

  // Totals: manual data + calendar auto-data
  const t = useMemo(() => {
    const manual = filtered.reduce((a, e) => ({
      newLeads: a.newLeads + e.newLeads,
      closed: a.closed + e.closed, dealVolume: a.dealVolume + e.dealVolume,
    }), { newLeads: 0, closed: 0, dealVolume: 0 });

    const rangeMeetings = allSalesMeetings.filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d >= filterRange.start && d <= filterRange.end;
    });
    const scheduled = rangeMeetings.length;
    const noShows = rangeMeetings.filter((e) => noshowIds.has(e.id)).length;

    return { ...manual, scheduled, showed: scheduled - noShows };
  }, [filtered, allSalesMeetings, noshowIds, filterRange]);

  const getWeekCalendarStats = (ws: Date) => {
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const weekMeetings = allSalesMeetings.filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d >= ws && d <= we;
    });
    const scheduled = weekMeetings.length;
    const noShows = weekMeetings.filter((e) => noshowIds.has(e.id)).length;
    return { scheduled, showed: scheduled - noShows, noShows };
  };

  const monthlyGoal = appSettings.salesGoalMonthly;
  const goalConfig = useMemo(() => {
    if (filterMode === "week") return { goal: Math.round(monthlyGoal / 4.33), label: "Wochenziel" };
    if (filterMode === "month") return { goal: monthlyGoal, label: "Monatsziel" };
    return { goal: monthlyGoal * 12, label: "Jahresziel" };
  }, [filterMode, monthlyGoal]);
  const goalPct = goalConfig.goal > 0 ? Math.min(Math.round((t.dealVolume / goalConfig.goal) * 100), 100) : 0;

  const handleAdd = async () => {
    if (!selectedDate) { toast.error("Bitte Woche auswählen"); return; }
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    await addSalesWeek({
      weekStart: format(ws, "yyyy-MM-dd"), kw: getISOWeek(ws), year: getYear(ws),
      newLeads: 0,
      closed: parseInt(form.closed) || 0, dealVolume: parseFloat(form.dealVolume) || 0,
      closerEmail: form.closerEmail || null,
    });
    setForm({ closed: "", dealVolume: "", closerEmail: "" });
    setSelectedDate(undefined);
    setDialogOpen(false);
    toast.success(`KW ${getISOWeek(ws)} eingetragen`);
  };

  const openEditWeek = (week: SalesWeek) => {
    setEditingWeek(week);
    setEditForm({
      newLeads: week.newLeads.toString(),
      closed: week.closed.toString(),
      dealVolume: week.dealVolume.toString(),
      closerEmail: week.closerEmail || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditWeek = async () => {
    if (!editingWeek) return;
    await updateSalesWeek(editingWeek.id, {
      newLeads: parseInt(editForm.newLeads) || 0,
      closed: parseInt(editForm.closed) || 0,
      dealVolume: parseFloat(editForm.dealVolume) || 0,
      closerEmail: editForm.closerEmail || null,
    });
    setEditDialogOpen(false);
    setEditingWeek(null);
    toast.success(`KW ${editingWeek.kw} aktualisiert`);
  };

  // Funnel values for display
  const funnelValues = useMemo(() => [t.newLeads, t.scheduled, t.showed, t.closed], [t]);

  // Current week for highlighting
  const currentKW = getISOWeek(now);
  const currentYear = getYear(now);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Neue Leads, Terminiert, Show-up & Deals tracken.</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="shadow-md hover:shadow-lg transition-shadow">
          <Plus className="mr-2 h-4 w-4" />Woche eintragen
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between rounded-xl border bg-card/80 backdrop-blur-sm p-2 shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFilterOffset(filterOffset - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={filterMode} onValueChange={(v) => { if (v) { setFilterMode(v as FilterMode); setFilterOffset(0); } }} size="sm">
            <ToggleGroupItem value="week">Woche</ToggleGroupItem>
            <ToggleGroupItem value="month">Monat</ToggleGroupItem>
            <ToggleGroupItem value="year">Jahr</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-sm font-medium">{filterLabel}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFilterOffset(filterOffset + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Goal Ring */}
      <Card className={cn(
        "overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl",
        goalPct >= 100
          ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/30"
          : "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/15"
      )}>
        <CardContent className="p-8">
          <div className="flex items-center gap-8">
            <div className="relative h-32 w-32 shrink-0">
              <svg className="h-32 w-32 -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="5" className="stroke-muted/30" />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" strokeLinecap="round"
                  className={goalPct >= 100 ? "stroke-emerald-500" : "stroke-primary"}
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - goalPct / 100)}`}
                  style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)", filter: goalPct >= 100 ? "drop-shadow(0 0 6px rgba(16,185,129,0.5))" : "drop-shadow(0 0 6px rgba(var(--primary),0.3))" }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black tracking-tight">{goalPct}%</span>
              </span>
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{goalConfig.label} · {filterLabel}</p>
              <p className="text-4xl font-black tracking-tight">{fmt(t.dealVolume)}</p>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-muted/40 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-700 ease-out", goalPct >= 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-primary to-primary/70")} style={{ width: `${goalPct}%` }} />
                </div>
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{fmt(goalConfig.goal)}</span>
              </div>
              {goalPct >= 100
                ? <p className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">{"🔥"} Ziel erreicht! {"✨"}</p>
                : <p className="text-sm text-muted-foreground">Noch <span className="font-semibold text-foreground">{fmt(goalConfig.goal - t.dealVolume)}</span> bis zum Ziel</p>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Neue Leads */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent ring-1 ring-blue-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Neue Leads</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-blue-500/15 flex items-center justify-center shadow-sm">
              <UserPlus className="h-4.5 w-4.5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">{closeLoading ? "..." : closeLeads}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />aus Close CRM
            </p>
          </CardContent>
        </Card>

        {/* Terminiert */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent ring-1 ring-amber-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Terminiert</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center shadow-sm">
              <Handshake className="h-4.5 w-4.5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">{t.scheduled}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-amber-500/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500" style={{ width: `${pct(t.scheduled, t.newLeads)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{pct(t.scheduled, t.newLeads)}% Termin-Rate</p>
          </CardContent>
        </Card>

        {/* Show-up Rate */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent ring-1 ring-cyan-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show-up Rate</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-cyan-500/15 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-4.5 w-4.5 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-cyan-600 dark:text-cyan-400">{pct(t.showed, t.scheduled)}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-cyan-500/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500" style={{ width: `${pct(t.showed, t.scheduled)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{t.showed} von {t.scheduled} erschienen</p>
          </CardContent>
        </Card>

        {/* Close Rate */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent ring-1 ring-purple-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Close Rate</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-purple-500/15 flex items-center justify-center shadow-sm">
              <Target className="h-4.5 w-4.5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-purple-600 dark:text-purple-400">{pct(t.closed, t.showed)}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-purple-500/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500" style={{ width: `${pct(t.closed, t.showed)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{t.closed} von {t.showed} abgeschlossen</p>
          </CardContent>
        </Card>

        {/* Deals */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deals</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shadow-sm">
              <DollarSign className="h-4.5 w-4.5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{t.closed}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{fmt(t.dealVolume)} Volumen</p>
            <p className="text-[10px] text-muted-foreground font-medium">{"\u00D8"} {t.closed > 0 ? fmt(t.dealVolume / t.closed) : "\u2013"} / Deal</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Table */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="pb-0 px-6 pt-6">
          <CardTitle className="text-base font-semibold">Wochenübersicht</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold pl-6">KW</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Zeitraum</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Leads</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Terminiert</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Erschienen</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Show-up</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Deals</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider font-semibold">Close</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold pr-4">Volumen</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filtered].sort((a, b) => a.year !== b.year ? a.year - b.year : a.kw - b.kw).map((e, idx) => {
                const calStats = getWeekCalendarStats(parseLocalDate(e.weekStart));
                const isCurrentWeek = e.kw === currentKW && e.year === currentYear;
                return (
                  <TableRow
                    key={e.id}
                    className={cn(
                      "transition-colors duration-150 hover:bg-muted/20",
                      idx % 2 === 1 ? "bg-muted/[0.06]" : "",
                      isCurrentWeek && "bg-primary/[0.06] hover:bg-primary/[0.1] ring-1 ring-inset ring-primary/10"
                    )}
                  >
                    <TableCell className="font-bold pl-6">
                      <span className={cn("inline-flex items-center gap-1.5", isCurrentWeek && "text-primary")}>
                        KW {e.kw}
                        {isCurrentWeek && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getWeekLabel(parseLocalDate(e.weekStart))}</TableCell>
                    <TableCell className="text-center font-medium">{e.newLeads}</TableCell>
                    <TableCell className="text-center font-medium">{calStats.scheduled} <span className="text-[9px] text-muted-foreground">(auto)</span></TableCell>
                    <TableCell className="text-center">{calStats.showed}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={calStats.scheduled > 0 && pct(calStats.showed, calStats.scheduled) >= appSettings.salesGoalShowUpRate ? "default" : calStats.scheduled === 0 ? "secondary" : "destructive"}
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 shadow-sm",
                          calStats.scheduled > 0 && pct(calStats.showed, calStats.scheduled) >= appSettings.salesGoalShowUpRate ? "bg-emerald-500 shadow-emerald-500/20" : ""
                        )}
                      >
                        {calStats.scheduled > 0 ? `${pct(calStats.showed, calStats.scheduled)}%` : "\u2013"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">{e.closed}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={calStats.showed > 0 && pct(e.closed, calStats.showed) >= appSettings.salesGoalCloseRate ? "default" : calStats.showed === 0 ? "secondary" : "destructive"}
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 shadow-sm",
                          calStats.showed > 0 && pct(e.closed, calStats.showed) >= appSettings.salesGoalCloseRate ? "bg-emerald-500 shadow-emerald-500/20" : ""
                        )}
                      >
                        {calStats.showed > 0 ? `${pct(e.closed, calStats.showed)}%` : "\u2013"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums pr-4">{fmt(e.dealVolume)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors" onClick={() => openEditWeek(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors" onClick={() => deleteSalesWeek(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Keine Einträge für diesen Zeitraum.</TableCell></TableRow>
              )}
              {/* Summary */}
              {filtered.length > 0 && (
                <TableRow className="bg-muted/50 border-t-2 font-semibold hover:bg-muted/50">
                  <TableCell colSpan={2} className="pl-6">Gesamt</TableCell>
                  <TableCell className="text-center">{t.newLeads}</TableCell>
                  <TableCell className="text-center">{t.scheduled}</TableCell>
                  <TableCell className="text-center">{t.showed}</TableCell>
                  <TableCell className="text-center"><Badge className="bg-primary shadow-sm shadow-primary/20 text-[10px] font-semibold px-2 py-0.5">{pct(t.showed, t.scheduled)}%</Badge></TableCell>
                  <TableCell className="text-center text-emerald-600 dark:text-emerald-400">{t.closed}</TableCell>
                  <TableCell className="text-center"><Badge className="bg-primary shadow-sm shadow-primary/20 text-[10px] font-semibold px-2 py-0.5">{pct(t.closed, t.showed)}%</Badge></TableCell>
                  <TableCell className="text-right pr-4">{fmt(t.dealVolume)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Woche eintragen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Woche auswählen</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? `KW ${getISOWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }))} · ${getWeekLabel(selectedDate)}` : "Woche wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="p-3 pointer-events-auto" locale={de} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="rounded-lg border-2 border-dashed p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manuelle Daten</div>
              <p className="text-[10px] text-muted-foreground -mt-1">Terminiert & Erschienen werden automatisch aus dem Google Calendar berechnet.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                </div>
                <div className="space-y-1">
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Deals</Label>
                  <Input type="number" min="0" placeholder="4" value={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volumen (€)</Label>
                  <Input type="number" min="0" step="100" placeholder="15000" value={form.dealVolume} onChange={(e) => setForm({ ...form, dealVolume: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Closer (für Provision)</Label>
                <Select
                  value={form.closerEmail || "__none"}
                  onValueChange={(v) => setForm({ ...form, closerEmail: v === "__none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Optional — wer hat geclosed?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">– keiner –</SelectItem>
                    {teamMembers.filter((m) => m.status === "active").map((m) => (
                      <SelectItem key={m.id} value={m.email}>
                        {m.name} ({m.commissionRate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAdd}>Eintragen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Week Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWeek ? `KW ${editingWeek.kw} bearbeiten` : "Woche bearbeiten"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingWeek && (
              <div className="text-sm text-muted-foreground">
                {getWeekLabel(parseLocalDate(editingWeek.weekStart))}
              </div>
            )}

            <div className="rounded-lg border-2 border-dashed p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manuelle Daten</div>
              <p className="text-[10px] text-muted-foreground -mt-1">Terminiert & Erschienen werden automatisch aus dem Google Calendar berechnet.</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Neue Leads</Label>
                  <Input type="number" min="0" placeholder="0" value={editForm.newLeads} onChange={(e) => setEditForm({ ...editForm, newLeads: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deals</Label>
                  <Input type="number" min="0" placeholder="0" value={editForm.closed} onChange={(e) => setEditForm({ ...editForm, closed: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volumen (€)</Label>
                  <Input type="number" min="0" step="100" placeholder="0" value={editForm.dealVolume} onChange={(e) => setEditForm({ ...editForm, dealVolume: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Closer (für Provision)</Label>
                <Select
                  value={editForm.closerEmail || "__none"}
                  onValueChange={(v) => setEditForm({ ...editForm, closerEmail: v === "__none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">– keiner –</SelectItem>
                    {teamMembers.filter((m) => m.status === "active").map((m) => (
                      <SelectItem key={m.id} value={m.email}>
                        {m.name} ({m.commissionRate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleEditWeek}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp, Trash2, Target, Calendar, ChevronLeft, ChevronRight, ArrowRight, UserPlus, PhoneCall, PhoneForwarded, Handshake, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, isWithinInterval, startOfMonth, endOfMonth, addMonths, addYears } from "date-fns";
import { de } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { useAllCalendarEvents } from "@/store/calendar";
import { useNoShows } from "@/store/noshows";
import { isSalesMeeting } from "@/lib/sales-meetings";

type SalesWeek = {
  id: string;
  weekStart: Date;
  kw: number;
  year: number;
  newLeads: number;   // Neue Leads (angerufen/angeschrieben)
  reached: number;     // Erreicht
  scheduled: number;   // Terminiert auf Closing
  showed: number;      // Zum Closing erschienen
  closed: number;      // Deal abgeschlossen
  dealVolume: number;
};

function fmt(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function getWeekLabel(date: Date) {
  const ws = startOfWeek(date, { weekStartsOn: 1 });
  const we = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(ws, "dd.MM.", { locale: de })} – ${format(we, "dd.MM.yyyy", { locale: de })}`;
}

const now = new Date();

const initialWeeks: SalesWeek[] = [];

type FilterMode = "week" | "month" | "year";

const funnelSteps = [
  { key: "newLeads", label: "Neue Leads", icon: UserPlus, color: "bg-blue-500" },
  { key: "reached", label: "Erreicht", icon: PhoneCall, color: "bg-violet-500" },
  { key: "scheduled", label: "Terminiert", icon: PhoneForwarded, color: "bg-amber-500" },
  { key: "showed", label: "Erschienen", icon: Handshake, color: "bg-cyan-500" },
  { key: "closed", label: "Deal", icon: DollarSign, color: "bg-emerald-500" },
];

export default function Sales() {
  const [appSettings] = useSettings();
  const [weeks, setWeeks] = useState<SalesWeek[]>(initialWeeks);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [form, setForm] = useState({ newLeads: "", reached: "", scheduled: "", showed: "", closed: "", dealVolume: "" });
  const calendarEvents = useAllCalendarEvents();
  const noshowList = useNoShows();
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [filterOffset, setFilterOffset] = useState(0);

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

  const filtered = useMemo(() => weeks.filter((e) => {
    const we = endOfWeek(e.weekStart, { weekStartsOn: 1 });
    return isWithinInterval(e.weekStart, filterRange) || isWithinInterval(we, filterRange);
  }), [weeks, filterRange]);

  const t = filtered.reduce((a, e) => ({
    newLeads: a.newLeads + e.newLeads, reached: a.reached + e.reached, scheduled: a.scheduled + e.scheduled,
    showed: a.showed + e.showed, closed: a.closed + e.closed, dealVolume: a.dealVolume + e.dealVolume,
  }), { newLeads: 0, reached: 0, scheduled: 0, showed: 0, closed: 0, dealVolume: 0 });

  // Auto-calculate from Google Calendar sales meetings
  const calendarSalesStats = useMemo(() => {
    // All events (including Google Calendar ones from the calendar store's allEvents won't be here,
    // but googleEvents are synced separately. We check all calendarEvents + detect sales meetings)
    // For now we work with what's in the calendar store
    const allSalesMeetings = calendarEvents.filter((e) => isSalesMeeting(e));
    const inRange = allSalesMeetings.filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d >= filterRange.start && d <= filterRange.end;
    });
    const noshowIds = new Set(noshowList.map((n) => n.eventId));
    const scheduled = inRange.length;
    const noShows = inRange.filter((e) => noshowIds.has(e.id)).length;
    const showed = scheduled - noShows;
    return { scheduled, showed, noShows };
  }, [calendarEvents, noshowList, filterRange]);

  const monthlyGoal = appSettings.salesGoalMonthly;
  const goalConfig = useMemo(() => {
    if (filterMode === "week") return { goal: Math.round(monthlyGoal / 4.33), label: "Wochenziel" };
    if (filterMode === "month") return { goal: monthlyGoal, label: "Monatsziel" };
    return { goal: monthlyGoal * 12, label: "Jahresziel" };
  }, [filterMode, monthlyGoal]);
  const goalPct = goalConfig.goal > 0 ? Math.min(Math.round((t.dealVolume / goalConfig.goal) * 100), 100) : 0;

  const handleAdd = () => {
    if (!selectedDate || !form.newLeads) { toast.error("Bitte Woche und Daten ausfüllen"); return; }
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    setWeeks((prev) => [...prev, {
      id: Date.now().toString(), weekStart: ws, kw: getISOWeek(ws), year: getYear(ws),
      newLeads: parseInt(form.newLeads) || 0, reached: parseInt(form.reached) || 0,
      scheduled: parseInt(form.scheduled) || 0, showed: parseInt(form.showed) || 0,
      closed: parseInt(form.closed) || 0, dealVolume: parseFloat(form.dealVolume) || 0,
    }]);
    setForm({ newLeads: "", reached: "", scheduled: "", showed: "", closed: "", dealVolume: "" });
    setSelectedDate(undefined);
    setDialogOpen(false);
    toast.success(`KW ${getISOWeek(ws)} eingetragen`);
  };

  // Funnel values for display
  const funnelValues = [t.newLeads, t.reached, t.scheduled, t.showed, t.closed];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Neue Leads, Erreicht, Terminiert, Show-up & Deals tracken.</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Woche eintragen
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-2">
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
        "overflow-hidden border-0 shadow-lg",
        goalPct >= 100 ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/20" : "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent ring-1 ring-primary/10"
      )}>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative h-28 w-28 shrink-0">
              <svg className="h-28 w-28 -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-muted/40" />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" strokeLinecap="round"
                  className={goalPct >= 100 ? "stroke-emerald-500" : "stroke-primary"}
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - goalPct / 100)}`}
                  style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight">{goalPct}%</span>
              </span>
            </div>
            <div className="space-y-1.5 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{goalConfig.label} · {filterLabel}</p>
              <p className="text-3xl font-bold tracking-tight">{fmt(t.dealVolume)}</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-muted/50">
                  <div className={cn("h-full rounded-full transition-all duration-500", goalPct >= 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${goalPct}%` }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{fmt(goalConfig.goal)}</span>
              </div>
              {goalPct >= 100
                ? <p className="text-sm font-semibold text-emerald-600">Ziel erreicht!</p>
                : <p className="text-sm text-muted-foreground">Noch <span className="font-medium text-foreground">{fmt(goalConfig.goal - t.dealVolume)}</span> bis zum Ziel</p>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Sales Stats */}
      {calendarSalesStats.scheduled > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sales Meetings aus Google Calendar</span>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-2xl font-bold">{calendarSalesStats.scheduled}</div>
                <div className="text-[10px] text-muted-foreground">Terminiert</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{calendarSalesStats.showed}</div>
                <div className="text-[10px] text-muted-foreground">Erschienen</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${calendarSalesStats.noShows > 0 ? "text-red-500" : ""}`}>{calendarSalesStats.noShows}</div>
                <div className="text-[10px] text-muted-foreground">No Shows</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-lg font-bold">{calendarSalesStats.scheduled > 0 ? pct(calendarSalesStats.showed, calendarSalesStats.scheduled) : 0}%</div>
                <div className="text-[10px] text-muted-foreground">Show-up Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Neue Leads</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{t.newLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Erreicht</CardTitle>
            <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t.reached}</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(t.reached, t.newLeads)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{pct(t.reached, t.newLeads)}% Erreicht-Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terminiert</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t.scheduled}</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(t.scheduled, t.reached)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{pct(t.scheduled, t.reached)}% Termin-Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Show-up Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(t.showed, t.scheduled)}%</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct(t.showed, t.scheduled)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t.showed} von {t.scheduled} erschienen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Close Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(t.closed, t.showed)}%</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct(t.closed, t.showed)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t.closed} von {t.showed} abgeschlossen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deals</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{t.closed}</div>
            <p className="text-xs text-muted-foreground mt-1">{fmt(t.dealVolume)} Volumen</p>
            <p className="text-xs text-muted-foreground">Ø {t.closed > 0 ? fmt(t.dealVolume / t.closed) : "–"} / Deal</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Wochenübersicht</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider">KW</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Zeitraum</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Leads</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Erreicht</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Terminiert</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Erschienen</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Show-up</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Deals</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Close</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Volumen</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filtered].sort((a, b) => a.year !== b.year ? a.year - b.year : a.kw - b.kw).map((e, idx) => (
                <TableRow key={e.id} className={idx % 2 === 1 ? "bg-muted/[0.03]" : ""}>
                  <TableCell className="font-bold">KW {e.kw}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getWeekLabel(e.weekStart)}</TableCell>
                  <TableCell className="text-center font-medium">{e.newLeads}</TableCell>
                  <TableCell className="text-center">{e.reached} <span className="text-[9px] text-muted-foreground">({pct(e.reached, e.newLeads)}%)</span></TableCell>
                  <TableCell className="text-center">{e.scheduled} <span className="text-[9px] text-muted-foreground">({pct(e.scheduled, e.reached)}%)</span></TableCell>
                  <TableCell className="text-center">{e.showed}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={pct(e.showed, e.scheduled) >= appSettings.salesGoalShowUpRate ? "default" : "destructive"} className={pct(e.showed, e.scheduled) >= appSettings.salesGoalShowUpRate ? "bg-emerald-500" : ""}>
                      {pct(e.showed, e.scheduled)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">{e.closed}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={pct(e.closed, e.showed) >= appSettings.salesGoalCloseRate ? "default" : "destructive"} className={pct(e.closed, e.showed) >= appSettings.salesGoalCloseRate ? "bg-emerald-500" : ""}>
                      {pct(e.closed, e.showed)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(e.dealVolume)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setWeeks((prev) => prev.filter((x) => x.id !== e.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Keine Einträge für diesen Zeitraum.</TableCell></TableRow>
              )}
              {/* Summary */}
              {filtered.length > 0 && (
                <TableRow className="bg-muted/40 border-t-2 font-semibold">
                  <TableCell colSpan={2}>Gesamt</TableCell>
                  <TableCell className="text-center">{t.newLeads}</TableCell>
                  <TableCell className="text-center">{t.reached}</TableCell>
                  <TableCell className="text-center">{t.scheduled}</TableCell>
                  <TableCell className="text-center">{t.showed}</TableCell>
                  <TableCell className="text-center"><Badge className="bg-primary">{pct(t.showed, t.scheduled)}%</Badge></TableCell>
                  <TableCell className="text-center text-emerald-600 dark:text-emerald-400">{t.closed}</TableCell>
                  <TableCell className="text-center"><Badge className="bg-primary">{pct(t.closed, t.showed)}%</Badge></TableCell>
                  <TableCell className="text-right">{fmt(t.dealVolume)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
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
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funnel-Daten</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Neue Leads</Label>
                  <Input type="number" min="0" placeholder="30" value={form.newLeads} onChange={(e) => setForm({ ...form, newLeads: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Erreicht</Label>
                  <Input type="number" min="0" placeholder="20" value={form.reached} onChange={(e) => setForm({ ...form, reached: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Terminiert</Label>
                  <Input type="number" min="0" placeholder="11" value={form.scheduled} onChange={(e) => setForm({ ...form, scheduled: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Erschienen</Label>
                  <Input type="number" min="0" placeholder="9" value={form.showed} onChange={(e) => setForm({ ...form, showed: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deals</Label>
                  <Input type="number" min="0" placeholder="4" value={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Volumen (€)</Label>
                  <Input type="number" min="0" step="100" placeholder="15000" value={form.dealVolume} onChange={(e) => setForm({ ...form, dealVolume: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAdd}>Eintragen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

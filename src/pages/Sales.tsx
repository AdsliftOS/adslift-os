import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp, CalendarCheck, Users, DollarSign, Trash2, Target, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, startOfYear, addWeeks, isWithinInterval, startOfMonth, endOfMonth, addMonths, addYears } from "date-fns";
import { de } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type SalesEntry = {
  id: string;
  weekStart: Date;
  kw: number;
  year: number;
  scheduled: number;
  held: number;
  closed: number;
  dealVolume: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function calcShowUpRate(scheduled: number, held: number) {
  if (scheduled === 0) return 0;
  return Math.round((held / scheduled) * 100);
}

function calcCloseRate(held: number, closed: number) {
  if (held === 0) return 0;
  return Math.round((closed / held) * 100);
}

function getWeekLabel(date: Date) {
  const ws = startOfWeek(date, { weekStartsOn: 1 });
  const we = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(ws, "dd.MM.", { locale: de })} – ${format(we, "dd.MM.yyyy", { locale: de })}`;
}

const now = new Date();

const initialEntries: SalesEntry[] = [
  (() => {
    const ws = startOfWeek(addWeeks(now, -2), { weekStartsOn: 1 });
    return { id: "1", weekStart: ws, kw: getISOWeek(ws), year: getYear(ws), scheduled: 12, held: 9, closed: 3, dealVolume: 18000 };
  })(),
  (() => {
    const ws = startOfWeek(addWeeks(now, -1), { weekStartsOn: 1 });
    return { id: "2", weekStart: ws, kw: getISOWeek(ws), year: getYear(ws), scheduled: 15, held: 11, closed: 4, dealVolume: 24000 };
  })(),
  (() => {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return { id: "3", weekStart: ws, kw: getISOWeek(ws), year: getYear(ws), scheduled: 10, held: 8, closed: 3, dealVolume: 21000 };
  })(),
];

type FilterMode = "week" | "month" | "year";

export default function Sales() {
  const [entries, setEntries] = useState<SalesEntry[]>(initialEntries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [form, setForm] = useState({ scheduled: "", held: "", closed: "", dealVolume: "" });
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [filterOffset, setFilterOffset] = useState(0);

  const filterRange = useMemo(() => {
    const base = new Date();
    if (filterMode === "week") {
      const ref = addWeeks(base, filterOffset);
      return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
    } else if (filterMode === "month") {
      const ref = addMonths(base, filterOffset);
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    } else {
      const ref = addYears(base, filterOffset);
      return { start: new Date(ref.getFullYear(), 0, 1), end: new Date(ref.getFullYear(), 11, 31) };
    }
  }, [filterMode, filterOffset]);

  const filterLabel = useMemo(() => {
    if (filterMode === "week") {
      return `KW ${getISOWeek(filterRange.start)} · ${format(filterRange.start, "dd.MM.", { locale: de })} – ${format(filterRange.end, "dd.MM.yyyy", { locale: de })}`;
    } else if (filterMode === "month") {
      return format(filterRange.start, "MMMM yyyy", { locale: de });
    } else {
      return filterRange.start.getFullYear().toString();
    }
  }, [filterMode, filterRange]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const we = endOfWeek(e.weekStart, { weekStartsOn: 1 });
      return isWithinInterval(e.weekStart, filterRange) || isWithinInterval(we, filterRange);
    });
  }, [entries, filterRange]);

  const totals = filteredEntries.reduce(
    (acc, e) => ({
      scheduled: acc.scheduled + e.scheduled,
      held: acc.held + e.held,
      closed: acc.closed + e.closed,
      dealVolume: acc.dealVolume + e.dealVolume,
    }),
    { scheduled: 0, held: 0, closed: 0, dealVolume: 0 }
  );

  const overallShowUp = calcShowUpRate(totals.scheduled, totals.held);
  const overallCloseRate = calcCloseRate(totals.held, totals.closed);

  // Monthly goal based on current month
  const MONTHLY_GOAL = 50000;
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const currentMonthVolume = entries
    .filter((e) => {
      const we = endOfWeek(e.weekStart, { weekStartsOn: 1 });
      return isWithinInterval(e.weekStart, { start: currentMonthStart, end: currentMonthEnd }) ||
             isWithinInterval(we, { start: currentMonthStart, end: currentMonthEnd });
    })
    .reduce((s, e) => s + e.dealVolume, 0);
  const goalPercent = Math.min(Math.round((currentMonthVolume / MONTHLY_GOAL) * 100), 100);
  const goalReached = currentMonthVolume >= MONTHLY_GOAL;
  const currentMonthName = format(now, "MMMM", { locale: de });

  const handleAdd = () => {
    if (!selectedDate || !form.scheduled || !form.held || !form.closed || !form.dealVolume) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const entry: SalesEntry = {
      id: Date.now().toString(),
      weekStart: ws,
      kw: getISOWeek(ws),
      year: getYear(ws),
      scheduled: parseInt(form.scheduled),
      held: parseInt(form.held),
      closed: parseInt(form.closed),
      dealVolume: parseFloat(form.dealVolume),
    };
    setEntries([...entries, entry]);
    setForm({ scheduled: "", held: "", closed: "", dealVolume: "" });
    setSelectedDate(undefined);
    setDialogOpen(false);
    toast.success(`KW ${entry.kw} hinzugefügt`);
  };

  const handleDelete = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
    toast.success("Eintrag gelöscht");
  };

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.kw - b.kw;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Tracker</h1>
          <p className="text-sm text-muted-foreground">Wöchentliches Check-in: Meetings, Show-up Rate & Dealvolumen.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Woche eintragen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Wochen-Check-in</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Woche auswählen</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedDate
                        ? `KW ${getISOWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }))} · ${getWeekLabel(selectedDate)}`
                        : "Woche wählen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={de}
                    />
                  </PopoverContent>
                </Popover>
                {selectedDate && (
                  <p className="text-xs text-muted-foreground">
                    KW {getISOWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }))} · {getWeekLabel(selectedDate)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Terminiert</Label>
                  <Input type="number" min="0" placeholder="z.B. 12" value={form.scheduled} onChange={(e) => setForm({ ...form, scheduled: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Stattgefunden</Label>
                  <Input type="number" min="0" placeholder="z.B. 10" value={form.held} onChange={(e) => setForm({ ...form, held: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Abgeschlossen</Label>
                  <Input type="number" min="0" placeholder="z.B. 3" value={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Dealvolumen (€)</Label>
                  <Input type="number" min="0" step="100" placeholder="z.B. 15000" value={form.dealVolume} onChange={(e) => setForm({ ...form, dealVolume: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAdd}>Hinzufügen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFilterOffset(filterOffset - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={filterMode}
            onValueChange={(v) => { if (v) { setFilterMode(v as FilterMode); setFilterOffset(0); } }}
            size="sm"
          >
            <ToggleGroupItem value="week">Woche</ToggleGroupItem>
            <ToggleGroupItem value="month">Monat</ToggleGroupItem>
            <ToggleGroupItem value="year">Jahr</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-sm font-medium">{filterLabel}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFilterOffset(filterOffset + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card className={goalReached ? "border-success" : ""}>
        <CardContent className="p-5">
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-muted" />
                <circle
                  cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                  strokeLinecap="round"
                  className={goalReached ? "stroke-success" : "stroke-primary"}
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - goalPercent / 100)}`}
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                {goalPercent}%
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Monatsziel {currentMonthName}</p>
              <p className="text-2xl font-bold">{formatCurrency(currentMonthVolume)} <span className="text-base font-normal text-muted-foreground">/ {formatCurrency(MONTHLY_GOAL)}</span></p>
              {goalReached ? (
                <p className="text-sm font-medium text-success">🎉 Ziel erreicht!</p>
              ) : (
                <p className="text-sm text-muted-foreground">Noch {formatCurrency(MONTHLY_GOAL - currentMonthVolume)} bis zum Ziel</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terminiert</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.scheduled}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stattgefunden</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.held}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Show-up Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallShowUp}%</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallShowUp}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Close Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallCloseRate}%</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${overallCloseRate}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dealvolumen</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.dealVolume)}</div></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wochenübersicht</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KW</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead className="text-center">Terminiert</TableHead>
                <TableHead className="text-center">Stattgefunden</TableHead>
                <TableHead className="text-center">Show-up</TableHead>
                <TableHead className="text-center">Abgeschlossen</TableHead>
                <TableHead className="text-center">Close Rate</TableHead>
                <TableHead className="text-right">Dealvolumen</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((e) => {
                const showUp = calcShowUpRate(e.scheduled, e.held);
                const closeRate = calcCloseRate(e.held, e.closed);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-bold">KW {e.kw}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{getWeekLabel(e.weekStart)}</TableCell>
                    <TableCell className="text-center">{e.scheduled}</TableCell>
                    <TableCell className="text-center">{e.held}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={showUp >= 80 ? "default" : showUp >= 60 ? "secondary" : "destructive"}>
                        {showUp}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{e.closed}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={closeRate >= 30 ? "default" : closeRate >= 20 ? "secondary" : "destructive"}>
                        {closeRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(e.dealVolume)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

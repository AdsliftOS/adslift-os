import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  PhoneCall,
  Clock,
  CalendarCheck,
  Trophy,
  DollarSign,
  Mail,
  Plus,
  Trash2,
  Check,
  Phone,
  RefreshCw,
  CreditCard,
  ListTodo,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  isToday,
  isPast,
  isThisWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useTeamMembers, getMemberByEmail } from "@/store/teamMembers";
import {
  useEmployeeTodos,
  addEmployeeTodo,
  updateEmployeeTodo,
  deleteEmployeeTodo,
  type EmployeeTodoType,
} from "@/store/employeeTodos";
import { getUserKPIs, formatDuration, type UserKPIs } from "@/lib/close-user-kpis";
import { useSettings } from "@/store/settings";
import { useSalesWeeks } from "@/store/sales";
import { Eyebrow, KpiNumber, ProgressRing } from "@/components/ui/kpi";
import { cn } from "@/lib/utils";

type FilterMode = "week" | "month";

const todoTypes: { value: EmployeeTodoType; label: string; icon: typeof Phone; color: string }[] = [
  { value: "call", label: "Anruf", icon: Phone, color: "text-blue-500" },
  { value: "followup", label: "Follow-Up", icon: RefreshCw, color: "text-amber-500" },
  { value: "payment_reminder", label: "Zahlungserinnerung", icon: CreditCard, color: "text-rose-500" },
  { value: "other", label: "Sonstiges", icon: ListTodo, color: "text-muted-foreground" },
];

const todoTypeMap = Object.fromEntries(todoTypes.map((t) => [t.value, t]));

function fmtEUR(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtEURFull(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MyArea() {
  const [appSettings] = useSettings();
  const team = useTeamMembers();
  const [salesWeeks] = useSalesWeeks();
  const [userEmail, setUserEmail] = useState<string>("");
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [filterOffset, setFilterOffset] = useState(0);
  const [kpis, setKpis] = useState<UserKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  // Detect logged-in user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email || "");
    });
  }, []);

  const me = useMemo(() => getMemberByEmail(userEmail), [userEmail, team]);
  const myTodos = useEmployeeTodos(userEmail);

  const filterRange = useMemo(() => {
    const base = new Date();
    if (filterMode === "week") {
      const ref = addWeeks(base, filterOffset);
      return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
    }
    const ref = addMonths(base, filterOffset);
    return { start: startOfMonth(ref), end: endOfMonth(ref) };
  }, [filterMode, filterOffset]);

  const filterLabel = useMemo(() => {
    if (filterMode === "week") {
      return `${format(filterRange.start, "dd.MM.", { locale: de })} – ${format(filterRange.end, "dd.MM.yyyy", { locale: de })}`;
    }
    return format(filterRange.start, "MMMM yyyy", { locale: de });
  }, [filterMode, filterRange]);

  // Load KPIs from Close
  useEffect(() => {
    if (!me?.closeUserId) {
      setKpis(null);
      return;
    }
    setKpisLoading(true);
    const dateFrom = format(filterRange.start, "yyyy-MM-dd");
    const dateTo = format(filterRange.end, "yyyy-MM-dd");
    getUserKPIs(me.closeUserId, dateFrom, dateTo)
      .then(setKpis)
      .finally(() => setKpisLoading(false));
  }, [me?.closeUserId, filterRange]);

  // Provision calculation: from sales_weeks where this user is the closer
  const myCommission = useMemo(() => {
    if (!me) return { volume: 0, commission: 0, deals: 0 };
    const inRange = salesWeeks.filter((w) => {
      const ws = new Date(w.weekStart);
      return ws >= filterRange.start && ws <= filterRange.end;
    });
    const mine = inRange.filter((w: any) => (w.closerEmail || "").toLowerCase() === me.email.toLowerCase());
    const volume = mine.reduce((s, w) => s + (w.dealVolume || 0), 0);
    const deals = mine.reduce((s, w) => s + (w.closed || 0), 0);
    return {
      volume,
      commission: Math.round(volume * (me.commissionRate / 100)),
      deals,
    };
  }, [me, salesWeeks, filterRange]);

  // Goals (from app settings, prorated by filter mode)
  const callsTarget = filterMode === "week"
    ? appSettings.salesGoalScheduledWeekly
    : Math.round(appSettings.salesGoalScheduledWeekly * 4.33);
  const revenueTarget = filterMode === "week"
    ? Math.round(appSettings.salesGoalMonthly / 4.33)
    : appSettings.salesGoalMonthly;

  // ToDo state
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [todoForm, setTodoForm] = useState({
    title: "",
    description: "",
    type: "call" as EmployeeTodoType,
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueTime: "",
    leadName: "",
    phone: "",
  });

  const resetTodoForm = () => {
    setTodoForm({
      title: "",
      description: "",
      type: "call",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      dueTime: "",
      leadName: "",
      phone: "",
    });
  };

  const handleAddTodo = async () => {
    if (!userEmail || !todoForm.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    await addEmployeeTodo({
      userEmail,
      title: todoForm.title.trim(),
      description: todoForm.description.trim(),
      type: todoForm.type,
      dueDate: todoForm.dueDate || null,
      dueTime: todoForm.dueTime || null,
      leadName: todoForm.leadName.trim() || null,
      leadCloseId: null,
      phone: todoForm.phone.trim() || null,
      done: false,
    });
    setTodoDialogOpen(false);
    resetTodoForm();
    toast.success("ToDo hinzugefügt");
  };

  const openTodos = myTodos.filter((t) => !t.done);
  const doneTodos = myTodos.filter((t) => t.done).slice(0, 20);
  const overdueCount = openTodos.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)),
  ).length;
  const todayCount = openTodos.filter((t) => t.dueDate && isToday(new Date(t.dueDate))).length;

  // Goals — call progress
  const callPct = Math.min(100, (kpis?.callCount || 0) / Math.max(1, callsTarget) * 100);
  const showRate = kpis && kpis.meetingsScheduled > 0
    ? Math.round((kpis.meetingsCompleted / kpis.meetingsScheduled) * 100)
    : 0;

  // -------------------------------------------------------------------
  // Renderers
  // -------------------------------------------------------------------

  if (!userEmail) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground">Lade...</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mein Bereich</h1>
          <p className="text-sm text-muted-foreground">Performance, Provision & ToDos.</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
            <div>
              <p className="font-medium">Du bist noch nicht als Team-Mitglied eingerichtet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Bitte unter <strong>Einstellungen → Team</strong> einen Eintrag mit deiner E-Mail{" "}
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{userEmail}</span> anlegen.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#4D96FF] to-[#0650C7] flex items-center justify-center text-lg font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            {me.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Hi {me.name.split(" ")[0]}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">{me.role}</Badge>
              {me.closeUserId ? (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15">
                  Close verbunden
                </Badge>
              ) : (
                <Badge className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/15">
                  Close nicht verbunden
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={filterMode}
            onValueChange={(v) => v && setFilterMode(v as FilterMode)}
            className="h-9"
          >
            <ToggleGroupItem value="week" className="text-xs px-3">Woche</ToggleGroupItem>
            <ToggleGroupItem value="month" className="text-xs px-3">Monat</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setFilterOffset((o) => o - 1)}>‹</Button>
            <span className="text-xs font-mono text-muted-foreground min-w-[140px] text-center tabular-nums">
              {filterLabel}
            </span>
            <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setFilterOffset((o) => o + 1)}>›</Button>
            {filterOffset !== 0 && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setFilterOffset(0)}>Heute</Button>
            )}
          </div>
        </div>
      </div>

      {!me.closeUserId && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Close noch nicht verbunden</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verknüpfe dein Close-Konto unter Einstellungen → Team, um KPIs zu sehen.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/settings">Verbinden</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="todos" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            ToDos
            {openTodos.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {openTodos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="provision" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Provision
          </TabsTrigger>
        </TabsList>

        {/* PERFORMANCE TAB */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          {/* Top KPI grid */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              eyebrow="Anwahlen"
              icon={PhoneCall}
              loading={kpisLoading}
            >
              <KpiNumber size="lg">{kpis?.callCount ?? 0}</KpiNumber>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2">
                <span>Out: {kpis?.outboundCalls ?? 0}</span>
                <span>In: {kpis?.inboundCalls ?? 0}</span>
              </div>
            </KpiCard>

            <KpiCard
              eyebrow="Telefon-Laufzeit"
              icon={Clock}
              loading={kpisLoading}
            >
              <KpiNumber size="lg">
                {formatDuration(kpis?.callDurationSec ?? 0)}
              </KpiNumber>
              <div className="text-[10px] text-muted-foreground mt-2">
                ø {kpis && kpis.callCount > 0 ? Math.round(kpis.callDurationSec / kpis.callCount / 60) : 0} min/Call
              </div>
            </KpiCard>

            <KpiCard
              eyebrow="Termine"
              icon={CalendarCheck}
              loading={kpisLoading}
            >
              <KpiNumber size="lg">{kpis?.meetingsScheduled ?? 0}</KpiNumber>
              <div className="text-[10px] text-muted-foreground mt-2">
                Show-Rate: {showRate}%
              </div>
            </KpiCard>

            <KpiCard
              eyebrow="Closes"
              icon={Trophy}
              loading={kpisLoading}
            >
              <KpiNumber size="lg" tone="amber">{kpis?.opportunitiesWon ?? 0}</KpiNumber>
              <div className="text-[10px] text-muted-foreground mt-2">
                Volumen: {fmtEUR(kpis?.wonValue ?? 0)}
              </div>
            </KpiCard>
          </div>

          {/* Goals + extras */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Anwahlen-Ziel ({filterMode === "week" ? "Woche" : "Monat"})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ProgressRing value={callPct} size={80} stroke={8} label={`${Math.round(callPct)}%`} />
                  <div className="flex-1 space-y-1">
                    <div className="text-2xl font-bold tabular-nums">
                      {kpis?.callCount ?? 0}
                      <span className="text-base text-muted-foreground"> / {callsTarget}</span>
                    </div>
                    <Progress value={callPct} className="h-1.5" />
                    <div className="text-[10px] text-muted-foreground">
                      {Math.max(0, callsTarget - (kpis?.callCount ?? 0))} fehlen noch
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">E-Mails versendet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <KpiNumber size="md">{kpis?.emailsSent ?? 0}</KpiNumber>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      im {filterMode === "week" ? "Wochen-" : "Monats-"}Zeitraum
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Aktive Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <KpiNumber size="md">{kpis?.opportunitiesActive ?? 0}</KpiNumber>
                    <span className="text-xs text-muted-foreground">offene Deals</span>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground tabular-nums">
                    {fmtEUR(kpis?.activeValue ?? 0)} im Pipeline-Wert
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel — show even if 0 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Funnel</CardTitle>
              <CardDescription>Aus deinen Aktivitäten in {filterLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Anwahlen", value: kpis?.callCount ?? 0, color: "bg-blue-500" },
                  { label: "Termine gelegt", value: kpis?.meetingsScheduled ?? 0, color: "bg-amber-500" },
                  { label: "Termine wahrg.", value: kpis?.meetingsCompleted ?? 0, color: "bg-cyan-500" },
                  { label: "Deals", value: kpis?.opportunitiesWon ?? 0, color: "bg-emerald-500" },
                ].map((s, i, arr) => {
                  const max = Math.max(...arr.map((a) => a.value), 1);
                  const pct = (s.value / max) * 100;
                  const fromPrev = i === 0 ? null : arr[i - 1].value > 0
                    ? Math.round((s.value / arr[i - 1].value) * 100)
                    : 0;
                  return (
                    <div key={s.label} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                        {s.label}
                      </div>
                      <div className="text-xl font-bold tabular-nums">{s.value}</div>
                      <div className="h-1 rounded bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded transition-all", s.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {fromPrev !== null && (
                        <div className="text-[10px] text-muted-foreground">
                          {fromPrev}% vom vorigen Schritt
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TODOS TAB */}
        <TabsContent value="todos" className="space-y-4 mt-4">
          {/* Stats row */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <StatPill label="Heute fällig" value={todayCount} tone="primary" />
            <StatPill label="Überfällig" value={overdueCount} tone="danger" />
            <StatPill label="Offen gesamt" value={openTodos.length} tone="muted" />
            <StatPill label="Erledigt" value={doneTodos.length} tone="success" />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Persönliche ToDos — für Anrufe, Follow-Ups, Zahlungserinnerungen.
            </p>
            <Button size="sm" onClick={() => { resetTodoForm(); setTodoDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Neu
            </Button>
          </div>

          {/* Grouped by type */}
          {todoTypes.map((type) => {
            const items = openTodos.filter((t) => t.type === type.value);
            if (items.length === 0) return null;
            const Icon = type.icon;
            return (
              <Card key={type.value}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", type.color)} />
                    <CardTitle className="text-sm">{type.label}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {items.map((t) => {
                      const overdue = t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate));
                      const today = t.dueDate && isToday(new Date(t.dueDate));
                      return (
                        <li key={t.id} className="px-4 py-3 flex items-start gap-3 group hover:bg-muted/30">
                          <button
                            onClick={() => updateEmployeeTodo(t.id, { done: true })}
                            className="mt-0.5 h-5 w-5 rounded border border-muted-foreground/40 hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                            title="Als erledigt markieren"
                          >
                            <Check className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{t.title}</p>
                              {t.leadName && (
                                <Badge variant="outline" className="text-[10px]">
                                  {t.leadName}
                                </Badge>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              {t.dueDate && (
                                <span
                                  className={cn(
                                    overdue && "text-rose-500 font-semibold",
                                    today && "text-amber-500 font-semibold",
                                  )}
                                >
                                  {today
                                    ? `Heute${t.dueTime ? ` · ${t.dueTime}` : ""}`
                                    : `${format(new Date(t.dueDate), "dd.MM.yyyy", { locale: de })}${t.dueTime ? ` · ${t.dueTime}` : ""}`}
                                  {overdue && " · überfällig"}
                                </span>
                              )}
                              {t.phone && (
                                <a href={`tel:${t.phone}`} className="hover:text-foreground inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {t.phone}
                                </a>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteEmployeeTodo(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}

          {openTodos.length === 0 && (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Keine offenen ToDos. Sauber. 🔥</p>
              </CardContent>
            </Card>
          )}

          {doneTodos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Zuletzt erledigt</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {doneTodos.map((t) => {
                    const type = todoTypeMap[t.type];
                    const Icon = type?.icon || ListTodo;
                    return (
                      <li key={t.id} className="px-4 py-2.5 flex items-center gap-3 text-sm group">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", type?.color)} />
                        <span className="flex-1 line-through text-muted-foreground">{t.title}</span>
                        <button
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => updateEmployeeTodo(t.id, { done: false })}
                        >
                          rückgängig
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PROVISION TAB */}
        <TabsContent value="provision" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Deine Provision · {filterLabel}</CardTitle>
                <CardDescription>
                  {me.commissionRate}% von Deals, bei denen du als Closer hinterlegt bist.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Eyebrow>Deals</Eyebrow>
                    <KpiNumber size="lg" className="mt-2">{myCommission.deals}</KpiNumber>
                  </div>
                  <div>
                    <Eyebrow>Volumen</Eyebrow>
                    <KpiNumber size="lg" className="mt-2">{fmtEURFull(myCommission.volume)}</KpiNumber>
                  </div>
                  <div>
                    <Eyebrow tone="amber">Provision</Eyebrow>
                    <KpiNumber size="lg" tone="amber" className="mt-2">{fmtEURFull(myCommission.commission)}</KpiNumber>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Provision wird automatisch berechnet aus dem <strong>Sales Tracker</strong>.
                    Wenn ein Deal in einer Kalenderwoche eingetragen wird und du als Closer markiert bist, fließt das Volumen hier ein.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Provisionssatz: <strong>{me.commissionRate}%</strong> — änderbar unter Einstellungen → Team.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Aktuelle Pipeline</CardTitle>
                <CardDescription>Voraussichtliche Provision aus offenen Deals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Eyebrow>Pipeline-Wert</Eyebrow>
                  <KpiNumber size="md" className="mt-2">{fmtEUR(kpis?.activeValue ?? 0)}</KpiNumber>
                </div>
                <div>
                  <Eyebrow tone="amber">Mögliche Provision</Eyebrow>
                  <KpiNumber size="md" tone="amber" className="mt-2">
                    {fmtEUR((kpis?.activeValue ?? 0) * (me.commissionRate / 100))}
                  </KpiNumber>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Wenn alle aktiven Deals durchgehen.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New ToDo Dialog */}
      <Dialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues ToDo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Typ</Label>
              <Select
                value={todoForm.type}
                onValueChange={(v) => setTodoForm((f) => ({ ...f, type: v as EmployeeTodoType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {todoTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input
                placeholder="z.B. Max Müller anrufen"
                value={todoForm.title}
                onChange={(e) => setTodoForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Notizen</Label>
              <Textarea
                placeholder="Optional"
                value={todoForm.description}
                onChange={(e) => setTodoForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Lead Name</Label>
                <Input
                  placeholder="z.B. Max Müller"
                  value={todoForm.leadName}
                  onChange={(e) => setTodoForm((f) => ({ ...f, leadName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Telefon</Label>
                <Input
                  placeholder="+49..."
                  value={todoForm.phone}
                  onChange={(e) => setTodoForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Fällig am</Label>
                <Input
                  type="date"
                  value={todoForm.dueDate}
                  onChange={(e) => setTodoForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Uhrzeit</Label>
                <Input
                  type="time"
                  value={todoForm.dueTime}
                  onChange={(e) => setTodoForm((f) => ({ ...f, dueTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTodoDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAddTodo}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------- Small helpers --------

function KpiCard({
  eyebrow,
  icon: Icon,
  loading,
  children,
}: {
  eyebrow: string;
  icon: typeof PhoneCall;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
        {loading ? (
          <div className="h-9 w-20 bg-muted/50 rounded animate-pulse" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "danger" | "success" | "muted";
}) {
  const colors = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    danger: "border-rose-500/30 bg-rose-500/5 text-rose-500",
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    muted: "border-muted-foreground/20 bg-muted/30 text-muted-foreground",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", colors[tone])}>
      <div className="text-[9px] font-mono uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

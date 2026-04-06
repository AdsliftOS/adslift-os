import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useAllCalendarEvents } from "@/store/calendar";
import { useTasks } from "@/store/tasks";
import { useDeals } from "@/store/deals";
import {
  FolderKanban, Users, DollarSign, TrendingUp, Clock, ArrowRight, BarChart3, ArrowUpRight,
  Flag, CalendarDays, CheckCircle2, ListTodo, Video, Mail, Megaphone, CircleCheckBig,
  Inbox, Eye, MousePointerClick, Euro, Wallet, Phone, Target, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isPast } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { isSalesMeeting } from "@/lib/sales-meetings";
import { isGmailConnected, getGmailAccounts, getValidGmailToken } from "@/lib/gmail-auth";
import { getPipelineSummary, getWeightedForecast, getTodayActivities } from "@/lib/close-api-client";
import { listMessages } from "@/lib/gmail";

const emailToName: Record<string, string> = {
  "info@consulting-og.de": "Alex",
  "office@consulting-og.de": "Daniel",
};

function getMeetingPlatform(link: string) {
  if (link.includes("zoom")) return "Zoom";
  if (link.includes("meet.google")) return "Meet";
  if (link.includes("teams")) return "Teams";
  return "Meeting";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients] = useClients();
  const [projects] = useProjects();
  const calendarEvents = useAllCalendarEvents();
  const [tasks] = useTasks();
  const [deals] = useDeals();
  const [userName, setUserName] = useState("Alex");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      if (email && emailToName[email]) setUserName(emailToName[email]);
    });
  }, []);

  // Sales closed this month
  const [monthlyClosed, setMonthlyClosed] = useState(0);
  useEffect(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`;
    const nextMonth = now.getMonth() === 11 ? `${now.getFullYear() + 1}-01-01` : `${now.getFullYear()}-${(now.getMonth() + 2).toString().padStart(2, "0")}-01`;
    supabase.from("sales_weeks").select("deal_volume,week_start").gte("week_start", monthStart).lt("week_start", nextMonth).then(({ data }) => {
      if (data) setMonthlyClosed(data.reduce((s, w) => s + (w.deal_volume || 0), 0));
    });
  }, []);

  // Unread mail count
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  useEffect(() => {
    if (!isGmailConnected()) return;
    const accs = getGmailAccounts();
    if (accs.length === 0) return;
    (async () => {
      try {
        const token = await getValidGmailToken(accs[0]);
        const res = await listMessages(token, { labelIds: ["INBOX", "UNREAD"], maxResults: 1 });
        setUnreadCount(res.resultSizeEstimate || 0);
      } catch { setUnreadCount(null); }
    })();
  }, []);

  // Meta Ads summary
  const [adsSummary, setAdsSummary] = useState<{ spend: number; impressions: number; clicks: number; ctr: number } | null>(null);
  useEffect(() => {
    supabase.from("meta_campaign_insights").select("spend,impressions,clicks,ctr").then(({ data }) => {
      if (data && data.length > 0) {
        const spend = data.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
        const impressions = data.reduce((s, r) => s + parseInt(r.impressions || "0"), 0);
        const clicks = data.reduce((s, r) => s + parseInt(r.clicks || "0"), 0);
        const ctr = clicks > 0 && impressions > 0 ? (clicks / impressions) * 100 : 0;
        setAdsSummary({ spend, impressions, clicks, ctr });
      }
    });
  }, []);

  // Close CRM data
  const [pipelineData, setPipelineData] = useState<{ stages: { label: string; count: number; value: number }[]; totalValue: number; totalCount: number } | null>(null);
  const [forecastData, setForecastData] = useState<{ totalWeighted: number; totalUnweighted: number; byUser: { name: string; weighted: number; unweighted: number; count: number }[] } | null>(null);
  const [activityData, setActivityData] = useState<{ total: number; byUser: { name: string; calls: number; emails: number; meetings: number }[] } | null>(null);
  const [closeLoading, setCloseLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getPipelineSummary().then(setPipelineData),
      getWeightedForecast().then(setForecastData),
      getTodayActivities().then(setActivityData),
    ]).finally(() => setCloseLoading(false));
  }, []);

  const today = new Date();
  const activeClients = clients.filter((c) => c.status === "Active").length;
  const fmt = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const fmtFull = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  const hour = today.getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Nachmittag" : "Guten Abend";

  // Tasks
  const openTasks = useMemo(() => tasks.filter((t) => t.column !== "done"), [tasks]);
  const todayTasks = useMemo(() => openTasks.filter((t) => t.dueDate && t.dueDate === format(today, "yyyy-MM-dd")).slice(0, 5), [openTasks, today]);
  const highPrioTasks = useMemo(() => openTasks.filter((t) => t.priority === "high").slice(0, 5), [openTasks]);

  // Monthly recurring revenue from deals
  const mrr = useMemo(() => {
    const currentMonth = format(today, "yyyy-MM");
    return deals.reduce((sum, d) => {
      const payment = d.monthlyPayments?.[currentMonth];
      if (payment && (payment.status === "paid" || payment.status === "planned")) {
        return sum + payment.amount;
      }
      return sum + d.netAmount;
    }, 0);
  }, [deals, today]);

  // Projects with progress
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.phases.length > 0).map((p) => {
      const total = p.phases.reduce((s, ph) => s + ph.tasks.length, 0);
      const done = p.phases.reduce((s, ph) => s + ph.tasks.filter((t) => t.status === "done").length, 0);
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const currentPhase = p.phases.find((ph) => !ph.tasks.every((t) => t.status === "done"));
      return { ...p, progress, currentPhase: currentPhase?.title || "Abgeschlossen", total, done };
    }).sort((a, b) => b.progress === 100 ? -1 : a.progress - b.progress).slice(0, 5);
  }, [projects]);

  // Today's events
  const todayStr = format(today, "yyyy-MM-dd");
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === todayStr && !e.id.startsWith("proj-deadline-"))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 6),
  [calendarEvents, todayStr]);

  // Deadlines
  const deadlines = useMemo(() => {
    return projects.filter((p) => p.deadline).map((p) => {
      const d = new Date(p.deadline + "T00:00:00");
      const isOverdue = isPast(new Date(p.deadline + "T23:59:59")) && !isSameDay(d, today);
      return { ...p, deadlineDate: d, isOverdue, isToday: isSameDay(d, today) };
    }).sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime()).slice(0, 5);
  }, [projects, today]);

  // Top clients
  const topClients = useMemo(() => [...clients].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [clients]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/favicon.png" className="h-5 w-5 rounded" />
              <span className="text-xs font-medium text-primary uppercase tracking-wider">Adslift OS</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{greeting}, {userName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => navigate("/clients")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] text-muted-foreground">{activeClients} aktiv</span>
            </div>
            <div className="text-2xl font-bold">{clients.length}</div>
            <div className="text-[10px] text-muted-foreground">Kunden</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => navigate("/projects")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FolderKanban className="h-4 w-4 text-violet-500" />
              <span className="text-[10px] text-muted-foreground">{activeProjects.length} aktiv</span>
            </div>
            <div className="text-2xl font-bold">{projects.length}</div>
            <div className="text-[10px] text-muted-foreground">Projekte</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => navigate("/sales")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground">{today.toLocaleString("de-DE", { month: "short" })}</span>
            </div>
            <div className="text-2xl font-bold">{fmt(monthlyClosed)}</div>
            <div className="text-[10px] text-muted-foreground">Closed</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => navigate("/mail")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Mail className="h-4 w-4 text-red-500" />
              {unreadCount !== null && unreadCount > 0 && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{unreadCount}</Badge>}
            </div>
            <div className="text-2xl font-bold">{unreadCount !== null ? unreadCount : "—"}</div>
            <div className="text-[10px] text-muted-foreground">Ungelesene Mails</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" onClick={() => navigate("/tasks")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CircleCheckBig className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] text-muted-foreground">{highPrioTasks.length} prio</span>
            </div>
            <div className="text-2xl font-bold">{openTasks.length}</div>
            <div className="text-[10px] text-muted-foreground">Offene Aufgaben</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid — 3 columns */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Column 1: Today + Tasks */}
        <div className="space-y-5">
          {/* Today's Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Heute — {format(today, "d. MMM", { locale: de })}
              </CardTitle>
              <button onClick={() => navigate("/calendar")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Kalender <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              {todayEvents.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-xs text-muted-foreground">Keine Events heute.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((event) => {
                    const isSales = isSalesMeeting(event);
                    return (
                      <div key={event.id} className={`rounded-lg p-2 cursor-pointer hover:bg-accent/50 transition-colors ${event.accountColorLight || "bg-muted/30"}`} onClick={() => navigate("/calendar")}>
                        <div className="flex items-center gap-2">
                          {isSales && <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />}
                          <span className="text-xs font-medium truncate">{event.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{event.startTime} – {event.endTime}</span>
                          {event.meetingLink && (
                            <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary hover:underline">
                              <Video className="h-2.5 w-2.5" />{getMeetingPlatform(event.meetingLink)}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CircleCheckBig className="h-3.5 w-3.5 text-amber-500" /> Aufgaben
              </CardTitle>
              <button onClick={() => navigate("/tasks")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Alle <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              {openTasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-xs text-muted-foreground">Alles erledigt!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(todayTasks.length > 0 ? todayTasks : highPrioTasks.length > 0 ? highPrioTasks : openTasks.slice(0, 5)).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigate("/tasks")}>
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.priority === "high" ? "bg-red-500" : t.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
                      <span className="text-xs truncate flex-1">{t.title}</span>
                      <Badge variant="secondary" className="text-[8px] px-1.5 py-0 shrink-0">
                        {t.column === "in-progress" ? "In Arbeit" : "To-Do"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Projects + Deadlines */}
        <div className="space-y-5">
          {/* Active Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Aktive Projekte</CardTitle>
              <button onClick={() => navigate("/projects")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Alle <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              {activeProjects.length === 0 ? (
                <div className="text-center py-6">
                  <FolderKanban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-xs text-muted-foreground">Keine Projekte.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeProjects.map((p) => (
                    <div key={p.id} className="cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate("/projects")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{p.name}</span>
                        <span className="text-[10px] font-bold tabular-nums ml-2">{p.progress}%</span>
                      </div>
                      <Progress value={p.progress} className="h-1.5" />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-muted-foreground">{p.client}</span>
                        <span className="text-[9px] text-primary">{p.currentPhase}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deadlines */}
          {deadlines.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-red-500" />Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deadlines.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2.5 rounded-lg p-2 ${p.isOverdue ? "bg-red-500/5" : p.isToday ? "bg-amber-500/5" : ""}`}>
                      <Flag className={`h-3 w-3 shrink-0 ${p.isOverdue ? "text-red-500" : p.isToday ? "text-amber-500" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{p.name}</div>
                        <div className="text-[9px] text-muted-foreground">{p.client}</div>
                      </div>
                      <span className={`text-[10px] font-medium shrink-0 ${p.isOverdue ? "text-red-500" : ""}`}>
                        {p.isToday ? "Heute" : format(p.deadlineDate, "d. MMM", { locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Column 3: Meta Ads + Top Kunden + Revenue */}
        <div className="space-y-5">
          {/* Meta Ads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-blue-500" /> Meta Ads
              </CardTitle>
              <button onClick={() => navigate("/meta-ads")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Details <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              {adsSummary ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Euro className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground uppercase">Spend</span>
                    </div>
                    <div className="text-sm font-bold">{fmtFull(adsSummary.spend)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground uppercase">Impressions</span>
                    </div>
                    <div className="text-sm font-bold">{new Intl.NumberFormat("de-DE").format(adsSummary.impressions)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground uppercase">Clicks</span>
                    </div>
                    <div className="text-sm font-bold">{new Intl.NumberFormat("de-DE").format(adsSummary.clicks)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground uppercase">CTR</span>
                    </div>
                    <div className="text-sm font-bold">{adsSummary.ctr.toFixed(2)}%</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-xs text-muted-foreground">Keine Ads-Daten.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue / MRR */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-emerald-500" /> Revenue
              </CardTitle>
              <button onClick={() => navigate("/finances")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Finanzen <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">MRR</span>
                  <span className="text-sm font-bold">{fmt(mrr)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Deals aktiv</span>
                  <span className="text-sm font-bold">{deals.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Closed {today.toLocaleString("de-DE", { month: "short" })}</span>
                  <span className="text-sm font-bold">{fmt(monthlyClosed)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Clients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Top Kunden</CardTitle>
              <button onClick={() => navigate("/clients")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Alle <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              {topClients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Kunden.</p>
              ) : (
                <div className="space-y-2">
                  {topClients.map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 rounded-lg p-1.5 -mx-1.5 transition-colors" onClick={() => navigate("/clients")}>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate">{c.name}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{fmt(c.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- Close CRM Section --- */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Sales Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-violet-500" /> Sales Pipeline
            </CardTitle>
            <button onClick={() => navigate("/sales")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Sales <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent>
            {closeLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : pipelineData ? (
              <div className="space-y-2">
                {pipelineData.stages.filter((s) => s.count > 0).map((stage) => (
                  <div key={stage.label} className="flex items-center gap-2">
                    <span className="text-xs truncate flex-1 min-w-0">{stage.label}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">{stage.count}</Badge>
                    <span className="text-xs font-semibold tabular-nums shrink-0">{fmt(stage.value / 100)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{pipelineData.totalCount} Deals</span>
                  <span className="text-sm font-bold">{fmt(pipelineData.totalValue / 100)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Keine Pipeline-Daten.</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue Forecast */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Revenue Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {closeLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : forecastData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <div className="text-[9px] text-muted-foreground uppercase mb-1">Pipeline (gesamt)</div>
                    <div className="text-sm font-bold">{fmt(forecastData.totalUnweighted / 100)}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2.5">
                    <div className="text-[9px] text-emerald-600 uppercase mb-1">Gewichtet</div>
                    <div className="text-sm font-bold text-emerald-600">{fmt(forecastData.totalWeighted / 100)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {forecastData.byUser.map((u) => (
                    <div key={u.name} className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <span className="text-xs truncate flex-1">{u.name.split(" ")[0]}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{u.count} Deals</span>
                      <span className="text-xs font-semibold tabular-nums">{fmt(u.weighted / 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Keine Forecast-Daten.</p>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-blue-500" /> Heutige Aktivitäten
            </CardTitle>
          </CardHeader>
          <CardContent>
            {closeLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : activityData ? (
              <div className="space-y-3">
                {activityData.byUser.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Noch keine Aktivitäten heute.</p>
                ) : (
                  <>
                    {activityData.byUser.map((u) => (
                      <div key={u.name} className="rounded-lg bg-muted/30 p-2.5">
                        <div className="text-xs font-medium mb-1.5">{u.name.split(" ")[0]}</div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-500" />
                            <span className="text-xs font-semibold">{u.calls}</span>
                            <span className="text-[9px] text-muted-foreground">Calls</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-blue-500" />
                            <span className="text-xs font-semibold">{u.emails}</span>
                            <span className="text-[9px] text-muted-foreground">Mails</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Video className="h-3 w-3 text-violet-500" />
                            <span className="text-xs font-semibold">{u.meetings}</span>
                            <span className="text-[9px] text-muted-foreground">Meetings</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Gesamt heute</span>
                      <span className="text-sm font-bold">{activityData.total} Aktivitäten</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Keine Activity-Daten.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

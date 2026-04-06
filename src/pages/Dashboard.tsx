import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useAllCalendarEvents } from "@/store/calendar";
import { useTasks } from "@/store/tasks";
import { useDeals } from "@/store/deals";
import {
  FolderKanban, Users, DollarSign, TrendingUp, ArrowRight, BarChart3,
  Flag, CheckCircle2, Video, Mail, Megaphone, CircleCheckBig,
  Eye, MousePointerClick, Euro, Wallet, Phone, Target, Loader2,
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

  const [monthlyClosed, setMonthlyClosed] = useState(0);
  useEffect(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`;
    const nextMonth = now.getMonth() === 11 ? `${now.getFullYear() + 1}-01-01` : `${now.getFullYear()}-${(now.getMonth() + 2).toString().padStart(2, "0")}-01`;
    supabase.from("sales_weeks").select("deal_volume,week_start").gte("week_start", monthStart).lt("week_start", nextMonth).then(({ data }) => {
      if (data) setMonthlyClosed(data.reduce((s, w) => s + (w.deal_volume || 0), 0));
    });
  }, []);

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
  const num = (n: number) => new Intl.NumberFormat("de-DE").format(n);

  const hour = today.getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Nachmittag" : "Guten Abend";

  const openTasks = useMemo(() => tasks.filter((t) => t.column !== "done"), [tasks]);
  const todayTasks = useMemo(() => openTasks.filter((t) => t.dueDate && t.dueDate === format(today, "yyyy-MM-dd")).slice(0, 5), [openTasks, today]);
  const highPrioTasks = useMemo(() => openTasks.filter((t) => t.priority === "high").slice(0, 5), [openTasks]);
  const displayTasks = todayTasks.length > 0 ? todayTasks : highPrioTasks.length > 0 ? highPrioTasks : openTasks.slice(0, 5);

  const mrr = useMemo(() => {
    const currentMonth = format(today, "yyyy-MM");
    return deals.reduce((sum, d) => {
      const payment = d.monthlyPayments?.[currentMonth];
      if (payment && (payment.status === "paid" || payment.status === "planned")) return sum + payment.amount;
      return sum + d.netAmount;
    }, 0);
  }, [deals, today]);

  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.phases.length > 0).map((p) => {
      const total = p.phases.reduce((s, ph) => s + ph.tasks.length, 0);
      const done = p.phases.reduce((s, ph) => s + ph.tasks.filter((t) => t.status === "done").length, 0);
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const currentPhase = p.phases.find((ph) => !ph.tasks.every((t) => t.status === "done"));
      return { ...p, progress, currentPhase: currentPhase?.title || "Abgeschlossen", total, done };
    }).sort((a, b) => b.progress === 100 ? -1 : a.progress - b.progress).slice(0, 4);
  }, [projects]);

  const todayStr = format(today, "yyyy-MM-dd");
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === todayStr && !e.id.startsWith("proj-deadline-"))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 5),
  [calendarEvents, todayStr]);

  const deadlines = useMemo(() => {
    return projects.filter((p) => p.deadline).map((p) => {
      const d = new Date(p.deadline + "T00:00:00");
      const isOverdue = isPast(new Date(p.deadline + "T23:59:59")) && !isSameDay(d, today);
      return { ...p, deadlineDate: d, isOverdue, isToday: isSameDay(d, today) };
    }).sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime()).slice(0, 4);
  }, [projects, today]);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}, {userName}</h1>
        <p className="text-sm text-muted-foreground">{format(today, "EEEE, d. MMMM yyyy", { locale: de })}</p>
      </div>

      {/* ═══ ROW 1: KPI Strip ═══ */}
      <div className="grid gap-2.5 grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Kunden", value: String(clients.length), sub: `${activeClients} aktiv`, icon: Users, color: "text-blue-500", path: "/clients" },
          { label: "Projekte", value: String(projects.length), sub: `${activeProjects.length} aktiv`, icon: FolderKanban, color: "text-violet-500", path: "/projects" },
          { label: "Closed", value: fmt(monthlyClosed), sub: today.toLocaleString("de-DE", { month: "long" }), icon: TrendingUp, color: "text-emerald-500", path: "/sales" },
          { label: "MRR", value: fmt(mrr), sub: `${deals.length} Deals`, icon: Wallet, color: "text-teal-500", path: "/finances" },
          { label: "Mails", value: unreadCount !== null ? String(unreadCount) : "—", sub: "ungelesen", icon: Mail, color: "text-red-500", path: "/mail", badge: unreadCount && unreadCount > 0 ? unreadCount : null },
          { label: "Aufgaben", value: String(openTasks.length), sub: `${highPrioTasks.length} high prio`, icon: CircleCheckBig, color: "text-amber-500", path: "/tasks" },
        ].map((kpi) => (
          <Card key={kpi.label} className="cursor-pointer hover:shadow-sm hover:-translate-y-0.5 transition-all border-border/50" onClick={() => navigate(kpi.path)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                {kpi.badge && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">{kpi.badge}</Badge>}
              </div>
              <div className="text-lg font-bold leading-tight">{kpi.value}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ ROW 2: Heute + Aufgaben + Sales Pipeline ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Heute */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Heute
            </CardTitle>
            <button onClick={() => navigate("/calendar")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Kalender <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {todayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Keine Events heute</p>
            ) : (
              <div className="space-y-1.5">
                {todayEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-2.5 rounded-md p-2 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => navigate("/calendar")}>
                    <div className="text-[10px] tabular-nums text-muted-foreground w-10 shrink-0">{event.startTime}</div>
                    <div className="h-full w-0.5 rounded-full bg-primary/30 self-stretch" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">{event.title}</span>
                      {event.meetingLink && (
                        <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-[9px] text-primary hover:underline mt-0.5">
                          <Video className="h-2.5 w-2.5" />{getMeetingPlatform(event.meetingLink)}
                        </a>
                      )}
                    </div>
                    {isSalesMeeting(event) && <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aufgaben */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aufgaben</CardTitle>
            <button onClick={() => navigate("/tasks")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Alle <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {displayTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Alles erledigt</p>
            ) : (
              <div className="space-y-1">
                {displayTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => navigate("/tasks")}>
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.priority === "high" ? "bg-red-500" : t.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
                    <span className="text-xs truncate flex-1">{t.title}</span>
                    <span className={`text-[9px] shrink-0 ${t.column === "in-progress" ? "text-primary" : "text-muted-foreground"}`}>
                      {t.column === "in-progress" ? "In Arbeit" : "To-Do"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Pipeline */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sales Pipeline</CardTitle>
            <button onClick={() => navigate("/sales")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Sales <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {closeLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : pipelineData ? (
              <div className="space-y-2">
                {pipelineData.stages.filter((s) => s.count > 0).map((stage) => {
                  const pct = pipelineData.totalValue > 0 ? (stage.value / pipelineData.totalValue) * 100 : 0;
                  return (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] truncate flex-1">{stage.label}</span>
                        <span className="text-[10px] text-muted-foreground mx-2">{stage.count}</span>
                        <span className="text-[11px] font-semibold tabular-nums">{fmt(stage.value / 100)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
                <Separator className="my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium">{pipelineData.totalCount} Deals</span>
                  <span className="text-sm font-bold">{fmt(pipelineData.totalValue / 100)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Keine Daten</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ ROW 3: Forecast + Activity + Meta Ads ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Forecast */}
        <Card className="border-border/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue Forecast</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {closeLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : forecastData ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg bg-muted/40 p-2.5 text-center">
                    <div className="text-lg font-bold">{fmt(forecastData.totalUnweighted / 100)}</div>
                    <div className="text-[9px] text-muted-foreground">Pipeline</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-emerald-500/10 p-2.5 text-center">
                    <div className="text-lg font-bold text-emerald-600">{fmt(forecastData.totalWeighted / 100)}</div>
                    <div className="text-[9px] text-emerald-600">Gewichtet</div>
                  </div>
                </div>
                {forecastData.byUser.map((u) => (
                  <div key={u.name} className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <span className="text-xs flex-1">{u.name.split(" ")[0]}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums mr-1">{u.count}</span>
                    <span className="text-xs font-semibold tabular-nums">{fmt(u.weighted / 100)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Keine Daten</p>
            )}
          </CardContent>
        </Card>

        {/* Heutige Aktivitäten */}
        <Card className="border-border/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Heutige Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {closeLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : activityData && activityData.byUser.length > 0 ? (
              <div className="space-y-3">
                {activityData.byUser.map((u) => (
                  <div key={u.name} className="rounded-lg border border-border/50 p-3">
                    <div className="text-xs font-medium mb-2">{u.name.split(" ")[0]}</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Phone className="h-3 w-3 text-emerald-500" />
                          <span className="text-sm font-bold">{u.calls}</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground uppercase">Calls</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Mail className="h-3 w-3 text-blue-500" />
                          <span className="text-sm font-bold">{u.emails}</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground uppercase">Mails</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <Video className="h-3 w-3 text-violet-500" />
                          <span className="text-sm font-bold">{u.meetings}</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground uppercase">Meetings</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-center">
                  <span className="text-[10px] text-muted-foreground">{activityData.total} Aktivitäten gesamt</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Noch keine Aktivitäten heute</p>
            )}
          </CardContent>
        </Card>

        {/* Meta Ads */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meta Ads</CardTitle>
            <button onClick={() => navigate("/meta-ads")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Details <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {adsSummary ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Euro, label: "Spend", value: fmt(adsSummary.spend), color: "text-muted-foreground" },
                  { icon: Eye, label: "Impressions", value: num(adsSummary.impressions), color: "text-muted-foreground" },
                  { icon: MousePointerClick, label: "Clicks", value: num(adsSummary.clicks), color: "text-muted-foreground" },
                  { icon: TrendingUp, label: "CTR", value: adsSummary.ctr.toFixed(2) + "%", color: "text-muted-foreground" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border/50 p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <m.icon className={`h-3 w-3 ${m.color}`} />
                      <span className="text-[8px] text-muted-foreground uppercase">{m.label}</span>
                    </div>
                    <div className="text-sm font-bold">{m.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Keine Ads-Daten</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ ROW 4: Projekte + Deadlines + Revenue ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Projekte */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aktive Projekte</CardTitle>
            <button onClick={() => navigate("/projects")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Alle <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {activeProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Keine aktiven Projekte</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeProjects.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border/50 p-3 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate("/projects")}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium truncate flex-1">{p.name}</span>
                      <span className="text-[10px] font-bold tabular-nums ml-2">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} className="h-1" />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-muted-foreground">{p.client}</span>
                      <span className="text-[9px] text-primary">{p.currentPhase}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deadlines + Revenue */}
        <div className="space-y-4">
          {deadlines.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Flag className="h-3 w-3 text-red-500" /> Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {deadlines.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2 rounded-md p-2 ${p.isOverdue ? "bg-red-500/5" : p.isToday ? "bg-amber-500/5" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium truncate">{p.name}</div>
                        <div className="text-[9px] text-muted-foreground">{p.client}</div>
                      </div>
                      <span className={`text-[10px] font-medium shrink-0 ${p.isOverdue ? "text-red-500" : p.isToday ? "text-amber-500" : "text-muted-foreground"}`}>
                        {p.isToday ? "Heute" : format(p.deadlineDate, "d. MMM", { locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">MRR</span>
                  <span className="text-sm font-bold">{fmt(mrr)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Aktive Deals</span>
                  <span className="text-sm font-bold">{deals.length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Closed {today.toLocaleString("de-DE", { month: "long" })}</span>
                  <span className="text-sm font-bold text-emerald-600">{fmt(monthlyClosed)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

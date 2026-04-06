import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useAllCalendarEvents, setGoogleEvents } from "@/store/calendar";
import { isGoogleConnected, getAccounts, listAllEvents, type GoogleCalendarEvent } from "@/lib/google-calendar";
import { useTasks } from "@/store/tasks";
import { useDeals } from "@/store/deals";
import {
  FolderKanban, Users, DollarSign, TrendingUp, ArrowRight, BarChart3,
  Flag, Video, Mail, Megaphone, CircleCheckBig,
  Eye, MousePointerClick, Euro, Wallet, Phone, Loader2, ArrowUpRight,
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
  return "Link";
}

// Bento cell wrapper
function Bento({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-border/40 bg-card p-4 ${onClick ? "cursor-pointer hover:border-border hover:shadow-lg hover:-translate-y-0.5 transition-all" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients] = useClients();
  const [projects] = useProjects();
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
    const ms = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`;
    const nm = now.getMonth() === 11 ? `${now.getFullYear() + 1}-01-01` : `${now.getFullYear()}-${(now.getMonth() + 2).toString().padStart(2, "0")}-01`;
    supabase.from("sales_weeks").select("deal_volume,week_start").gte("week_start", ms).lt("week_start", nm).then(({ data }) => {
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

  // Auto-load Google Calendar events if not loaded yet
  const calendarEvents = useAllCalendarEvents();
  useEffect(() => {
    if (calendarEvents.length > 0 || !isGoogleConnected()) return;
    const accounts = getAccounts();
    if (accounts.length === 0) return;
    const now = new Date();
    const timeMin = `${now.getFullYear()}-01-01T00:00:00Z`;
    const timeMax = `${now.getFullYear()}-12-31T23:59:59Z`;
    listAllEvents(timeMin, timeMax).then((allResults) => {
      const mapped = allResults.flatMap(({ email, events: gEvents }) => {
        const account = accounts.find((a) => a.email === email);
        return gEvents.map((ge: GoogleCalendarEvent) => {
          const start = ge.start.dateTime || ge.start.date || "";
          const end = ge.end.dateTime || ge.end.date || "";
          const startDate = start.split("T")[0];
          const startTime = start.includes("T") ? start.split("T")[1]?.substring(0, 5) : "00:00";
          const endTime = end.includes("T") ? end.split("T")[1]?.substring(0, 5) : "23:59";
          let meetingLink = ge.hangoutLink || "";
          if (!meetingLink && ge.conferenceData?.entryPoints) {
            const video = ge.conferenceData.entryPoints.find((ep) => ep.entryPointType === "video");
            if (video) meetingLink = video.uri;
          }
          return {
            id: `gcal-${email}-${ge.id}`,
            title: ge.summary || "(Kein Titel)",
            date: startDate,
            startTime,
            endTime,
            type: (meetingLink ? "meeting" : "other") as any,
            description: ge.description,
            meetingLink: meetingLink || undefined,
            accountColor: account?.color,
            accountColorLight: account?.colorLight,
          };
        });
      });
      setGoogleEvents(mapped);
    }).catch(() => {});
  }, [calendarEvents.length]);

  const today = new Date();
  const activeClients = clients.filter((c) => c.status === "Active").length;
  const fmt = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const num = (n: number) => new Intl.NumberFormat("de-DE").format(n);

  const hour = today.getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Nachmittag" : "Guten Abend";

  const openTasks = useMemo(() => tasks.filter((t) => t.column !== "done"), [tasks]);
  const highPrioTasks = useMemo(() => openTasks.filter((t) => t.priority === "high"), [openTasks]);
  const todayTasks = useMemo(() => openTasks.filter((t) => t.dueDate && t.dueDate === format(today, "yyyy-MM-dd")), [openTasks, today]);
  const displayTasks = (todayTasks.length > 0 ? todayTasks : highPrioTasks.length > 0 ? highPrioTasks : openTasks).slice(0, 4);

  const mrr = useMemo(() => {
    const cm = format(today, "yyyy-MM");
    return deals.reduce((sum, d) => {
      const p = d.monthlyPayments?.[cm];
      return sum + (p && (p.status === "paid" || p.status === "planned") ? p.amount : d.netAmount);
    }, 0);
  }, [deals, today]);

  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.phases.length > 0).map((p) => {
      const total = p.phases.reduce((s, ph) => s + ph.tasks.length, 0);
      const done = p.phases.reduce((s, ph) => s + ph.tasks.filter((t) => t.status === "done").length, 0);
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      return { ...p, progress, total, done };
    }).sort((a, b) => a.progress - b.progress).slice(0, 4);
  }, [projects]);

  const todayStr = format(today, "yyyy-MM-dd");
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === todayStr && !e.id.startsWith("proj-deadline-"))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 5),
  [calendarEvents, todayStr]);

  const deadlines = useMemo(() => {
    return projects.filter((p) => p.deadline).map((p) => {
      const d = new Date(p.deadline + "T00:00:00");
      return { name: p.name, client: p.client, deadlineDate: d, isOverdue: isPast(new Date(p.deadline + "T23:59:59")) && !isSameDay(d, today), isToday: isSameDay(d, today) };
    }).sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime()).slice(0, 3);
  }, [projects, today]);

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}, {userName}</h1>
          <p className="text-sm text-muted-foreground">{format(today, "EEEE, d. MMMM yyyy", { locale: de })}</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-2xl font-bold text-primary">{fmt(monthlyClosed)}</div>
          <p className="text-[10px] text-muted-foreground">Closed in {today.toLocaleString("de-DE", { month: "long" })}</p>
        </div>
      </div>

      {/* ═══ BENTO GRID ═══ */}
      <div className="grid gap-3 grid-cols-4 lg:grid-cols-12 auto-rows-[minmax(120px,auto)]">

        {/* ── HEUTE (tall, left) ── */}
        <Bento className="col-span-4 lg:col-span-4 lg:row-span-2" onClick={() => navigate("/calendar")}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Heute</span>
            <span className="text-[10px] text-primary flex items-center gap-0.5">Kalender <ArrowUpRight className="h-2.5 w-2.5" /></span>
          </div>
          {todayEvents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground/30">
              <p className="text-xs">Freier Tag</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayEvents.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] tabular-nums text-muted-foreground font-medium">{event.startTime}</span>
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-1.5">
                      {isSalesMeeting(event) && <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />}
                      <span className="text-sm font-medium">{event.title}</span>
                    </div>
                    {event.meetingLink && (
                      <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5">
                        <Video className="h-2.5 w-2.5" />{getMeetingPlatform(event.meetingLink)}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Bento>

        {/* ── CLOSED + MRR (small KPIs) ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/sales")}>
          <TrendingUp className="h-4 w-4 text-emerald-500 mb-2" />
          <div className="text-xl font-bold">{fmt(monthlyClosed)}</div>
          <div className="text-[9px] text-muted-foreground">Closed</div>
        </Bento>

        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/finances")}>
          <Wallet className="h-4 w-4 text-teal-500 mb-2" />
          <div className="text-xl font-bold">{fmt(mrr)}</div>
          <div className="text-[9px] text-muted-foreground">MRR</div>
        </Bento>

        {/* ── PIPELINE (wide) ── */}
        <Bento className="col-span-4 lg:col-span-4" onClick={() => navigate("/sales")}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pipeline</span>
            {pipelineData && <span className="text-sm font-bold">{fmt(pipelineData.totalValue / 100)}</span>}
          </div>
          {closeLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : pipelineData ? (
            <div className="space-y-1.5">
              {pipelineData.stages.filter((s) => s.count > 0).map((stage) => {
                const pct = pipelineData.totalValue > 0 ? (stage.value / pipelineData.totalValue) * 100 : 0;
                return (
                  <div key={stage.label} className="flex items-center gap-2">
                    <span className="text-[11px] w-24 truncate text-muted-foreground">{stage.label.replace(/[^\w\s]/g, "").trim()}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                    <span className="text-[10px] font-medium tabular-nums w-6 text-right">{stage.count}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Bento>

        {/* ── MAILS (small) ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/mail")}>
          <div className="flex items-center justify-between mb-2">
            <Mail className="h-4 w-4 text-red-500" />
            {unreadCount !== null && unreadCount > 0 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-4">{unreadCount}</Badge>}
          </div>
          <div className="text-xl font-bold">{unreadCount !== null ? unreadCount : "—"}</div>
          <div className="text-[9px] text-muted-foreground">Ungelesen</div>
        </Bento>

        {/* ── KUNDEN + PROJEKTE (small) ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/clients")}>
          <Users className="h-4 w-4 text-blue-500 mb-2" />
          <div className="text-xl font-bold">{clients.length}</div>
          <div className="text-[9px] text-muted-foreground">{activeClients} aktiv</div>
        </Bento>

        {/* ── AUFGABEN (medium) ── */}
        <Bento className="col-span-4 lg:col-span-4" onClick={() => navigate("/tasks")}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aufgaben</span>
            <span className="text-xs font-bold">{openTasks.length} offen</span>
          </div>
          {displayTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 py-2">Alles erledigt</p>
          ) : (
            <div className="space-y-1.5">
              {displayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${t.priority === "high" ? "bg-red-500" : t.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground/20"}`} />
                  <span className="text-xs truncate flex-1">{t.title}</span>
                  {t.column === "in-progress" && <span className="text-[8px] text-primary font-medium shrink-0">IN ARBEIT</span>}
                </div>
              ))}
            </div>
          )}
        </Bento>

        {/* ── FORECAST (medium) ── */}
        <Bento className="col-span-4 lg:col-span-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Forecast</span>
          {closeLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : forecastData ? (
            <div className="mt-2">
              <div className="flex gap-3 mb-3">
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold">{fmt(forecastData.totalUnweighted / 100)}</div>
                  <div className="text-[9px] text-muted-foreground">Pipeline</div>
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold text-emerald-500">{fmt(forecastData.totalWeighted / 100)}</div>
                  <div className="text-[9px] text-emerald-500">Gewichtet</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {forecastData.byUser.map((u) => (
                  <div key={u.name} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">{u.name.charAt(0)}</div>
                    <span className="text-xs flex-1">{u.name.split(" ")[0]}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{u.count} Deals</span>
                    <span className="text-xs font-semibold tabular-nums">{fmt(u.weighted / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Bento>

        {/* ── AKTIVITÄTEN (medium) ── */}
        <Bento className="col-span-4 lg:col-span-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Heutige Aktivitäten</span>
          {closeLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : activityData && activityData.byUser.length > 0 ? (
            <div className="mt-2 space-y-3">
              {activityData.byUser.map((u) => (
                <div key={u.name}>
                  <div className="text-xs font-medium mb-1.5">{u.name.split(" ")[0]}</div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-lg font-bold">{u.calls}</span>
                      <span className="text-[9px] text-muted-foreground">Calls</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-lg font-bold">{u.emails}</span>
                      <span className="text-[9px] text-muted-foreground">Mails</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-lg font-bold">{u.meetings}</span>
                      <span className="text-[9px] text-muted-foreground">Meetings</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 mt-4">Noch keine Aktivitäten</p>
          )}
        </Bento>

        {/* ── META ADS (medium) ── */}
        <Bento className="col-span-4 lg:col-span-4" onClick={() => navigate("/meta-ads")}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Meta Ads</span>
            <Megaphone className="h-3.5 w-3.5 text-blue-500" />
          </div>
          {adsSummary ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
              <div>
                <div className="text-lg font-bold">{fmt(adsSummary.spend)}</div>
                <div className="text-[9px] text-muted-foreground">Spend</div>
              </div>
              <div>
                <div className="text-lg font-bold">{num(adsSummary.impressions)}</div>
                <div className="text-[9px] text-muted-foreground">Impressions</div>
              </div>
              <div>
                <div className="text-lg font-bold">{num(adsSummary.clicks)}</div>
                <div className="text-[9px] text-muted-foreground">Clicks</div>
              </div>
              <div>
                <div className="text-lg font-bold">{adsSummary.ctr.toFixed(2)}%</div>
                <div className="text-[9px] text-muted-foreground">CTR</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 mt-4">Keine Daten</p>
          )}
        </Bento>

        {/* ── PROJEKTE (wide) ── */}
        <Bento className="col-span-4 lg:col-span-8" onClick={() => navigate("/projects")}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Projekte</span>
            <span className="text-[10px] text-primary flex items-center gap-0.5">Alle <ArrowUpRight className="h-2.5 w-2.5" /></span>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">Keine aktiven Projekte</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeProjects.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{p.name}</span>
                    <span className="text-[10px] font-bold tabular-nums ml-2">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1 mb-1" />
                  <span className="text-[9px] text-muted-foreground">{p.client}</span>
                </div>
              ))}
            </div>
          )}
        </Bento>

        {/* ── DEADLINES (small col) ── */}
        <Bento className="col-span-4 lg:col-span-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Flag className="h-3.5 w-3.5 text-red-500" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deadlines</span>
          </div>
          {deadlines.length === 0 ? (
            <p className="text-xs text-muted-foreground/50">Keine Deadlines</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map((p, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg p-2 ${p.isOverdue ? "bg-red-500/8" : p.isToday ? "bg-amber-500/8" : "bg-muted/30"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[9px] text-muted-foreground">{p.client}</div>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 ${p.isOverdue ? "text-red-500" : p.isToday ? "text-amber-500" : "text-muted-foreground"}`}>
                    {p.isToday ? "Heute" : format(p.deadlineDate, "d. MMM", { locale: de })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Bento>
      </div>
    </div>
  );
}

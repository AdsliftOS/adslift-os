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

// Glassmorphism Bento cell
function Bento({ children, className = "", onClick, glow }: { children: React.ReactNode; className?: string; onClick?: () => void; glow?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl border border-blue-500/10 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm p-5 overflow-hidden
        ${onClick ? "cursor-pointer hover:border-blue-500/30 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)] hover:-translate-y-0.5 transition-all duration-300" : ""}
        ${glow ? "shadow-[0_0_40px_-10px_rgba(59,130,246,0.2)]" : ""}
        ${className}`}
    >
      {glow && <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Small stat label
function StatLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-medium uppercase tracking-[0.15em] text-blue-300/40">{children}</div>;
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

  // Auto-load Google Calendar events
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
            id: `gcal-${email}-${ge.id}`, title: ge.summary || "(Kein Titel)", date: startDate, startTime, endTime,
            type: (meetingLink ? "meeting" : "other") as any, description: ge.description, meetingLink: meetingLink || undefined,
            accountColor: account?.color, accountColorLight: account?.colorLight,
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
      return { ...p, progress: total > 0 ? Math.round((done / total) * 100) : 0, total, done };
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
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-400/50 mb-1">Adslift OS</p>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}, {userName}</h1>
          <p className="text-sm text-muted-foreground">{format(today, "EEEE, d. MMMM yyyy", { locale: de })}</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{fmt(monthlyClosed)}</div>
          <p className="text-[10px] text-muted-foreground">Closed in {today.toLocaleString("de-DE", { month: "long" })}</p>
        </div>
      </div>

      {/* ═══ BENTO GRID ═══ */}
      <div className="grid gap-3 grid-cols-4 lg:grid-cols-12 auto-rows-[minmax(100px,auto)]">

        {/* ── HEUTE (tall left) ── */}
        <Bento className="col-span-4 lg:col-span-4 lg:row-span-2" onClick={() => navigate("/calendar")} glow>
          <div className="flex items-center justify-between mb-4">
            <StatLabel>Heute</StatLabel>
            <span className="text-[10px] text-blue-400/60 flex items-center gap-0.5">Kalender <ArrowUpRight className="h-2.5 w-2.5" /></span>
          </div>
          {todayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/20">
              <div className="text-4xl font-bold mb-1">{format(today, "d")}</div>
              <p className="text-[10px]">Freier Tag</p>
            </div>
          ) : (
            <div className="space-y-1">
              {todayEvents.map((event, i) => (
                <div key={event.id} className="flex gap-3 group">
                  <div className="flex flex-col items-center pt-0.5">
                    <span className="text-[10px] tabular-nums text-blue-400/60 font-mono">{event.startTime}</span>
                    {i < todayEvents.length - 1 && <div className="w-px flex-1 bg-gradient-to-b from-blue-500/20 to-transparent mt-1" />}
                  </div>
                  <div className="flex-1 pb-3 min-w-0">
                    <span className="text-sm font-medium block truncate group-hover:text-blue-400 transition-colors">{event.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isSalesMeeting(event) && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Sales</span>}
                      {event.meetingLink && (
                        <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="text-[9px] text-blue-400/60 hover:text-blue-400 flex items-center gap-0.5">
                          <Video className="h-2.5 w-2.5" />{getMeetingPlatform(event.meetingLink)}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Bento>

        {/* ── KPI: Closed ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/sales")}>
          <TrendingUp className="h-4 w-4 text-emerald-400 mb-3" />
          <div className="text-2xl font-bold">{fmt(monthlyClosed)}</div>
          <StatLabel>Closed</StatLabel>
        </Bento>

        {/* ── KPI: MRR ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/finances")}>
          <Wallet className="h-4 w-4 text-blue-400 mb-3" />
          <div className="text-2xl font-bold">{fmt(mrr)}</div>
          <StatLabel>MRR</StatLabel>
        </Bento>

        {/* ── PIPELINE (wide) ── */}
        <Bento className="col-span-4 lg:col-span-4 lg:row-span-2" onClick={() => navigate("/sales")} glow>
          <div className="flex items-center justify-between mb-3">
            <StatLabel>Sales Pipeline</StatLabel>
            {pipelineData && <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{fmt(pipelineData.totalValue / 100)}</span>}
          </div>
          {closeLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-blue-400/40" /></div>
          ) : pipelineData ? (
            <div className="space-y-2.5">
              {pipelineData.stages.filter((s) => s.count > 0).map((stage) => {
                const pct = pipelineData.totalValue > 0 ? (stage.value / pipelineData.totalValue) * 100 : 0;
                return (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground truncate">{stage.label.replace(/[^\w\sÄÖÜäöü]/g, "").trim()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-400/50 tabular-nums">{stage.count}</span>
                        <span className="text-[11px] font-semibold tabular-nums">{fmt(stage.value / 100)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-blue-500/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-blue-500/10 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{pipelineData.totalCount} Deals aktiv</span>
              </div>
            </div>
          ) : null}
        </Bento>

        {/* ── KPI: Mails ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/mail")}>
          <div className="flex items-center justify-between mb-3">
            <Mail className="h-4 w-4 text-red-400" />
            {unreadCount !== null && unreadCount > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>
            )}
          </div>
          <div className="text-2xl font-bold">{unreadCount !== null ? unreadCount : "—"}</div>
          <StatLabel>Ungelesen</StatLabel>
        </Bento>

        {/* ── KPI: Kunden ── */}
        <Bento className="col-span-2 lg:col-span-2" onClick={() => navigate("/clients")}>
          <Users className="h-4 w-4 text-violet-400 mb-3" />
          <div className="text-2xl font-bold">{clients.length}</div>
          <StatLabel>{activeClients} aktive Kunden</StatLabel>
        </Bento>

        {/* ── AUFGABEN ── */}
        <Bento className="col-span-4 lg:col-span-4" onClick={() => navigate("/tasks")}>
          <div className="flex items-center justify-between mb-3">
            <StatLabel>Aufgaben</StatLabel>
            <div className="flex items-center gap-2">
              {highPrioTasks.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">{highPrioTasks.length} urgent</span>
              )}
              <span className="text-sm font-bold">{openTasks.length}</span>
            </div>
          </div>
          {displayTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground/30 py-2">Alles erledigt</p>
          ) : (
            <div className="space-y-2">
              {displayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${t.priority === "high" ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" : t.priority === "medium" ? "bg-amber-400" : "bg-muted-foreground/20"}`} />
                  <span className="text-xs truncate flex-1">{t.title}</span>
                  {t.column === "in-progress" && <span className="text-[8px] text-blue-400 font-medium uppercase tracking-wider shrink-0">In Arbeit</span>}
                </div>
              ))}
            </div>
          )}
        </Bento>

        {/* ── FORECAST ── */}
        <Bento className="col-span-4 lg:col-span-4" glow>
          <StatLabel>Revenue Forecast</StatLabel>
          {closeLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-blue-400/40" /></div>
          ) : forecastData ? (
            <div className="mt-3">
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <div className="text-2xl font-bold">{fmt(forecastData.totalUnweighted / 100)}</div>
                  <StatLabel>Pipeline</StatLabel>
                </div>
                <div className="w-px bg-blue-500/10" />
                <div className="flex-1">
                  <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{fmt(forecastData.totalWeighted / 100)}</div>
                  <StatLabel>Gewichtet</StatLabel>
                </div>
              </div>
              <div className="space-y-2">
                {forecastData.byUser.map((u) => (
                  <div key={u.name} className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center text-[9px] font-bold text-blue-400 shrink-0">{u.name.charAt(0)}</div>
                    <span className="text-xs flex-1">{u.name.split(" ")[0]}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{u.count} Deals</span>
                    <span className="text-xs font-semibold tabular-nums">{fmt(u.weighted / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Bento>

        {/* ── AKTIVITÄTEN ── */}
        <Bento className="col-span-4 lg:col-span-4">
          <StatLabel>Heutige Aktivitäten</StatLabel>
          {closeLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-blue-400/40" /></div>
          ) : activityData && activityData.byUser.length > 0 ? (
            <div className="mt-3 space-y-3">
              {activityData.byUser.map((u) => (
                <div key={u.name}>
                  <div className="text-xs font-medium mb-2 text-muted-foreground">{u.name.split(" ")[0]}</div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Phone className="h-3.5 w-3.5 text-emerald-400" /></div>
                      <div>
                        <div className="text-sm font-bold leading-none">{u.calls}</div>
                        <div className="text-[8px] text-muted-foreground">Calls</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Mail className="h-3.5 w-3.5 text-blue-400" /></div>
                      <div>
                        <div className="text-sm font-bold leading-none">{u.emails}</div>
                        <div className="text-[8px] text-muted-foreground">Mails</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center"><Video className="h-3.5 w-3.5 text-violet-400" /></div>
                      <div>
                        <div className="text-sm font-bold leading-none">{u.meetings}</div>
                        <div className="text-[8px] text-muted-foreground">Meetings</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/30 mt-4">Noch keine Aktivitäten</p>
          )}
        </Bento>

        {/* ── META ADS ── */}
        <Bento className="col-span-4 lg:col-span-4" onClick={() => navigate("/meta-ads")}>
          <div className="flex items-center justify-between mb-3">
            <StatLabel>Meta Ads</StatLabel>
            <Megaphone className="h-3.5 w-3.5 text-blue-400/40" />
          </div>
          {adsSummary ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div className="text-lg font-bold">{fmt(adsSummary.spend)}</div>
                <StatLabel>Spend</StatLabel>
              </div>
              <div>
                <div className="text-lg font-bold">{num(adsSummary.impressions)}</div>
                <StatLabel>Impressions</StatLabel>
              </div>
              <div>
                <div className="text-lg font-bold">{num(adsSummary.clicks)}</div>
                <StatLabel>Clicks</StatLabel>
              </div>
              <div>
                <div className="text-lg font-bold">{adsSummary.ctr.toFixed(2)}%</div>
                <StatLabel>CTR</StatLabel>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/30 mt-4">Keine Daten</p>
          )}
        </Bento>

        {/* ── PROJEKTE (wide) ── */}
        <Bento className="col-span-4 lg:col-span-8" onClick={() => navigate("/projects")}>
          <div className="flex items-center justify-between mb-3">
            <StatLabel>Projekte</StatLabel>
            <span className="text-[10px] text-blue-400/60 flex items-center gap-0.5">Alle <ArrowUpRight className="h-2.5 w-2.5" /></span>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground/30">Keine aktiven Projekte</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {activeProjects.map((p) => (
                <div key={p.id} className="rounded-xl border border-blue-500/10 bg-blue-500/[0.02] p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium truncate">{p.name}</span>
                    <span className="text-[10px] font-bold tabular-nums text-blue-400 ml-2">{p.progress}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-blue-500/10 overflow-hidden mb-1.5">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{p.client}</span>
                </div>
              ))}
            </div>
          )}
        </Bento>

        {/* ── DEADLINES ── */}
        <Bento className="col-span-4 lg:col-span-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Flag className="h-3 w-3 text-red-400" />
            <StatLabel>Deadlines</StatLabel>
          </div>
          {deadlines.length === 0 ? (
            <p className="text-xs text-muted-foreground/30">Keine Deadlines</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map((p, i) => (
                <div key={i} className={`flex items-center gap-2.5 rounded-xl p-2.5 ${p.isOverdue ? "bg-red-500/8 border border-red-500/10" : p.isToday ? "bg-amber-500/8 border border-amber-500/10" : "bg-muted/20"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[9px] text-muted-foreground">{p.client}</div>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 ${p.isOverdue ? "text-red-400" : p.isToday ? "text-amber-400" : "text-muted-foreground"}`}>
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

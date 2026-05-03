import { useMemo, useState, useEffect } from "react";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useAllCalendarEvents, setGoogleEvents } from "@/store/calendar";
import { isGoogleConnected, getAccounts, listAllEvents, type GoogleCalendarEvent } from "@/lib/google-calendar";
import { useTasks } from "@/store/tasks";
import { useDeals } from "@/store/deals";
import { useSalesWeeks } from "@/store/sales";
import {
  Users, ArrowUpRight, Flag, Video, Mail, Megaphone,
  Wallet, Phone, Loader2, Flame, Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isPast } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { isSalesMeeting } from "@/lib/sales-meetings";
import { isGmailConnected, getGmailAccounts, getValidGmailToken } from "@/lib/gmail-auth";
import { getPipelineSummary, getWeightedForecast, getTodayActivities } from "@/lib/close-api-client";
import { listMessages } from "@/lib/gmail";
import { Eyebrow, KpiNumber, Sparkline, ProgressRing, DeltaChip } from "@/components/ui/kpi";
import { cn } from "@/lib/utils";

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

/**
 * Dashboard glass bento cell — Adslift design system variant.
 * Replaces the prior ad-hoc Bento. Accepts an optional `accent` for the
 * blue-tinted hero look and an optional `glow` for the soft blue backlight.
 */
function Cell({
  children,
  className = "",
  onClick,
  accent,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  accent?: "blue" | "amber";
  glow?: boolean;
}) {
  const accentClass =
    accent === "blue"
      ? "border-primary/25 bg-glass-card-blue shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_34px_-12px_rgba(13,114,255,0.3)]"
      : accent === "amber"
        ? "border-adslift-amber/25 bg-glass-card-amber"
        : "border-white/[0.08] bg-glass-card";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl border backdrop-blur-glass p-5 overflow-hidden",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_34px_-14px_rgba(0,0,0,0.6)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/[0.05] before:to-transparent before:rounded-t-xl",
        accentClass,
        onClick &&
          "cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow-blue-sm",
        className,
      )}
    >
      {glow && (
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(13,114,255,0.25), transparent 60%)",
            filter: "blur(28px)",
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients] = useClients();
  const [projects] = useProjects();
  const [tasks] = useTasks();
  const [deals] = useDeals();
  const [salesWeeks] = useSalesWeeks();
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

  const [adsSummary, setAdsSummary] = useState<{ spend: number; impressions: number; clicks: number; ctr: number; leads: number; cpl: number } | null>(null);
  useEffect(() => {
    fetch("/api/meta-ads?preset=this_month&account=act_1263695578446693")
      .then((r) => r.json())
      .then((res) => {
        if (res.totals) {
          const t = res.totals;
          const spend = parseFloat(t.spend || "0");
          const leads = (t.actions || []).filter((a: any) => a.action_type === "lead").reduce((s: number, a: any) => s + parseInt(a.value || "0"), 0);
          setAdsSummary({
            spend,
            impressions: parseInt(t.impressions || "0"),
            clicks: parseInt(t.clicks || "0"),
            ctr: parseFloat(t.ctr || "0"),
            leads,
            cpl: leads > 0 ? spend / leads : 0,
          });
        }
      })
      .catch(() => {});
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

  // ── Weekly sparkline data (last 12 weeks of deal volume) ──
  const weeklyTrend = useMemo(() => {
    const sorted = [...salesWeeks]
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .slice(-12);
    return sorted.map((w) => w.dealVolume);
  }, [salesWeeks]);

  const weekDelta = useMemo(() => {
    if (weeklyTrend.length < 2) return 0;
    const prev = weeklyTrend[weeklyTrend.length - 2];
    const curr = weeklyTrend[weeklyTrend.length - 1];
    if (!prev) return 0;
    return ((curr - prev) / prev) * 100;
  }, [weeklyTrend]);

  // ── Monthly goal: derived from last 3 months avg × 1.15, rounded to next 5k, min 30k ──
  const monthlyGoal = useMemo(() => {
    const now = new Date();
    const monthVolumes = new Map<string, number>();
    for (const w of salesWeeks) {
      const key = w.weekStart.substring(0, 7);
      monthVolumes.set(key, (monthVolumes.get(key) ?? 0) + w.dealVolume);
    }
    const lastThree: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      const v = monthVolumes.get(key);
      if (v) lastThree.push(v);
    }
    if (lastThree.length === 0) return 30000;
    const avg = lastThree.reduce((a, b) => a + b, 0) / lastThree.length;
    const target = Math.max(30000, Math.ceil((avg * 1.15) / 5000) * 5000);
    return target;
  }, [salesWeeks]);

  const goalProgress = monthlyGoal > 0 ? Math.min(100, (monthlyClosed / monthlyGoal) * 100) : 0;

  // ── MRR sparkline from deal monthly payments ──
  const mrrTrend = useMemo(() => {
    const points: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = format(d, "yyyy-MM");
      const total = deals.reduce((sum, deal) => {
        const p = deal.monthlyPayments?.[key];
        return sum + (p && (p.status === "paid" || p.status === "planned") ? p.amount : 0);
      }, 0);
      points.push(total);
    }
    return points;
  }, [deals, today]);

  const topPerformer = forecastData?.byUser?.[0];

  return (
    <div className="space-y-5">
      {/* ── HERO BAND ── */}
      <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Left — greeting */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <Eyebrow tone="primary" className="mb-2">Adslift Core OS</Eyebrow>
            <h1 className="text-[26px] font-semibold leading-[1.1] tracking-tight text-foreground">
              {greeting}, {userName}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
          </div>

          {/* Center — Closed metric */}
          <div className="lg:col-span-5 flex flex-col justify-center lg:border-l lg:border-r lg:border-white/[0.06] lg:px-8">
            <Eyebrow className="mb-2">
              Closed · {today.toLocaleString("de-DE", { month: "long" })}
            </Eyebrow>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-[44px] font-bold leading-none tracking-tight tabular-nums text-foreground">
                {fmt(monthlyClosed)}
              </div>
              {weeklyTrend.length >= 2 && (
                <DeltaChip value={Math.round(weekDelta * 10) / 10} format="pct" />
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-[12px] text-muted-foreground">
                Ziel <span className="text-foreground font-medium tabular-nums">{fmt(monthlyGoal)}</span>
                {weeklyTrend.length >= 2 && <> · vs. Vorwoche</>}
              </p>
              {weeklyTrend.length >= 3 && (
                <Sparkline values={weeklyTrend} width={140} height={32} color="#4D96FF" className="shrink-0 opacity-80" />
              )}
            </div>
          </div>

          {/* Right — goal ring */}
          <div className="lg:col-span-3 flex items-center lg:justify-end gap-4">
            <ProgressRing
              value={goalProgress}
              size={76}
              stroke={6}
              gradientFrom={goalProgress >= 100 ? "#22C55E" : "#4D96FF"}
              gradientTo={goalProgress >= 100 ? "#15803D" : "#0650C7"}
              label={
                <span className="text-[15px] font-semibold leading-none tabular-nums text-foreground">
                  {Math.round(goalProgress)}%
                </span>
              }
            />
            <div className="leading-tight">
              <Eyebrow>Monatsziel</Eyebrow>
              <div className="mt-1 text-[12.5px] font-medium text-foreground tabular-nums">
                {fmt(monthlyClosed)}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                / {fmt(monthlyGoal)}
              </div>
              {goalProgress >= 100 && (
                <div className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-ui text-adslift-success">
                  <Target className="h-2.5 w-2.5" /> Erreicht
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BENTO GRID ═══ */}
      <div className="grid gap-3 grid-cols-4 lg:grid-cols-12 auto-rows-[minmax(100px,auto)]">

        {/* ── HEUTE (tall left) ── */}
        <Cell className="col-span-4 lg:col-span-4 lg:row-span-2" onClick={() => navigate("/calendar")} >
          <div className="flex items-center justify-between mb-4">
            <Eyebrow tone="primary">Heute</Eyebrow>
            <span className="text-[10px] font-mono uppercase tracking-ui text-primary/70 flex items-center gap-1">
              Kalender <ArrowUpRight className="h-2.5 w-2.5" />
            </span>
          </div>
          {todayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/30">
              <div className="text-5xl font-bold mb-1 tabular-nums">{format(today, "d")}</div>
              <p className="font-mono text-[10px] uppercase tracking-ui">Freier Tag</p>
            </div>
          ) : (
            <div className="space-y-1">
              {todayEvents.map((event, i) => (
                <div key={event.id} className="flex gap-3 group">
                  <div className="flex flex-col items-center pt-0.5">
                    <span className="font-mono text-[10px] tabular-nums text-primary/70">{event.startTime}</span>
                    {i < todayEvents.length - 1 && <div className="w-px flex-1 bg-gradient-to-b from-primary/30 to-transparent mt-1" />}
                  </div>
                  <div className="flex-1 pb-3 min-w-0">
                    <span className="text-[13px] font-medium block truncate group-hover:text-primary transition-colors">{event.title}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {isSalesMeeting(event) && <span className="chip-success">Sales</span>}
                      {event.meetingLink && (
                        <a
                          href={event.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[10px] uppercase tracking-ui text-primary/70 hover:text-primary flex items-center gap-1"
                        >
                          <Video className="h-2.5 w-2.5" />
                          {getMeetingPlatform(event.meetingLink)}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cell>

        {/* ── Top Performer ── */}
        <Cell className="col-span-2 lg:col-span-2" onClick={() => navigate("/sales")}>
          <div className="flex items-center justify-between mb-3">
            <Flame className="h-4 w-4 text-adslift-amber" />
          </div>
          {topPerformer ? (
            <>
              <KpiNumber size="md" tone="plain">{fmt(topPerformer.weighted / 100)}</KpiNumber>
              <Eyebrow className="mt-2">
                {topPerformer.name.split(" ")[0]} · {topPerformer.count} Deals
              </Eyebrow>
            </>
          ) : (
            <>
              <KpiNumber size="md" tone="plain">–</KpiNumber>
              <Eyebrow className="mt-2">Top Performer</Eyebrow>
            </>
          )}
        </Cell>

        {/* ── KPI: MRR (mit Sparkline) ── */}
        <Cell className="col-span-2 lg:col-span-2" onClick={() => navigate("/finances")}>
          <div className="flex items-center justify-between mb-3">
            <Wallet className="h-4 w-4 text-primary" />
            {mrrTrend.length >= 3 && (
              <Sparkline values={mrrTrend} width={54} height={18} color="#4D96FF" className="opacity-80" />
            )}
          </div>
          <KpiNumber size="md" tone="blue">{fmt(mrr)}</KpiNumber>
          <Eyebrow className="mt-2">MRR</Eyebrow>
        </Cell>

        {/* ── PIPELINE (tall right) ── */}
        <Cell className="col-span-4 lg:col-span-4 lg:row-span-2" onClick={() => navigate("/sales")} >
          <div className="flex items-center justify-between mb-4">
            <Eyebrow tone="primary">Sales Pipeline</Eyebrow>
            {pipelineData && (
              <KpiNumber size="sm" tone="blue" className="!leading-none">
                {fmt(pipelineData.totalValue / 100)}
              </KpiNumber>
            )}
          </div>
          {closeLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
            </div>
          ) : pipelineData ? (
            <div className="space-y-3">
              {pipelineData.stages.filter((s) => s.count > 0).map((stage) => {
                const pct = pipelineData.totalValue > 0 ? (stage.value / pipelineData.totalValue) * 100 : 0;
                return (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-muted-foreground truncate">
                        {stage.label.replace(/[^\w\sÄÖÜäöü]/g, "").trim()}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">{stage.count}</span>
                        <span className="text-[12px] font-semibold tabular-nums text-foreground">{fmt(stage.value / 100)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden border border-white/[0.04]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-[#4D96FF] to-[#4D96FF] shadow-[0_0_6px_rgba(77,150,255,0.5)]"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <Eyebrow>{pipelineData.totalCount} Deals aktiv</Eyebrow>
              </div>
            </div>
          ) : null}
        </Cell>

        {/* ── KPI: Kunden ── */}
        <Cell className="col-span-2 lg:col-span-2" onClick={() => navigate("/clients")}>
          <Users className="h-4 w-4 text-[#A78BFA] mb-3" />
          <KpiNumber size="md" tone="blue">{clients.length}</KpiNumber>
          <Eyebrow className="mt-2">{activeClients} aktive Kunden</Eyebrow>
        </Cell>

        {/* ── AUFGABEN ── */}
        <Cell className="col-span-4 lg:col-span-4" onClick={() => navigate("/tasks")}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Aufgaben</Eyebrow>
            <div className="flex items-center gap-2">
              {highPrioTasks.length > 0 && (
                <span className="chip-danger">{highPrioTasks.length} urgent</span>
              )}
              <span className="text-[14px] font-bold tabular-nums text-foreground">{openTasks.length}</span>
            </div>
          </div>
          {displayTasks.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/50 py-2">Alles erledigt</p>
          ) : (
            <div className="space-y-2.5">
              {displayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      t.priority === "high"
                        ? "bg-adslift-danger shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                        : t.priority === "medium"
                          ? "bg-adslift-amber shadow-[0_0_6px_rgba(245,166,35,0.5)]"
                          : "bg-muted-foreground/30",
                    )}
                  />
                  <span className="text-[12.5px] truncate flex-1 text-foreground/90">{t.title}</span>
                  {t.column === "in-progress" && (
                    <span className="font-mono text-[9px] font-bold uppercase tracking-ui text-primary shrink-0">
                      In Arbeit
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Cell>

        {/* ── FORECAST ── */}
        <Cell className="col-span-4 lg:col-span-4">
          <Eyebrow tone="primary">Revenue Forecast</Eyebrow>
          {closeLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
            </div>
          ) : forecastData ? (
            <div className="mt-4">
              <div className="flex gap-5 mb-5">
                <div className="flex-1">
                  <KpiNumber size="md" tone="plain">{fmt(forecastData.totalUnweighted / 100)}</KpiNumber>
                  <Eyebrow className="mt-2">Pipeline</Eyebrow>
                </div>
                <div className="w-px bg-white/[0.08]" />
                <div className="flex-1">
                  <KpiNumber size="md" tone="blue">{fmt(forecastData.totalWeighted / 100)}</KpiNumber>
                  <Eyebrow tone="success" className="mt-2">Gewichtet</Eyebrow>
                </div>
              </div>
              <div className="space-y-2.5">
                {forecastData.byUser.map((u) => (
                  <div key={u.name} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 border border-primary/20">
                      {u.name.charAt(0)}
                    </div>
                    <span className="text-[12.5px] flex-1 text-foreground/90">{u.name.split(" ")[0]}</span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">{u.count} Deals</span>
                    <span className="text-[12.5px] font-semibold tabular-nums text-foreground">{fmt(u.weighted / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Cell>

        {/* ── AKTIVITÄTEN ── */}
        <Cell className="col-span-4 lg:col-span-4">
          <Eyebrow>Heutige Aktivitäten</Eyebrow>
          {closeLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
            </div>
          ) : activityData && activityData.byUser.length > 0 ? (
            <div className="mt-4 space-y-4">
              {activityData.byUser.map((u) => (
                <div key={u.name}>
                  <div className="text-[12px] font-semibold mb-2 text-foreground/80">
                    {u.name.split(" ")[0]}
                  </div>
                  <div className="flex gap-5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-adslift-success/15 border border-adslift-success/20 flex items-center justify-center">
                        <Phone className="h-3.5 w-3.5 text-adslift-success" />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold leading-none tabular-nums text-foreground">{u.calls}</div>
                        <div className="font-mono text-[9px] uppercase tracking-ui text-muted-foreground mt-1">Calls</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold leading-none tabular-nums text-foreground">{u.emails}</div>
                        <div className="font-mono text-[9px] uppercase tracking-ui text-muted-foreground mt-1">Mails</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-[#A78BFA]/15 border border-[#A78BFA]/20 flex items-center justify-center">
                        <Video className="h-3.5 w-3.5 text-[#A78BFA]" />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold leading-none tabular-nums text-foreground">{u.meetings}</div>
                        <div className="font-mono text-[9px] uppercase tracking-ui text-muted-foreground mt-1">Meetings</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/50 mt-4">Noch keine Aktivitäten</p>
          )}
        </Cell>

        {/* ── PROJEKTE (wide) ── */}
        <Cell className="col-span-4 lg:col-span-8" onClick={() => navigate("/pipeline")}>
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Projekte</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-ui text-primary/70 flex items-center gap-1">
              Alle <ArrowUpRight className="h-2.5 w-2.5" />
            </span>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/50">Keine aktiven Projekte</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeProjects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3.5 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold truncate text-foreground/95 leading-tight">
                        {p.name}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-ui text-muted-foreground/70 mt-0.5">
                        {p.client}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-primary shrink-0">
                      {p.progress}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-muted-foreground/60">
                    <span>{p.done}/{p.total} Tasks</span>
                    {p.deadline && <span>{format(new Date(p.deadline), "d. MMM", { locale: de })}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cell>

        {/* ── DEADLINES ── */}
        <Cell className="col-span-4 lg:col-span-4">
          <div className="flex items-center gap-1.5 mb-4">
            <Flag className="h-3.5 w-3.5 text-adslift-danger" />
            <Eyebrow>Deadlines</Eyebrow>
          </div>
          {deadlines.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/50">Keine Deadlines</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map((p, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg p-2.5 border",
                    p.isOverdue
                      ? "bg-adslift-danger/10 border-adslift-danger/20"
                      : p.isToday
                        ? "bg-adslift-amber/10 border-adslift-amber/20"
                        : "bg-white/[0.03] border-white/[0.06]",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate text-foreground/90">{p.name}</div>
                    <div className="font-mono text-[9px] uppercase tracking-ui text-muted-foreground/70 mt-0.5">{p.client}</div>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[10px] font-bold uppercase tracking-ui shrink-0",
                      p.isOverdue ? "text-adslift-danger" : p.isToday ? "text-adslift-amber" : "text-muted-foreground",
                    )}
                  >
                    {p.isToday ? "Heute" : format(p.deadlineDate, "d. MMM", { locale: de })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Cell>
      </div>
    </div>
  );
}

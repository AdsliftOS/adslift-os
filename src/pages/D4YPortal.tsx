import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getProjectCampaigns, getDailyBreakdown, type Campaign, type DailyDataPoint, type Preset } from "@/lib/meta-ads-project";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Activity,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Play,
  Rocket,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type Session = {
  customer_id: string;
  email: string;
  name: string;
  onboarding_completed?: boolean;
  variant?: "dwy" | "d4y";
};

type PipelineProject = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "done";
  variant: "dwy" | "d4y";
  ad_account_id: string | null;
  start_date: string | null;
  creatives_html: string | null;
  ad_copy_html: string | null;
  drive_link: string | null;
  drive_links: Array<{ name: string; url: string }> | null;
};

type PipelineStep = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  position: number;
  status: "todo" | "active" | "done" | "skipped";
  started_at: string | null;
  completed_at: string | null;
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

export default function D4YPortal() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [allProjects, setAllProjects] = useState<PipelineProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [briefing, setBriefing] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const project = allProjects.find((p) => p.id === selectedProjectId) || allProjects[0] || null;
  const [showKickoffModal, setShowKickoffModal] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [previewType, setPreviewType] = useState<"creatives" | "adcopy" | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dailyData, setDailyData] = useState<DailyDataPoint[]>([]);
  const [perfPreset, setPerfPreset] = useState<Preset>("last_30d");
  const [perfActiveOnly, setPerfActiveOnly] = useState(true);
  const [chartMetric, setChartMetric] = useState<"spend" | "leads" | "impressions" | "clicks">("leads");
  const [tab, setTab] = useState<"projects" | "ads">("projects");

  // Session check + frische DB-Verifikation (robust gegen stale localStorage)
  // + Admin-Preview via ?as=<customer_id>
  useEffect(() => {
    (async () => {
      // Admin-Preview-Mode: ?as=<academy_customer_id>
      const url = new URL(window.location.href);
      const asCustomerId = url.searchParams.get("as");
      if (asCustomerId) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession?.user?.email) {
          const { data: tm } = await supabase.from("team_members").select("status").eq("email", authSession.user.email).maybeSingle();
          if (tm?.status === "active") {
            // Lade den Customer-Datensatz und setz' ihn als Session
            const { data: ac } = await supabase
              .from("academy_customers")
              .select("id, email, name, variant, onboarding_completed")
              .eq("id", asCustomerId)
              .single();
            if (ac && ac.variant === "d4y") {
              const previewSession: Session = {
                customer_id: ac.id, email: ac.email, name: ac.name + " (Preview)",
                onboarding_completed: !!ac.onboarding_completed, variant: "d4y",
              };
              setSession(previewSession);
              return;
            }
            toast.error("Customer nicht gefunden oder kein D4Y");
            navigate("/pipeline", { replace: true });
            return;
          }
        }
        toast.error("Admin-Preview nur für eingeloggte Team-Member");
        navigate("/academy", { replace: true });
        return;
      }

      // Standard-Customer-Flow
      const stored = localStorage.getItem("academy_session");
      if (!stored) { navigate("/academy", { replace: true }); return; }
      let parsed: Session;
      try { parsed = JSON.parse(stored) as Session; }
      catch { localStorage.removeItem("academy_session"); navigate("/academy", { replace: true }); return; }
      if (!parsed.customer_id) { navigate("/academy", { replace: true }); return; }

      const { data, error } = await supabase
        .from("academy_customers").select("variant, onboarding_completed").eq("id", parsed.customer_id).single();
      if (error || !data) { localStorage.removeItem("academy_session"); navigate("/academy", { replace: true }); return; }
      if (data.variant !== "d4y") { navigate("/academy", { replace: true }); return; }
      if (!data.onboarding_completed) {
        localStorage.setItem("academy_session", JSON.stringify({ ...parsed, onboarding_completed: false, variant: "d4y" }));
        navigate("/onboarding?from=academy", { replace: true });
        return;
      }
      const fresh = { ...parsed, onboarding_completed: true, variant: "d4y" as const };
      localStorage.setItem("academy_session", JSON.stringify(fresh));
      setSession(fresh);
    })();
  }, [navigate]);

  // Daten laden: client_id → pipeline_project + steps
  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data: ac } = await supabase
      .from("academy_customers")
      .select("client_id")
      .eq("id", session.customer_id)
      .maybeSingle();
    if (!ac?.client_id) { setLoading(false); return; }

    // excalidraw_data NICHT laden — Board lädt sich seine Kopie selbst auf /board/:id
    const baseCols =
      "id,name,variant,status,client_id,client_email,ad_account_id,start_date," +
      "customer_portal_token,portal_pin,portal_customer_name,created_at,updated_at," +
      "creatives_html,ad_copy_html,drive_link,meeting_notes";
    let { data: pps, error: ppsErr } = await supabase
      .from("pipeline_projects")
      .select(baseCols + ",drive_links")
      .eq("client_id", ac.client_id)
      .order("created_at", { ascending: true });
    if (ppsErr && /drive_links/i.test(ppsErr.message || "")) {
      const retry = await supabase
        .from("pipeline_projects")
        .select(baseCols)
        .eq("client_id", ac.client_id)
        .order("created_at", { ascending: true });
      pps = retry.data;
    }
    if (!pps || pps.length === 0) { setLoading(false); return; }
    setAllProjects(pps);
    const currentId = selectedProjectId && pps.some((p) => p.id === selectedProjectId)
      ? selectedProjectId
      : pps[0].id;
    setSelectedProjectId(currentId);

    const { data: ps } = await supabase
      .from("pipeline_steps")
      .select("*")
      .eq("project_id", currentId)
      .order("position", { ascending: true });
    setSteps(ps ?? []);

    // Briefing-Daten laden (legacy projects table mit JSONB onboarding)
    const { data: legacyProjects } = await supabase
      .from("projects")
      .select("onboarding")
      .eq("client_id", ac.client_id);
    const projectWithOnboarding = (legacyProjects ?? []).find(
      (p: any) => p.onboarding && Object.keys(p.onboarding).length > 0,
    );
    if (projectWithOnboarding) setBriefing(projectWithOnboarding.onboarding);

    setLoading(false);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // Steps neu laden wenn User zwischen Projekten wechselt
  useEffect(() => {
    if (!selectedProjectId) return;
    if (allProjects.length === 0) return;
    (async () => {
      const { data: ps } = await supabase
        .from("pipeline_steps")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("position", { ascending: true });
      setSteps(ps ?? []);
    })();
  }, [selectedProjectId, allProjects.length]);

  // Meta-Campaigns + Daily-Data laden wenn ad_account_id verknüpft
  useEffect(() => {
    if (!project?.ad_account_id) {
      setCampaigns([]);
      setDailyData([]);
      return;
    }
    getProjectCampaigns(project.ad_account_id, perfPreset).then(({ campaigns: cs }) => {
      setCampaigns(cs);
    }).catch(() => setCampaigns([]));
    getDailyBreakdown(project.ad_account_id, perfPreset).then(({ daily }) => {
      setDailyData(daily);
    }).catch(() => setDailyData([]));
  }, [project?.ad_account_id, perfPreset]);

  // Filter Status
  const visibleCampaigns = perfActiveOnly
    ? campaigns.filter((c) => c.effectiveStatus === "ACTIVE")
    : campaigns;

  // Kickoff-Modal-Auto-Open + Calendly Script + Booking-Listener
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("academy_customers")
        .select("kickoff_call_booked")
        .eq("id", session.customer_id)
        .single();
      if (cancelled) return;
      if (data && data.kickoff_call_booked === false) setShowKickoffModal(true);
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!showKickoffModal) return;
    if (document.getElementById("calendly-widget-js")) return;
    const s = document.createElement("script");
    s.id = "calendly-widget-js";
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.head.appendChild(s);
  }, [showKickoffModal]);

  useEffect(() => {
    if (!showKickoffModal || !session) return;
    const handler = async (e: MessageEvent) => {
      const evt = (e.data && typeof e.data === "object") ? (e.data as any).event : null;
      if (evt === "calendly.event_scheduled") {
        await supabase
          .from("academy_customers")
          .update({ kickoff_call_booked: true })
          .eq("id", session.customer_id);
        setTimeout(() => setShowKickoffModal(false), 2500);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [showKickoffModal, session]);

  const handleLogout = () => {
    localStorage.removeItem("academy_session");
    navigate("/academy", { replace: true });
  };

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-white/40 text-sm">Lade ...</div>
      </div>
    );
  }

  const totalSteps = steps.length;
  const doneSteps = steps.filter((s) => s.status === "done").length;
  const activeSteps = steps.filter((s) => s.status === "active");
  const overallProgress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  // Status-Phase ableiten
  const phase = project?.status === "active" ? "live"
    : project?.status === "done" ? "done"
    : doneSteps > 0 ? "setup"
    : "starting";

  const phaseLabel = {
    starting: "Wir legen gerade los",
    setup: "Setup läuft",
    live: "Kampagne ist live",
    done: "Projekt abgeschlossen",
  }[phase];

  const phaseGradient = {
    starting: "from-blue-500 to-indigo-600",
    setup: "from-violet-500 to-fuchsia-600",
    live: "from-emerald-500 to-teal-600",
    done: "from-slate-500 to-slate-700",
  }[phase];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-2xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/adslift-icon.png" alt="Adslift" className="w-8 h-8 rounded-xl" />
            <span className="font-bold text-base">Kundenbereich</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/60 hover:text-white hover:bg-white/[0.05]">
            <LogOut className="h-4 w-4 mr-1.5" /> Abmelden
          </Button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {getGreeting()},{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              {session.name?.split(" ")[0]}
            </span>
          </h1>
          <p className="mt-1.5 text-white/40 text-sm sm:text-base">
            Hier siehst du jederzeit, woran wir gerade für dich arbeiten.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: CalendarIcon, label: "Meeting buchen", color: "violet", onClick: () => window.open("https://calendly.com/consulting-og-info/kundenmeeting-alex-adslift", "_blank") },
            { icon: MessageCircle, label: "WhatsApp", color: "emerald", onClick: () => window.open("https://api.whatsapp.com/message/6CY2BBVU45OUJ1?autoload=1&app_absent=0", "_blank") },
          ].map((qa) => (
            <button
              key={qa.label}
              onClick={qa.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/[0.06] bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.06] transition-all hover:scale-[1.02]"
            >
              <qa.icon className={cn(
                "h-4 w-4",
                qa.color === "violet" && "text-violet-400",
                qa.color === "emerald" && "text-emerald-400",
                qa.color === "blue" && "text-blue-400",
              )} />
              {qa.label}
            </button>
          ))}
        </div>

        {/* Top-Tabs: Projekte / Meta-Ads */}
        <div className="flex items-center gap-1 border-b border-white/[0.06]">
          {([
            { key: "projects", label: "Deine Projekte", icon: Sparkles },
            { key: "ads", label: "Deine Meta-Ads", icon: TrendingUp, hidden: !project?.ad_account_id },
          ] as const).filter((t) => !t.hidden).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "projects" | "ads")}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.key
                  ? "border-emerald-500 text-white"
                  : "border-transparent text-white/40 hover:text-white/80",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Multi-Project-Switcher — nur in Projects-Tab */}
        {tab === "projects" && allProjects.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-white/40">Aktiv:</span>
            {allProjects.map((p) => {
              const isActive = p.id === selectedProjectId;
              const status = p.status;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-2",
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-transparent shadow-md"
                      : "border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.04]",
                  )}
                >
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "active" && "bg-blue-400",
                    status === "done" && "bg-emerald-400",
                    status === "paused" && "bg-amber-400",
                    status === "draft" && (isActive ? "bg-white/60" : "bg-white/30"),
                  )} />
                  {p.name}
                  {isActive && <CheckCircle2 className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Pipeline-Steps */}
        {tab === "projects" && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Was wir gerade für dich tun</h3>
                <p className="text-[11px] text-white/40">Live-Status der Kampagnen-Pipeline</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {steps.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center pt-4 pb-2">
                  <Clock className="h-10 w-10 mx-auto text-emerald-400/40 mb-3" />
                  <p className="text-base font-semibold text-white/90">Setup-Pipeline wird vorbereitet</p>
                  <p className="text-xs text-white/50 mt-1.5 max-w-sm mx-auto">
                    Nach deinem Kickoff-Call legt Alex die konkreten Schritte fest und du siehst hier live den Fortschritt.
                  </p>
                </div>
                {/* Was passiert jetzt — 3-Step-Roadmap */}
                <div className="grid sm:grid-cols-3 gap-2 mt-4">
                  {[
                    { num: 1, title: "Kickoff-Call buchen", desc: "Wir gehen dein Briefing durch", done: true },
                    { num: 2, title: "Setup & Creatives", desc: "Wir bauen alles auf", done: false },
                    { num: 3, title: "Live-Schaltung", desc: "Kampagne geht on-air", done: false },
                  ].map((s) => (
                    <div
                      key={s.num}
                      className={cn(
                        "rounded-xl border p-3 text-left",
                        s.done
                          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                          : "border-white/[0.06] bg-white/[0.02]",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold",
                          s.done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.04] text-white/40",
                        )}>
                          {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                        </div>
                        <h4 className="text-xs font-semibold text-white/90">{s.title}</h4>
                      </div>
                      <p className="text-[11px] text-white/40 leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const StatusIcon = step.status === "done" ? CheckCircle2
                    : step.status === "active" ? Play
                    : Circle;
                  const statusLabel = step.status === "done" ? "Fertig"
                    : step.status === "active" ? "In Arbeit"
                    : step.status === "skipped" ? "Übersprungen"
                    : "Geplant";
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "rounded-xl border p-4 flex items-center gap-4 transition-all",
                        step.status === "done" && "border-emerald-500/30 bg-emerald-500/[0.04]",
                        step.status === "active" && "border-blue-500/30 bg-blue-500/[0.04]",
                        step.status === "todo" && "border-white/[0.06] bg-white/[0.02]",
                        step.status === "skipped" && "border-white/[0.04] bg-white/[0.01] opacity-50",
                      )}
                    >
                      <div className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                        step.status === "done" && "bg-emerald-500/20 text-emerald-400",
                        step.status === "active" && "bg-blue-500/20 text-blue-400",
                        step.status === "todo" && "bg-white/[0.04] text-white/40",
                        step.status === "skipped" && "bg-white/[0.04] text-white/30",
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm truncate">{step.name}</h4>
                          <Badge variant="outline" className={cn(
                            "text-[10px] shrink-0",
                            step.status === "done" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
                            step.status === "active" && "bg-blue-500/10 text-blue-300 border-blue-500/20",
                            step.status === "todo" && "bg-white/[0.04] text-white/40 border-white/[0.08]",
                          )}>
                            {statusLabel}
                          </Badge>
                        </div>
                        {step.description && <p className="text-xs text-white/50 line-clamp-1">{step.description}</p>}
                        {step.completed_at && (
                          <p className="text-[10px] text-white/30 mt-1">
                            Fertig am {format(new Date(step.completed_at), "dd.MM.yyyy", { locale: de })}
                          </p>
                        )}
                      </div>
                      <StatusIcon className={cn(
                        "h-5 w-5 shrink-0",
                        step.status === "done" && "text-emerald-400",
                        step.status === "active" && "text-blue-400",
                        step.status === "todo" && "text-white/30",
                      )} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Asset-Cards: Creative-Board + Ad-Copy + Google Drive (immer sichtbar) */}
        {tab === "projects" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <D4YPortalAssetCard
            title="Creative-Board"
            subtitle="Ad-Vorschauen"
            icon={ImageIcon}
            accent="from-violet-500 to-fuchsia-600"
            shadow="shadow-violet-500/20"
            hasContent={!!project?.creatives_html}
            emptyHint="Wir laden hier bald deine Ad-Creatives hoch"
            onClick={() => setPreviewType("creatives")}
          />
          <D4YPortalAssetCard
            title="Ad-Copy"
            subtitle="Werbe-Texte"
            icon={FileText}
            accent="from-blue-500 to-cyan-600"
            shadow="shadow-blue-500/20"
            hasContent={!!project?.ad_copy_html}
            emptyHint="Wir laden hier bald deine Ad-Copy-Varianten hoch"
            onClick={() => setPreviewType("adcopy")}
          />
          <D4YPortalDriveCard
            driveLinks={
              project?.drive_links && project.drive_links.length > 0
                ? project.drive_links
                : project?.drive_link
                  ? [{ name: "Drive", url: project.drive_link }]
                  : briefing?.driveLink
                    ? [{ name: "Drive", url: briefing.driveLink }]
                    : []
            }
          />
        </div>
        )}

        {/* Strategie-Board-Link (Live-Collab mit Adslift) */}
        {tab === "projects" && project && (
          <button
            onClick={() => window.open(`/board/${project.id}`, "_blank")}
            className="group w-full rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.06] via-white/[0.02] to-white/[0.02] hover:from-violet-500/[0.1] transition-all text-left p-5 flex items-center gap-4"
          >
            <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11H4l3-7 5 11 5-11 3 7h-5"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Strategie-Board
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">Live-Collab</Badge>
              </h3>
              <p className="text-[11px] text-white/50 mt-0.5">
                Whiteboard wo Adslift + du parallel an Strategie / Funnels / Ideen arbeiten — Auto-Sync alle 5s
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
          </button>
        )}

        {/* Meta-Ads Dashboard — Tab Ads */}
        {tab === "ads" && project?.ad_account_id && (() => {
          const totalSpend = visibleCampaigns.reduce((s, c) => s + (c.spend || 0), 0);
          const totalLeads = visibleCampaigns.reduce((s, c) => s + (c.leads || 0), 0);
          const totalImpr = visibleCampaigns.reduce((s, c) => s + (c.impressions || 0), 0);
          const totalClicks = visibleCampaigns.reduce((s, c) => s + (c.clicks || 0), 0);
          const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
          const avgCTR = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
          const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
          const avgCPM = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : 0;
          const bestCampaign = [...visibleCampaigns].filter((c) => c.leads > 0).sort((a, b) => a.cpl - b.cpl)[0];
          const presetLabel = {
            today: "Heute", yesterday: "Gestern", last_7d: "Letzte 7 Tage", last_14d: "Letzte 14 Tage",
            last_30d: "Letzte 30 Tage", this_month: "Diesen Monat", last_month: "Letzten Monat",
            this_quarter: "Dieses Quartal", last_quarter: "Letztes Quartal", lifetime: "Gesamt",
          }[perfPreset] || perfPreset;

          return (
            <div className="space-y-4">
              {/* Filter-Bar */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Meta-Ads Performance</h3>
                    <p className="text-[11px] text-white/40">{presetLabel} · {visibleCampaigns.length} Kampagne{visibleCampaigns.length !== 1 ? "n" : ""}{perfActiveOnly ? " (aktiv)" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={perfPreset} onValueChange={(v) => setPerfPreset(v as Preset)}>
                    <SelectTrigger className="h-9 w-auto text-xs bg-white/[0.03] border-white/[0.08] text-white/90"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Heute</SelectItem>
                      <SelectItem value="yesterday">Gestern</SelectItem>
                      <SelectItem value="last_7d">Letzte 7 Tage</SelectItem>
                      <SelectItem value="last_14d">Letzte 14 Tage</SelectItem>
                      <SelectItem value="last_30d">Letzte 30 Tage</SelectItem>
                      <SelectItem value="this_month">Diesen Monat</SelectItem>
                      <SelectItem value="last_month">Letzten Monat</SelectItem>
                      <SelectItem value="this_quarter">Dieses Quartal</SelectItem>
                      <SelectItem value="last_quarter">Letztes Quartal</SelectItem>
                      <SelectItem value="lifetime">Gesamt</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => setPerfActiveOnly((v) => !v)}
                    className={cn(
                      "px-3 h-9 rounded-md text-xs font-medium border transition-all",
                      perfActiveOnly
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-white/[0.03] text-white/60 border-white/[0.08] hover:text-white",
                    )}
                  >
                    {perfActiveOnly ? "Nur aktive" : "Alle"}
                  </button>
                </div>
              </div>

              {/* Empty-State wenn keine Daten */}
              {campaigns.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
                  <Clock className="h-8 w-8 mx-auto text-white/20 mb-3" />
                  <p className="text-sm font-medium text-white/80">Noch keine Kampagnen-Daten</p>
                  <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">Sobald deine Kampagnen live sind, siehst du hier alle KPIs in Echtzeit.</p>
                </div>
              ) : visibleCampaigns.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
                  <p className="text-sm text-white/60">Keine aktiven Kampagnen im Zeitraum.</p>
                  <button onClick={() => setPerfActiveOnly(false)} className="text-xs text-emerald-400 hover:text-emerald-300 mt-2">Alle anzeigen →</button>
                </div>
              ) : (() => {
                // Trend-Berechnung: erste Hälfte vs zweite Hälfte
                const half = Math.floor(dailyData.length / 2);
                const firstHalf = dailyData.slice(0, half);
                const secondHalf = dailyData.slice(half);
                const sumIn = (arr: typeof dailyData, k: keyof DailyDataPoint) => arr.reduce((s, d) => s + (Number(d[k]) || 0), 0);
                const trend = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
                const leadsTrend = trend(sumIn(secondHalf, "leads"), sumIn(firstHalf, "leads"));
                const spendTrend = trend(sumIn(secondHalf, "spend"), sumIn(firstHalf, "spend"));
                const cplCurrent = sumIn(secondHalf, "leads") > 0 ? sumIn(secondHalf, "spend") / sumIn(secondHalf, "leads") : 0;
                const cplPrev = sumIn(firstHalf, "leads") > 0 ? sumIn(firstHalf, "spend") / sumIn(firstHalf, "leads") : 0;
                const cplTrend = cplPrev > 0 ? Math.round(((cplCurrent - cplPrev) / cplPrev) * 100) : null;

                // Tagesdaten formatieren für Chart
                const chartData = dailyData.map((d) => ({
                  date: d.date,
                  dateLabel: new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
                  Leads: d.leads,
                  Spend: Math.round(d.spend * 100) / 100,
                  Klicks: d.clicks,
                  CPL: d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : 0,
                }));

                // Spend-Verteilung pro Kampagne
                const spendDistribution = visibleCampaigns
                  .filter((c) => c.spend > 0)
                  .sort((a, b) => b.spend - a.spend)
                  .map((c) => ({
                    name: c.name.length > 28 ? c.name.slice(0, 25) + "..." : c.name,
                    value: Math.round(c.spend * 100) / 100,
                  }));

                const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#14b8a6", "#f97316"];

                return (
                  <div className="space-y-4">
                    {/* Hero KPI-Cards mit Trends */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <KPICardTrend label="Spend" value={`${totalSpend.toFixed(0)} €`} accent="from-emerald-500 to-teal-600" trend={spendTrend} icon={<TrendingUp className="h-4 w-4" />} />
                      <KPICardTrend label="Leads" value={totalLeads.toString()} accent="from-blue-500 to-cyan-600" trend={leadsTrend} positiveIsGood icon={<CheckCircle2 className="h-4 w-4" />} />
                      <KPICardTrend label="Ø CPL" value={avgCPL > 0 ? `${avgCPL.toFixed(2)} €` : "—"} accent="from-violet-500 to-fuchsia-600" trend={cplTrend} positiveIsGood={false} icon={<TrendingUp className="h-4 w-4" />} />
                      <KPICardTrend label="Ø CTR" value={avgCTR > 0 ? `${avgCTR.toFixed(2)} %` : "—"} accent="from-amber-500 to-orange-600" trend={null} icon={<Activity className="h-4 w-4" />} />
                    </div>

                    {/* HAUPT-CHART: Leads + Spend über Zeit */}
                    {chartData.length > 1 && (
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div>
                            <h3 className="text-sm font-bold">Performance über Zeit</h3>
                            <p className="text-[11px] text-white/40 mt-0.5">{presetLabel} · täglich</p>
                          </div>
                          <div className="flex gap-1">
                            {(["leads", "spend", "clicks"] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => setChartMetric(m === "clicks" ? "clicks" : m === "spend" ? "spend" : "leads")}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize",
                                  chartMetric === m
                                    ? "bg-white/[0.08] text-white"
                                    : "text-white/40 hover:text-white/70",
                                )}
                              >
                                {m === "leads" ? "Leads" : m === "spend" ? "Spend" : "Klicks"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="h-[280px] -mx-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                              <defs>
                                <linearGradient id="grad-main" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={chartMetric === "leads" ? "#3b82f6" : chartMetric === "spend" ? "#10b981" : "#8b5cf6"} stopOpacity={0.6} />
                                  <stop offset="100%" stopColor={chartMetric === "leads" ? "#3b82f6" : chartMetric === "spend" ? "#10b981" : "#8b5cf6"} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="dateLabel" stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                              <Tooltip
                                contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                                itemStyle={{ color: chartMetric === "leads" ? "#3b82f6" : chartMetric === "spend" ? "#10b981" : "#8b5cf6" }}
                                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                              />
                              <Area
                                type="monotone"
                                dataKey={chartMetric === "leads" ? "Leads" : chartMetric === "spend" ? "Spend" : "Klicks"}
                                stroke={chartMetric === "leads" ? "#3b82f6" : chartMetric === "spend" ? "#10b981" : "#8b5cf6"}
                                strokeWidth={2.5}
                                fill="url(#grad-main)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Sekundäre KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <SmallKPI label="Impressionen" value={totalImpr.toLocaleString("de-DE")} />
                      <SmallKPI label="Klicks" value={totalClicks.toLocaleString("de-DE")} />
                      <SmallKPI label="Ø CPC" value={avgCPC > 0 ? `${avgCPC.toFixed(2)} €` : "—"} />
                      <SmallKPI label="Ø CPM" value={avgCPM > 0 ? `${avgCPM.toFixed(2)} €` : "—"} />
                    </div>

                    {/* 2-Spalten: Daily-Leads-Bars + Spend-Verteilung */}
                    <div className="grid lg:grid-cols-2 gap-3">
                      {/* Daily Leads Bars */}
                      {chartData.length > 1 && (
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-7 w-7 rounded-md bg-blue-500/20 flex items-center justify-center">
                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold">Tägliche Leads</h3>
                              <p className="text-[10px] text-white/40">Anzahl Leads pro Tag</p>
                            </div>
                          </div>
                          <div className="h-[200px] -mx-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                                <XAxis dataKey="dateLabel" stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
                                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                                  itemStyle={{ color: "#3b82f6" }}
                                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                />
                                <Bar dataKey="Leads" radius={[4, 4, 0, 0]}>
                                  {chartData.map((d, i) => (
                                    <Cell key={i} fill={d.Leads > 0 ? "#3b82f6" : "rgba(255,255,255,0.1)"} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Spend-Verteilung Donut */}
                      {spendDistribution.length > 0 && (
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-7 w-7 rounded-md bg-emerald-500/20 flex items-center justify-center">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold">Spend-Verteilung</h3>
                              <p className="text-[10px] text-white/40">pro Kampagne</p>
                            </div>
                          </div>
                          <div className="h-[200px] flex items-center">
                            <ResponsiveContainer width="55%" height="100%">
                              <PieChart>
                                <Pie data={spendDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="rgba(0,0,0,0.2)" strokeWidth={1}>
                                  {spendDistribution.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                                  itemStyle={{ color: "#fff" }}
                                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                                  formatter={(v: number) => `${v.toFixed(2)} €`}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                              {spendDistribution.slice(0, 6).map((s, i) => (
                                <div key={s.name} className="flex items-center gap-2 text-[10px]">
                                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  <span className="flex-1 truncate text-white/70">{s.name}</span>
                                  <span className="font-semibold text-white tabular-nums">{s.value.toFixed(0)} €</span>
                                </div>
                              ))}
                              {spendDistribution.length > 6 && (
                                <p className="text-[10px] text-white/30 pt-1">+ {spendDistribution.length - 6} weitere</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Best Performer Highlight */}
                    {bestCampaign && (
                      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.06] via-emerald-500/[0.02] to-transparent p-5 flex items-center gap-4">
                        <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Top Performer · niedrigster CPL</p>
                          <h4 className="text-sm font-bold mt-0.5 truncate">{bestCampaign.name}</h4>
                          <p className="text-xs text-white/50 mt-0.5">{bestCampaign.leads} Leads · {bestCampaign.cpl.toFixed(2)} € CPL · {bestCampaign.spend.toFixed(0)} € Spend</p>
                        </div>
                      </div>
                    )}

                    {/* Campaign Detail-Liste */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
                        <Activity className="h-3.5 w-3.5 text-white/40" />
                        <h3 className="text-sm font-bold">Kampagnen-Details</h3>
                        <span className="text-[11px] text-white/40">{visibleCampaigns.length} {visibleCampaigns.length === 1 ? "Kampagne" : "Kampagnen"}</span>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {visibleCampaigns
                          .sort((a, b) => b.spend - a.spend)
                          .map((c) => {
                            const sharePct = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0;
                            return (
                              <div key={c.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    c.effectiveStatus === "ACTIVE" && "bg-emerald-400 animate-pulse",
                                    c.effectiveStatus === "PAUSED" && "bg-amber-400",
                                    c.effectiveStatus !== "ACTIVE" && c.effectiveStatus !== "PAUSED" && "bg-white/30",
                                  )} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{c.name}</p>
                                    <p className="text-[10px] text-white/40 mt-0.5">{c.objective.replace("OUTCOME_", "")} · {c.effectiveStatus}</p>
                                  </div>
                                  <div className="shrink-0 text-right hidden sm:block">
                                    <p className="text-[10px] text-white/40">Anteil Spend</p>
                                    <p className="text-xs font-bold">{sharePct.toFixed(1)}%</p>
                                  </div>
                                </div>
                                {/* Spend-Bar */}
                                <div className="mb-2 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: `${sharePct}%` }} />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px] tabular-nums">
                                  <CampaignKPI label="Spend" value={`${c.spend.toFixed(0)} €`} />
                                  <CampaignKPI label="Leads" value={c.leads.toString()} />
                                  <CampaignKPI label="CPL" value={c.cpl > 0 ? `${c.cpl.toFixed(2)} €` : "—"} />
                                  <CampaignKPI label="CTR" value={c.ctr > 0 ? `${c.ctr.toFixed(2)} %` : "—"} />
                                  <CampaignKPI label="Impr." value={c.impressions.toLocaleString("de-DE")} />
                                  <CampaignKPI label="Klicks" value={c.clicks.toLocaleString("de-DE")} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Support-Footer */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">Fragen oder Feedback?</h3>
            <p className="text-xs text-white/50 mt-0.5">Schreib Alex direkt auf WhatsApp oder buch ein Meeting — meistens Antwort am gleichen Tag.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("https://api.whatsapp.com/message/6CY2BBVU45OUJ1?autoload=1&app_absent=0", "_blank")}
              className="border-white/[0.08] bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={() => window.open("https://calendly.com/consulting-og-info/kundenmeeting-alex-adslift", "_blank")}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Meeting
            </Button>
          </div>
        </div>

        <div className="text-center text-[11px] text-white/25 pt-2 pb-4">
          Adslift · Done 4 You · Bei Problemen: <a href="mailto:info@consulting-og.de" className="underline hover:text-white/50">info@consulting-og.de</a>
        </div>
      </main>

      {/* Kickoff-Modal — kompakt, Buchung öffnet in neuem Tab (kein Embed-Whitescreen-Bug) */}
      <Dialog open={showKickoffModal} onOpenChange={setShowKickoffModal}>
        <DialogContent
          className="sm:max-w-md rounded-2xl border-0 p-0 overflow-hidden"
          style={{ background: "#0a0a0f", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
        >
          <div className="relative px-8 pt-12 pb-8 text-center">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 mb-7">
                <CalendarIcon className="h-8 w-8 text-white" />
              </div>
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  Letzter Schritt
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                  Buch dir deinen Kickoff-Call
                </DialogTitle>
                <DialogDescription className="text-white/60 text-sm leading-relaxed">
                  Wir gehen dein Briefing gemeinsam durch und planen die nächsten Schritte. <strong className="text-white/80">Dauer: 45–60 Min.</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="mt-8 space-y-2">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30"
                  onClick={async () => {
                    window.open("https://calendly.com/consulting-og-info/kickoff-call-alex-adslift?primary_color=10b981", "_blank");
                    if (session) {
                      await supabase
                        .from("academy_customers")
                        .update({ kickoff_call_booked: true })
                        .eq("id", session.customer_id);
                    }
                    setTimeout(() => setShowKickoffModal(false), 500);
                  }}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Termin auswählen
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowKickoffModal(false)}
                  className="w-full text-white/50 hover:text-white hover:bg-white/[0.04]"
                >
                  Später buchen
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Briefing-Modal — Kunde sieht seine eingereichten Daten */}
      <Dialog open={showBriefingModal} onOpenChange={setShowBriefingModal}>
        <DialogContent
          className="sm:max-w-2xl max-h-[85vh] rounded-2xl border-0 p-0 overflow-hidden flex flex-col"
          style={{ background: "#0a0a0f", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
        >
          <div className="p-6 shrink-0 border-b border-white/[0.06]">
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/10 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-blue-400" />
                </div>
                <DialogTitle className="text-lg font-bold text-white">Dein Briefing</DialogTitle>
              </div>
              <DialogDescription className="text-white/60 text-sm">
                Die Daten die du im Onboarding eingereicht hast. Falls etwas geändert werden muss → schreib Alex auf WhatsApp.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {!briefing ? (
              <div className="text-center py-10 text-sm text-white/40">
                Noch kein Briefing vorhanden.
              </div>
            ) : (
              [
                {
                  title: "Basisdaten",
                  fields: [
                    { label: "Firma", value: briefing.companyName },
                    { label: "Ansprechpartner", value: briefing.contactName },
                    { label: "E-Mail", value: briefing.contactEmail },
                    { label: "Telefon", value: briefing.contactPhone },
                    { label: "Website", value: briefing.website },
                    { label: "Teamgröße", value: briefing.teamSize },
                    { label: "Services", value: Array.isArray(briefing.services) ? briefing.services.join(", ") : null },
                  ],
                },
                {
                  title: "Angebot & Positionierung",
                  fields: [
                    { label: "Hauptangebot", value: briefing.mainOffer },
                    { label: "Preisrange", value: briefing.priceRange },
                    { label: "USP", value: briefing.uspChoice === "known" ? briefing.usp : briefing.uspChoice === "unknown" ? "Wird gemeinsam erarbeitet" : briefing.usp },
                    { label: "Case Studies", value: briefing.caseStudies },
                    { label: "Aktuelle Kunden", value: briefing.currentClients },
                  ],
                },
                {
                  title: "Traumkunden",
                  fields: [
                    { label: "Idealer Kunde", value: briefing.idealClient },
                    { label: "Branche", value: Array.isArray(briefing.idealIndustry) ? briefing.idealIndustry.join(", ") : briefing.idealIndustry },
                    { label: "Kundenbudget", value: briefing.idealBudget },
                    { label: "Kundenprobleme", value: briefing.clientProblems },
                  ],
                },
                {
                  title: "Aktuelle Situation",
                  fields: [
                    { label: "Marketing-Kanäle", value: Array.isArray(briefing.currentMarketing) ? briefing.currentMarketing.join(", ") : null },
                    { label: "Leads/Monat", value: briefing.monthlyLeads },
                    { label: "Closing-Rate", value: briefing.closingRate },
                    { label: "Größte Challenge", value: briefing.biggestChallenge },
                  ],
                },
                {
                  title: "Ads & Budget",
                  fields: [
                    { label: "Ads-Erfahrung", value: briefing.adExperience },
                    { label: "Monatsbudget", value: briefing.monthlyAdBudget },
                    { label: "Ziele", value: Array.isArray(briefing.adGoal) ? briefing.adGoal.join(", ") : null },
                    { label: "Leads/Monat Ziel", value: briefing.targetLeadsPerMonth },
                    { label: "Timeline", value: briefing.timeline },
                  ],
                },
                {
                  title: "Material & Zugänge",
                  fields: [
                    { label: "Drive-Link", value: briefing.driveLink },
                    { label: "Bestehende Ads", value: briefing.existingAds },
                    { label: "MBM vorhanden", value: briefing.hasMetaBusinessManager === "yes" ? "Ja" : briefing.hasMetaBusinessManager === "no" ? "Nein" : null },
                    { label: "MBM-ID", value: briefing.metaBusinessManager },
                    { label: "Ad-Account-ID", value: briefing.adAccountId },
                    { label: "Pixel-ID", value: briefing.pixelId },
                    { label: "Ads-Website", value: briefing.websiteForAds },
                    { label: "Notizen", value: briefing.additionalNotes },
                  ],
                },
              ].map((section) => {
                const visibleFields = section.fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== "");
                if (visibleFields.length === 0) return null;
                return (
                  <div key={section.title}>
                    <h4 className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-2">{section.title}</h4>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                      {visibleFields.map((f) => (
                        <div key={f.label} className="px-4 py-2.5 flex items-start justify-between gap-3 text-sm">
                          <span className="text-white/40 shrink-0">{f.label}</span>
                          <span className="text-white/90 text-right break-words">{String(f.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-3 border-t border-white/[0.06] flex justify-end shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setShowBriefingModal(false)} className="text-white/60 hover:text-white">
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Creative-Board / Ad-Copy Preview Modal */}
      <Dialog open={previewType !== null} onOpenChange={(o) => !o && setPreviewType(null)}>
        <DialogContent
          className="sm:max-w-5xl h-[85vh] rounded-2xl border-0 p-0 overflow-hidden flex flex-col"
          style={{ background: "#0a0a0f" }}
        >
          <div className="p-4 border-b border-white/[0.06] shrink-0 flex items-center gap-2.5">
            {previewType === "creatives" ? (
              <ImageIcon className="h-4 w-4 text-violet-400" />
            ) : (
              <FileText className="h-4 w-4 text-blue-400" />
            )}
            <DialogTitle className="text-sm font-bold text-white">
              {previewType === "creatives" ? "Creative-Board" : "Ad-Copy"}
            </DialogTitle>
          </div>
          <iframe
            srcDoc={(previewType === "creatives" ? project?.creatives_html : project?.ad_copy_html) || ""}
            className="flex-1 w-full bg-white"
            sandbox="allow-same-origin allow-scripts"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Asset-Card im Kundenbereich (Creative/Ad-Copy mit Empty-State) ───
function D4YPortalAssetCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  shadow,
  hasContent,
  emptyHint,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: typeof Eye;
  accent: string;
  shadow: string;
  hasContent: boolean;
  emptyHint: string;
  onClick: () => void;
}) {
  if (!hasContent) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-5 flex items-center gap-4 opacity-70">
        <div className={cn(
          "shrink-0 h-12 w-12 rounded-xl flex items-center justify-center bg-white/[0.04]",
        )}>
          <Icon className="h-6 w-6 text-white/30" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white/70">{title}</h3>
          <p className="text-[11px] text-white/40 mt-0.5">{emptyHint}</p>
        </div>
        <Clock className="h-4 w-4 text-white/20 shrink-0" />
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all text-left p-5 flex items-center gap-4"
    >
      <div className={cn(
        "shrink-0 h-12 w-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br",
        accent,
        shadow,
      )}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[11px] text-white/50 mt-0.5">{subtitle} ansehen</p>
      </div>
      <Eye className="h-4 w-4 text-white/30 group-hover:text-white/80 transition-colors shrink-0" />
    </button>
  );
}

// ─── Google-Drive-Card im Kundenbereich ──────────────────────────────
function D4YPortalDriveCard({ driveLinks }: { driveLinks: Array<{ name: string; url: string }> }) {
  if (driveLinks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-5 flex items-center gap-4 opacity-70">
        <div className="shrink-0 h-12 w-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
          <FolderOpen className="h-6 w-6 text-white/30" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white/70">Google Drive</h3>
          <p className="text-[11px] text-white/40 mt-0.5">Noch kein Drive-Ordner verknüpft</p>
        </div>
        <Clock className="h-4 w-4 text-white/20 shrink-0" />
      </div>
    );
  }
  if (driveLinks.length === 1) {
    const only = driveLinks[0];
    return (
      <button
        onClick={() => window.open(only.url, "_blank")}
        className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-amber-500/30 transition-all text-left p-5 flex items-center gap-4"
      >
        <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <FolderOpen className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{only.name}</h3>
          <p className="text-[11px] text-white/50 mt-0.5 truncate">Google Drive · Brand-Assets</p>
        </div>
        <ExternalLink className="h-4 w-4 text-white/30 group-hover:text-white/80 transition-colors shrink-0" />
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <FolderOpen className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">Google Drive</h3>
          <p className="text-[11px] text-white/50 mt-0.5">{driveLinks.length} Ordner verknüpft</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {driveLinks.map((entry, i) => (
          <button
            key={i}
            onClick={() => window.open(entry.url, "_blank")}
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/30 transition-all text-left px-3 py-2.5 flex items-center gap-3"
          >
            <div className="shrink-0 h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{entry.name}</div>
              <div className="text-[10px] text-white/40 truncate font-mono">{entry.url}</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-white/80 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── KPI-Card mit Trend-Indikator ─────────────────────────────────────
function KPICardTrend({ label, value, accent, icon, trend, positiveIsGood = true }: {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
  trend: number | null;
  positiveIsGood?: boolean;
}) {
  const trendIsGood = trend === null ? null : positiveIsGood ? trend >= 0 : trend <= 0;
  const trendColor = trendIsGood === null ? "text-white/40"
    : trendIsGood ? "text-emerald-400"
    : "text-rose-400";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 relative overflow-hidden group hover:border-white/[0.12] transition-colors">
      <div className={cn("absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-xl bg-gradient-to-br pointer-events-none", accent)} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("h-7 w-7 rounded-md bg-gradient-to-br flex items-center justify-center text-white shadow-md", accent)}>
            {icon}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold flex-1">{label}</span>
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
        {trend !== null && (
          <div className={cn("flex items-center gap-1 mt-1.5 text-[11px] font-semibold", trendColor)}>
            <span>{trend >= 0 ? "↑" : "↓"}</span>
            <span>{Math.abs(trend)}%</span>
            <span className="text-white/30 font-normal">vs vorheriger Zeitraum</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI-Cards für Meta-Ads-Dashboard ────────────────────────────────
function KPICard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 relative overflow-hidden group hover:border-white/[0.12] transition-colors">
      <div className={cn("absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-xl bg-gradient-to-br pointer-events-none", accent)} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("h-7 w-7 rounded-md bg-gradient-to-br flex items-center justify-center text-white shadow-md", accent)}>
            {icon}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</span>
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function SmallKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{label}</p>
      <p className="text-lg font-bold mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function CampaignKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.02] px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-xs font-semibold mt-0.5">{value}</p>
    </div>
  );
}

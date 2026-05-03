import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Activity,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Download,
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
  const [project, setProject] = useState<PipelineProject | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKickoffModal, setShowKickoffModal] = useState(false);

  // Session check
  useEffect(() => {
    const stored = localStorage.getItem("academy_session");
    if (!stored) {
      navigate("/academy", { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Session;
      // Falls DWY-Kunde fälschlich auf /portal landet → zurück
      if (parsed.variant !== "d4y") {
        navigate("/academy", { replace: true });
        return;
      }
      // Falls Onboarding noch nicht ausgefüllt → zum D4Y-Briefing
      if (!parsed.onboarding_completed) {
        navigate("/portal/onboarding", { replace: true });
        return;
      }
      setSession(parsed);
    } catch {
      localStorage.removeItem("academy_session");
      navigate("/academy", { replace: true });
    }
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

    const { data: pp } = await supabase
      .from("pipeline_projects")
      .select("*")
      .eq("client_id", ac.client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pp) { setLoading(false); return; }
    setProject(pp);

    const { data: ps } = await supabase
      .from("pipeline_steps")
      .select("*")
      .eq("project_id", pp.id)
      .order("position", { ascending: true });
    setSteps(ps ?? []);

    setLoading(false);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

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
            <span className="font-bold text-base">Kundenportal</span>
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
              Done 4 You
            </Badge>
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

        {/* Status Hero */}
        <div className={cn(
          "rounded-2xl border overflow-hidden relative",
          "border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01]",
        )}>
          <div className={cn("absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-br", phaseGradient)} />
          <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
            <div className={cn(
              "shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl bg-gradient-to-br",
              phaseGradient,
            )}>
              {phase === "live" ? <Activity className="h-8 w-8 text-white" /> :
               phase === "done" ? <CheckCircle2 className="h-8 w-8 text-white" /> :
               <Rocket className="h-8 w-8 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-white/50 mb-1">Aktueller Stand</p>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">{phaseLabel}</h2>
              <p className="text-sm text-white/60">{project?.name || "Dein Adslift-Projekt"}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-3xl font-black">{overallProgress}%</p>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Setup-Fortschritt</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: CalendarIcon, label: "Meeting buchen", color: "violet", onClick: () => window.open("https://calendly.com/consulting-og-info/kundenmeeting-alex-adslift", "_blank") },
            { icon: MessageCircle, label: "WhatsApp", color: "emerald", onClick: () => window.open("https://api.whatsapp.com/message/6CY2BBVU45OUJ1?autoload=1&app_absent=0", "_blank") },
            { icon: Download, label: "Briefing-PDFs", color: "blue", onClick: () => window.open("#", "_self") },
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

        {/* Pipeline-Steps */}
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
              <div className="text-center py-10 space-y-3">
                <Clock className="h-8 w-8 mx-auto text-white/20" />
                <div>
                  <p className="text-sm font-medium text-white/80">Setup-Pipeline wird gerade vorbereitet</p>
                  <p className="text-xs text-white/40 mt-1">Dein Account-Manager Alex meldet sich nach dem Kickoff-Call mit den nächsten Schritten.</p>
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

        {/* Performance Preview (only if Live) */}
        {phase === "live" && project?.ad_account_id && (
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Live-Performance</h3>
                <p className="text-[11px] text-white/40">Dein Account-Manager teilt detaillierte Reports</p>
              </div>
            </div>
            <p className="text-sm text-white/60">
              Kampagne läuft auf Account <span className="font-mono text-white/80">{project.ad_account_id}</span>.
              Detaillierte Reports sendet dir Alex regelmäßig per WhatsApp / Email.
            </p>
          </div>
        )}

        <div className="text-center text-xs text-white/30 pt-6">
          Fragen? Schreib Alex direkt auf WhatsApp oder buch ein Meeting.
        </div>
      </main>

      {/* Kickoff-Modal */}
      <Dialog open={showKickoffModal} onOpenChange={setShowKickoffModal}>
        <DialogContent
          className="sm:max-w-5xl rounded-2xl p-0 overflow-hidden border-0"
          style={{ background: "#0a0a0f", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
        >
          <div className="p-6 sm:p-8" style={{ background: "#0a0a0f", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                Letzter Schritt
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                Buch dir deinen Kickoff-Call mit Alex
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Wir gehen dein Briefing gemeinsam durch und planen die nächsten Schritte. Dauer: 45–60 Min.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ background: "#ffffff", padding: 0, margin: 0 }}>
            <div
              className="calendly-inline-widget"
              data-url="https://calendly.com/consulting-og-info/kickoff-call-alex-adslift?primary_color=10b981&hide_gdpr_banner=1"
              style={{ minWidth: 320, height: 720, background: "#ffffff" }}
            />
          </div>
          <div className="p-4 flex justify-end" style={{ background: "#0a0a0f", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Button variant="ghost" onClick={() => setShowKickoffModal(false)} className="text-white/60 hover:text-white">
              Später buchen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

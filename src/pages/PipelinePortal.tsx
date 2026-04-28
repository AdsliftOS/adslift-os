import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Box,
  Users,
  Gift,
  Settings,
  Megaphone,
  Linkedin,
  Activity,
  Sparkles,
  Mail,
  Building2,
  Check,
  Play,
  CircleDashed,
  Pause,
  Paperclip,
  Eye,
  FileText,
  Image as ImageIcon,
  Code,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  getProjectKPIs,
  getProjectCampaigns,
  fmtEUR,
  fmtNum,
  type ProjectKPIs,
  type Campaign,
} from "@/lib/meta-ads-project";

const ICONS: Record<string, typeof Box> = {
  box: Box, users: Users, gift: Gift, settings: Settings,
  megaphone: Megaphone, linkedin: Linkedin, activity: Activity, sparkles: Sparkles,
};

const STATUS = {
  todo:    { label: "Offen",        icon: CircleDashed, ring: "ring-slate-400/20",   tone: "bg-muted text-muted-foreground" },
  active:  { label: "In Arbeit",    icon: Play,         ring: "ring-blue-500/50",     tone: "bg-blue-500/15 text-blue-500" },
  done:    { label: "Erledigt",     icon: Check,        ring: "ring-emerald-500/50",  tone: "bg-emerald-500/15 text-emerald-500" },
  skipped: { label: "Übersprungen", icon: Pause,        ring: "ring-rose-500/30",     tone: "bg-rose-500/15 text-rose-500" },
} as const;

type Step = {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: keyof typeof STATUS;
  position: number;
  startedAt: string | null;
  completedAt: string | null;
};

type Project = {
  id: string;
  name: string;
  client_email: string | null;
  status: string;
  ad_account_id: string | null;
  created_at: string;
};

type FileRow = {
  id: string;
  step_id: string;
  filename: string;
  type: string;
  content: string | null;
  url: string | null;
  created_at: string;
};

export default function PipelinePortal() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [kpis, setKpis] = useState<ProjectKPIs | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data: p, error: pe } = await supabase
        .from("pipeline_projects")
        .select("id, name, client_email, status, ad_account_id, created_at")
        .eq("customer_portal_token", token)
        .maybeSingle();
      if (pe || !p) {
        setError("Projekt nicht gefunden — Link ungültig");
        setLoading(false);
        return;
      }
      setProject(p);
      const { data: s } = await supabase
        .from("pipeline_steps")
        .select("id, name, icon, description, status, position, started_at, completed_at")
        .eq("project_id", p.id)
        .order("position");
      setSteps(
        (s || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          icon: r.icon,
          description: r.description,
          status: r.status,
          position: r.position,
          startedAt: r.started_at,
          completedAt: r.completed_at,
        })),
      );
      if (s && s.length > 0) {
        const { data: f } = await supabase
          .from("pipeline_step_files")
          .select("*")
          .in("step_id", s.map((x: any) => x.id));
        setFiles(f || []);
      }
      setLoading(false);

      // Fetch live Meta data if account is connected
      if (p.ad_account_id) {
        getProjectKPIs(p.ad_account_id, "this_month").then(setKpis);
        getProjectCampaigns(p.ad_account_id, "this_month").then(({ campaigns: cs }) =>
          setCampaigns(cs.filter((c) => c.effectiveStatus === "ACTIVE")),
        );
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <img src="/favicon.png" alt="" className="h-10 w-10 rounded-xl mx-auto animate-pulse" />
          <p className="text-xs text-muted-foreground">Lade Projekt...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-lg font-semibold">Projekt nicht gefunden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const completed = steps.filter((s) => s.status === "done").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const hasKpiData = kpis && !kpis.error && (kpis.leads > 0 || kpis.spend > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <header className="border-b bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="adslift" className="h-9 w-9 rounded-xl" />
            <div className="leading-tight">
              <div className="font-sans text-base font-extrabold tracking-tight">
                <span className="text-primary">ads</span>
                <span className="text-foreground">LIFT</span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                Kunden-Portal
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">{project.status}</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
            Dein Projekt
          </div>
          <h1 className="text-4xl font-black tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {project.client_email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {project.client_email}
              </span>
            )}
            <span>·</span>
            <span>Gestartet {format(new Date(project.created_at), "dd.MM.yyyy", { locale: de })}</span>
          </div>
        </div>

        {/* Live KPIs */}
        {project.ad_account_id && (
          <div className="rounded-2xl border bg-gradient-to-br from-blue-500/[0.06] via-emerald-500/[0.03] to-transparent overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  hasKpiData ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
                )}
              />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Live-Performance · diesen Monat
              </h3>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <img
                  src="https://cdn.simpleicons.org/meta/0866FF"
                  alt="Meta"
                  className="h-3 w-3"
                />
                Meta Ads
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
              <PortalKpi label="Leads" value={kpis?.leads} />
              <PortalKpi label="Spend" value={kpis?.spend} format="eur" accent="blue" />
              <PortalKpi label="CPL" value={kpis?.cpl} format="eur" accent="amber" />
              <PortalKpi label="CTR" value={kpis?.ctr} format="pct" />
              <PortalKpi label="Reach" value={kpis?.reach} />
              <PortalKpi label="Impressions" value={kpis?.impressions} />
            </div>
          </div>
        )}

        {/* Active campaigns */}
        {campaigns.length > 0 && (
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
              <img
                src="https://cdn.simpleicons.org/meta/0866FF"
                alt="Meta"
                className="h-4 w-4"
              />
              <h3 className="text-sm font-bold">Aktive Anzeigen</h3>
              <Badge variant="outline" className="text-[10px] ml-1">{campaigns.length}</Badge>
            </div>
            <ul className="divide-y divide-border/40">
              {campaigns.slice(0, 8).map((c) => {
                const start = c.startTime || c.createdTime;
                const days = start ? Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86400000)) : 0;
                return (
                  <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#0866FF]/10 ring-1 ring-[#0866FF]/30 flex items-center justify-center shrink-0">
                      <img
                        src="https://cdn.simpleicons.org/meta/0866FF"
                        alt="Meta"
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        läuft seit {days}d · {c.objective}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 shrink-0 text-right">
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                          Spend
                        </div>
                        <div className="text-sm font-bold tabular-nums">{fmtEUR(c.spend)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                          Leads
                        </div>
                        <div className="text-sm font-bold tabular-nums">{c.leads}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                          CPL
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {c.cpl > 0 ? fmtEUR(c.cpl) : "—"}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Progress */}
        {steps.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Fortschritt
                </div>
                <div className="text-3xl font-black tabular-nums mt-0.5">{progress}%</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{completed}/{steps.length}</div>
                <div className="text-xs text-muted-foreground">Steps abgeschlossen</div>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Pipeline steps */}
        {steps.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-10 text-center space-y-2">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Pipeline wird gerade aufgesetzt...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Projekt-Schritte
            </h2>
            <div className="space-y-3">
              {steps.map((s, idx) => (
                <PortalStepCard
                  key={s.id}
                  step={s}
                  index={idx}
                  files={files.filter((f) => f.step_id === s.id)}
                />
              ))}
            </div>
          </div>
        )}

        <footer className="pt-8 text-center text-[10px] text-muted-foreground">
          Powered by <span className="font-bold text-primary">adsLIFT</span>
        </footer>
      </main>
    </div>
  );
}

function PortalKpi({
  label,
  value,
  format = "num",
  accent,
}: {
  label: string;
  value: number | undefined;
  format?: "num" | "eur" | "pct";
  accent?: "emerald" | "blue" | "amber";
}) {
  const isMissing = value === undefined || value === null || (typeof value === "number" && Number.isNaN(value));
  const display = isMissing
    ? "—"
    : format === "eur"
    ? fmtEUR(value as number)
    : format === "pct"
    ? `${(value as number).toFixed(2)}%`
    : fmtNum(value as number);
  const accentColor = {
    emerald: "text-emerald-500",
    blue: "text-blue-500",
    amber: "text-amber-500",
  }[accent || ""] || "text-foreground";
  return (
    <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
        {label}
      </div>
      <div className={cn("text-lg font-bold tabular-nums tracking-tight mt-1", isMissing ? "text-muted-foreground/40" : !isMissing && accent ? accentColor : "")}>
        {display}
      </div>
    </div>
  );
}

function PortalStepCard({
  step,
  index,
  files,
}: {
  step: Step;
  index: number;
  files: FileRow[];
}) {
  const Icon = ICONS[step.icon] || Box;
  const statusMeta = STATUS[step.status];
  const StatusIcon = statusMeta.icon;
  const [filePreview, setFilePreview] = useState<FileRow | null>(null);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden ring-1 transition-all",
        statusMeta.ring,
        step.status === "active" && "shadow-md",
      )}
    >
      <div className="p-5 flex items-start gap-4">
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", statusMeta.tone)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                Step {String(index + 1).padStart(2, "0")}
              </div>
              <div className="font-semibold text-base leading-tight">{step.name}</div>
            </div>
            <Badge variant="outline" className={cn("text-[10px] gap-1", statusMeta.tone)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {statusMeta.label}
            </Badge>
          </div>

          {step.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          )}

          {(step.startedAt || step.completedAt) && (
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3 pt-1">
              {step.startedAt && (
                <span>Gestartet {format(new Date(step.startedAt), "dd.MM.yyyy", { locale: de })}</span>
              )}
              {step.completedAt && (
                <span>Abgeschlossen {format(new Date(step.completedAt), "dd.MM.yyyy", { locale: de })}</span>
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                <Paperclip className="h-2.5 w-2.5" />
                {files.length} Datei{files.length === 1 ? "" : "en"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {files.map((f) => {
                  const FIcon = f.type === "html" ? Code : f.type === "image" ? ImageIcon : FileText;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilePreview(f)}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/30 hover:bg-muted px-2.5 py-1 text-xs transition-colors"
                    >
                      <FIcon className="h-3 w-3" />
                      <span className="truncate max-w-[180px]">{f.filename}</span>
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {filePreview && (
        <Dialog open onOpenChange={(o) => !o && setFilePreview(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader><DialogTitle>{filePreview.filename}</DialogTitle></DialogHeader>
            {filePreview.type === "html" && filePreview.content ? (
              <iframe srcDoc={filePreview.content} className="w-full h-[60vh] rounded border bg-white" sandbox="" />
            ) : filePreview.type === "image" && (filePreview.url || filePreview.content) ? (
              <img src={filePreview.url || filePreview.content!} alt={filePreview.filename} className="max-w-full rounded" />
            ) : filePreview.url ? (
              <a href={filePreview.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Datei öffnen</a>
            ) : (
              <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded">{filePreview.content}</pre>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

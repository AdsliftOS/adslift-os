import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Check,
  Play,
  Pause,
  CircleDashed,
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
  Upload,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Eye,
  Send,
  TrendingUp,
  Calendar,
  X,
  PanelRight,
  Paperclip,
  Code,
} from "lucide-react";
import { format, differenceInDays, addDays, isToday, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useClients } from "@/store/clients";
import {
  usePipelineProjects,
  useProjectSteps,
  useStepTemplates,
  addPipelineProject,
  deletePipelineProject,
  updatePipelineProject,
  addStepFromTemplate,
  addCustomStep,
  updateProjectStep,
  deleteProjectStep,
  reorderSteps,
  addStepTask,
  toggleStepTask,
  removeStepTask,
  updateStepTaskTitle,
  type StepStatus,
  type StepTemplate,
  type ProjectStep,
  type StepTask,
} from "@/store/pipeline";
import {
  useStepFiles,
  useFileCountByStep,
  addStepFile,
  deleteStepFile,
  type StepFile,
} from "@/store/pipelineFiles";
import { PipelineGantt } from "@/components/PipelineGantt";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────

const ICONS: Record<string, typeof Box> = {
  box: Box,
  users: Users,
  gift: Gift,
  settings: Settings,
  megaphone: Megaphone,
  linkedin: Linkedin,
  activity: Activity,
  sparkles: Sparkles,
};

const STATUS_GRADIENT: Record<StepStatus, string> = {
  todo: "from-slate-500/20 to-slate-500/5",
  active: "from-blue-500/30 to-blue-500/5",
  done: "from-emerald-500/30 to-emerald-500/5",
  skipped: "from-rose-500/20 to-rose-500/5",
};

const STATUS_RING: Record<StepStatus, string> = {
  todo: "ring-slate-400/30",
  active: "ring-blue-500/60 shadow-[0_0_24px_-4px_rgba(59,130,246,0.4)]",
  done: "ring-emerald-500/50",
  skipped: "ring-rose-500/30",
};

const STATUS_BADGE: Record<StepStatus, { label: string; className: string; icon: typeof Box }> = {
  todo: {
    label: "Offen",
    className: "bg-slate-500/15 text-slate-500 border-slate-500/30",
    icon: CircleDashed,
  },
  active: {
    label: "Aktiv",
    className: "bg-blue-500/15 text-blue-500 border-blue-500/40",
    icon: Play,
  },
  done: {
    label: "Erledigt",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
    icon: Check,
  },
  skipped: {
    label: "Übersprungen",
    className: "bg-rose-500/15 text-rose-500 border-rose-500/30",
    icon: Pause,
  },
};

const PROJECT_STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
  active: { label: "Live", className: "bg-blue-500/15 text-blue-500 border-blue-500/40" },
  paused: { label: "Pausiert", className: "bg-amber-500/15 text-amber-500 border-amber-500/40" },
  done: { label: "Abgeschlossen", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" },
};

// ─── Main Page ──────────────────────────────────────────────────────

export default function Pipeline() {
  const projects = usePipelineProjects();
  const templates = useStepTemplates();
  const [clients] = useClients();
  const [filter, setFilter] = useState<"all" | "draft" | "active" | "done">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", clientId: "", adAccountId: "" });
  const [createdByEmail, setCreatedByEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCreatedByEmail(session?.user?.email || "");
    });
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  if (selectedProject) {
    return (
      <PipelineDetail
        projectId={selectedProject.id}
        onBack={() => setSelectedProjectId(null)}
        templates={templates}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
            <Badge variant="outline" className="text-[10px]">Sandbox v2</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Baukasten-Pipeline mit visuellem Flow · HTML-Upload pro Step · Kunden-Portal
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="shadow-md">
          <Plus className="h-4 w-4 mr-1" />
          Neues Projekt
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b">
        {([
          { key: "all", label: `Alle (${projects.length})` },
          { key: "draft", label: `Draft (${projects.filter((p) => p.status === "draft").length})` },
          { key: "active", label: `Live (${projects.filter((p) => p.status === "active").length})` },
          { key: "done", label: `Done (${projects.filter((p) => p.status === "done").length})` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              filter === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Noch keine Projekte</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Lege das erste Projekt an. Du wählst den Kunden, baust die Pipeline aus 6 vordefinierten Steps oder mit Custom-Steps.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Erstes Projekt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              client={clients.find((c) => c.id === p.clientId) || null}
              onClick={() => setSelectedProjectId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Projekt anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Projektname *</Label>
              <Input
                placeholder="z.B. Müller GmbH — Q3 Lead-Gen"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Kunde</Label>
              <Select
                value={createForm.clientId || "__none"}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, clientId: v === "__none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">– kein Kunde –</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.email && <span className="text-muted-foreground ml-1">({c.email})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.clientId && (() => {
                const c = clients.find((x) => x.id === createForm.clientId);
                return c?.email ? (
                  <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    E-Mail wird übernommen: <strong>{c.email}</strong>
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-500">
                    Kunde hat keine E-Mail hinterlegt — Report-Versand später nicht möglich
                  </p>
                );
              })()}
            </div>
            <div className="grid gap-2">
              <Label>Werbekonto-ID (optional)</Label>
              <Input
                placeholder="act_1234567890"
                value={createForm.adAccountId}
                onChange={(e) => setCreateForm((f) => ({ ...f, adAccountId: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Meta Ad-Account-ID für späteren Live-KPI-Transfer
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button
              onClick={async () => {
                if (!createForm.name.trim()) return toast.error("Projektname ist erforderlich");
                const client = clients.find((c) => c.id === createForm.clientId);
                const id = await addPipelineProject({
                  name: createForm.name.trim(),
                  clientId: createForm.clientId || null,
                  clientEmail: client?.email || null,
                  adAccountId: createForm.adAccountId.trim() || null,
                  createdByEmail: createdByEmail || null,
                });
                if (id) {
                  setCreateOpen(false);
                  setCreateForm({ name: "", clientId: "", adAccountId: "" });
                  setSelectedProjectId(id);
                }
              }}
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Project Card ───────────────────────────────────────────────────

function ProjectCard({
  project,
  client,
  onClick,
}: {
  project: ReturnType<typeof usePipelineProjects>[number];
  client: { name: string } | null;
  onClick: () => void;
}) {
  const steps = useProjectSteps(project.id);
  const completed = steps.filter((s) => s.status === "done").length;
  const active = steps.filter((s) => s.status === "active").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const statusMeta = PROJECT_STATUS_META[project.status] || PROJECT_STATUS_META.draft;

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border bg-card hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all overflow-hidden"
    >
      <div className="relative p-5">
        {/* gradient accent */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
            project.status === "active"
              ? "from-blue-500 via-blue-400 to-blue-500"
              : project.status === "done"
              ? "from-emerald-500 to-emerald-400"
              : project.status === "paused"
              ? "from-amber-500 to-amber-400"
              : "from-slate-500/40 to-slate-500/20",
          )}
        />
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold leading-tight line-clamp-2">{project.name}</h3>
          <Badge variant="outline" className={cn("text-[10px] shrink-0", statusMeta.className)}>
            {statusMeta.label}
          </Badge>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {client && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{client.name}</span>
            </div>
          )}
          {project.clientEmail && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              <span className="truncate">{project.clientEmail}</span>
            </div>
          )}
        </div>

        {/* Mini step preview */}
        {steps.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-0.5">
              {steps.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex-1 h-1.5 rounded-full",
                    s.status === "done" && "bg-emerald-500",
                    s.status === "active" && "bg-blue-500",
                    s.status === "todo" && "bg-muted",
                    s.status === "skipped" && "bg-rose-300/50",
                  )}
                />
              ))}
              {steps.length > 8 && (
                <span className="text-[9px] text-muted-foreground ml-1">+{steps.length - 8}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{completed}/{steps.length} Steps</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-2 bg-muted/30 text-[10px] text-muted-foreground border-t flex items-center justify-between group-hover:bg-primary/5 transition-colors">
        <span>{active > 0 ? `${active} aktiv` : "Klick → öffnen"}</span>
        <ChevronRight className="h-3 w-3 opacity-50 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

// ─── Project Detail (Pipeline-Builder + Live-View) ──────────────────

function PipelineDetail({
  projectId,
  onBack,
  templates,
}: {
  projectId: string;
  onBack: () => void;
  templates: StepTemplate[];
}) {
  const projects = usePipelineProjects();
  const project = projects.find((p) => p.id === projectId);
  const steps = useProjectSteps(projectId);
  const fileCounts = useFileCountByStep();
  const [clients] = useClients();
  const client = project?.clientId ? clients.find((c) => c.id === project.clientId) : null;

  const [addOpen, setAddOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", description: "" });
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Drag & Drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
        </Button>
        <p className="text-sm text-muted-foreground">Projekt nicht gefunden.</p>
      </div>
    );
  }

  const editingStep = steps.find((s) => s.id === editingStepId) || null;
  const completedCount = steps.filter((s) => s.status === "done").length;
  const activeCount = steps.filter((s) => s.status === "active").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const usedTemplateIds = new Set(steps.map((s) => s.templateId).filter(Boolean));
  const availableTemplates = templates.filter((t) => !usedTemplateIds.has(t.id));

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const order = steps.map((s) => s.id);
    const fromIdx = order.indexOf(dragId);
    const toIdx = order.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, dragId);
    await reorderSteps(projectId, order);
    setDragId(null);
    setDragOverId(null);
  };

  const portalUrl = project.customerPortalToken
    ? `${window.location.origin}/p/${project.customerPortalToken}`
    : null;

  const isLive = project.status === "active";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-7 text-xs">
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Alle Projekte
        </Button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge
                variant="outline"
                className={cn("text-[11px]", PROJECT_STATUS_META[project.status]?.className)}
              >
                {PROJECT_STATUS_META[project.status]?.label || project.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {client && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{client.name}</span>
              )}
              {project.clientEmail && (
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{project.clientEmail}</span>
              )}
              {project.adAccountId && (
                <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{project.adAccountId}</span>
              )}
              <span>· erstellt {format(new Date(project.createdAt), "dd.MM.yyyy", { locale: de })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <PanelRight className="h-3.5 w-3.5 mr-1" /> Kunden-Portal
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!project.clientEmail}
              onClick={() => toast.info("Report-Versand kommt in Phase 3")}
            >
              <Send className="h-3.5 w-3.5 mr-1" /> Report senden
            </Button>
            <Select
              value={project.status}
              onValueChange={(v) => updatePipelineProject(projectId, { status: v as any })}
            >
              <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Live</SelectItem>
                <SelectItem value="paused">Pausiert</SelectItem>
                <SelectItem value="done">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={async () => {
                if (!confirm(`Projekt "${project.name}" wirklich löschen?`)) return;
                await deletePipelineProject(projectId);
                onBack();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Banner — for live projects */}
      {isLive && (
        <div className="rounded-2xl border bg-gradient-to-br from-blue-500/[0.08] via-blue-500/[0.03] to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">Live-KPIs</h3>
            <Badge variant="outline" className="text-[10px]">aus Meta Ads — Phase 3</Badge>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Leads", value: "—" },
              { label: "Spend", value: "—" },
              { label: "CPL", value: "—" },
              { label: "CTR", value: "—" },
              { label: "ROAS", value: "—" },
              { label: "Frequency", value: "—" },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-card border p-3">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{k.label}</div>
                <div className="text-xl font-bold tabular-nums text-muted-foreground/40">{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress + Stats */}
      {steps.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Fortschritt" value={`${progress}%`} sub={`${completedCount}/${steps.length} Steps`} tone="primary" />
          <Stat label="Aktiv" value={activeCount} sub="Steps in Bearbeitung" tone={activeCount > 0 ? "blue" : "muted"} />
          <Stat label="Erledigt" value={completedCount} sub="abgeschlossen" tone="success" />
          <Stat label="Offen" value={steps.filter((s) => s.status === "todo").length} sub="warten" tone="muted" />
        </div>
      )}

      {/* Pipeline Canvas — visual flow with cards & connectors */}
      <div className="rounded-2xl border bg-gradient-to-br from-background via-muted/10 to-background overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Projekt-Pipeline</h3>
            <span className="text-[11px] text-muted-foreground">
              {steps.length === 0 ? "leer" : `${steps.length} Steps · drag zum Sortieren`}
            </span>
          </div>
          {steps.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Step
            </Button>
          )}
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Pipeline ist leer</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Wähle Steps aus dem Baukasten oder bau eigene. Reihenfolge per Drag&amp;Drop änderbar.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Erster Step
            </Button>
          </div>
        ) : (
          <div className="p-6 overflow-x-auto">
            <div className="flex items-stretch gap-2 min-w-fit">
              {steps.map((s, idx) => (
                <div key={s.id} className="flex items-stretch gap-2 shrink-0">
                  <StepCard
                    step={s}
                    index={idx}
                    fileCount={fileCounts.get(s.id) || 0}
                    isDragOver={dragOverId === s.id}
                    isDragging={dragId === s.id}
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    onDragOver={() => setDragOverId(s.id)}
                    onDragLeave={() => dragOverId === s.id && setDragOverId(null)}
                    onDrop={() => handleDrop(s.id)}
                    onClick={() => setEditingStepId(s.id)}
                  />
                  {idx < steps.length - 1 && <Connector status={s.status} />}
                </div>
              ))}
              <button
                onClick={() => setAddOpen(true)}
                className="shrink-0 w-[200px] rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all py-8"
              >
                <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">Step hinzufügen</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gantt-Timeline — proper calendar-style for live projects */}
      {isLive && steps.length > 0 && <PipelineGantt steps={steps} />}

      {/* Add step dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Step hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Aus Baukasten wählen
              </p>
              {availableTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  Alle Default-Templates sind schon im Projekt.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableTemplates.map((t) => {
                    const Icon = ICONS[t.icon] || Box;
                    return (
                      <button
                        key={t.id}
                        onClick={async () => {
                          await addStepFromTemplate(projectId, t, steps.length);
                          setAddOpen(false);
                        }}
                        className="text-left rounded-xl border p-3 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: t.color + "22", color: t.color }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="font-semibold text-sm leading-tight">{t.name}</div>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t pt-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setAddOpen(false); setCustomOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Eigenen Step bauen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom step dialog */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Step bauen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                placeholder="z.B. Webseite live schalten"
                value={customForm.name}
                onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung</Label>
              <Textarea
                placeholder="Optional"
                value={customForm.description}
                onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Abbrechen</Button>
            <Button
              onClick={async () => {
                if (!customForm.name.trim()) return toast.error("Name erforderlich");
                await addCustomStep(
                  projectId,
                  { name: customForm.name.trim(), description: customForm.description.trim() },
                  steps.length,
                );
                setCustomForm({ name: "", description: "" });
                setCustomOpen(false);
              }}
            >
              Step anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step detail panel (with file upload) */}
      {editingStep && (
        <StepDetailDialog
          step={editingStep}
          onClose={() => setEditingStepId(null)}
          onDeleted={() => setEditingStepId(null)}
        />
      )}

      {/* Share / customer portal dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kunden-Portal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Dein Kunde sieht diese Seite read-only mit dem aktuellen Pipeline-Stand und allen hochgeladenen Files.
            </p>
            {portalUrl ? (
              <>
                <div className="flex items-center gap-2">
                  <Input value={portalUrl} readOnly className="font-mono text-xs" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(portalUrl);
                      toast.success("Link kopiert");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Token-basiert — kein Login nötig. Wer den Link hat, sieht das Projekt.
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-500">Kein Portal-Token. Speichere das Projekt einmal neu.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Step Card ──────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  fileCount,
  isDragOver,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  step: ProjectStep;
  index: number;
  fileCount: number;
  isDragOver: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onClick: () => void;
}) {
  const Icon = ICONS[step.icon] || Box;
  const status = STATUS_BADGE[step.status];
  const StatusIcon = status.icon;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={onClick}
      className={cn(
        "shrink-0 w-[220px] rounded-2xl border-2 border-transparent bg-card cursor-pointer overflow-hidden group relative ring-1",
        STATUS_RING[step.status],
        isDragging && "opacity-30 scale-95",
        isDragOver && "ring-2 ring-primary ring-offset-2 scale-[1.03]",
        "transition-all duration-200",
      )}
    >
      {/* gradient header */}
      <div className={cn("h-2 bg-gradient-to-r", STATUS_GRADIENT[step.status])} />

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              step.status === "active" && "bg-blue-500/15 text-blue-500",
              step.status === "done" && "bg-emerald-500/15 text-emerald-500",
              step.status === "todo" && "bg-muted text-muted-foreground",
              step.status === "skipped" && "bg-rose-500/15 text-rose-500",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
              Step {String(index + 1).padStart(2, "0")}
            </div>
            <div className="font-semibold text-sm leading-tight mt-0.5 line-clamp-2">{step.name}</div>
          </div>
        </div>

        {step.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{step.description}</p>
        )}

        {/* Task progress */}
        {(() => {
          const tasks: StepTask[] = Array.isArray(step.data?.tasks) ? step.data.tasks : [];
          if (tasks.length === 0) return null;
          const done = tasks.filter((t) => t.done).length;
          const pct = (done / tasks.length) * 100;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] tabular-nums">
                <span className="text-muted-foreground/70">Sub-Tasks</span>
                <span className="font-semibold">
                  {done}/{tasks.length}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct === 100
                      ? "bg-emerald-500"
                      : pct > 0
                      ? "bg-blue-500"
                      : "bg-muted-foreground/30",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}

        <div className="flex items-center justify-between pt-2 border-t border-current/5">
          <Badge variant="outline" className={cn("text-[10px] gap-1 py-0", status.className)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {status.label}
          </Badge>
          {fileCount > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-2.5 w-2.5" />
              {fileCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Connector ──────────────────────────────────────────────────────

function Connector({ status }: { status: StepStatus }) {
  const color =
    status === "done"
      ? "from-emerald-500/60 to-emerald-500/40"
      : status === "active"
      ? "from-blue-500/60 to-blue-500/40"
      : "from-muted-foreground/30 to-muted-foreground/20";
  return (
    <div className="flex items-center self-center shrink-0 px-1">
      <div className={cn("h-[3px] w-8 rounded-full bg-gradient-to-r", color)} />
      <div
        className={cn(
          "h-2 w-2 rotate-45 border-r-[2.5px] border-t-[2.5px] -ml-1.5",
          status === "done" && "border-emerald-500/60",
          status === "active" && "border-blue-500/60",
          (status === "todo" || status === "skipped") && "border-muted-foreground/40",
        )}
      />
    </div>
  );
}

// ─── Step Detail Dialog ─────────────────────────────────────────────

function StepDetailDialog({
  step,
  onClose,
  onDeleted,
}: {
  step: ProjectStep;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const files = useStepFiles(step.id);
  const [name, setName] = useState(step.name);
  const [description, setDescription] = useState(step.description);
  const [status, setStatus] = useState<StepStatus>(step.status);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Sync if external step changes
  useEffect(() => {
    setName(step.name);
    setDescription(step.description);
    setStatus(step.status);
  }, [step.id]);

  const Icon = ICONS[step.icon] || Box;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                status === "active" && "bg-blue-500/15 text-blue-500",
                status === "done" && "bg-emerald-500/15 text-emerald-500",
                status === "todo" && "bg-muted text-muted-foreground",
                status === "skipped" && "bg-rose-500/15 text-rose-500",
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">{step.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Step bearbeiten · Files anhängen</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StepStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["todo", "active", "done", "skipped"] as StepStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_BADGE[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Tasks section */}
          <div className="border-t pt-4 space-y-2">
            <TasksSection step={step} />
          </div>

          {/* Files section */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Files / Creatives / Adcopies
              </Label>
              <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Hochladen
              </Button>
            </div>
            {files.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-6 text-center text-xs text-muted-foreground">
                Noch keine Dateien hochgeladen. HTML / Bilder / PDFs werden für den Kunden im Portal sichtbar.
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {files.map((f) => (
                  <FileRow key={f.id} file={f} />
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive mr-auto"
            onClick={async () => {
              if (!confirm("Step löschen?")) return;
              await deleteProjectStep(step.id);
              onDeleted();
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Löschen
          </Button>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            onClick={async () => {
              await updateProjectStep(step.id, { name, description, status });
              onClose();
            }}
          >
            Speichern
          </Button>
        </DialogFooter>

        {uploadOpen && (
          <UploadDialog stepId={step.id} onClose={() => setUploadOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── File Row ───────────────────────────────────────────────────────

function FileRow({ file }: { file: StepFile }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const Icon = file.type === "html" ? Code : file.type === "image" ? ImageIcon : FileText;
  return (
    <li className="px-3 py-2 flex items-center gap-2 group hover:bg-muted/30">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{file.filename}</div>
        <div className="text-[10px] text-muted-foreground">
          {file.type} · {format(new Date(file.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
        </div>
      </div>
      {(file.content || file.url) && (
        <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={async () => {
          if (!confirm(`"${file.filename}" löschen?`)) return;
          await deleteStepFile(file.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {previewOpen && (
        <Dialog open onOpenChange={(o) => !o && setPreviewOpen(false)}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{file.filename}</DialogTitle>
            </DialogHeader>
            {file.type === "html" && file.content ? (
              <iframe srcDoc={file.content} className="w-full h-[60vh] rounded border bg-white" sandbox="" />
            ) : file.type === "image" && file.url ? (
              <img src={file.url} alt={file.filename} className="max-w-full rounded" />
            ) : file.url ? (
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Datei öffnen
              </a>
            ) : (
              <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded">{file.content}</pre>
            )}
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}

// ─── Upload Dialog ──────────────────────────────────────────────────

function UploadDialog({ stepId, onClose }: { stepId: string; onClose: () => void }) {
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<StepFile["type"]>("html");
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploaderEmail, setUploaderEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUploaderEmail(session?.user?.email || null);
    });
  }, []);

  const handleFile = (file: File) => {
    setFilename(file.name);
    if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
      setType("html");
      const reader = new FileReader();
      reader.onload = (e) => setContent(String(e.target?.result || ""));
      reader.readAsText(file);
    } else if (file.type.startsWith("image/")) {
      setType("image");
      const reader = new FileReader();
      reader.onload = (e) => setContent(String(e.target?.result || ""));
      reader.readAsDataURL(file);
    } else {
      setType("other");
      const reader = new FileReader();
      reader.onload = (e) => setContent(String(e.target?.result || ""));
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Datei hochladen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInput.current?.click()}
            className="rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 p-8 text-center cursor-pointer transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium">HTML / Bild / PDF hochladen</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Drop hier oder Klick zum Auswählen
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".html,.htm,image/*,.pdf,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          {filename && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-xs">
                <strong>{filename}</strong> · {type}
              </div>
              {type === "html" && (
                <div className="text-[10px] text-muted-foreground">
                  Inline-Preview im Portal verfügbar.
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Dateiname</Label>
              <Input value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Typ</Label>
              <Select value={type} onValueChange={(v) => setType(v as StepFile["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="other">Andere</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            disabled={!filename || !content}
            onClick={async () => {
              const isImage = type === "image";
              await addStepFile({
                stepId,
                filename: filename.trim(),
                type,
                content: isImage ? null : content,
                url: isImage ? content : null,
                uploadedByEmail: uploaderEmail,
              });
              onClose();
            }}
          >
            Hochladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stat tile ──────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: "primary" | "blue" | "success" | "muted";
}) {
  const colors = {
    primary: "border-primary/30 bg-primary/[0.06]",
    blue: "border-blue-500/30 bg-blue-500/[0.06]",
    success: "border-emerald-500/30 bg-emerald-500/[0.06]",
    muted: "border-muted-foreground/15 bg-muted/30",
  };
  return (
    <div className={cn("rounded-xl border p-4", colors[tone])}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Sub-Tasks section in step detail ───────────────────────────────

function TasksSection({ step }: { step: ProjectStep }) {
  const tasks: StepTask[] = Array.isArray(step.data?.tasks) ? step.data.tasks : [];
  const [newTask, setNewTask] = useState("");
  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const handleAdd = async () => {
    const t = newTask.trim();
    if (!t) return;
    await addStepTask(step.id, t);
    setNewTask("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Sub-Tasks
          {tasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              · {done}/{tasks.length} ({pct}%)
            </span>
          )}
        </Label>
      </div>

      {tasks.length > 0 && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct === 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-muted-foreground/30",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <ul className="space-y-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} stepId={step.id} task={t} />
        ))}
      </ul>

      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Neuer Sub-Task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newTask.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {tasks.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Keine Sub-Tasks. Default-Templates haben automatisch eine Checkliste — bei Custom-Steps kannst du sie hier hinzufügen.
        </p>
      )}
    </div>
  );
}

function TaskRow({ stepId, task }: { stepId: string; task: StepTask }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  // sync external changes
  useEffect(() => setTitle(task.title), [task.title]);

  return (
    <li className="flex items-center gap-2 group rounded-md hover:bg-muted/30 px-1 py-0.5">
      <button
        onClick={() => toggleStepTask(stepId, task.id)}
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
          task.done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {task.done && <Check className="h-3 w-3" />}
      </button>
      {editing ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={async () => {
            if (title.trim() && title !== task.title) {
              await updateStepTaskTitle(stepId, task.id, title.trim());
            }
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(task.title);
              setEditing(false);
            }
          }}
          autoFocus
          className="h-6 text-xs flex-1"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            "flex-1 text-left text-xs py-1 leading-tight",
            task.done && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => removeStepTask(stepId, task.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </li>
  );
}

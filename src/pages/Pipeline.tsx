import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  Lock,
  MessageSquare,
  Download,
  FolderOpen,
  GraduationCap,
  ClipboardList,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { format, differenceInDays, addDays, isToday, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useClients } from "@/store/clients";
import { OnboardingDetails } from "@/pages/ClientDetail";
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
  useStepFilesByProject,
  addStepFile,
  deleteStepFile,
  downloadFile,
  type StepFile,
} from "@/store/pipelineFiles";
import { PipelineGantt } from "@/components/PipelineGantt";
import {
  getProjectKPIs,
  getProjectCampaigns,
  listMetaAccounts,
  fmtEUR,
  fmtNum,
  type ProjectKPIs,
  type Campaign,
  type MetaAccount,
  type Preset,
} from "@/lib/meta-ads-project";
import {
  useFeedback,
  useUnreadFeedbackCount,
  markFeedbackRead,
  markProjectFeedbackRead,
  deleteFeedback,
  type Feedback,
} from "@/store/pipelineFeedback";
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
  const [variantFilter, setVariantFilter] = useState<"all" | "dwy" | "d4y">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ name: string; clientId: string; adAccountId: string; variant: "dwy" | "d4y" }>({ name: "", clientId: "", adAccountId: "", variant: "dwy" });
  const [createdByEmail, setCreatedByEmail] = useState<string>("");
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCreatedByEmail(session?.user?.email || "");
    });
  }, []);

  // Load Meta-Accounts when create dialog opens
  useEffect(() => {
    if (!createOpen || metaAccounts.length > 0) return;
    setMetaLoading(true);
    listMetaAccounts()
      .then(setMetaAccounts)
      .finally(() => setMetaLoading(false));
  }, [createOpen]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const filtered = useMemo(() => {
    let list = projects;
    if (variantFilter !== "all") list = list.filter((p) => p.variant === variantFilter);
    if (filter !== "all") list = list.filter((p) => p.status === filter);
    return list;
  }, [projects, filter, variantFilter]);

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

      {/* Filter Bar — Variant Segmented Control + Status Pills */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Variant segmented control */}
        <div className="inline-flex items-center p-1 rounded-xl bg-muted/40 border">
          {([
            { key: "all", label: "Alle", count: projects.length, color: "from-slate-500 to-slate-600", textColor: "text-slate-600" },
            { key: "dwy", label: "DWY", count: projects.filter((p) => p.variant === "dwy").length, color: "from-violet-500 to-indigo-600", textColor: "text-violet-600" },
            { key: "d4y", label: "D4Y", count: projects.filter((p) => p.variant === "d4y").length, color: "from-emerald-500 to-teal-600", textColor: "text-emerald-600" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setVariantFilter(t.key)}
              className={cn(
                "relative px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                variantFilter === t.key
                  ? `bg-gradient-to-r ${t.color} text-white shadow-md shadow-black/10`
                  : `text-muted-foreground hover:${t.textColor} hover:bg-background`,
              )}
            >
              {t.label}
              <span className={cn(
                "min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums",
                variantFilter === t.key
                  ? "bg-white/25 text-white"
                  : "bg-muted text-muted-foreground",
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="inline-flex items-center gap-1.5">
          {([
            { key: "all", label: "Alle", count: filtered.length, dot: "bg-slate-400" },
            { key: "draft", label: "Draft", count: projects.filter((p) => p.status === "draft" && (variantFilter === "all" || p.variant === variantFilter)).length, dot: "bg-slate-400" },
            { key: "active", label: "Live", count: projects.filter((p) => p.status === "active" && (variantFilter === "all" || p.variant === variantFilter)).length, dot: "bg-blue-500" },
            { key: "done", label: "Done", count: projects.filter((p) => p.status === "done" && (variantFilter === "all" || p.variant === variantFilter)).length, dot: "bg-emerald-500" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2",
                filter === t.key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
              {t.label}
              <span className={cn(
                "tabular-nums text-[10px]",
                filter === t.key ? "opacity-70" : "opacity-50",
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
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
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
              <Label>Modell *</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "dwy" as const, label: "Done With You", desc: "Coaching + Academy" },
                  { v: "d4y" as const, label: "Done 4 You",    desc: "Wir machen alles" },
                ]).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, variant: opt.v }))}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      createForm.variant === opt.v
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
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
              <Label>Meta Werbekonto</Label>
              {metaAccounts.length > 0 ? (
                <Select
                  value={createForm.adAccountId || "__none"}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, adAccountId: v === "__none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Werbekonto auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">– kein Werbekonto –</SelectItem>
                    {metaAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                        <span className="text-muted-foreground ml-2 font-mono text-[10px]">{a.id}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={metaLoading ? "Lade Meta-Accounts..." : "act_1234567890"}
                  value={createForm.adAccountId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, adAccountId: e.target.value }))}
                  disabled={metaLoading}
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                {metaAccounts.length > 0
                  ? `${metaAccounts.length} Werbekonten gefunden — Live-KPIs erscheinen direkt nach Anlage`
                  : "Meta Ad-Account-ID für Live-KPIs (Leads / Spend / CPL / CTR ...)"}
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
                  variant: createForm.variant,
                  clientId: createForm.clientId || null,
                  clientEmail: client?.email || null,
                  adAccountId: createForm.adAccountId.trim() || null,
                  createdByEmail: createdByEmail || null,
                });
                if (id) {
                  setCreateOpen(false);
                  setCreateForm({ name: "", clientId: "", adAccountId: "", variant: "dwy" });
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
  const isDWY = project.variant === "dwy";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left aspect-square rounded-lg border bg-card hover:shadow-md hover:scale-[1.02] transition-all duration-200 overflow-hidden relative flex flex-col",
        project.status === "active" && "hover:border-blue-500/60",
        project.status === "done" && "hover:border-emerald-500/60",
        project.status === "paused" && "hover:border-amber-500/60",
        project.status === "draft" && "hover:border-primary/60",
      )}
    >
      {/* Variant gradient strip */}
      <div className={cn(
        "h-0.5 w-full bg-gradient-to-r",
        isDWY ? "from-violet-500 to-indigo-500" : "from-emerald-500 to-teal-500",
      )} />

      <div className="p-2.5 flex-1 flex flex-col gap-2">
        {/* Top: Variant + Status */}
        <div className="flex items-center justify-between gap-1">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-gradient-to-r",
            isDWY ? "from-violet-500 to-indigo-600" : "from-emerald-500 to-teal-600",
          )}>
            {isDWY ? "DWY" : "D4Y"}
          </span>
          <span className={cn("text-[9px] font-medium", statusMeta.className.split(" ").filter(c => c.startsWith("text-")).join(" "))}>
            {statusMeta.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-xs leading-tight line-clamp-2">{project.name}</h3>

        {/* Client */}
        {client && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{client.name}</span>
          </div>
        )}

        {/* Progress — pinned bottom */}
        <div className="mt-auto space-y-1">
          {steps.length > 0 ? (
            <>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    project.status === "done" && "bg-emerald-500",
                    project.status === "active" && "bg-blue-500",
                    project.status === "paused" && "bg-amber-500",
                    project.status === "draft" && "bg-slate-400",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] tabular-nums">
                <span className="text-muted-foreground">{completed}/{steps.length}</span>
                <span className="font-semibold">{progress}%</span>
              </div>
            </>
          ) : (
            <div className="text-[9px] text-muted-foreground">Noch keine Steps</div>
          )}
        </div>
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
  const [reportOpen, setReportOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; priority: "low" | "med" | "high"; dueDate: string; category: string }>({ title: "", description: "", priority: "med", dueDate: "", category: "Allgemein" });
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserEmail(session?.user?.email || "");
    });
  }, []);

  // Drag & Drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Mode tab — Setup / Live-Operations / Onboarding / Academy
  // Default depends on project status.
  const projectForMode = projects.find((p) => p.id === projectId);
  const defaultMode: "setup" | "ops" | "onboarding" | "academy" =
    projectForMode?.status === "active" || projectForMode?.status === "done"
      ? "ops"
      : "setup";
  const [mode, setMode] = useState<"setup" | "ops" | "onboarding" | "academy">(defaultMode);
  const isDWY = projectForMode?.variant === "dwy";

  // Onboarding-Daten + Academy-Progress für die neuen Tabs
  const [onboardingProjects, setOnboardingProjects] = useState<any[]>([]);
  const [academyData, setAcademyData] = useState<{
    customer: any | null;
    courses: any[];
    chapters: any[];
    lessons: any[];
    progress: any[];
  }>({ customer: null, courses: [], chapters: [], lessons: [], progress: [] });

  useEffect(() => {
    if (!projectForMode?.clientId) {
      setOnboardingProjects([]);
      setAcademyData({ customer: null, courses: [], chapters: [], lessons: [], progress: [] });
      return;
    }
    (async () => {
      // 1. Legacy projects mit Onboarding-JSON
      const { data: legacy } = await supabase
        .from("projects").select("*").eq("client_id", projectForMode.clientId);
      setOnboardingProjects(legacy ?? []);

      // 2. Academy-Customer + Progress
      const { data: customer } = await supabase
        .from("academy_customers").select("*").eq("client_id", projectForMode.clientId).maybeSingle();
      const [coursesRes, chaptersRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from("courses").select("*").eq("is_published", true).order("sort_order", { ascending: true }),
        supabase.from("chapters").select("*").order("sort_order", { ascending: true }),
        supabase.from("lessons").select("*").eq("is_published", true).order("sort_order", { ascending: true }),
        customer
          ? supabase.from("lesson_progress").select("*").eq("customer_id", customer.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setAcademyData({
        customer: customer || null,
        courses: coursesRes.data ?? [],
        chapters: chaptersRes.data ?? [],
        lessons: lessonsRes.data ?? [],
        progress: (progressRes.data as any[]) ?? [],
      });
    })();
  }, [projectForMode?.clientId]);

  // Live campaigns from Meta — fed into Operations panel + Gantt
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  useEffect(() => {
    if (!projectForMode?.adAccountId) return;
    getProjectCampaigns(projectForMode.adAccountId, "this_month").then(({ campaigns: cs }) =>
      setCampaigns(cs),
    );
  }, [projectForMode?.adAccountId]);

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
              <ProjectAdAccountPicker project={project} />
              <span>· erstellt {format(new Date(project.createdAt), "dd.MM.yyyy", { locale: de })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isDWY && (
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                <PanelRight className="h-3.5 w-3.5 mr-1" /> Kunden-Portal
              </Button>
            )}
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

      {/* Mode tabs — Setup / Live-Ops / Onboarding / Academy */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/30 border w-fit flex-wrap">
        <ModeTab
          active={mode === "setup"}
          onClick={() => setMode("setup")}
          icon={Sparkles}
          title="Setup"
          subtitle="Pipeline aufbauen · Steps & Tasks"
          accent="from-blue-500/30 to-blue-500/10"
        />
        <ModeTab
          active={mode === "ops"}
          onClick={() => setMode("ops")}
          icon={Activity}
          title="Live-Operations"
          subtitle="Ads laufen · Reports · Optimierungen"
          accent="from-emerald-500/30 to-emerald-500/10"
          badge={isLive ? "LIVE" : undefined}
        />
        <ModeTab
          active={mode === "onboarding"}
          onClick={() => setMode("onboarding")}
          icon={ClipboardList}
          title="Onboarding"
          subtitle="Wizard-Daten · USP · Zielgruppe"
          accent="from-amber-500/30 to-amber-500/10"
        />
        {isDWY && (
          <ModeTab
            active={mode === "academy"}
            onClick={() => setMode("academy")}
            icon={GraduationCap}
            title="Academy"
            subtitle="Module · Lessons · Detail-Progress"
            accent="from-violet-500/30 to-violet-500/10"
          />
        )}
      </div>

      {/* Setup-Stats (nur für D4Y mit Steps) */}
      {mode === "setup" && !isDWY && steps.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Fortschritt" value={`${progress}%`} sub={`${completedCount}/${steps.length} Steps`} tone="primary" />
          <Stat label="Aktiv" value={activeCount} sub="Steps in Bearbeitung" tone={activeCount > 0 ? "blue" : "muted"} />
          <Stat label="Erledigt" value={completedCount} sub="abgeschlossen" tone="success" />
          <Stat label="Offen" value={steps.filter((s) => s.status === "todo").length} sub="warten" tone="muted" />
        </div>
      )}

      {/* Live-Operations-Header — nur in ops-mode */}
      {mode === "ops" && (
        <OperationsHeader project={project} steps={steps} />
      )}

      {/* Files-Panel nur für D4Y im Setup */}
      {mode === "setup" && !isDWY && steps.length > 0 && (
        <ProjectFilesPanel steps={steps} onOpenStep={(id) => setEditingStepId(id)} />
      )}

      {/* Setup für DWY: grobes Dashboard (compact overview) */}
      {mode === "setup" && isDWY && (
        <DWYSetupDashboard
          data={academyData}
          onboardingProjects={onboardingProjects}
          onJumpToAcademy={() => setMode("academy")}
          onJumpToOnboarding={() => setMode("onboarding")}
        />
      )}

      {/* Tasks-Section auf Setup-Page (für DWY und D4Y) */}
      {mode === "setup" && project.clientId && (
        <ProjectTasksSection
          clientId={project.clientId}
          clientName={client?.name || project.name}
          onCreateClick={() => setTaskCreateOpen(true)}
        />
      )}

      {/* Academy-Tab (DWY): detaillierte Module + Lessons */}
      {mode === "academy" && isDWY && (
        <AcademyProgressView data={academyData} />
      )}

      {/* Setup für D4Y: manueller Step-Builder */}
      {mode === "setup" && !isDWY && (
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
                  <Connector status={s.status} />
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

      )}

      {/* Operations content */}
      {mode === "ops" && (
        <OperationsView
          project={project}
          steps={steps}
          onJumpToSetup={() => setMode("setup")}
          onOpenStep={(stepId) => setEditingStepId(stepId)}
        />
      )}

      {/* Onboarding content */}
      {mode === "onboarding" && (
        <div>
          {project.clientId ? (
            onboardingProjects.length > 0 && onboardingProjects.some((p) => p.onboarding && Object.keys(p.onboarding).length > 0) ? (
              <OnboardingDetails projects={onboardingProjects} />
            ) : (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                Kunde hat das Onboarding-Form noch nicht ausgefüllt.
              </CardContent></Card>
            )
          ) : (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              Diesem Projekt ist kein Kunde zugeordnet — Onboarding-Daten nicht verknüpfbar.
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Gantt-Timeline — nur bei D4Y im Setup oder bei Live-Ops, niemals in Onboarding/Academy */}
      {((mode === "setup" && !isDWY) || mode === "ops") && (steps.length > 0 || campaigns.length > 0) && (
        <PipelineGantt
          steps={steps}
          campaigns={campaigns}
          defaultSource={mode === "setup" ? "steps" : "campaigns"}
        />
      )}

      {/* Add step dialog */}
      <AddStepDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        availableTemplates={availableTemplates}
        onAddTemplate={async (t) => {
          await addStepFromTemplate(projectId, t, steps.length);
          setAddOpen(false);
        }}
        onCustom={() => {
          setAddOpen(false);
          setCustomOpen(true);
        }}
      />

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

      {/* Task create dialog */}
      <Dialog open={taskCreateOpen} onOpenChange={setTaskCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Task für {project.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input
                placeholder="z.B. Creative-Briefing erstellen"
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung</Label>
              <Textarea
                rows={3}
                placeholder="Details zur Task..."
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Priorität</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="med">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fälligkeit</Label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Kategorie</Label>
              <Input
                placeholder="z.B. Setup / Creative / Sales"
                value={taskForm.category}
                onChange={(e) => setTaskForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskCreateOpen(false)}>Abbrechen</Button>
            <Button
              onClick={async () => {
                if (!taskForm.title.trim()) return toast.error("Titel ist erforderlich");
                const { error } = await supabase.from("tasks").insert({
                  title: taskForm.title.trim(),
                  description: taskForm.description.trim() || null,
                  priority: taskForm.priority,
                  due_date: taskForm.dueDate || null,
                  category: taskForm.category.trim() || "Allgemein",
                  col: "todo",
                  client_id: project.clientId || null,
                  assignee: currentUserEmail || null,
                });
                if (error) {
                  toast.error("Task konnte nicht angelegt werden");
                  return;
                }
                toast.success("Task angelegt");
                setTaskForm({ title: "", description: "", priority: "med", dueDate: "", category: "Allgemein" });
                setTaskCreateOpen(false);
              }}
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report send dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        project={project}
        steps={steps}
        completedCount={completedCount}
        progress={progress}
      />

      {/* Share / customer portal dialog */}
      <PortalShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        project={project}
        portalUrl={portalUrl}
      />
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
  const files = useStepFiles(step.id);
  const [previewFile, setPreviewFile] = useState<StepFile | null>(null);

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

        {/* File chips — clickable directly from card */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-current/5">
            {files.slice(0, 4).map((f) => {
              const FIcon = f.type === "html" ? Code : f.type === "image" ? ImageIcon : FileText;
              return (
                <button
                  key={f.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewFile(f);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/30 hover:bg-muted hover:border-primary px-1.5 py-0.5 text-[9px] transition-colors max-w-[90px]"
                  title={f.filename}
                >
                  <FIcon className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{f.filename}</span>
                </button>
              );
            })}
            {files.length > 4 && (
              <span className="text-[9px] text-muted-foreground self-center">
                +{files.length - 4}
              </span>
            )}
          </div>
        )}

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

      {previewFile && (
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
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
  const [startedAt, setStartedAt] = useState<string>(step.startedAt?.slice(0, 10) || "");
  const [completedAt, setCompletedAt] = useState<string>(step.completedAt?.slice(0, 10) || "");
  const [uploadOpen, setUploadOpen] = useState(false);

  // Sync if external step changes
  useEffect(() => {
    setName(step.name);
    setDescription(step.description);
    setStatus(step.status);
    setStartedAt(step.startedAt?.slice(0, 10) || "");
    setCompletedAt(step.completedAt?.slice(0, 10) || "");
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
            <p className="text-[10px] text-muted-foreground">
              "Aktiv" setzt automatisch das Start-Datum auf heute · "Erledigt" das End-Datum
            </p>
          </div>

          {/* Manual date overrides — for retroactive tracking */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3 w-3" />
                Start (für Timeline)
              </Label>
              <Input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
              {startedAt && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-destructive text-left"
                  onClick={() => setStartedAt("")}
                >
                  Datum entfernen
                </button>
              )}
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5 text-xs">
                <Check className="h-3 w-3" />
                Ende (optional)
              </Label>
              <Input
                type="date"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                disabled={!startedAt}
              />
              {completedAt && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-destructive text-left"
                  onClick={() => setCompletedAt("")}
                >
                  Datum entfernen
                </button>
              )}
            </div>
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
              await updateProjectStep(step.id, {
                name,
                description,
                status,
                startedAt: startedAt ? new Date(startedAt).toISOString() : null,
                completedAt: completedAt ? new Date(completedAt).toISOString() : null,
              });
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
        <Button size="sm" variant="ghost" onClick={() => setPreviewOpen(true)} title="Vorschau">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => downloadFile(file)}
        title="Download"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={async () => {
          if (!confirm(`"${file.filename}" löschen?`)) return;
          await deleteStepFile(file.id);
        }}
        title="Löschen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {previewOpen && (
        <FilePreviewDialog file={file} onClose={() => setPreviewOpen(false)} />
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

// ─── Ad-Account inline picker ───────────────────────────────────────

function ProjectAdAccountPicker({
  project,
}: {
  project: ReturnType<typeof usePipelineProjects>[number];
}) {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || accounts.length > 0) return;
    setLoading(true);
    listMetaAccounts()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open && !project.adAccountId) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-600 hover:bg-amber-500/10 transition-colors"
      >
        <Megaphone className="h-2.5 w-2.5" />
        Werbekonto verknüpfen
      </button>
    );
  }

  return (
    <Select
      value={project.adAccountId || "__none"}
      onValueChange={async (v) => {
        await updatePipelineProject(project.id, { adAccountId: v === "__none" ? null : v });
        toast.success("Werbekonto aktualisiert");
        setOpen(false);
      }}
      onOpenChange={(o) => o && setOpen(true)}
    >
      <SelectTrigger className="h-6 w-auto border-0 bg-muted hover:bg-muted/70 text-[10px] font-mono px-2 py-0 gap-1">
        <Megaphone className="h-2.5 w-2.5" />
        <SelectValue placeholder="Werbekonto" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">– trennen –</SelectItem>
        {loading && <div className="px-2 py-2 text-xs text-muted-foreground">Lade...</div>}
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name} <span className="font-mono text-[10px] text-muted-foreground ml-1">{a.id}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Shared file preview dialog with Download ───────────────────────

function FilePreviewDialog({ file, onClose }: { file: StepFile; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate">{file.filename}</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => downloadFile(file)}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </Button>
          </div>
        </DialogHeader>
        {file.type === "html" && file.content ? (
          <iframe srcDoc={file.content} className="w-full h-[60vh] rounded border bg-white" sandbox="" />
        ) : file.type === "image" && (file.url || file.content) ? (
          <img src={file.url || file.content!} alt={file.filename} className="max-w-full rounded" />
        ) : file.url ? (
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Datei öffnen
          </a>
        ) : (
          <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded max-h-[60vh] overflow-auto">
            {file.content}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Project-Level Files Panel (Setup mode) ─────────────────────────

function ProjectFilesPanel({
  steps,
  onOpenStep,
}: {
  steps: ProjectStep[];
  onOpenStep: (stepId: string) => void;
}) {
  const stepIds = steps.map((s) => s.id);
  const allFiles = useStepFilesByProject(stepIds);
  const [previewFile, setPreviewFile] = useState<StepFile | null>(null);

  const stepNameById = new Map(steps.map((s) => [s.id, s.name]));

  if (allFiles.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Projekt-Dateien</h3>
        <Badge variant="outline" className="text-[10px]">{allFiles.length}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Creatives · Adcopies · HTML — sichtbar im Kunden-Portal
        </span>
      </div>
      <ul className="divide-y divide-border/40">
        {allFiles.map((f) => {
          const FIcon = f.type === "html" ? Code : f.type === "image" ? ImageIcon : FileText;
          const stepName = stepNameById.get(f.stepId) || "—";
          return (
            <li key={f.id} className="px-4 py-2.5 flex items-center gap-3 group hover:bg-muted/30">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.filename}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span className="uppercase tracking-wider">{f.type}</span>
                  <span>·</span>
                  <button
                    onClick={() => onOpenStep(f.stepId)}
                    className="hover:text-primary truncate"
                  >
                    {stepName}
                  </button>
                  <span>·</span>
                  <span>{format(new Date(f.createdAt), "dd.MM.yyyy", { locale: de })}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewFile(f)}
                title="Vorschau"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downloadFile(f)}
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
      {previewFile && (
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}

// ─── Portal Share Dialog (with PIN setup) ───────────────────────────

function PortalShareDialog({
  open,
  onOpenChange,
  project,
  portalUrl,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: ReturnType<typeof usePipelineProjects>[number];
  portalUrl: string | null;
}) {
  const [pin, setPin] = useState(project.portalPin || "");
  const [customerName, setCustomerName] = useState(project.portalCustomerName || "");

  useEffect(() => {
    if (open) {
      setPin(project.portalPin || "");
      setCustomerName(project.portalCustomerName || "");
    }
  }, [open, project.id, project.portalPin, project.portalCustomerName]);

  const savePin = async () => {
    await updatePipelineProject(project.id, {
      portalPin: pin.trim() || null,
      portalCustomerName: customerName.trim() || null,
    });
    toast.success("Portal-Zugang gespeichert");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PanelRight className="h-4 w-4" /> Kunden-Portal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Der Kunde loggt sich mit PIN ein und sieht aktuelles Projekt + Timeline + Anzeigen.
            Er kann Feedback hinterlassen, das hier im Operations-Tab erscheint.
          </p>

          {portalUrl ? (
            <div className="grid gap-2">
              <Label className="text-xs">Portal-Link</Label>
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
            </div>
          ) : (
            <p className="text-xs text-amber-500">Kein Portal-Token. Speichere das Projekt einmal neu.</p>
          )}

          <div className="grid gap-2">
            <Label className="text-xs">Kundenname (für Anzeige im Portal)</Label>
            <Input
              placeholder="z.B. Max Müller"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs flex items-center gap-1">
              <Lock className="h-3 w-3" /> PIN (mind. 4 Zeichen)
            </Label>
            <Input
              placeholder={project.portalPin ? "PIN ist gesetzt" : "Optional — Kunde kann selbst setzen"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Wenn leer: Kunde wird beim ersten Zugriff aufgefordert, selbst einen PIN zu setzen.
              Wenn gesetzt: Kunde muss diesen PIN eingeben.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
          <Button onClick={savePin}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Dialog ──────────────────────────────────────────────────

function ReportDialog({
  open,
  onOpenChange,
  project,
  steps,
  completedCount,
  progress,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: ReturnType<typeof usePipelineProjects>[number];
  steps: ProjectStep[];
  completedCount: number;
  progress: number;
}) {
  const portalUrl = project.customerPortalToken
    ? `${window.location.origin}/p/${project.customerPortalToken}`
    : "";

  const initialSubject = `Update zum Projekt: ${project.name}`;
  const initialBody = useMemo(
    () =>
      [
        `Hi,`,
        ``,
        `hier dein aktueller Stand zum Projekt "${project.name}".`,
        ``,
        `Status: ${PROJECT_STATUS_META[project.status]?.label || project.status}`,
        steps.length > 0
          ? `Fortschritt: ${completedCount}/${steps.length} Steps abgeschlossen (${progress}%)`
          : "",
        ``,
        portalUrl
          ? `Du kannst den kompletten Verlauf jederzeit hier einsehen:\n${portalUrl}`
          : "",
        ``,
        `Bei Fragen einfach antworten.`,
        ``,
        `Beste Grüße`,
      ].filter((l) => l !== undefined).join("\n"),
    [project.id, project.name, project.status, completedCount, progress, portalUrl, steps.length],
  );

  const [to, setTo] = useState(project.clientEmail || "");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  // Reset form on each open
  useEffect(() => {
    if (open) {
      setTo(project.clientEmail || "");
      setSubject(initialSubject);
      setBody(initialBody);
    }
  }, [open, project.id, initialBody, initialSubject, project.clientEmail]);

  const buildMailto = () =>
    `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const openInMailClient = () => {
    if (!to.trim()) {
      toast.error("Empfänger fehlt");
      return;
    }
    // Open in a new tab so the current page doesn't navigate to a blank
    // page if the OS has no mail client registered
    const a = document.createElement("a");
    a.href = buildMailto();
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    a.click();
    toast.success("Mail-Client wird geöffnet");
  };

  const copyToClipboard = async () => {
    const fullText = `An: ${to}\nBetreff: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success("In Zwischenablage kopiert");
    } catch {
      toast.error("Konnte nicht kopieren");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Report an Kunde senden
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label className="text-xs">An</Label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="kunde@firma.de"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">Betreff</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs">Nachricht</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <strong>Mail-Client öffnen</strong> nutzt deine Standard-App (Gmail / Apple Mail / Outlook).
            Falls du keinen Client hast, mit <strong>Kopieren</strong> alles in die Zwischenablage übertragen
            und in deinem Webmail einfügen.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="outline" onClick={copyToClipboard}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Kopieren
          </Button>
          <Button onClick={openInMailClient}>
            <Send className="h-3.5 w-3.5 mr-1" /> Im Mail-Client öffnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Step Dialog with category tabs ─────────────────────────────

const CATEGORY_META: Record<
  string,
  { label: string; description: string; accent: string }
> = {
  setup: {
    label: "Neues Projekt",
    description: "Initial-Setup: Zielgruppe · Offer · Meta-Setup · Launch",
    accent: "from-blue-500/30 to-blue-500/10",
  },
  campaign: {
    label: "Neue Kampagne",
    description: "Zusätzliche Kampagne in laufendem Projekt",
    accent: "from-emerald-500/30 to-emerald-500/10",
  },
  other: {
    label: "Sonstige",
    description: "Webseite · Email-Sequenzen · Calls · sonstige Bausteine",
    accent: "from-amber-500/30 to-amber-500/10",
  },
};

function AddStepDialog({
  open,
  onOpenChange,
  availableTemplates,
  onAddTemplate,
  onCustom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  availableTemplates: StepTemplate[];
  onAddTemplate: (t: StepTemplate) => void | Promise<void>;
  onCustom: () => void;
}) {
  const [category, setCategory] = useState<"setup" | "campaign" | "other">("setup");

  // group by category
  const byCategory: Record<string, StepTemplate[]> = {
    setup: [],
    campaign: [],
    other: [],
  };
  for (const t of availableTemplates) {
    (byCategory[t.category] || byCategory.other).push(t);
  }

  // auto-jump to a non-empty category if current is empty
  useEffect(() => {
    if (!open) return;
    if (byCategory[category]?.length === 0) {
      const firstNonEmpty = (["campaign", "other", "setup"] as const).find(
        (c) => byCategory[c]?.length > 0,
      );
      if (firstNonEmpty) setCategory(firstNonEmpty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = byCategory[category] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Step hinzufügen</DialogTitle>
        </DialogHeader>

        {/* Category tabs */}
        <div className="grid gap-2 sm:grid-cols-3">
          {(["setup", "campaign", "other"] as const).map((c) => {
            const meta = CATEGORY_META[c];
            const count = byCategory[c]?.length || 0;
            const isActive = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                disabled={count === 0}
                className={cn(
                  "text-left rounded-xl border p-3 transition-all relative overflow-hidden",
                  isActive
                    ? "border-primary bg-primary/[0.06] shadow-md"
                    : "hover:border-primary/40 hover:bg-muted/30",
                  count === 0 && "opacity-40 cursor-not-allowed",
                )}
              >
                {isActive && (
                  <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", meta.accent)} />
                )}
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm">{meta.label}</div>
                  <Badge variant="outline" className="text-[9px] py-0">
                    {count}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{meta.description}</p>
              </button>
            );
          })}
        </div>

        {/* Templates grid */}
        <div className="space-y-3">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
              Keine verfügbaren Templates in dieser Kategorie.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
              {visible.map((t) => {
                const Icon = ICONS[t.icon] || Box;
                const taskCount = (t.defaultTasks || []).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => onAddTemplate(t)}
                    className="text-left rounded-xl border p-3 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: t.color + "22", color: t.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm leading-tight">{t.name}</div>
                        {taskCount > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {taskCount} Sub-Tasks
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onCustom}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Eigenen Step bauen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Active Campaigns Panel (live Meta) ─────────────────────────────

function ActiveCampaignsPanel({
  project,
}: {
  project: ReturnType<typeof usePipelineProjects>[number];
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"active" | "all">("active");

  const load = async () => {
    if (!project.adAccountId) return;
    setLoading(true);
    const { campaigns: cs, error: err } = await getProjectCampaigns(project.adAccountId, "this_month");
    setCampaigns(cs);
    setError(err);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.adAccountId]);

  const activeCount = campaigns.filter((c) => c.effectiveStatus === "ACTIVE").length;
  const visible =
    filter === "active"
      ? campaigns.filter((c) => c.effectiveStatus === "ACTIVE")
      : campaigns;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden lg:col-span-2">
      <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="https://cdn.simpleicons.org/meta/0866FF"
            alt="Meta"
            className="h-4 w-4"
            loading="lazy"
          />
          <h3 className="text-sm font-semibold">Meta Anzeigen</h3>
          {campaigns.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {activeCount} live · {campaigns.length} gesamt
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {campaigns.length > 0 && (
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as any)}
              size="sm"
            >
              <ToggleGroupItem value="active" className="text-xs px-2.5">
                Nur aktiv ({activeCount})
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="text-xs px-2.5">
                Alle ({campaigns.length})
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!project.adAccountId || loading}
            onClick={load}
          >
            <TrendingUp className={cn("h-3.5 w-3.5 mr-1", loading && "animate-pulse")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-4">
        {!project.adAccountId ? (
          <div className="text-center py-8 space-y-3">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-[#0866FF]/10 ring-1 ring-[#0866FF]/30 flex items-center justify-center">
              <img
                src="https://cdn.simpleicons.org/meta/0866FF"
                alt="Meta"
                className="h-7 w-7"
                loading="lazy"
              />
            </div>
            <div>
              <p className="text-sm font-medium">Meta Werbekonto noch nicht verknüpft</p>
              <p className="text-xs text-muted-foreground mt-1">
                Klick im Projekt-Header auf "Werbekonto verknüpfen" um Live-Daten zu sehen
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-xl border bg-muted/20 p-4 animate-pulse">
                <div className="h-3 w-1/2 bg-muted rounded mb-2" />
                <div className="h-2 w-1/3 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs text-rose-600">
            <strong>Meta-API Fehler:</strong> {error}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm font-medium">Keine Kampagnen gefunden</p>
            <p className="text-xs text-muted-foreground">
              Im verknüpften Werbekonto sind aktuell keine Kampagnen.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm font-medium">Keine aktiven Kampagnen</p>
            <p className="text-xs text-muted-foreground">
              Switch oben auf "Alle" um pausierte/archivierte zu sehen.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.slice(0, 12).map((c) => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
            {visible.length > 12 && (
              <li className="text-[10px] text-center text-muted-foreground pt-1">
                + {visible.length - 12} weitere Kampagnen
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const isActive = campaign.effectiveStatus === "ACTIVE";
  const start = campaign.startTime || campaign.createdTime;
  const days = start ? Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86400000)) : 0;

  const statusColor =
    campaign.effectiveStatus === "ACTIVE"
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
      : campaign.effectiveStatus === "PAUSED"
      ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
      : "bg-slate-500/15 text-slate-500 border-slate-500/30";

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-3 flex items-center gap-3 hover:shadow-md transition-shadow",
        isActive && "ring-1 ring-emerald-500/20",
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1",
          isActive
            ? "bg-[#0866FF]/10 ring-[#0866FF]/40"
            : "bg-muted ring-border/30",
        )}
      >
        <img
          src="https://cdn.simpleicons.org/meta/0866FF"
          alt="Meta"
          className={cn("h-5 w-5", !isActive && "opacity-50 grayscale")}
          loading="lazy"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm truncate">{campaign.name}</p>
          <Badge variant="outline" className={cn("text-[9px] py-0", statusColor)}>
            {campaign.effectiveStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
          <span>läuft seit {days}d</span>
          {start && (
            <span>· {format(new Date(start), "dd.MM.yyyy", { locale: de })}</span>
          )}
          {campaign.objective && <span>· {campaign.objective}</span>}
          {campaign.dailyBudget > 0 && <span>· {fmtEUR(campaign.dailyBudget)}/Tag</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 shrink-0 text-right">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Spend</div>
          <div className="text-sm font-bold tabular-nums">{fmtEUR(campaign.spend)}</div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Leads</div>
          <div className="text-sm font-bold tabular-nums">{campaign.leads}</div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">CPL</div>
          <div className="text-sm font-bold tabular-nums">
            {campaign.cpl > 0 ? fmtEUR(campaign.cpl) : "—"}
          </div>
        </div>
      </div>
    </li>
  );
}

// ─── Mode tab (Setup / Operations) ──────────────────────────────────

function ModeTab({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  accent,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Box;
  title: string;
  subtitle: string;
  accent: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all relative overflow-hidden",
        active
          ? "bg-card shadow-md ring-1 ring-primary/20"
          : "hover:bg-card/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", accent)} />
      )}
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold leading-tight">{title}</span>
          {badge && (
            <Badge className="text-[9px] py-0 px-1.5 bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-500 animate-pulse">
              {badge}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}

// ─── Operations header (KPI Banner) ─────────────────────────────────

function OperationsHeader({
  project,
  steps,
}: {
  project: ReturnType<typeof usePipelineProjects>[number];
  steps: ProjectStep[];
}) {
  const liveAdsActive = project.status === "active";
  const allTasks = steps.flatMap((s) =>
    Array.isArray(s.data?.tasks) ? (s.data.tasks as StepTask[]) : [],
  );
  const tasksDone = allTasks.filter((t) => t.done).length;
  const tasksOpen = allTasks.length - tasksDone;
  const days = project.startDate
    ? Math.max(0, Math.floor((Date.now() - new Date(project.startDate).getTime()) / 86400000))
    : Math.max(0, Math.floor((Date.now() - new Date(project.createdAt).getTime()) / 86400000));

  const [preset, setPreset] = useState<Preset>("this_month");
  const [kpis, setKpis] = useState<ProjectKPIs | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!project.adAccountId) return;
    setLoading(true);
    const data = await getProjectKPIs(project.adAccountId, preset);
    setKpis(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.adAccountId, preset]);

  const hasError = kpis?.error;
  const hasData = kpis && !kpis.error && (kpis.leads > 0 || kpis.spend > 0 || kpis.impressions > 0);

  return (
    <div className="space-y-3">
      {/* Compact one-row KPI strip */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-500/[0.06] via-card to-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                hasData ? "bg-emerald-500 animate-pulse" : project.adAccountId ? "bg-amber-500" : "bg-slate-500",
              )}
            />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Live-KPIs
            </h3>
          </div>
          <div className="flex-1" />
          <div className="text-[10px] text-muted-foreground font-mono">
            {days}d · {tasksDone}/{allTasks.length} Tasks · {PROJECT_STATUS_META[project.status]?.label}
          </div>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-7 w-32 text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Heute</SelectItem>
              <SelectItem value="yesterday">Gestern</SelectItem>
              <SelectItem value="last_7d">Letzte 7 Tage</SelectItem>
              <SelectItem value="this_month">Dieser Monat</SelectItem>
              <SelectItem value="last_30d">Letzte 30 Tage</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 shrink-0"
            onClick={refresh}
            disabled={loading || !project.adAccountId}
          >
            <TrendingUp className={cn("h-3.5 w-3.5", loading && "animate-pulse")} />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
          <CompactKpi label="Leads" value={kpis?.leads} loading={loading} accent="emerald" />
          <CompactKpi label="Spend" value={kpis?.spend} format="eur" loading={loading} accent="blue" />
          <CompactKpi label="CPL" value={kpis?.cpl} format="eur" loading={loading} accent="amber" />
          <CompactKpi label="CTR" value={kpis?.ctr} format="pct" loading={loading} />
          <CompactKpi label="CPM" value={kpis?.cpm} format="eur" loading={loading} />
          <CompactKpi label="Freq." value={kpis?.frequency} format="num1" loading={loading} />
        </div>

        {hasError && (
          <div className="px-4 py-2 bg-rose-500/5 border-t border-rose-500/20 text-[10px] text-rose-500 font-mono">
            {hasError}
          </div>
        )}
      </div>
    </div>
  );
}

function CompactKpi({
  label,
  value,
  format = "num",
  loading,
  accent,
}: {
  label: string;
  value: number | undefined;
  format?: "num" | "eur" | "pct" | "num1";
  loading?: boolean;
  accent?: "emerald" | "blue" | "amber";
}) {
  const isMissing = value === undefined || value === null || (typeof value === "number" && Number.isNaN(value));
  const display = isMissing
    ? "—"
    : format === "eur"
    ? fmtEUR(value as number)
    : format === "pct"
    ? `${(value as number).toFixed(2)}%`
    : format === "num1"
    ? (value as number).toFixed(2)
    : fmtNum(value as number);
  const accentColor = {
    emerald: "text-emerald-500",
    blue: "text-blue-500",
    amber: "text-amber-500",
  }[accent || ""] || "text-foreground";

  return (
    <div className="px-3 py-2 hover:bg-muted/30 transition-colors">
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/80">{label}</div>
      {loading ? (
        <div className="h-5 w-16 rounded bg-muted/50 animate-pulse mt-1" />
      ) : (
        <div className={cn("text-base font-bold tabular-nums tracking-tight", isMissing ? "text-muted-foreground/40" : !isMissing && accent ? accentColor : "")}>
          {display}
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  format = "num",
  loading,
  sub,
  hasData,
}: {
  label: string;
  value: number | undefined;
  format?: "num" | "eur" | "pct" | "num1";
  loading?: boolean;
  sub?: string;
  hasData?: boolean;
}) {
  const isMissing = value === undefined || value === null || (typeof value === "number" && Number.isNaN(value));
  const display = isMissing
    ? "—"
    : format === "eur"
    ? fmtEUR(value as number)
    : format === "pct"
    ? `${(value as number).toFixed(2)}%`
    : format === "num1"
    ? (value as number).toFixed(2)
    : fmtNum(value as number);

  return (
    <div className="rounded-xl bg-card border p-3 hover:shadow-md transition-shadow">
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      {loading ? (
        <div className="h-7 w-20 rounded bg-muted/50 animate-pulse" />
      ) : (
        <div
          className={cn(
            "text-2xl font-bold tabular-nums",
            isMissing && "text-muted-foreground/40",
          )}
        >
          {display}
        </div>
      )}
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

// ─── Operations view ────────────────────────────────────────────────

function OperationsView({
  project,
  steps,
  onJumpToSetup,
  onOpenStep,
}: {
  project: ReturnType<typeof usePipelineProjects>[number];
  steps: ProjectStep[];
  onJumpToSetup: () => void;
  onOpenStep: (stepId: string) => void;
}) {
  const feedback = useFeedback(project.id);
  const unreadFeedbackCount = feedback.filter((f) => !f.readAt).length;
  const monitoringStep = steps.find((s) =>
    s.name.toLowerCase().includes("monitoring") ||
    s.name.toLowerCase().includes("optimier"),
  );

  return (
    <div className="space-y-4">
      {/* Row 1: Campaigns (2/3) + Feedback (1/3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveCampaignsPanel project={project} />
        </div>
        <FeedbackPanel
          projectId={project.id}
          feedback={feedback}
          unread={unreadFeedbackCount}
          onOpenStep={onOpenStep}
        />
      </div>

      {/* Row 2: Quick Actions horizontal */}
      <div className="rounded-2xl border bg-gradient-to-r from-muted/20 via-card to-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border/40">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80 font-semibold">
            Quick Actions
          </span>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = project.customerPortalToken
                ? `${window.location.origin}/p/${project.customerPortalToken}`
                : null;
              if (!url) return toast.error("Kein Portal-Token");
              navigator.clipboard.writeText(url);
              toast.success("Portal-Link kopiert");
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Portal-Link
          </Button>
          <Button variant="outline" size="sm" onClick={onJumpToSetup}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Zum Setup
          </Button>
          {monitoringStep && (
            <Button variant="outline" size="sm" onClick={() => onOpenStep(monitoringStep.id)}>
              <Activity className="h-3.5 w-3.5 mr-1" /> Monitoring öffnen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Panel ─────────────────────────────────────────────────

function FeedbackPanel({
  projectId,
  feedback,
  unread,
  onOpenStep,
}: {
  projectId: string;
  feedback: Feedback[];
  unread: number;
  onOpenStep: (stepId: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-amber-500/[0.04] via-card to-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold">Kunden-Feedback</h3>
          {unread > 0 && (
            <Badge className="text-[10px] bg-amber-500 text-white border-amber-500 hover:bg-amber-500 animate-pulse">
              {unread} neu
            </Badge>
          )}
        </div>
        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={() => markProjectFeedbackRead(projectId)}
          >
            Alle gelesen
          </Button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {feedback.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Noch kein Feedback. Sobald der Kunde im Portal etwas hinterlässt, erscheint es hier.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {feedback.map((f) => (
              <li
                key={f.id}
                className={cn("p-3 group hover:bg-muted/30", !f.readAt && "bg-amber-500/[0.04]")}
              >
                <div className="flex items-start gap-2">
                  {!f.readAt && (
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-pulse" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{f.authorName || "Kunde"}</span>
                      {f.stepId && (
                        <button
                          onClick={() => onOpenStep(f.stepId!)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Step öffnen
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(f.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
                      </span>
                    </div>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{f.message}</p>
                    <div className="flex gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!f.readAt && (
                        <button
                          onClick={() => markFeedbackRead(f.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Gelesen
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm("Feedback löschen?")) return;
                          await deleteFeedback(f.id);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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

// ─── Academy-Progress-View ──────────────────────────────────────────
function AcademyProgressView({ data }: {
  data: {
    customer: any | null;
    courses: any[];
    chapters: any[];
    lessons: any[];
    progress: any[];
  };
}) {
  if (!data.customer) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        Kunde hat noch keinen Academy-Account oder ist nicht verknüpft.
      </CardContent></Card>
    );
  }

  const totalLessons = data.lessons.length;
  const completedLessons = data.progress.filter((p) => p.completed).length;
  const overall = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Pro Course: Lessons + completion
  const courseStats = data.courses.map((c) => {
    const cls = data.lessons.filter((l) => l.course_id === c.id);
    const done = cls.filter((l) => data.progress.some((p) => p.lesson_id === l.id && p.completed)).length;
    const pct = cls.length > 0 ? Math.round((done / cls.length) * 100) : 0;
    const status: "done" | "active" | "todo" =
      pct === 100 ? "done"
      : done > 0 ? "active"
      : "todo";
    return { course: c, lessons: cls, done, total: cls.length, pct, status };
  }).sort((a, b) => (a.course.sort_order ?? 0) - (b.course.sort_order ?? 0));

  return (
    <div className="space-y-5">
      {/* Header-Stats */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Gesamtfortschritt" value={`${overall}%`} sub={`${completedLessons}/${totalLessons} Lektionen`} tone="primary" />
        <Stat label="Module fertig" value={courseStats.filter((c) => c.status === "done").length} sub={`von ${courseStats.length}`} tone="success" />
        <Stat label="Aktiv" value={courseStats.filter((c) => c.status === "active").length} sub="in Bearbeitung" tone="blue" />
        <Stat label="Offen" value={courseStats.filter((c) => c.status === "todo").length} sub="noch nicht gestartet" tone="muted" />
      </div>

      {/* Pipeline-Style: Module als auto-synced Steps */}
      <div className="rounded-2xl border bg-gradient-to-br from-background via-muted/10 to-background overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold">Academy-Pipeline</h3>
          <span className="text-[11px] text-muted-foreground">
            {courseStats.length} Module · auto-synced mit Kunden-Fortschritt
          </span>
        </div>
        <div className="p-6 overflow-x-auto">
          <div className="flex items-stretch gap-2 min-w-fit">
            {courseStats.map((cs, idx) => {
              const StatusIcon = cs.status === "done" ? CheckCircle2 : cs.status === "active" ? Play : Circle;
              const statusColor =
                cs.status === "done" ? "text-emerald-500"
                : cs.status === "active" ? "text-blue-500"
                : "text-muted-foreground";
              return (
                <div key={cs.course.id} className="flex items-stretch gap-2 shrink-0">
                  <div
                    className={cn(
                      "w-[220px] rounded-xl border bg-card p-4 flex flex-col gap-2",
                      cs.status === "done" && "border-emerald-500/40 bg-emerald-500/[0.04]",
                      cs.status === "active" && "border-blue-500/40 bg-blue-500/[0.04]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Modul {idx + 1}
                      </span>
                      <StatusIcon className={cn("h-4 w-4", statusColor)} />
                    </div>
                    <h4 className="font-semibold text-sm leading-tight line-clamp-2">{cs.course.title}</h4>
                    <div className="text-[11px] text-muted-foreground">
                      {cs.done}/{cs.total} Lektionen
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          cs.status === "done" ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : cs.status === "active" ? "bg-gradient-to-r from-blue-500 to-violet-500"
                          : "bg-muted-foreground/30",
                        )}
                        style={{ width: `${cs.pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {cs.pct}% abgeschlossen
                    </div>
                  </div>
                  {idx < courseStats.length - 1 && (
                    <div className="flex items-center">
                      <div className={cn(
                        "h-0.5 w-3",
                        cs.status === "done" ? "bg-emerald-500" : "bg-border",
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lesson-Detail-Liste pro Modul */}
      <div className="space-y-3">
        {courseStats.map((cs) => (
          <div key={cs.course.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <GraduationCap className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <span className="text-sm font-semibold truncate">{cs.course.title}</span>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {cs.done}/{cs.total}
              </Badge>
            </div>
            <div className="divide-y">
              {cs.lessons.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">Keine Lektionen.</div>
              ) : cs.lessons.map((l: any) => {
                const done = data.progress.some((p: any) => p.lesson_id === l.id && p.completed);
                return (
                  <div key={l.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={cn("flex-1 truncate", done && "text-muted-foreground line-through")}>
                      {l.title}
                    </span>
                    {l.duration_minutes ? (
                      <span className="text-[10px] text-muted-foreground shrink-0">{l.duration_minutes} Min</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DWY-Setup-Dashboard (grober Überblick) ─────────────────────────
function DWYSetupDashboard({
  data,
  onboardingProjects,
  onJumpToAcademy,
  onJumpToOnboarding,
}: {
  data: {
    customer: any | null;
    courses: any[];
    chapters: any[];
    lessons: any[];
    progress: any[];
  };
  onboardingProjects: any[];
  onJumpToAcademy: () => void;
  onJumpToOnboarding: () => void;
}) {
  const onboardingDone = onboardingProjects.some((p) => p.onboarding && Object.keys(p.onboarding).length > 0);
  const totalLessons = data.lessons.length;
  const completedLessons = data.progress.filter((p) => p.completed).length;
  const overall = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const courseStats = data.courses.map((c) => {
    const cls = data.lessons.filter((l) => l.course_id === c.id);
    const done = cls.filter((l) => data.progress.some((p) => p.lesson_id === l.id && p.completed)).length;
    const pct = cls.length > 0 ? Math.round((done / cls.length) * 100) : 0;
    const status: "done" | "active" | "todo" =
      pct === 100 ? "done"
      : done > 0 ? "active"
      : "todo";
    return { course: c, done, total: cls.length, pct, status };
  }).sort((a, b) => (a.course.sort_order ?? 0) - (b.course.sort_order ?? 0));

  const modulesDone = courseStats.filter((c) => c.status === "done").length;
  const modulesActive = courseStats.filter((c) => c.status === "active").length;

  const lastCompleted = data.progress
    .filter((p) => p.completed && p.completed_at)
    .sort((a, b) => (b.completed_at > a.completed_at ? 1 : -1))[0];
  const lastCompletedLesson = lastCompleted ? data.lessons.find((l) => l.id === lastCompleted.lesson_id) : null;

  return (
    <div className="space-y-5">
      {/* Top-Stats: 4-card overview */}
      <div className="grid gap-3 sm:grid-cols-4">
        <button
          onClick={onJumpToOnboarding}
          className={cn(
            "rounded-xl border p-4 text-left transition-all hover:shadow-md",
            onboardingDone ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-amber-500/40 bg-amber-500/[0.04]",
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {onboardingDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-amber-500" />}
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Onboarding</span>
          </div>
          <p className="text-lg font-bold">{onboardingDone ? "Abgeschlossen" : "Ausstehend"}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {onboardingDone ? "Wizard-Daten vorhanden" : "Kunde hat Form noch nicht ausgefüllt"}
          </p>
        </button>

        <button
          onClick={onJumpToAcademy}
          className="rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/40"
        >
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-violet-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Academy</span>
          </div>
          <p className="text-lg font-bold">{overall}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{completedLessons}/{totalLessons} Lektionen</p>
        </button>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Module fertig</span>
          </div>
          <p className="text-lg font-bold">{modulesDone}<span className="text-sm font-normal text-muted-foreground"> / {courseStats.length}</span></p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{modulesActive} aktiv in Bearbeitung</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Letzte Aktivität</span>
          </div>
          {lastCompleted && lastCompletedLesson ? (
            <>
              <p className="text-sm font-semibold truncate">{lastCompletedLesson.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(lastCompleted.completed_at), "dd.MM.yyyy HH:mm", { locale: de })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted-foreground">Noch keine</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Kunde hat noch nichts abgeschlossen</p>
            </>
          )}
        </div>
      </div>

      {/* Module-Übersicht — Grid-Layout, große Cards je Modul */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/10 flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Module-Übersicht</h3>
              <p className="text-[11px] text-muted-foreground">auto-synced mit Academy-Fortschritt</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onJumpToAcademy}>
            Detail-Ansicht <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        <div className="p-6">
          <div className="flex gap-3 w-full">
            {courseStats.map((cs, idx) => {
              const StatusIcon = cs.status === "done" ? CheckCircle2 : cs.status === "active" ? Play : Circle;
              const statusColor =
                cs.status === "done" ? "text-emerald-500"
                : cs.status === "active" ? "text-blue-500"
                : "text-muted-foreground/50";
              const statusLabel =
                cs.status === "done" ? "Fertig"
                : cs.status === "active" ? "Aktiv"
                : "Offen";
              return (
                <div
                  key={cs.course.id}
                  className={cn(
                    "group flex-1 min-w-0 rounded-xl border p-4 transition-all hover:shadow-md flex flex-col gap-3",
                    cs.status === "done" && "border-emerald-500/40 bg-emerald-500/[0.04] hover:border-emerald-500/60",
                    cs.status === "active" && "border-blue-500/40 bg-blue-500/[0.04] hover:border-blue-500/60",
                    cs.status === "todo" && "border-border bg-card hover:border-foreground/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                          cs.status === "done" && "bg-emerald-500/20 text-emerald-600",
                          cs.status === "active" && "bg-blue-500/20 text-blue-600",
                          cs.status === "todo" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {idx + 1}
                      </div>
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider font-semibold",
                        cs.status === "done" && "text-emerald-600",
                        cs.status === "active" && "text-blue-600",
                        cs.status === "todo" && "text-muted-foreground",
                      )}>
                        {statusLabel}
                      </span>
                    </div>
                    <StatusIcon className={cn("h-4 w-4 shrink-0", statusColor)} />
                  </div>
                  <h4 className="font-bold text-sm leading-tight line-clamp-2 flex-1 min-h-[2.5rem]">{cs.course.title}</h4>
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          cs.status === "done" && "bg-gradient-to-r from-emerald-500 to-teal-500",
                          cs.status === "active" && "bg-gradient-to-r from-blue-500 to-violet-500",
                          cs.status === "todo" && "bg-muted-foreground/30",
                        )}
                        style={{ width: `${cs.pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-muted-foreground truncate">{cs.done}/{cs.total} Lektionen</span>
                      <span className={cn(
                        "text-xs font-bold shrink-0",
                        cs.status === "done" && "text-emerald-600",
                        cs.status === "active" && "text-blue-600",
                        cs.status === "todo" && "text-muted-foreground",
                      )}>
                        {cs.pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Project-Tasks-Section (Setup-Page) ─────────────────────────────
function ProjectTasksSection({
  clientId,
  clientName,
  onCreateClick,
}: {
  clientId: string;
  clientName: string;
  onCreateClick: () => void;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setTasks(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  // Subscribe to changes — reload after create dialog closes (poll-style reload)
  useEffect(() => {
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (data) setTasks(data);
    }, 5000);
    return () => clearInterval(t);
  }, [clientId]);

  const toggleDone = async (taskId: string, currentCol: string) => {
    const newCol = currentCol === "done" ? "todo" : "done";
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, col: newCol } : t));
    await supabase.from("tasks").update({ col: newCol }).eq("id", taskId);
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from("tasks").delete().eq("id", taskId);
  };

  const open = tasks.filter((t) => t.col !== "done");
  const done = tasks.filter((t) => t.col === "done");

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Tasks für {clientName}</h3>
          <span className="text-[11px] text-muted-foreground">
            {tasks.length === 0 ? "keine" : `${open.length} offen · ${done.length} erledigt`}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onCreateClick}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Task
        </Button>
      </div>
      <div className="divide-y">
        {loading ? (
          <div className="px-5 py-6 text-sm text-muted-foreground text-center">Lade Tasks ...</div>
        ) : tasks.length === 0 ? (
          <div className="px-5 py-8 text-center space-y-3">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">Noch keine Tasks für diesen Kunden</p>
              <p className="text-xs text-muted-foreground mt-0.5">Klick oben rechts auf "Task" um eine zu erstellen.</p>
            </div>
          </div>
        ) : (
          <>
            {open.map((t) => (
              <ClientTaskRow key={t.id} task={t} onToggle={() => toggleDone(t.id, t.col)} onDelete={() => deleteTask(t.id)} />
            ))}
            {done.length > 0 && (
              <div className="px-5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/10 border-y">
                Erledigt ({done.length})
              </div>
            )}
            {done.map((t) => (
              <ClientTaskRow key={t.id} task={t} onToggle={() => toggleDone(t.id, t.col)} onDelete={() => deleteTask(t.id)} dimmed />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ClientTaskRow({
  task,
  onToggle,
  onDelete,
  dimmed,
}: {
  task: any;
  onToggle: () => void;
  onDelete: () => void;
  dimmed?: boolean;
}) {
  const isDone = task.col === "done";
  const priorityColor =
    task.priority === "high" ? "text-red-500"
    : task.priority === "med" ? "text-amber-500"
    : "text-muted-foreground";
  const priorityLabel =
    task.priority === "high" ? "Hoch"
    : task.priority === "med" ? "Mittel"
    : "Niedrig";

  return (
    <div className={cn("group px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors", dimmed && "opacity-60")}>
      <button onClick={onToggle} className="shrink-0">
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", isDone && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] shrink-0">
        {task.category && (
          <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
        )}
        {task.priority && (
          <span className={cn("font-semibold uppercase tracking-wider", priorityColor)}>{priorityLabel}</span>
        )}
        {task.due_date && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onDelete}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

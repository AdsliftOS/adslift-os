import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
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
  type StepStatus,
  type StepTemplate,
  type ProjectStep,
} from "@/store/pipeline";
import { cn } from "@/lib/utils";

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

const STATUS_META: Record<StepStatus, { label: string; color: string; icon: typeof Box }> = {
  todo:    { label: "Offen",        color: "text-muted-foreground border-muted-foreground/30 bg-muted/30",         icon: CircleDashed },
  active:  { label: "Aktiv",        color: "text-blue-600 border-blue-500/40 bg-blue-500/10",                       icon: Play },
  done:    { label: "Erledigt",     color: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10",              icon: Check },
  skipped: { label: "Übersprungen", color: "text-rose-500 border-rose-500/30 bg-rose-500/5",                        icon: Pause },
};

export default function Pipeline() {
  const projects = usePipelineProjects();
  const templates = useStepTemplates();
  const [clients] = useClients();

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

  // ── List view ──────────────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
              <Badge variant="outline" className="text-[10px]">Sandbox v2</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Neue Projektansicht mit Baukasten-Pipeline. Läuft parallel zum alten /projects.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Neues Projekt
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Noch keine Projekte. Lege das erste an um den Baukasten zu sehen.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const client = clients.find((c) => c.id === p.clientId);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className="group text-left rounded-xl border bg-card hover:border-primary/50 hover:shadow-lg transition-all overflow-hidden"
                >
                  <div className="p-5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          p.status === "active" && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                          p.status === "done" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                          p.status === "paused" && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                        )}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    {client && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        {client.name}
                      </div>
                    )}
                    {p.clientEmail && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{p.clientEmail}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground pt-1">
                      Erstellt {format(new Date(p.createdAt), "dd.MM.yyyy", { locale: de })}
                    </div>
                  </div>
                </button>
              );
            })}
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
                  placeholder="z.B. Müller GmbH — Webdesign Setup"
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
                    <p className="text-[10px] text-muted-foreground">
                      ✓ E-Mail wird automatisch übernommen: <strong>{c.email}</strong>
                    </p>
                  ) : null;
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
                  Meta Ad-Account-ID für späteren Metadaten-Transfer
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

  // ── Detail view (Pipeline-Builder) ─────────────────────────────────
  return (
    <PipelineDetail
      projectId={selectedProject.id}
      onBack={() => setSelectedProjectId(null)}
      templates={templates}
    />
  );
}

// ─── Detail view ─────────────────────────────────────────────────────

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
  const [clients] = useClients();
  const client = project?.clientId ? clients.find((c) => c.id === project.clientId) : null;

  const [addOpen, setAddOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", description: "" });
  const [editingStep, setEditingStep] = useState<ProjectStep | null>(null);

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

  const usedTemplateIds = new Set(steps.map((s) => s.templateId).filter(Boolean));
  const availableTemplates = templates.filter((t) => !usedTemplateIds.has(t.id));

  const handleAddTemplate = async (t: StepTemplate) => {
    await addStepFromTemplate(projectId, t, steps.length);
    setAddOpen(false);
  };

  const handleAddCustom = async () => {
    if (!customForm.name.trim()) return toast.error("Name erforderlich");
    await addCustomStep(
      projectId,
      { name: customForm.name.trim(), description: customForm.description.trim() },
      steps.length,
    );
    setCustomForm({ name: "", description: "" });
    setCustomOpen(false);
  };

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

  const completedCount = steps.filter((s) => s.status === "done").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-7 text-xs">
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Alle Projekte
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="text-[10px]">{project.status}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {client && (
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{client.name}</span>
            )}
            {project.clientEmail && (
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{project.clientEmail}</span>
            )}
            {project.adAccountId && (
              <span className="font-mono text-[10px]">{project.adAccountId}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={project.status}
            onValueChange={(v) => updatePipelineProject(projectId, { status: v as any })}
          >
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!confirm("Projekt wirklich löschen?")) return;
              await deletePipelineProject(projectId);
              onBack();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-muted-foreground uppercase tracking-wider">Fortschritt</span>
            <span className="font-semibold">{completedCount} / {steps.length} Steps · {progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Pipeline canvas — flow style with cards & connectors */}
      <div className="rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6">
        {steps.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-medium">Pipeline ist leer</p>
              <p className="text-xs text-muted-foreground mt-1">Füge deinen ersten Step hinzu</p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Erster Step
            </Button>
          </div>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-stretch gap-3 shrink-0">
                <StepCard
                  step={s}
                  index={idx}
                  isDragOver={dragOverId === s.id}
                  isDragging={dragId === s.id}
                  onDragStart={() => setDragId(s.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  onDragOver={() => setDragOverId(s.id)}
                  onDragLeave={() => dragOverId === s.id && setDragOverId(null)}
                  onDrop={() => handleDrop(s.id)}
                  onClick={() => setEditingStep(s)}
                />
                {idx < steps.length - 1 && (
                  <div className="flex items-center self-center shrink-0">
                    <div className="h-[2px] w-6 bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/60" />
                    <div className="h-2 w-2 rotate-45 border-r-2 border-t-2 border-muted-foreground/60 -ml-1" />
                  </div>
                )}
              </div>
            ))}

            {/* Add-button card at end */}
            <button
              onClick={() => setAddOpen(true)}
              className="shrink-0 w-[180px] rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors py-8"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium">Step hinzufügen</span>
            </button>
          </div>
        )}
      </div>

      {/* Add step dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Step zum Baukasten hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {availableTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground sm:col-span-2 text-center py-4">
                  Alle Default-Templates sind schon im Projekt. Bau einen Custom-Step.
                </p>
              ) : (
                availableTemplates.map((t) => {
                  const Icon = ICONS[t.icon] || Box;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleAddTemplate(t)}
                      className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="h-7 w-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: t.color + "22", color: t.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="font-medium text-sm">{t.name}</div>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); setCustomOpen(true); }}>
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
            <Button onClick={handleAddCustom}>Step anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit step dialog */}
      <Dialog open={!!editingStep} onOpenChange={(o) => !o && setEditingStep(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Step bearbeiten</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={editingStep.name}
                  onChange={(e) => setEditingStep({ ...editingStep, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Beschreibung</Label>
                <Textarea
                  value={editingStep.description}
                  onChange={(e) => setEditingStep({ ...editingStep, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editingStep.status}
                  onValueChange={(v) => setEditingStep({ ...editingStep, status: v as StepStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["todo", "active", "done", "skipped"] as StepStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive mr-auto"
              onClick={async () => {
                if (!editingStep) return;
                if (!confirm("Step löschen?")) return;
                await deleteProjectStep(editingStep.id);
                setEditingStep(null);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Löschen
            </Button>
            <Button variant="outline" onClick={() => setEditingStep(null)}>Abbrechen</Button>
            <Button
              onClick={async () => {
                if (!editingStep) return;
                await updateProjectStep(editingStep.id, {
                  name: editingStep.name,
                  description: editingStep.description,
                  status: editingStep.status,
                });
                setEditingStep(null);
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Step card ───────────────────────────────────────────────────────

function StepCard({
  step,
  index,
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
  const statusMeta = STATUS_META[step.status];
  const StatusIcon = statusMeta.icon;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onClick={onClick}
      className={cn(
        "shrink-0 w-[200px] rounded-xl border-2 bg-card cursor-pointer transition-all overflow-hidden group relative",
        statusMeta.color,
        isDragging && "opacity-40",
        isDragOver && "ring-2 ring-primary ring-offset-2 scale-[1.02]",
      )}
    >
      {/* Drag handle */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-current/10"
          >
            <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </div>
        </div>
        <div>
          <div className="font-semibold text-sm leading-tight">{step.name}</div>
          {step.description && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{step.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-medium pt-1 border-t border-current/10">
          <StatusIcon className="h-3 w-3" />
          {statusMeta.label}
        </div>
      </div>
    </div>
  );
}

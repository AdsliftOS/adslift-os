import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────

export type StepTask = {
  id: string;
  title: string;
  done: boolean;
};

export type StepTemplateCategory = "setup" | "campaign" | "other";

export type StepTemplate = {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  category: StepTemplateCategory;
  defaultTasks: StepTask[];
};

export type StepStatus = "todo" | "active" | "done" | "skipped";

export type ProjectStep = {
  id: string;
  projectId: string;
  templateId: string | null;
  name: string;
  icon: string;
  description: string;
  position: number;
  status: StepStatus;
  data: Record<string, any>;
  startedAt: string | null;
  completedAt: string | null;
};

export type ProjectStatus = "draft" | "active" | "paused" | "done";
export type ProjectVariant = "dwy" | "d4y";

export type PipelineProject = {
  id: string;
  name: string;
  variant: ProjectVariant;
  clientId: string | null;
  clientEmail: string | null;
  adAccountId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  customerPortalToken: string | null;
  portalPin: string | null;
  portalCustomerName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  // D4Y-spezifisch
  creativesHtml: string | null;
  adCopyHtml: string | null;
  driveLink: string | null;
  meetingNotes: string | null;
  excalidrawData: any | null;
};

// ─── Templates store ─────────────────────────────────────────────────

let templates: StepTemplate[] = [];
const tplListeners = new Set<() => void>();
const tplEmit = () => tplListeners.forEach((l) => l());
const tplSubscribe = (l: () => void) => { tplListeners.add(l); return () => tplListeners.delete(l); };
const tplGetSnapshot = () => templates;

function rowToTemplate(r: any): StepTemplate {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon || "box",
    description: r.description || "",
    color: r.color || "#1c7ed6",
    isDefault: !!r.is_default,
    sortOrder: r.sort_order || 0,
    category: (r.category as StepTemplateCategory) || "setup",
    defaultTasks: Array.isArray(r.default_tasks) ? r.default_tasks : [],
  };
}

export async function loadStepTemplates() {
  const { data, error } = await supabase
    .from("pipeline_step_templates")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!error && data) {
    templates = data.map(rowToTemplate);
    tplEmit();
  }
}
loadStepTemplates();

export async function addStepTemplate(t: Omit<StepTemplate, "id" | "isDefault">) {
  const { data, error } = await supabase
    .from("pipeline_step_templates")
    .insert({
      name: t.name,
      icon: t.icon,
      description: t.description,
      color: t.color,
      is_default: false,
      sort_order: t.sortOrder,
    })
    .select()
    .single();
  if (!error && data) {
    templates = [...templates, rowToTemplate(data)];
    tplEmit();
    return data.id;
  }
  toast.error("Template konnte nicht angelegt werden");
  return null;
}

export async function deleteStepTemplate(id: string) {
  templates = templates.filter((t) => t.id !== id);
  tplEmit();
  await supabase.from("pipeline_step_templates").delete().eq("id", id);
}

export function useStepTemplates(): StepTemplate[] {
  return useSyncExternalStore(tplSubscribe, tplGetSnapshot);
}

// ─── Projects store ──────────────────────────────────────────────────

let projects: PipelineProject[] = [];
const prjListeners = new Set<() => void>();
const prjEmit = () => prjListeners.forEach((l) => l());
const prjSubscribe = (l: () => void) => { prjListeners.add(l); return () => prjListeners.delete(l); };
const prjGetSnapshot = () => projects;

function rowToProject(r: any): PipelineProject {
  return {
    id: r.id,
    name: r.name,
    variant: (r.variant === "d4y" ? "d4y" : "dwy") as ProjectVariant,
    clientId: r.client_id || null,
    clientEmail: r.client_email || null,
    adAccountId: r.ad_account_id || null,
    status: r.status || "draft",
    startDate: r.start_date || null,
    customerPortalToken: r.customer_portal_token || null,
    portalPin: r.portal_pin || null,
    portalCustomerName: r.portal_customer_name || null,
    createdByEmail: r.created_by_email || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
    creativesHtml: r.creatives_html ?? null,
    adCopyHtml: r.ad_copy_html ?? null,
    driveLink: r.drive_link ?? null,
    meetingNotes: r.meeting_notes ?? null,
    excalidrawData: r.excalidraw_data ?? null,
  };
}

// Heavy fields (excalidraw_data ~6MB für aktive Boards) NICHT in der Listen-Query —
// das Board-Tab lädt sich seine Kopie via ProjectBoardPage selbst.
const PROJECT_LIST_COLUMNS =
  "id,name,variant,client_id,client_email,ad_account_id,status,start_date," +
  "customer_portal_token,portal_pin,portal_customer_name,created_by_email," +
  "created_at,updated_at,creatives_html,ad_copy_html,drive_link,meeting_notes";

export async function loadPipelineProjects() {
  const { data, error } = await supabase
    .from("pipeline_projects")
    .select(PROJECT_LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (!error && data) {
    projects = data.map(rowToProject);
    prjEmit();
  }
}
loadPipelineProjects();

function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(18))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function addPipelineProject(p: {
  name: string;
  variant?: ProjectVariant;
  clientId: string | null;
  clientEmail: string | null;
  adAccountId: string | null;
  createdByEmail: string | null;
}) {
  const { data, error } = await supabase
    .from("pipeline_projects")
    .insert({
      name: p.name,
      variant: p.variant || "dwy",
      client_id: p.clientId,
      client_email: p.clientEmail,
      ad_account_id: p.adAccountId,
      status: "draft",
      customer_portal_token: randomToken(),
      created_by_email: p.createdByEmail,
    })
    .select()
    .single();
  if (!error && data) {
    projects = [rowToProject(data), ...projects];
    prjEmit();
    return data.id;
  }
  console.error("addPipelineProject failed:", error);
  toast.error("Projekt konnte nicht angelegt werden");
  return null;
}

export async function updatePipelineProject(id: string, updates: Partial<PipelineProject>) {
  const row: any = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.variant !== undefined) row.variant = updates.variant;
  if (updates.creativesHtml !== undefined) row.creatives_html = updates.creativesHtml;
  if (updates.adCopyHtml !== undefined) row.ad_copy_html = updates.adCopyHtml;
  if (updates.driveLink !== undefined) row.drive_link = updates.driveLink;
  if (updates.meetingNotes !== undefined) row.meeting_notes = updates.meetingNotes;
  if (updates.excalidrawData !== undefined) row.excalidraw_data = updates.excalidrawData;
  if (updates.clientId !== undefined) row.client_id = updates.clientId;
  if (updates.clientEmail !== undefined) row.client_email = updates.clientEmail;
  if (updates.adAccountId !== undefined) row.ad_account_id = updates.adAccountId;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.startDate !== undefined) row.start_date = updates.startDate;
  if (updates.portalPin !== undefined) row.portal_pin = updates.portalPin;
  if (updates.portalCustomerName !== undefined) row.portal_customer_name = updates.portalCustomerName;
  row.updated_at = new Date().toISOString();

  projects = projects.map((p) => (p.id === id ? { ...p, ...updates } : p));
  prjEmit();

  const { error } = await supabase.from("pipeline_projects").update(row).eq("id", id);
  if (error) {
    toast.error("Projekt konnte nicht gespeichert werden");
    await loadPipelineProjects();
  }
}

export async function deletePipelineProject(id: string) {
  projects = projects.filter((p) => p.id !== id);
  prjEmit();
  await supabase.from("pipeline_projects").delete().eq("id", id);
}

export function usePipelineProjects(): PipelineProject[] {
  return useSyncExternalStore(prjSubscribe, prjGetSnapshot);
}

// ─── Steps store ─────────────────────────────────────────────────────

let steps: ProjectStep[] = [];
const stpListeners = new Set<() => void>();
const stpEmit = () => stpListeners.forEach((l) => l());
const stpSubscribe = (l: () => void) => { stpListeners.add(l); return () => stpListeners.delete(l); };
const stpGetSnapshot = () => steps;

function rowToStep(r: any): ProjectStep {
  return {
    id: r.id,
    projectId: r.project_id,
    templateId: r.template_id || null,
    name: r.name,
    icon: r.icon || "box",
    description: r.description || "",
    position: r.position || 0,
    status: r.status || "todo",
    data: r.data || {},
    startedAt: r.started_at || null,
    completedAt: r.completed_at || null,
  };
}

export async function loadProjectSteps() {
  const { data, error } = await supabase
    .from("pipeline_steps")
    .select("*")
    .order("position", { ascending: true });
  if (!error && data) {
    steps = data.map(rowToStep);
    stpEmit();
  }
}
loadProjectSteps();

export async function addStepFromTemplate(projectId: string, template: StepTemplate, position: number) {
  // Copy default tasks (deep clone) so each step instance has its own state
  const tasks: StepTask[] = (template.defaultTasks || []).map((t) => ({
    id: t.id || crypto.randomUUID().slice(0, 8),
    title: t.title,
    done: false,
  }));
  const { data, error } = await supabase
    .from("pipeline_steps")
    .insert({
      project_id: projectId,
      template_id: template.id,
      name: template.name,
      icon: template.icon,
      description: template.description,
      position,
      status: "todo",
      data: { tasks },
    })
    .select()
    .single();
  if (!error && data) {
    steps = [...steps, rowToStep(data)];
    stpEmit();
    return data.id;
  }
  toast.error("Step konnte nicht hinzugefügt werden");
  return null;
}

// ─── Sub-task helpers (persist via step.data.tasks) ─────────────────

export async function addStepTask(stepId: string, title: string) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;
  const tasks: StepTask[] = Array.isArray(step.data?.tasks) ? step.data.tasks : [];
  const next: StepTask[] = [
    ...tasks,
    { id: crypto.randomUUID().slice(0, 8), title: title.trim(), done: false },
  ];
  await updateProjectStep(stepId, { data: { ...step.data, tasks: next } });
}

export async function toggleStepTask(stepId: string, taskId: string) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;
  const tasks: StepTask[] = Array.isArray(step.data?.tasks) ? step.data.tasks : [];
  const next = tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
  await updateProjectStep(stepId, { data: { ...step.data, tasks: next } });
}

export async function removeStepTask(stepId: string, taskId: string) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;
  const tasks: StepTask[] = Array.isArray(step.data?.tasks) ? step.data.tasks : [];
  const next = tasks.filter((t) => t.id !== taskId);
  await updateProjectStep(stepId, { data: { ...step.data, tasks: next } });
}

export async function updateStepTaskTitle(stepId: string, taskId: string, title: string) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;
  const tasks: StepTask[] = Array.isArray(step.data?.tasks) ? step.data.tasks : [];
  const next = tasks.map((t) => (t.id === taskId ? { ...t, title } : t));
  await updateProjectStep(stepId, { data: { ...step.data, tasks: next } });
}

export async function addCustomStep(
  projectId: string,
  s: { name: string; icon?: string; description?: string },
  position: number,
) {
  const { data, error } = await supabase
    .from("pipeline_steps")
    .insert({
      project_id: projectId,
      template_id: null,
      name: s.name,
      icon: s.icon || "box",
      description: s.description || "",
      position,
      status: "todo",
    })
    .select()
    .single();
  if (!error && data) {
    steps = [...steps, rowToStep(data)];
    stpEmit();
    return data.id;
  }
  toast.error("Custom-Step konnte nicht angelegt werden");
  return null;
}

export async function updateProjectStep(id: string, updates: Partial<ProjectStep>) {
  const row: any = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.icon !== undefined) row.icon = updates.icon;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.position !== undefined) row.position = updates.position;
  if (updates.status !== undefined) {
    row.status = updates.status;
    // Auto-set started_at when transitioning to active and not already set
    if (updates.status === "active" && !steps.find((s) => s.id === id)?.startedAt) {
      row.started_at = new Date().toISOString();
    }
    // Auto-set completed_at when going to done (but only if not explicitly
    // overridden in the same update)
    if (updates.status === "done" && updates.completedAt === undefined) {
      row.completed_at = new Date().toISOString();
    }
  }
  // Explicit date overrides (manual backfill / correction)
  if (updates.startedAt !== undefined) row.started_at = updates.startedAt;
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt;
  if (updates.data !== undefined) row.data = updates.data;

  steps = steps.map((s) => (s.id === id ? { ...s, ...updates } : s));
  stpEmit();

  const { error } = await supabase.from("pipeline_steps").update(row).eq("id", id);
  if (error) await loadProjectSteps();
}

export async function deleteProjectStep(id: string) {
  steps = steps.filter((s) => s.id !== id);
  stpEmit();
  await supabase.from("pipeline_steps").delete().eq("id", id);
}

export async function reorderSteps(projectId: string, orderedIds: string[]) {
  // Optimistic
  const map = new Map(orderedIds.map((id, i) => [id, i]));
  steps = steps.map((s) =>
    s.projectId === projectId && map.has(s.id) ? { ...s, position: map.get(s.id)! } : s,
  );
  stpEmit();

  // Persist sequentially — small N, simple
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("pipeline_steps").update({ position: i }).eq("id", id),
    ),
  );
}

export function useProjectSteps(projectId: string | null): ProjectStep[] {
  const all = useSyncExternalStore(stpSubscribe, stpGetSnapshot);
  if (!projectId) return [];
  return all
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.position - b.position);
}

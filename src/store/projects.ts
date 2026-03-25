import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type TaskStatus = "todo" | "in-progress" | "done";
export type ProjectType = "neukunde" | "neue-kampagne" | "optimierung" | "custom" | "done4you" | "donewithyou" | "neukunde-meta" | "neukunde-meta-linkedin" | "kunde-meta" | "donewithyou-no-email";
export type CreativeFormat = "video" | "bild" | "beides";

export type Task = { id: string; title: string; status: TaskStatus; assignee?: string; };
export type Phase = { id: string; title: string; tasks: Task[]; };
export type Comment = { id: string; author: string; text: string; timestamp: string; };

export type Project = {
  id: string;
  client: string;
  name: string;
  product: string;
  type: ProjectType;
  creativeFormat: CreativeFormat;
  startDate: string;
  assignees: string[];
  phases: Phase[];
  briefing: string;
  meetingNotes: string;
  targetAudience: string;
  offer: string;
  comments: Comment[];
  onboarding?: Record<string, unknown>;
  deadline?: string;
};

let projects: Project[] = [];
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return projects; }

function rowToProject(row: any): Project {
  return {
    id: row.id,
    client: row.client,
    name: row.name,
    product: row.product,
    type: row.type,
    creativeFormat: row.creative_format,
    startDate: row.start_date,
    assignees: row.assignees || [],
    phases: row.phases || [],
    briefing: row.briefing || "",
    meetingNotes: row.meeting_notes || "",
    targetAudience: row.target_audience || "",
    offer: row.offer || "",
    comments: row.comments || [],
    onboarding: row.onboarding,
    deadline: row.deadline,
  };
}

function projectToRow(p: Project) {
  return {
    client: p.client, name: p.name, product: p.product, type: p.type,
    creative_format: p.creativeFormat, start_date: p.startDate,
    assignees: p.assignees, phases: p.phases, briefing: p.briefing,
    meeting_notes: p.meetingNotes, target_audience: p.targetAudience,
    offer: p.offer, comments: p.comments, onboarding: p.onboarding,
    deadline: p.deadline,
  };
}

export async function loadProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    projects = data.map(rowToProject);
    emit();
  }
}

loadProjects();

// --- Direct CRUD operations (no more diff-based setProjects) ---

export async function addProject(project: Omit<Project, "id"> & { id?: string }): Promise<string | null> {
  const row = projectToRow(project as Project);
  const { data, error } = await supabase.from("projects").insert(row).select().single();
  if (!error && data) {
    await loadProjects();
    return data.id;
  }
  console.error("Failed to add project:", error);
  return null;
}

export async function updateProject(id: string, updates: Partial<Project>) {
  const dbUpdates: any = {};
  if (updates.client !== undefined) dbUpdates.client = updates.client;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.product !== undefined) dbUpdates.product = updates.product;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.creativeFormat !== undefined) dbUpdates.creative_format = updates.creativeFormat;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.assignees !== undefined) dbUpdates.assignees = updates.assignees;
  if (updates.phases !== undefined) dbUpdates.phases = updates.phases;
  if (updates.briefing !== undefined) dbUpdates.briefing = updates.briefing;
  if (updates.meetingNotes !== undefined) dbUpdates.meeting_notes = updates.meetingNotes;
  if (updates.targetAudience !== undefined) dbUpdates.target_audience = updates.targetAudience;
  if (updates.offer !== undefined) dbUpdates.offer = updates.offer;
  if (updates.comments !== undefined) dbUpdates.comments = updates.comments;
  if (updates.onboarding !== undefined) dbUpdates.onboarding = updates.onboarding;
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;

  const { error } = await supabase.from("projects").update(dbUpdates).eq("id", id);
  if (!error) {
    // Optimistic: update local state without full reload (prevents overwriting while typing)
    projects = projects.map((p) => p.id === id ? { ...p, ...updates } : p);
    emit();
  } else {
    console.error("Failed to update project:", error);
  }
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (!error) {
    await loadProjects();
  } else {
    console.error("Failed to delete project:", error);
  }
}

// Legacy setProjects — only updates local state, does NOT sync to Supabase
// Used for optimistic UI updates; real persistence goes through add/update/deleteProject
export function setProjects(updater: Project[] | ((prev: Project[]) => Project[])) {
  const next = typeof updater === "function" ? updater(projects) : updater;
  projects = next;
  emit();
}

export function useProjects(): [Project[], typeof setProjects] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setProjects];
}

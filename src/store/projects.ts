import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type TaskStatus = "todo" | "in-progress" | "done";
export type ProjectType = "neukunde" | "neue-kampagne" | "optimierung" | "custom";
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
    briefing: row.briefing,
    meetingNotes: row.meeting_notes,
    targetAudience: row.target_audience,
    offer: row.offer,
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

async function loadProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    projects = data.map(rowToProject);
    emit();
  }
}

loadProjects();

export function setProjects(updater: Project[] | ((prev: Project[]) => Project[])) {
  const prev = projects;
  const next = typeof updater === "function" ? updater(prev) : updater;

  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));
  const updated = next.filter((n) => {
    const old = prev.find((p) => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  added.forEach((p) => {
    supabase.from("projects").insert(projectToRow(p)).then(() => loadProjects());
  });
  removed.forEach((p) => {
    supabase.from("projects").delete().eq("id", p.id);
  });
  updated.forEach((p) => {
    supabase.from("projects").update(projectToRow(p)).eq("id", p.id);
  });

  projects = next;
  emit();
}

export function useProjects(): [Project[], typeof setProjects] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setProjects];
}

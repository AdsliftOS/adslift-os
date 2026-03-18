import { useSyncExternalStore } from "react";

// Re-export types that pages need
export type TaskStatus = "todo" | "in-progress" | "done";
export type ProjectType = "neukunde" | "neue-kampagne" | "optimierung" | "custom";
export type CreativeFormat = "video" | "bild" | "beides";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  assignee?: string;
};

export type Phase = {
  id: string;
  title: string;
  tasks: Task[];
};

export type Comment = {
  id: string;
  author: string;
  text: string;
  timestamp: string;
};

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
  deadline?: string; // YYYY-MM-DD
};

const STORAGE_KEY = "agencyos-projects";

function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveProjects(data: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// --- Store ---
let projects: Project[] = loadProjects();
let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Project[] {
  return projects;
}

export function setProjects(updater: Project[] | ((prev: Project[]) => Project[])) {
  projects = typeof updater === "function" ? updater(projects) : updater;
  saveProjects(projects);
  emit();
}

export function useProjects(): [Project[], typeof setProjects] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setProjects];
}

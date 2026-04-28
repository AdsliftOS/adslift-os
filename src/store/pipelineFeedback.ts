import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type Feedback = {
  id: string;
  projectId: string;
  stepId: string | null;
  authorName: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

let items: Feedback[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => items;

function rowToFeedback(r: any): Feedback {
  return {
    id: r.id,
    projectId: r.project_id,
    stepId: r.step_id || null,
    authorName: r.author_name || "",
    message: r.message,
    readAt: r.read_at || null,
    createdAt: r.created_at,
  };
}

export async function loadFeedback() {
  const { data, error } = await supabase
    .from("pipeline_feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (!error && data) {
    items = data.map(rowToFeedback);
    emit();
  }
}
loadFeedback();

export async function addFeedback(f: {
  projectId: string;
  stepId: string | null;
  authorName: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from("pipeline_feedback")
    .insert({
      project_id: f.projectId,
      step_id: f.stepId,
      author_name: f.authorName,
      message: f.message,
    })
    .select()
    .single();
  if (!error && data) {
    items = [rowToFeedback(data), ...items];
    emit();
    return data.id;
  }
  console.error("addFeedback failed:", error);
  toast.error("Feedback konnte nicht gespeichert werden");
  return null;
}

export async function markFeedbackRead(id: string) {
  items = items.map((f) => (f.id === id ? { ...f, readAt: new Date().toISOString() } : f));
  emit();
  await supabase
    .from("pipeline_feedback")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markProjectFeedbackRead(projectId: string) {
  const now = new Date().toISOString();
  items = items.map((f) => (f.projectId === projectId && !f.readAt ? { ...f, readAt: now } : f));
  emit();
  await supabase
    .from("pipeline_feedback")
    .update({ read_at: now })
    .eq("project_id", projectId)
    .is("read_at", null);
}

export async function deleteFeedback(id: string) {
  items = items.filter((f) => f.id !== id);
  emit();
  await supabase.from("pipeline_feedback").delete().eq("id", id);
}

export function useFeedback(projectId: string | null): Feedback[] {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  if (!projectId) return all;
  return all.filter((f) => f.projectId === projectId);
}

export function useUnreadFeedbackCount(projectId?: string): number {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  return all.filter((f) => !f.readAt && (!projectId || f.projectId === projectId)).length;
}

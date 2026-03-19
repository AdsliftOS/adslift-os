import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type Category = "admin" | "growth" | "marketing" | "sales" | "customer-success";
export type Priority = "high" | "medium" | "low";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";
export type Column = "todo" | "in-progress" | "done";

export type Task = {
  id: string;
  title: string;
  category: Category;
  priority: Priority;
  dueDate?: string;
  column: Column;
  recurrence: Recurrence;
  assignee: string;
};

let tasks: Task[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return tasks; }

async function load() {
  try {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      tasks = data.map((r: any) => ({
        id: r.id, title: r.title, category: r.category || "admin", priority: r.priority || "medium",
        dueDate: r.due_date || undefined, column: r.col || "todo", recurrence: r.recurrence || "none",
        assignee: r.assignee || "alex",
      }));
      emit();
    }
  } catch {}
}
load();

export function setTasks(updater: Task[] | ((prev: Task[]) => Task[])) {
  const prev = tasks;
  const next = typeof updater === "function" ? updater(prev) : updater;
  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));
  const updated = next.filter((n) => { const o = prev.find((p) => p.id === n.id); return o && JSON.stringify(o) !== JSON.stringify(n); });

  tasks = next;
  emit();

  added.forEach((t) => {
    supabase.from("tasks").insert({
      title: t.title, category: t.category, priority: t.priority, due_date: t.dueDate || null,
      col: t.column, recurrence: t.recurrence, assignee: t.assignee,
    }).then(() => load());
  });
  removed.forEach((t) => { supabase.from("tasks").delete().eq("id", t.id).then(() => load()); });
  updated.forEach((t) => {
    supabase.from("tasks").update({
      title: t.title, category: t.category, priority: t.priority, due_date: t.dueDate || null,
      col: t.column, recurrence: t.recurrence, assignee: t.assignee,
    }).eq("id", t.id);
  });
}

export function useTasks(): [Task[], typeof setTasks] {
  return [useSyncExternalStore(subscribe, getSnapshot), setTasks];
}

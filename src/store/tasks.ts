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
let loaded = false;

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return tasks; }

export async function loadTasks() {
  try {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      tasks = data.map((r: any) => ({
        id: r.id,
        title: r.title || "",
        category: r.category || "admin",
        priority: r.priority || "medium",
        dueDate: r.due_date || undefined,
        column: (r.status || r.col || "todo") as Column,
        recurrence: r.recurring || "none",
        assignee: r.assignee || "alex",
      }));
      loaded = true;
      emit();
    }
  } catch (e) {
    console.error("Failed to load tasks:", e);
  }
}
loadTasks();

export async function addTask(task: Omit<Task, "id">) {
  const { data, error } = await supabase.from("tasks").insert({
    title: task.title,
    category: task.category,
    priority: task.priority,
    due_date: task.dueDate || null,
    col: task.column,
    recurrence: task.recurrence,
    assignee: task.assignee,
  }).select().single();

  if (!error && data) {
    await loadTasks();
    return data.id;
  } else {
    console.error("Failed to add task:", error);
    return null;
  }
}

export async function updateTask(id: string, updates: Partial<Task>) {
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
  if (updates.column !== undefined) dbUpdates.col = updates.column;
  if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
  if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", id);
  if (!error) {
    await loadTasks();
  } else {
    console.error("Failed to update task:", error);
  }
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (!error) {
    await loadTasks();
  } else {
    console.error("Failed to delete task:", error);
  }
}

export async function moveTask(id: string, column: Column) {
  // Optimistic update — move immediately in UI, then persist
  tasks = tasks.map((t) => t.id === id ? { ...t, column } : t);
  emit();
  await updateTask(id, { column });
}

// Legacy setter for compatibility
export function setTasks(updater: Task[] | ((prev: Task[]) => Task[])) {
  // This is kept for compatibility but shouldn't be used for persistence
  const next = typeof updater === "function" ? updater(tasks) : updater;
  tasks = next;
  emit();
}

export function useTasks(): [Task[], typeof setTasks] {
  return [useSyncExternalStore(subscribe, getSnapshot), setTasks];
}

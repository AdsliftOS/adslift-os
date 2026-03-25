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

function rowToTask(r: any): Task {
  return {
    id: r.id,
    title: r.title || "",
    category: r.category || "admin",
    priority: r.priority || "medium",
    dueDate: r.due_date || undefined,
    column: (r.status || r.col || "todo") as Column,
    recurrence: r.recurring || r.recurrence || "none",
    assignee: r.assignee || "alex",
  };
}

export async function loadTasks() {
  try {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      tasks = data.map(rowToTask);
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
    // Add to local state directly — no full reload
    tasks = [rowToTask(data), ...tasks];
    emit();
    return data.id;
  } else {
    console.error("Failed to add task:", error);
    return null;
  }
}

export async function updateTask(id: string, updates: Partial<Task>) {
  const dbUpdates: any = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if ("dueDate" in updates) dbUpdates.due_date = updates.dueDate || null;
  if (updates.column !== undefined) dbUpdates.col = updates.column;
  if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
  if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;

  // Optimistic update — immediate UI change
  tasks = tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
  emit();

  // Persist to Supabase (no reload after — trust the optimistic update)
  const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", id);
  if (error) {
    console.error("Failed to update task:", error);
  }
}

export async function deleteTask(id: string) {
  // Optimistic delete
  tasks = tasks.filter((t) => t.id !== id);
  emit();

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete task:", error);
    await loadTasks(); // revert on error
  }
}

export async function moveTask(id: string, column: Column) {
  // Optimistic move
  tasks = tasks.map((t) => t.id === id ? { ...t, column } : t);
  emit();

  const dbUpdates = { col: column, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", id);
  if (error) {
    console.error("Failed to move task:", error);
  }
}

// Legacy setter
export function setTasks(updater: Task[] | ((prev: Task[]) => Task[])) {
  const next = typeof updater === "function" ? updater(tasks) : updater;
  tasks = next;
  emit();
}

export function useTasks(): [Task[], typeof setTasks] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setTasks];
}

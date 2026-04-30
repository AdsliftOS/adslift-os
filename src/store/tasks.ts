import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type Category = "admin" | "growth" | "marketing" | "sales" | "customer-success";
export type Priority = "high" | "medium" | "low";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";
export type Column = "todo" | "in-progress" | "done";

export type Task = {
  id: string;
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  dueDate?: string;
  column: Column;
  recurrence: Recurrence;
  assignee: string;
  clientId?: string | null;
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
    description: r.description || "",
    category: r.category || "admin",
    priority: r.priority || "medium",
    dueDate: r.due_date || undefined,
    column: (r.col || "todo") as Column,
    recurrence: r.recurrence || r.recurring || "none",
    assignee: r.assignee || "alex",
    clientId: r.client_id ?? null,
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
    description: task.description || "",
    category: task.category,
    priority: task.priority,
    due_date: task.dueDate || null,
    col: task.column,
    recurrence: task.recurrence,
    assignee: task.assignee,
    client_id: task.clientId ?? null,
  }).select().single();

  if (!error && data) {
    tasks = [rowToTask(data), ...tasks];
    emit();
    return data.id;
  } else {
    console.error("Failed to add task:", error);
    toast.error("Aufgabe konnte nicht erstellt werden");
    return null;
  }
}

export async function updateTask(id: string, updates: Partial<Task>) {
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if ("dueDate" in updates) dbUpdates.due_date = updates.dueDate || null;
  if (updates.column !== undefined) dbUpdates.col = updates.column;
  if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.assignee !== undefined) dbUpdates.assignee = updates.assignee;
  if ("clientId" in updates) dbUpdates.client_id = updates.clientId ?? null;

  // Optimistic update
  tasks = tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
  emit();

  // Persist — use .select() to get response and verify
  const { data, error } = await supabase.from("tasks").update(dbUpdates).eq("id", id).select().single();
  if (error) {
    console.error("TASK UPDATE FAILED:", error, "updates:", dbUpdates, "id:", id);
    toast.error("Aufgabe konnte nicht gespeichert werden");
    // Revert by reloading
    await loadTasks();
  } else if (data) {
    // Verify the update was applied — update local with DB response
    const updated = rowToTask(data);
    tasks = tasks.map((t) => t.id === id ? updated : t);
    emit();
  }
}

export async function deleteTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  emit();

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    console.error("TASK DELETE FAILED:", error);
    toast.error("Aufgabe konnte nicht gelöscht werden");
    await loadTasks();
  }
}

export async function moveTask(id: string, column: Column) {
  // Optimistic move
  tasks = tasks.map((t) => t.id === id ? { ...t, column } : t);
  emit();

  // Persist with .select() to verify
  const { data, error } = await supabase.from("tasks").update({ col: column }).eq("id", id).select().single();
  if (error) {
    console.error("TASK MOVE FAILED:", error, "column:", column, "id:", id);
    toast.error("Spalte konnte nicht geändert werden");
    await loadTasks();
  } else if (data) {
    const updated = rowToTask(data);
    tasks = tasks.map((t) => t.id === id ? updated : t);
    emit();
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

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type EmployeeTodoType = "call" | "followup" | "payment_reminder" | "other";

export type EmployeeTodo = {
  id: string;
  userEmail: string;
  title: string;
  description: string;
  type: EmployeeTodoType;
  dueDate: string | null;
  dueTime: string | null;
  leadName: string | null;
  leadCloseId: string | null;
  phone: string | null;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
};

let todos: EmployeeTodo[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return todos; }

function rowToTodo(r: any): EmployeeTodo {
  return {
    id: r.id,
    userEmail: r.user_email,
    title: r.title || "",
    description: r.description || "",
    type: (r.type || "call") as EmployeeTodoType,
    dueDate: r.due_date || null,
    dueTime: r.due_time || null,
    leadName: r.lead_name || null,
    leadCloseId: r.lead_close_id || null,
    phone: r.phone || null,
    done: !!r.done,
    doneAt: r.done_at || null,
    createdAt: r.created_at,
  };
}

export async function loadEmployeeTodos() {
  const { data, error } = await supabase
    .from("employee_todos")
    .select("*")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (!error && data) {
    todos = data.map(rowToTodo);
    emit();
  }
}
loadEmployeeTodos();

export async function addEmployeeTodo(t: Omit<EmployeeTodo, "id" | "createdAt" | "doneAt">) {
  const { data, error } = await supabase
    .from("employee_todos")
    .insert({
      user_email: t.userEmail,
      title: t.title,
      description: t.description,
      type: t.type,
      due_date: t.dueDate,
      due_time: t.dueTime,
      lead_name: t.leadName,
      lead_close_id: t.leadCloseId,
      phone: t.phone,
      done: t.done,
    })
    .select()
    .single();
  if (!error && data) {
    todos = [rowToTodo(data), ...todos];
    emit();
    return data.id;
  }
  console.error("addEmployeeTodo failed:", error);
  toast.error("ToDo konnte nicht angelegt werden");
  return null;
}

export async function updateEmployeeTodo(id: string, updates: Partial<EmployeeTodo>) {
  const row: any = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.dueDate !== undefined) row.due_date = updates.dueDate;
  if (updates.dueTime !== undefined) row.due_time = updates.dueTime;
  if (updates.leadName !== undefined) row.lead_name = updates.leadName;
  if (updates.leadCloseId !== undefined) row.lead_close_id = updates.leadCloseId;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.done !== undefined) {
    row.done = updates.done;
    row.done_at = updates.done ? new Date().toISOString() : null;
  }

  todos = todos.map((t) =>
    t.id === id
      ? {
          ...t,
          ...updates,
          doneAt:
            updates.done === undefined
              ? t.doneAt
              : updates.done
              ? new Date().toISOString()
              : null,
        }
      : t,
  );
  emit();

  const { error } = await supabase.from("employee_todos").update(row).eq("id", id);
  if (error) {
    console.error("updateEmployeeTodo failed:", error);
    toast.error("ToDo konnte nicht gespeichert werden");
    await loadEmployeeTodos();
  }
}

export async function deleteEmployeeTodo(id: string) {
  todos = todos.filter((t) => t.id !== id);
  emit();
  const { error } = await supabase.from("employee_todos").delete().eq("id", id);
  if (error) {
    console.error("deleteEmployeeTodo failed:", error);
    toast.error("Konnte nicht gelöscht werden");
    await loadEmployeeTodos();
  }
}

export function useEmployeeTodos(userEmail: string | null): EmployeeTodo[] {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  if (!userEmail) return [];
  return all.filter((t) => t.userEmail.toLowerCase() === userEmail.toLowerCase());
}

export function useAllEmployeeTodos(): EmployeeTodo[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

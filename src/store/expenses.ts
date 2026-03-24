import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type ExpenseStatus = "bezahlt" | "geplant" | "offen";
export type MonthlyExpense = { amount: number; status: ExpenseStatus };

export type Expense = {
  id: string;
  name: string;
  category: string;
  description: string;
  monthlyExpenses: Record<string, MonthlyExpense>;
};

let expenses: Expense[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return expenses; }

async function load() {
  try {
    const { data, error } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      expenses = data.map((r: any) => ({
        id: r.id, name: r.name, category: r.category, description: r.description || "",
        monthlyExpenses: r.monthly_expenses || {},
      }));
      emit();
    }
  } catch {}
}
load();

function expenseToRow(e: Partial<Expense>) {
  const row: any = {};
  if (e.name !== undefined) row.name = e.name;
  if (e.category !== undefined) row.category = e.category;
  if (e.description !== undefined) row.description = e.description || "";
  if (e.monthlyExpenses !== undefined) row.monthly_expenses = e.monthlyExpenses;
  return row;
}

// --- Direct CRUD ---
export async function addExpense(expense: Omit<Expense, "id">): Promise<string | null> {
  const { data, error } = await supabase.from("expenses").insert(expenseToRow(expense)).select().single();
  if (!error && data) {
    await load();
    return data.id;
  }
  console.error("Failed to add expense:", error);
  return null;
}

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const { error } = await supabase.from("expenses").update(expenseToRow(updates)).eq("id", id);
  if (!error) {
    expenses = expenses.map((e) => e.id === id ? { ...e, ...updates } : e);
    emit();
  } else {
    console.error("Failed to update expense:", error);
  }
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (!error) {
    expenses = expenses.filter((e) => e.id !== id);
    emit();
  } else {
    console.error("Failed to delete expense:", error);
  }
}

// Legacy setExpenses — for local-only state changes
export function setExpenses(updater: Expense[] | ((prev: Expense[]) => Expense[])) {
  const next = typeof updater === "function" ? updater(expenses) : updater;
  expenses = next;
  emit();
}

export function useExpenses(): [Expense[], typeof setExpenses] {
  return [useSyncExternalStore(subscribe, getSnapshot), setExpenses];
}

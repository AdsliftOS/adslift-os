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

export function setExpenses(updater: Expense[] | ((prev: Expense[]) => Expense[])) {
  const prev = expenses;
  const next = typeof updater === "function" ? updater(prev) : updater;
  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));

  expenses = next;
  emit();

  added.forEach((e) => {
    supabase.from("expenses").insert({
      name: e.name, category: e.category, description: e.description, monthly_expenses: e.monthlyExpenses,
    }).then(() => load());
  });
  removed.forEach((e) => { supabase.from("expenses").delete().eq("id", e.id).then(() => load()); });
}

export function useExpenses(): [Expense[], typeof setExpenses] {
  return [useSyncExternalStore(subscribe, getSnapshot), setExpenses];
}

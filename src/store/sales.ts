import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type SalesWeek = {
  id: string;
  weekStart: string; // ISO date string for Supabase compat
  kw: number;
  year: number;
  newLeads: number;
  closed: number;
  dealVolume: number;
};

let weeks: SalesWeek[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return weeks; }

async function load() {
  try {
    const { data, error } = await supabase.from("sales_weeks").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      weeks = data.map((r: any) => ({
        id: r.id, weekStart: r.week_start, kw: r.kw, year: r.year,
        newLeads: r.new_leads, closed: r.closed,
        dealVolume: Number(r.deal_volume),
      }));
      emit();
    }
  } catch {}
}
load();

function weekToRow(w: Partial<SalesWeek>) {
  const row: any = {};
  if (w.weekStart !== undefined) row.week_start = w.weekStart;
  if (w.kw !== undefined) row.kw = w.kw;
  if (w.year !== undefined) row.year = w.year;
  if (w.newLeads !== undefined) row.new_leads = w.newLeads;
  if (w.closed !== undefined) row.closed = w.closed;
  if (w.dealVolume !== undefined) row.deal_volume = w.dealVolume;
  return row;
}

// --- Direct CRUD ---
export async function addSalesWeek(week: Omit<SalesWeek, "id">): Promise<string | null> {
  const { data, error } = await supabase.from("sales_weeks").insert(weekToRow(week)).select().single();
  if (!error && data) {
    await load();
    return data.id;
  }
  console.error("Failed to add sales week:", error);
  return null;
}

export async function updateSalesWeek(id: string, updates: Partial<SalesWeek>) {
  const { error } = await supabase.from("sales_weeks").update(weekToRow(updates)).eq("id", id);
  if (!error) {
    weeks = weeks.map((w) => w.id === id ? { ...w, ...updates } : w);
    emit();
  } else {
    console.error("Failed to update sales week:", error);
  }
}

export async function deleteSalesWeek(id: string) {
  const { error } = await supabase.from("sales_weeks").delete().eq("id", id);
  if (!error) {
    weeks = weeks.filter((w) => w.id !== id);
    emit();
  } else {
    console.error("Failed to delete sales week:", error);
  }
}

// Legacy setSalesWeeks — for local-only state changes
export function setSalesWeeks(updater: SalesWeek[] | ((prev: SalesWeek[]) => SalesWeek[])) {
  const next = typeof updater === "function" ? updater(weeks) : updater;
  weeks = next;
  emit();
}

export function useSalesWeeks(): [SalesWeek[], typeof setSalesWeeks] {
  return [useSyncExternalStore(subscribe, getSnapshot), setSalesWeeks];
}

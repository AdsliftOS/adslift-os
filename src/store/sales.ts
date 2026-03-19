import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type SalesWeek = {
  id: string;
  weekStart: string; // ISO date string for Supabase compat
  kw: number;
  year: number;
  newLeads: number;
  reached: number;
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
        newLeads: r.new_leads, reached: r.reached, closed: r.closed,
        dealVolume: Number(r.deal_volume),
      }));
      emit();
    }
  } catch {}
}
load();

export function setSalesWeeks(updater: SalesWeek[] | ((prev: SalesWeek[]) => SalesWeek[])) {
  const prev = weeks;
  const next = typeof updater === "function" ? updater(prev) : updater;
  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));

  weeks = next;
  emit();

  added.forEach((w) => {
    supabase.from("sales_weeks").insert({
      week_start: w.weekStart, kw: w.kw, year: w.year,
      new_leads: w.newLeads, reached: w.reached, closed: w.closed, deal_volume: w.dealVolume,
    }).then(() => load());
  });
  removed.forEach((w) => { supabase.from("sales_weeks").delete().eq("id", w.id).then(() => load()); });
}

export function useSalesWeeks(): [SalesWeek[], typeof setSalesWeeks] {
  return [useSyncExternalStore(subscribe, getSnapshot), setSalesWeeks];
}

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type AppSettings = {
  companyName: string;
  companyEmail: string;
  companyWebsite: string;
  currency: string;
  language: string;
  weeklyHourTarget: number;
  salesGoalMonthly: number;
  salesGoalScheduledWeekly: number;
  salesGoalCloseRate: number;
  salesGoalShowUpRate: number;
};

const defaultSettings: AppSettings = {
  companyName: "adslift", companyEmail: "hello@adslift.de", companyWebsite: "adslift.de",
  currency: "EUR", language: "de", weeklyHourTarget: 40,
  salesGoalMonthly: 50000, salesGoalScheduledWeekly: 15, salesGoalCloseRate: 30, salesGoalShowUpRate: 75,
};

let settings: AppSettings = { ...defaultSettings };
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return settings; }

async function loadSettings() {
  const { data } = await supabase.from("app_settings").select("*");
  if (data && data.length > 0) {
    const merged = { ...defaultSettings };
    data.forEach((row: any) => { (merged as any)[row.key] = row.value; });
    settings = merged;
    emit();
  }
}

loadSettings();

export function setSettings(updater: AppSettings | ((prev: AppSettings) => AppSettings)) {
  const next = typeof updater === "function" ? updater(settings) : updater;
  settings = next;
  emit();

  // Upsert all settings
  Object.entries(next).forEach(([key, value]) => {
    supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
  });
}

export function useSettings(): [AppSettings, typeof setSettings] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setSettings];
}

import { useSyncExternalStore } from "react";

export type AppSettings = {
  companyName: string;
  companyEmail: string;
  companyWebsite: string;
  currency: string;
  language: string;
  weeklyHourTarget: number;
  // Sales goals
  salesGoalMonthly: number;
  salesGoalScheduledWeekly: number;
  salesGoalCloseRate: number;
  salesGoalShowUpRate: number;
};

const STORAGE_KEY = "agencyos-settings";

const defaultSettings: AppSettings = {
  companyName: "adslift",
  companyEmail: "hello@adslift.de",
  companyWebsite: "adslift.de",
  currency: "EUR",
  language: "de",
  weeklyHourTarget: 40,
  salesGoalMonthly: 50000,
  salesGoalScheduledWeekly: 15,
  salesGoalCloseRate: 30,
  salesGoalShowUpRate: 75,
};

function load(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {}
  return defaultSettings;
}

function save(data: AppSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

let settings: AppSettings = load();
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return settings; }

export function setSettings(updater: AppSettings | ((prev: AppSettings) => AppSettings)) {
  settings = typeof updater === "function" ? updater(settings) : updater;
  save(settings);
  emit();
}

export function useSettings(): [AppSettings, typeof setSettings] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setSettings];
}

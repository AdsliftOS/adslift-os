import { useSyncExternalStore } from "react";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  type: "call" | "meeting" | "deadline" | "internal" | "other";
  client?: string;
  description?: string;
  meetingLink?: string; // Zoom, Google Meet, etc.
  color?: string;
  projectId?: string; // Link to project deadline
};

const STORAGE_KEY = "agencyos-calendar";

const defaultEvents: CalendarEvent[] = [
  { id: "1", title: "Kick-off Call — Acme Co", date: "2026-03-17", startTime: "10:00", endTime: "11:00", type: "call", client: "Acme Co", description: "Onboarding besprechen, Zugänge klären", meetingLink: "https://zoom.us/j/123456789" },
  { id: "2", title: "Creative Review intern", date: "2026-03-17", startTime: "14:00", endTime: "15:00", type: "internal", description: "Neue Creatives für Nova durchgehen", meetingLink: "https://meet.google.com/abc-defg-hij" },
  { id: "3", title: "Strategie-Call — Nova", date: "2026-03-18", startTime: "09:00", endTime: "10:00", type: "call", client: "Nova", description: "Funnel-Strategie Q2", meetingLink: "https://zoom.us/j/987654321" },
  { id: "4", title: "Ad Copy Deadline — Bolt", date: "2026-03-18", startTime: "17:00", endTime: "17:30", type: "deadline", client: "Bolt" },
  { id: "5", title: "Team Weekly", date: "2026-03-19", startTime: "09:00", endTime: "09:45", type: "meeting", description: "Wöchentliches Team-Meeting", meetingLink: "https://zoom.us/j/111222333" },
  { id: "6", title: "Reporting Call — TerraFin", date: "2026-03-19", startTime: "14:00", endTime: "14:30", type: "call", client: "TerraFin", meetingLink: "https://zoom.us/j/444555666" },
  { id: "7", title: "Creative Shoot vorbereiten", date: "2026-03-20", startTime: "10:00", endTime: "12:00", type: "internal", description: "Skripte und Shot-List für UGC" },
  { id: "8", title: "Kunden-Onboarding — Prism Labs", date: "2026-03-21", startTime: "11:00", endTime: "12:00", type: "call", client: "Prism Labs", meetingLink: "https://zoom.us/j/777888999" },
];

function load(): CalendarEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultEvents;
}

function save(data: CalendarEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

let events: CalendarEvent[] = load();
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return events; }

export function setCalendarEvents(updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) {
  events = typeof updater === "function" ? updater(events) : updater;
  save(events);
  emit();
}

export function useCalendar(): [CalendarEvent[], typeof setCalendarEvents] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setCalendarEvents];
}

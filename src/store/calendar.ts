import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "call" | "meeting" | "deadline" | "internal" | "other" | "sales-call" | "kundenmeeting" | "anruf" | "sonstiges";
  client?: string;
  description?: string;
  meetingLink?: string;
  color?: string;
  projectId?: string;
  accountColor?: string;
  accountColorLight?: string;
  googleEventId?: string;
  accountEmail?: string;
};

let events: CalendarEvent[] = [];
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return events; }

function rowToEvent(row: any): CalendarEvent {
  return {
    id: row.id, title: row.title, date: row.date, startTime: row.start_time,
    endTime: row.end_time, type: row.type, client: row.client,
    description: row.description, meetingLink: row.meeting_link, projectId: row.project_id,
  };
}

async function loadEvents() {
  const { data, error } = await supabase.from("calendar_events").select("*").order("date");
  if (!error && data) { events = data.map(rowToEvent); emit(); }
}

loadEvents();

function eventToRow(e: Partial<CalendarEvent>) {
  const row: any = {};
  if (e.title !== undefined) row.title = e.title;
  if (e.date !== undefined) row.date = e.date;
  if (e.startTime !== undefined) row.start_time = e.startTime;
  if (e.endTime !== undefined) row.end_time = e.endTime;
  if (e.type !== undefined) row.type = e.type;
  if (e.client !== undefined) row.client = e.client || null;
  if (e.description !== undefined) row.description = e.description || null;
  if (e.meetingLink !== undefined) row.meeting_link = e.meetingLink || null;
  if (e.projectId !== undefined) row.project_id = e.projectId || null;
  return row;
}

// --- Direct CRUD ---
export async function addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<string | null> {
  const { data, error } = await supabase.from("calendar_events").insert(eventToRow(event)).select().single();
  if (!error && data) {
    await loadEvents();
    return data.id;
  }
  console.error("Failed to add calendar event:", error);
  return null;
}

export async function updateCalendarEvent(id: string, updates: Partial<CalendarEvent>) {
  const { error } = await supabase.from("calendar_events").update(eventToRow(updates)).eq("id", id);
  if (!error) {
    events = events.map((e) => e.id === id ? { ...e, ...updates } : e);
    emit();
  } else {
    console.error("Failed to update calendar event:", error);
  }
}

export async function deleteCalendarEvent(id: string) {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (!error) {
    events = events.filter((e) => e.id !== id);
    emit();
  } else {
    console.error("Failed to delete calendar event:", error);
  }
}

// Legacy setCalendarEvents — for local-only state changes (Google Calendar events etc.)
export function setCalendarEvents(updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) {
  const next = typeof updater === "function" ? updater(events) : updater;
  events = next;
  emit();
}

export function useCalendar(): [CalendarEvent[], typeof setCalendarEvents] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setCalendarEvents];
}

// --- Google Events Store (separate, set by Calendar page sync) ---
let googleEvents: CalendarEvent[] = [];
let gListeners = new Set<() => void>();

function gEmit() { gListeners.forEach((l) => l()); }
function gSubscribe(l: () => void) { gListeners.add(l); return () => gListeners.delete(l); }
function gGetSnapshot() { return googleEvents; }

export function setGoogleEvents(evts: CalendarEvent[]) {
  googleEvents = evts;
  gEmit();
}

export function useGoogleEvents(): CalendarEvent[] {
  return useSyncExternalStore(gSubscribe, gGetSnapshot);
}

// All events combined (calendar store + google events)
let allEventsCached: CalendarEvent[] = [];
let allEventsCalRef: CalendarEvent[] = [];
let allEventsGcalRef: CalendarEvent[] = [];

export function useAllCalendarEvents(): CalendarEvent[] {
  const cal = useSyncExternalStore(subscribe, getSnapshot);
  const gcal = useSyncExternalStore(gSubscribe, gGetSnapshot);
  if (cal !== allEventsCalRef || gcal !== allEventsGcalRef) {
    allEventsCalRef = cal;
    allEventsGcalRef = gcal;
    allEventsCached = [...cal, ...gcal];
  }
  return allEventsCached;
}

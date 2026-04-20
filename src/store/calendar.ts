import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import {
  accountForAssignee,
  accountByEmail,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "@/lib/google-calendar";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "call" | "meeting" | "deadline" | "internal" | "other" | "sales-call" | "kundenmeeting" | "anruf" | "sonstiges" | "privat";
  client?: string;
  description?: string;
  meetingLink?: string;
  color?: string;
  projectId?: string;
  accountColor?: string;
  accountColorLight?: string;
  googleEventId?: string;
  accountEmail?: string;
  assignee?: string;
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
    assignee: row.assignee || undefined,
    googleEventId: row.google_event_id || undefined,
    accountEmail: row.google_account_email || undefined,
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
  if (e.assignee !== undefined) row.assignee = e.assignee || null;
  if (e.googleEventId !== undefined) row.google_event_id = e.googleEventId || null;
  if (e.accountEmail !== undefined) row.google_account_email = e.accountEmail || null;
  return row;
}

// --- Direct CRUD ---

export type SyncStatus =
  | { kind: "synced"; email: string }
  | { kind: "no-account"; assignee?: string }
  | { kind: "sync-failed"; email: string; reason: string }
  | { kind: "skipped" };

export async function addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<{ id: string; sync: SyncStatus } | { error: string }> {
  const { data, error } = await supabase.from("calendar_events").insert(eventToRow(event)).select().single();
  if (error || !data) {
    console.error("Failed to add calendar event:", error);
    return { error: error?.message || "Unbekannter Fehler" };
  }

  // Push to Google Calendar
  let sync: SyncStatus = { kind: "skipped" };
  const account = accountForAssignee(event.assignee);
  if (!account) {
    sync = { kind: "no-account", assignee: event.assignee };
  } else {
    try {
      const googleEventId = await createGoogleEvent(account, event);
      if (googleEventId) {
        const { error: updErr } = await supabase
          .from("calendar_events")
          .update({ google_event_id: googleEventId, google_account_email: account.email })
          .eq("id", data.id);
        if (updErr) {
          console.warn("Google event created but link column missing. Run the DB migration.", updErr);
          sync = { kind: "sync-failed", email: account.email, reason: "DB-Migration fehlt (google_event_id)" };
        } else {
          sync = { kind: "synced", email: account.email };
        }
      } else {
        sync = { kind: "sync-failed", email: account.email, reason: "Google Calendar API lehnte ab" };
      }
    } catch (e: any) {
      sync = { kind: "sync-failed", email: account.email, reason: e?.message || "Unbekannter Fehler" };
    }
  }

  await loadEvents();
  return { id: data.id, sync };
}

export async function updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<{ sync: SyncStatus } | { error: string }> {
  const existing = events.find((e) => e.id === id);
  const { error } = await supabase.from("calendar_events").update(eventToRow(updates)).eq("id", id);
  if (error) {
    console.error("Failed to update calendar event:", error);
    return { error: error.message };
  }
  events = events.map((e) => e.id === id ? { ...e, ...updates } : e);
  emit();

  let sync: SyncStatus = { kind: "skipped" };

  // If event already has a Google link → update there
  if (existing?.googleEventId && existing.accountEmail) {
    const account = accountByEmail(existing.accountEmail);
    if (account) {
      const merged = { ...existing, ...updates };
      try {
        const ok = await updateGoogleEvent(account, existing.googleEventId, merged);
        sync = ok
          ? { kind: "synced", email: account.email }
          : { kind: "sync-failed", email: account.email, reason: "Google API lehnte Update ab" };
      } catch (e: any) {
        sync = { kind: "sync-failed", email: account.email, reason: e?.message || "Unbekannter Fehler" };
      }
    }
  } else if (existing) {
    // Event war noch nicht mit Google verknüpft → jetzt erstellen
    const merged = { ...existing, ...updates };
    const account = accountForAssignee(merged.assignee);
    if (!account) {
      sync = { kind: "no-account", assignee: merged.assignee };
    } else {
      try {
        const googleEventId = await createGoogleEvent(account, merged);
        if (googleEventId) {
          await supabase
            .from("calendar_events")
            .update({ google_event_id: googleEventId, google_account_email: account.email })
            .eq("id", id);
          sync = { kind: "synced", email: account.email };
        } else {
          sync = { kind: "sync-failed", email: account.email, reason: "Google Calendar API lehnte ab" };
        }
      } catch (e: any) {
        sync = { kind: "sync-failed", email: account.email, reason: e?.message || "Unbekannter Fehler" };
      }
    }
  }

  return { sync };
}

export async function deleteCalendarEvent(id: string): Promise<{ sync: SyncStatus } | { error: string }> {
  const existing = events.find((e) => e.id === id);
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete calendar event:", error);
    return { error: error.message };
  }
  events = events.filter((e) => e.id !== id);
  emit();

  let sync: SyncStatus = { kind: "skipped" };
  if (existing?.googleEventId && existing.accountEmail) {
    const account = accountByEmail(existing.accountEmail);
    if (account) {
      try {
        const ok = await deleteGoogleEvent(account, existing.googleEventId);
        sync = ok
          ? { kind: "synced", email: account.email }
          : { kind: "sync-failed", email: account.email, reason: "Google API lehnte Delete ab" };
      } catch (e: any) {
        sync = { kind: "sync-failed", email: account.email, reason: e?.message || "Unbekannter Fehler" };
      }
    }
  }
  return { sync };
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
    const linkedGoogleIds = new Set(cal.map((e) => e.googleEventId).filter(Boolean) as string[]);
    const gcalDeduped = gcal.filter((e) => !e.googleEventId || !linkedGoogleIds.has(e.googleEventId));
    allEventsCached = [...cal, ...gcalDeduped];
  }
  return allEventsCached;
}

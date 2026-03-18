import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "call" | "meeting" | "deadline" | "internal" | "other";
  client?: string;
  description?: string;
  meetingLink?: string;
  color?: string;
  projectId?: string;
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

export function setCalendarEvents(updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) {
  const prev = events;
  const next = typeof updater === "function" ? updater(prev) : updater;

  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));
  const updated = next.filter((n) => {
    const old = prev.find((p) => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  added.forEach((e) => {
    supabase.from("calendar_events").insert({
      title: e.title, date: e.date, start_time: e.startTime, end_time: e.endTime,
      type: e.type, client: e.client, description: e.description,
      meeting_link: e.meetingLink, project_id: e.projectId,
    }).then(() => loadEvents());
  });
  removed.forEach((e) => { supabase.from("calendar_events").delete().eq("id", e.id); });
  updated.forEach((e) => {
    supabase.from("calendar_events").update({
      title: e.title, date: e.date, start_time: e.startTime, end_time: e.endTime,
      type: e.type, client: e.client, description: e.description,
      meeting_link: e.meetingLink, project_id: e.projectId,
    }).eq("id", e.id);
  });

  events = next;
  emit();
}

export function useCalendar(): [CalendarEvent[], typeof setCalendarEvents] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setCalendarEvents];
}

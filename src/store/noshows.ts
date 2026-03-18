import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type NoShow = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
};

let noshows: NoShow[] = [];
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return noshows; }

async function load() {
  const { data } = await supabase.from("meeting_noshows").select("*");
  if (data) {
    noshows = data.map((r: any) => ({ eventId: r.event_id, eventTitle: r.event_title, eventDate: r.event_date }));
    emit();
  }
}

load();

export async function markNoShow(eventId: string, eventTitle: string, eventDate: string) {
  await supabase.from("meeting_noshows").upsert({ event_id: eventId, event_title: eventTitle, event_date: eventDate }, { onConflict: "event_id" });
  noshows = [...noshows.filter((n) => n.eventId !== eventId), { eventId, eventTitle, eventDate }];
  emit();
}

export async function unmarkNoShow(eventId: string) {
  await supabase.from("meeting_noshows").delete().eq("event_id", eventId);
  noshows = noshows.filter((n) => n.eventId !== eventId);
  emit();
}

export function isNoShow(eventId: string): boolean {
  return noshows.some((n) => n.eventId === eventId);
}

export function useNoShows(): NoShow[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

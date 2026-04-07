import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type Category = "fulfillment" | "sales" | "admin" | "growth" | "meeting" | "creative" | "pause";

export type TimeEntry = {
  id: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  category: Category;
  note: string;
  assignee: string;
  source?: string;    // "google-calendar" | "close-crm" | undefined (manual)
  sourceId?: string;  // external event ID to prevent duplicates
};

let entries: TimeEntry[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return entries; }

export async function loadTimeEntries() {
  try {
    const { data, error } = await supabase.from("time_entries").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      entries = data.map((r: any) => ({
        id: r.id,
        date: r.date,
        startHour: r.start_hour,
        startMinute: r.start_minute,
        endHour: r.end_hour,
        endMinute: r.end_minute,
        category: r.category || "admin",
        note: r.note || "",
        assignee: r.assignee || "alex",
        source: r.source || undefined,
        sourceId: r.source_id || undefined,
      }));
      emit();
    }
  } catch (e) {
    console.error("Failed to load time entries:", e);
  }
}
loadTimeEntries();

export async function addTimeEntry(entry: Omit<TimeEntry, "id">) {
  // Optimistic update
  const tempId = crypto.randomUUID();
  entries = [{ ...entry, id: tempId }, ...entries];
  emit();

  const row: any = {
    date: entry.date,
    start_hour: entry.startHour,
    start_minute: entry.startMinute,
    end_hour: entry.endHour,
    end_minute: entry.endMinute,
    category: entry.category,
    note: entry.note,
    assignee: entry.assignee,
  };
  if (entry.source) row.source = entry.source;
  if (entry.sourceId) row.source_id = entry.sourceId;

  const { error } = await supabase.from("time_entries").insert(row);

  if (!error) {
    await loadTimeEntries();
  } else {
    console.error("Failed to add time entry:", error);
    entries = entries.filter((e) => e.id !== tempId);
    emit();
  }
}

export async function updateTimeEntry(id: string, updates: Partial<TimeEntry>) {
  // Optimistic update
  entries = entries.map((e) => e.id === id ? { ...e, ...updates } : e);
  emit();

  const dbUpdates: any = {};
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.startHour !== undefined) dbUpdates.start_hour = updates.startHour;
  if (updates.startMinute !== undefined) dbUpdates.start_minute = updates.startMinute;
  if (updates.endHour !== undefined) dbUpdates.end_hour = updates.endHour;
  if (updates.endMinute !== undefined) dbUpdates.end_minute = updates.endMinute;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.note !== undefined) dbUpdates.note = updates.note;

  const { error } = await supabase.from("time_entries").update(dbUpdates).eq("id", id);
  if (!error) {
    await loadTimeEntries();
  } else {
    console.error("Failed to update time entry:", error);
    await loadTimeEntries(); // revert
  }
}

export async function deleteTimeEntry(id: string) {
  entries = entries.filter((e) => e.id !== id);
  emit();

  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (!error) {
    await loadTimeEntries();
  } else {
    console.error("Failed to delete time entry:", error);
    await loadTimeEntries();
  }
}

export function getExistingSourceIds(source: string): Set<string> {
  return new Set(
    entries.filter((e) => e.source === source && e.sourceId).map((e) => e.sourceId!)
  );
}

export async function bulkAddTimeEntries(newEntries: Omit<TimeEntry, "id">[]): Promise<number> {
  if (newEntries.length === 0) return 0;

  const rows = newEntries.map((entry) => {
    const row: any = {
      date: entry.date,
      start_hour: entry.startHour,
      start_minute: entry.startMinute,
      end_hour: entry.endHour,
      end_minute: entry.endMinute,
      category: entry.category,
      note: entry.note,
      assignee: entry.assignee,
    };
    if (entry.source) row.source = entry.source;
    if (entry.sourceId) row.source_id = entry.sourceId;
    return row;
  });

  const { error } = await supabase.from("time_entries").insert(rows);
  if (!error) {
    await loadTimeEntries();
    return newEntries.length;
  } else {
    console.error("Failed to bulk add time entries:", error);
    return 0;
  }
}

export function useTimeEntries(): TimeEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

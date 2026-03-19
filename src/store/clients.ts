import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type ClientStatus = "Active" | "Paused";

export type Client = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  company: string;
  projects: number;
  revenue: number;
  status: ClientStatus;
};

// --- Store ---
let clients: Client[] = [];
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return clients; }

async function loadClients() {
  try {
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      clients = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        contact: row.contact || "",
        email: row.email || "",
        phone: row.phone || "",
        company: row.company || "",
        projects: row.projects || 0,
        revenue: Number(row.revenue) || 0,
        status: (row.status as ClientStatus) || "Active",
      }));
      emit();
    }
  } catch {}
}

loadClients();

// setClients — works with Supabase
export function setClients(updater: Client[] | ((prev: Client[]) => Client[])) {
  const prev = clients;
  const next = typeof updater === "function" ? updater(prev) : updater;

  // Find added
  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  // Find removed
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));
  // Find updated
  const updated = next.filter((n) => {
    const old = prev.find((p) => p.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  // Optimistic update
  clients = next;
  emit();

  // Sync to Supabase
  added.forEach((c) => {
    supabase.from("clients").insert({
      name: c.name, contact: c.contact, email: c.email, phone: c.phone,
      company: c.company, projects: c.projects, revenue: c.revenue, status: c.status,
    }).then(() => loadClients());
  });

  removed.forEach((c) => {
    supabase.from("clients").delete().eq("id", c.id).then(() => loadClients());
  });

  updated.forEach((c) => {
    supabase.from("clients").update({
      name: c.name, contact: c.contact, email: c.email, phone: c.phone,
      company: c.company, projects: c.projects, revenue: c.revenue, status: c.status,
    }).eq("id", c.id);
  });
}

export function useClients(): [Client[], typeof setClients] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setClients];
}

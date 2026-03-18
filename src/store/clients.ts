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
let loaded = false;
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return clients; }

// Load from Supabase
async function loadClients() {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (!error && data) {
    clients = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      contact: row.contact,
      email: row.email,
      phone: row.phone,
      company: row.company,
      projects: row.projects,
      revenue: Number(row.revenue),
      status: row.status as ClientStatus,
    }));
    loaded = true;
    emit();
  }
}

// Initial load
loadClients();

export async function addClient(client: Omit<Client, "id">) {
  const { data, error } = await supabase.from("clients").insert({
    name: client.name,
    contact: client.contact,
    email: client.email,
    phone: client.phone,
    company: client.company,
    projects: client.projects,
    revenue: client.revenue,
    status: client.status,
  }).select().single();

  if (!error && data) {
    clients = [{ ...client, id: data.id }, ...clients];
    emit();
    return data.id;
  }
  return null;
}

export async function updateClient(id: string, updates: Partial<Client>) {
  await supabase.from("clients").update(updates).eq("id", id);
  clients = clients.map((c) => c.id === id ? { ...c, ...updates } : c);
  emit();
}

export async function deleteClient(id: string) {
  await supabase.from("clients").delete().eq("id", id);
  clients = clients.filter((c) => c.id !== id);
  emit();
}

// Legacy setClients for compatibility — syncs to Supabase
export function setClients(updater: Client[] | ((prev: Client[]) => Client[])) {
  const prev = clients;
  const next = typeof updater === "function" ? updater(prev) : updater;

  // Find new clients (added)
  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  // Find removed clients
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));

  // Sync to Supabase
  added.forEach((c) => {
    supabase.from("clients").insert({
      id: c.id.length > 20 ? undefined : c.id, // let supabase generate uuid for new ones
      name: c.name, contact: c.contact, email: c.email, phone: c.phone,
      company: c.company, projects: c.projects, revenue: c.revenue, status: c.status,
    }).then(() => loadClients()); // reload to get proper ids
  });

  removed.forEach((c) => {
    supabase.from("clients").delete().eq("id", c.id);
  });

  clients = next;
  emit();
}

export function useClients(): [Client[], typeof setClients] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setClients];
}

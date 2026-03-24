import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type ClientStatus = "Active" | "Paused" | "Inactive";

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
  contract_start?: string;
  contract_end?: string;
  drive_link?: string;
};

// --- Store ---
let clients: Client[] = [];
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return clients; }

function rowToClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    email: row.email || "",
    phone: row.phone || "",
    company: row.company || "",
    projects: row.projects || 0,
    revenue: Number(row.revenue) || 0,
    status: (row.status as ClientStatus) || "Active",
    contract_start: row.contract_start || undefined,
    contract_end: row.contract_end || undefined,
    drive_link: row.drive_link || undefined,
  };
}

function clientToRow(c: Partial<Client>) {
  const row: any = {};
  if (c.name !== undefined) row.name = c.name;
  if (c.contact !== undefined) row.contact = c.contact;
  if (c.email !== undefined) row.email = c.email;
  if (c.phone !== undefined) row.phone = c.phone;
  if (c.company !== undefined) row.company = c.company;
  if (c.projects !== undefined) row.projects = c.projects;
  if (c.revenue !== undefined) row.revenue = c.revenue;
  if (c.status !== undefined) row.status = c.status;
  if (c.contract_start !== undefined) row.contract_start = c.contract_start || null;
  if (c.contract_end !== undefined) row.contract_end = c.contract_end || null;
  if (c.drive_link !== undefined) row.drive_link = c.drive_link || null;
  return row;
}

export async function loadClients() {
  try {
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      clients = data.map(rowToClient);
      emit();
    }
  } catch {}
}

loadClients();

// --- Direct CRUD ---
export async function addClient(client: Omit<Client, "id">): Promise<string | null> {
  const { data, error } = await supabase.from("clients").insert(clientToRow(client)).select().single();
  if (!error && data) {
    await loadClients();
    return data.id;
  }
  console.error("Failed to add client:", error);
  return null;
}

export async function updateClient(id: string, updates: Partial<Client>) {
  const { error } = await supabase.from("clients").update(clientToRow(updates)).eq("id", id);
  if (!error) {
    // Optimistic update
    clients = clients.map((c) => c.id === id ? { ...c, ...updates } : c);
    emit();
  } else {
    console.error("Failed to update client:", error);
  }
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (!error) {
    clients = clients.filter((c) => c.id !== id);
    emit();
  } else {
    console.error("Failed to delete client:", error);
  }
}

// Legacy setClients — for local-only state changes
export function setClients(updater: Client[] | ((prev: Client[]) => Client[])) {
  const next = typeof updater === "function" ? updater(clients) : updater;
  clients = next;
  emit();
}

export function useClients(): [Client[], typeof setClients] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setClients];
}

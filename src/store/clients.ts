import { useSyncExternalStore } from "react";

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

const STORAGE_KEY = "agencyos-clients";

const defaultClients: Client[] = [
  { id: "1", name: "Acme Co", contact: "Maria Schmidt", email: "maria@acme.co", phone: "+49 170 1234567", company: "Acme Co GmbH", projects: 3, revenue: 18400, status: "Active" },
  { id: "2", name: "Nova", contact: "Jan Müller", email: "jan@nova.io", phone: "+49 171 2345678", company: "Nova Technologies", projects: 2, revenue: 12800, status: "Active" },
  { id: "3", name: "Bolt", contact: "Lisa Weber", email: "lisa@bolt.dev", phone: "+49 172 3456789", company: "Bolt UG", projects: 1, revenue: 8500, status: "Active" },
  { id: "4", name: "Prism Labs", contact: "Amy Park", email: "amy@prism.co", phone: "+49 173 4567890", company: "Prism Labs Inc.", projects: 1, revenue: 4200, status: "Paused" },
  { id: "5", name: "TerraFin", contact: "David Wu", email: "david@terrafin.com", phone: "+49 174 5678901", company: "TerraFin AG", projects: 2, revenue: 9300, status: "Active" },
  { id: "6", name: "Cloudrise Digital", contact: "Sarah Chen", email: "sarah@cloudrise.de", phone: "+49 175 6789012", company: "Cloudrise Digital GmbH", projects: 1, revenue: 5000, status: "Active" },
  { id: "7", name: "Buzzman", contact: "Tom Becker", email: "tom@buzzman.de", phone: "+49 176 7890123", company: "Buzzman Media", projects: 1, revenue: 8000, status: "Active" },
  { id: "8", name: "Visual Solutions", contact: "Klara Braun", email: "klara@visualsolutions.de", phone: "+49 177 8901234", company: "Visual Solutions KG", projects: 1, revenue: 5000, status: "Active" },
];

function loadClients(): Client[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultClients;
}

function saveClients(data: Client[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// --- Store ---
let clients: Client[] = loadClients();
let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Client[] {
  return clients;
}

export function setClients(updater: Client[] | ((prev: Client[]) => Client[])) {
  clients = typeof updater === "function" ? updater(clients) : updater;
  saveClients(clients);
  emit();
}

export function getClientNames(): string[] {
  return clients.map((c) => c.name);
}

// React hook
export function useClients(): [Client[], typeof setClients] {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  return [data, setClients];
}

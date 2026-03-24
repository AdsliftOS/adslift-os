import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type PaymentStatus = "paid" | "planned" | "overdue" | "open" | "potenzial";
export type ServiceType = "done4you" | "donewithyou";

export type MonthlyPayment = { amount: number; status: PaymentStatus };

export type Deal = {
  id: string;
  startDate: string;
  client: string;
  serviceType: ServiceType;
  netAmount: number;
  taxRate: number;
  paymentMethod: string;
  monthlyPayments: Record<string, MonthlyPayment>;
};

let deals: Deal[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return deals; }

async function load() {
  try {
    const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      deals = data.map((r: any) => ({
        id: r.id, startDate: r.start_date, client: r.client, serviceType: r.service_type,
        netAmount: Number(r.net_amount), taxRate: Number(r.tax_rate), paymentMethod: r.payment_method,
        monthlyPayments: r.monthly_payments || {},
      }));
      emit();
    }
  } catch {}
}
load();

function dealToRow(d: Partial<Deal>) {
  const row: any = {};
  if (d.startDate !== undefined) row.start_date = d.startDate;
  if (d.client !== undefined) row.client = d.client;
  if (d.serviceType !== undefined) row.service_type = d.serviceType;
  if (d.netAmount !== undefined) row.net_amount = d.netAmount;
  if (d.taxRate !== undefined) row.tax_rate = d.taxRate;
  if (d.paymentMethod !== undefined) row.payment_method = d.paymentMethod;
  if (d.monthlyPayments !== undefined) row.monthly_payments = d.monthlyPayments;
  return row;
}

// --- Direct CRUD ---
export async function addDeal(deal: Omit<Deal, "id">): Promise<string | null> {
  const { data, error } = await supabase.from("deals").insert(dealToRow(deal)).select().single();
  if (!error && data) {
    await load();
    return data.id;
  }
  console.error("Failed to add deal:", error);
  return null;
}

export async function updateDeal(id: string, updates: Partial<Deal>) {
  const { error } = await supabase.from("deals").update(dealToRow(updates)).eq("id", id);
  if (!error) {
    deals = deals.map((d) => d.id === id ? { ...d, ...updates } : d);
    emit();
  } else {
    console.error("Failed to update deal:", error);
  }
}

export async function deleteDeal(id: string) {
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (!error) {
    deals = deals.filter((d) => d.id !== id);
    emit();
  } else {
    console.error("Failed to delete deal:", error);
  }
}

// Legacy setDeals — for local-only state changes
export function setDeals(updater: Deal[] | ((prev: Deal[]) => Deal[])) {
  const next = typeof updater === "function" ? updater(deals) : updater;
  deals = next;
  emit();
}

export function useDeals(): [Deal[], typeof setDeals] {
  return [useSyncExternalStore(subscribe, getSnapshot), setDeals];
}

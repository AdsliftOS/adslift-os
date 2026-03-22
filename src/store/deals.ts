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

export function setDeals(updater: Deal[] | ((prev: Deal[]) => Deal[])) {
  const prev = deals;
  const next = typeof updater === "function" ? updater(prev) : updater;
  const added = next.filter((n) => !prev.find((p) => p.id === n.id));
  const removed = prev.filter((p) => !next.find((n) => n.id === p.id));
  const updated = next.filter((n) => { const o = prev.find((p) => p.id === n.id); return o && JSON.stringify(o) !== JSON.stringify(n); });

  deals = next;
  emit();

  added.forEach((d) => {
    supabase.from("deals").insert({
      start_date: d.startDate, client: d.client, service_type: d.serviceType,
      net_amount: d.netAmount, tax_rate: d.taxRate, payment_method: d.paymentMethod,
      monthly_payments: d.monthlyPayments,
    }).then(() => load());
  });
  removed.forEach((d) => { supabase.from("deals").delete().eq("id", d.id).then(() => load()); });
  updated.forEach((d) => {
    supabase.from("deals").update({
      monthly_payments: d.monthlyPayments,
    }).eq("id", d.id).then(({ error }) => {
      if (error) console.error("Failed to update deal:", error);
    });
  });
}

export function useDeals(): [Deal[], typeof setDeals] {
  return [useSyncExternalStore(subscribe, getSnapshot), setDeals];
}

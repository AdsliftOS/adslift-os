import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type RevolutTransaction = {
  id: string;
  type: string | null;
  state: string | null;
  txCreatedAt: string | null;
  txCompletedAt: string | null;
  amount: number;
  currency: string;
  amountEur: number | null;
  description: string | null;
  merchantName: string | null;
  merchantCategory: string | null;
  counterpartyName: string | null;
  reference: string | null;
  category: string | null;
  expenseId: string | null;
  ignored: boolean;
};

export type RevolutConnection = {
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hasToken: boolean;
};

let txs: RevolutTransaction[] = [];
let connection: RevolutConnection | null = null;
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

function rowToTx(r: any): RevolutTransaction {
  return {
    id: r.id,
    type: r.type,
    state: r.state,
    txCreatedAt: r.tx_created_at,
    txCompletedAt: r.tx_completed_at,
    amount: Number(r.amount),
    currency: r.currency,
    amountEur: r.amount_eur != null ? Number(r.amount_eur) : null,
    description: r.description,
    merchantName: r.merchant_name,
    merchantCategory: r.merchant_category,
    counterpartyName: r.counterparty_name,
    reference: r.reference,
    category: r.category,
    expenseId: r.expense_id,
    ignored: !!r.ignored,
  };
}

export async function loadRevolut() {
  try {
    const [txRes, connRes] = await Promise.all([
      supabase.from("revolut_transactions").select("*").order("tx_created_at", { ascending: false }),
      supabase.from("revolut_connection").select("*").eq("id", "default").maybeSingle(),
    ]);
    if (!txRes.error && txRes.data) txs = txRes.data.map(rowToTx);
    if (!connRes.error) {
      const r = connRes.data;
      connection = r ? {
        connectedAt: r.connected_at,
        lastSyncedAt: r.last_synced_at,
        lastSyncError: r.last_sync_error,
        hasToken: !!r.access_token,
      } : null;
    }
    emit();
  } catch {}
}
loadRevolut();

export function useRevolutTransactions() {
  return useSyncExternalStore(subscribe, () => txs);
}
export function useRevolutConnection() {
  return useSyncExternalStore(subscribe, () => connection);
}

export async function updateRevolutTx(id: string, patch: Partial<{
  category: string | null;
  ignored: boolean;
  expenseId: string | null;
}>) {
  const row: any = {};
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.ignored !== undefined) row.ignored = patch.ignored;
  if (patch.expenseId !== undefined) row.expense_id = patch.expenseId;
  const { error } = await supabase.from("revolut_transactions").update(row).eq("id", id);
  if (!error) {
    txs = txs.map((t) => t.id === id ? { ...t, ...patch } as RevolutTransaction : t);
    emit();
  } else {
    console.error("Failed to update Revolut tx:", error);
  }
}

const SUPABASE_URL = "https://ofrvoxupatowfatpleji.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcnZveHVwYXRvd2ZhdHBsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjk0NTQsImV4cCI6MjA4OTQwNTQ1NH0.AIqVTa0JK_srhTaD-a6CH9Ik94FATjhX8P-ilToCO0U";

export async function getRevolutAuthUrl(): Promise<string | null> {
  try {
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    const url = new URL(`${SUPABASE_URL}/functions/v1/revolut-auth-start`);
    url.searchParams.set("return_to", returnTo);
    const res = await fetch(url.toString(), { headers: { apikey: ANON_KEY } });
    const j = await res.json();
    return j.authUrl ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function syncRevolut(): Promise<{ ok: boolean; outgoing?: number; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/revolut-sync`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    if (!res.ok) return { ok: false, error: j.error || j.detail || "sync failed" };
    await loadRevolut();
    return { ok: true, outgoing: j.outgoing };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

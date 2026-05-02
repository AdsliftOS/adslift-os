// Pulls transactions from Revolut and stores outgoing ones.
// Usage: POST /functions/v1/revolut-sync   body: { fromIso?: string }
// Refreshes the access token if needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchTransactions, refreshAccessToken } from "../_shared/revolut.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REFRESH_BUFFER_MS = 60_000; // refresh 60s before expiry

function pickPrimaryLeg(legs: any[] | undefined): any | null {
  if (!Array.isArray(legs) || legs.length === 0) return null;
  // For most outgoing tx (card payment, transfer): single leg with negative amount.
  // For exchange: two legs, we take the negative (debit) one.
  return legs.find((l) => Number(l.amount) < 0) ?? legs[0];
}

function isOutgoing(tx: any): boolean {
  const leg = pickPrimaryLeg(tx.legs);
  if (!leg) return false;
  // Skip topups, incoming transfers (positive amounts), refunds.
  if (Number(leg.amount) >= 0) return false;
  // Skip declined/failed/reverted.
  const state = String(tx.state ?? "").toLowerCase();
  if (["declined", "failed", "reverted"].includes(state)) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");
  if (!supabaseUrl || !serviceRole || !clientId || !privateKeyPem) {
    return new Response(JSON.stringify({ error: "missing env" }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  let fromIso: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.fromIso === "string") fromIso = body.fromIso;
  } catch {}

  // Load connection
  const { data: conn, error: connErr } = await supabase
    .from("revolut_connection")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (connErr || !conn) {
    return new Response(
      JSON.stringify({ error: "not connected", detail: connErr?.message }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }

  // Refresh token if needed
  let accessToken: string = conn.access_token;
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (!accessToken || exp - Date.now() < REFRESH_BUFFER_MS) {
    if (!conn.refresh_token) {
      return new Response(
        JSON.stringify({ error: "token expired and no refresh_token" }),
        { status: 401, headers: { ...CORS, "content-type": "application/json" } },
      );
    }
    try {
      const refreshed = await refreshAccessToken({
        clientId,
        privateKeyPem,
        refreshToken: conn.refresh_token,
      });
      accessToken = refreshed.access_token;
      const newExp = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("revolut_connection").update({
        access_token: refreshed.access_token,
        // refresh_token stays the same unless Revolut rotates it
        refresh_token: refreshed.refresh_token ?? conn.refresh_token,
        token_expires_at: newExp,
      }).eq("id", "default");
    } catch (e) {
      const msg = String(e);
      await supabase.from("revolut_connection").update({ last_sync_error: msg })
        .eq("id", "default");
      return new Response(JSON.stringify({ error: "refresh failed", detail: msg }), {
        status: 401,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
  }

  // Default: sync last 90 days, or from oldest_synced_at - 1 day overlap.
  if (!fromIso) {
    const last = conn.last_synced_at ? new Date(conn.last_synced_at) : null;
    if (last) {
      // re-pull last 7 days to catch state changes
      const overlap = new Date(last.getTime() - 7 * 24 * 60 * 60 * 1000);
      fromIso = overlap.toISOString();
    } else {
      fromIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  let txs: any[];
  try {
    txs = await fetchTransactions({ accessToken, fromIso, count: 1000 });
  } catch (e) {
    const msg = String(e);
    await supabase.from("revolut_connection").update({ last_sync_error: msg })
      .eq("id", "default");
    return new Response(JSON.stringify({ error: "fetch failed", detail: msg }), {
      status: 502,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const outgoing = txs.filter(isOutgoing);
  const rows = outgoing.map((tx) => {
    const leg = pickPrimaryLeg(tx.legs)!;
    return {
      id: tx.id,
      type: tx.type ?? null,
      state: tx.state ?? null,
      tx_created_at: tx.created_at ?? null,
      tx_completed_at: tx.completed_at ?? null,
      amount: Number(leg.amount),
      currency: leg.currency,
      amount_eur: leg.bill_amount ? Number(leg.bill_amount) : null,
      description: leg.description ?? tx.reference ?? null,
      merchant_name: tx.merchant?.name ?? null,
      merchant_category: tx.merchant?.category_code ?? null,
      counterparty_name: leg.counterparty?.account_name
        ?? tx.merchant?.name
        ?? null,
      reference: tx.reference ?? null,
      raw: tx,
    };
  });

  let inserted = 0;
  if (rows.length > 0) {
    // Upsert; ignored / category / expense_id stay if row exists (we don't overwrite them).
    const { error: upErr, count } = await supabase
      .from("revolut_transactions")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false, count: "exact" });
    if (upErr) {
      await supabase.from("revolut_connection").update({ last_sync_error: upErr.message })
        .eq("id", "default");
      return new Response(JSON.stringify({ error: "upsert failed", detail: upErr.message }), {
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    inserted = count ?? rows.length;
  }

  await supabase.from("revolut_connection").update({
    last_synced_at: new Date().toISOString(),
    last_sync_error: null,
  }).eq("id", "default");

  return new Response(
    JSON.stringify({
      ok: true,
      fetched: txs.length,
      outgoing: rows.length,
      upserted: inserted,
      fromIso,
    }),
    { headers: { ...CORS, "content-type": "application/json" } },
  );
});

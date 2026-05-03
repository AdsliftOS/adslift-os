// /api/close-sync — Holt Close-Activities für einen Kunden + cached in Supabase.
//
// POST { clientId: string, email?: string, force?: boolean }
//
// Verhalten:
//   1. Findet/findet Lead in Close (per email oder gespeicherter close_lead_id)
//   2. Holt activity-Liste (note/call/meeting), upserted in close_activities
//   3. Speichert close_lead_id + close_last_synced_at auf clients
//   4. Returns: { lead_id, count, activities, error }

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

const CLOSE_API_KEY = process.env.CLOSE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1] || "ofrvoxupatowfatpleji.supabase.co"}`;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });
  }
  if (!CLOSE_API_KEY) {
    return new Response(JSON.stringify({ error: "CLOSE_API_KEY missing" }), { status: 500, headers });
  }
  if (!SUPABASE_SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE missing" }), { status: 500, headers });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const { clientId, email, force } = body;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "clientId fehlt" }), { status: 400, headers });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const auth = `Basic ${btoa(CLOSE_API_KEY + ":")}`;

  // 1. Client laden + close_lead_id (cached)
  const { data: client } = await sb.from("clients").select("id, email, name, close_lead_id, close_last_synced_at").eq("id", clientId).maybeSingle();
  if (!client) return new Response(JSON.stringify({ error: "Client nicht gefunden" }), { status: 404, headers });
  const searchEmail = (email || client.email || "").toLowerCase().trim();
  if (!searchEmail) return new Response(JSON.stringify({ error: "Keine Email für Lead-Suche" }), { status: 400, headers });

  let leadId: string | null = client.close_lead_id || null;

  // 2. Falls noch keine lead_id → in Close suchen
  if (!leadId) {
    const searchRes = await fetch(`https://api.close.com/api/v1/lead/?query=${encodeURIComponent(`email:${searchEmail}`)}&_limit=5`, {
      headers: { Authorization: auth },
    });
    if (!searchRes.ok) {
      const t = await searchRes.text();
      return new Response(JSON.stringify({ error: `Close-Search ${searchRes.status}: ${t.slice(0, 200)}` }), { status: 502, headers });
    }
    const searchData = await searchRes.json();
    const lead = (searchData.data || [])[0];
    if (!lead) {
      return new Response(JSON.stringify({ error: "Kein Lead in Close gefunden für " + searchEmail, leadId: null, count: 0 }), { status: 200, headers });
    }
    leadId = lead.id;
    await sb.from("clients").update({ close_lead_id: leadId }).eq("id", clientId);
  }

  // 3. Activities holen (notes, calls, meetings)
  const types = ["activity.note", "activity.call", "activity.meeting"];
  const allActivities: any[] = [];
  for (const t of types) {
    const actRes = await fetch(`https://api.close.com/api/v1/activity/${t.replace("activity.", "")}/?lead_id=${leadId}&_limit=100`, {
      headers: { Authorization: auth },
    });
    if (actRes.ok) {
      const data = await actRes.json();
      const items = (data.data || []).map((a: any) => ({ ...a, _activity_type: t.replace("activity.", "") }));
      allActivities.push(...items);
    }
  }

  // 4. Upsert in close_activities
  const rows = allActivities.map((a) => ({
    id: a.id,
    client_id: clientId,
    close_lead_id: leadId,
    type: a._activity_type,
    title: a.subject || a.title || a.summary || null,
    body: a.note || a.text || a.body || null,
    activity_at: a.starts_at || a.created_at || a.date_created || new Date().toISOString(),
    duration_seconds: a.duration ?? null,
    user_id: a.user_id || a.created_by || null,
    outcome: a.outcome || a.status || null,
    raw: a,
    synced_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error: upsertErr } = await sb.from("close_activities").upsert(rows, { onConflict: "id" });
    if (upsertErr) {
      return new Response(JSON.stringify({ error: "Upsert: " + upsertErr.message, leadId, count: 0 }), { status: 500, headers });
    }
  }

  await sb.from("clients").update({ close_last_synced_at: new Date().toISOString() }).eq("id", clientId);

  return new Response(
    JSON.stringify({ leadId, count: rows.length, syncedAt: new Date().toISOString() }),
    { headers },
  );
}

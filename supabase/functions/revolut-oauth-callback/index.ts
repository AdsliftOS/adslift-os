// OAuth callback. Revolut redirects here with ?code=...&state=...
// Exchanges code for access+refresh token, stores in revolut_connection,
// then redirects user back to the URL encoded in `state`
// (or REVOLUT_APP_RETURN_URL fallback).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exchangeAuthCode } from "../_shared/revolut.ts";

function decodeState(state: string | null): string | null {
  if (!state) return null;
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
    if (!/^https?:\/\//.test(decoded)) return null;
    return decoded;
  } catch { return null; }
}

function appendQuery(rawUrl: string, params: Record<string, string>): string {
  const u = new URL(rawUrl);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");

  const fallbackReturn = Deno.env.get("REVOLUT_APP_RETURN_URL")
    ?? "http://localhost:8080/finances";
  const appReturnUrl = decodeState(stateParam) ?? fallbackReturn;

  if (errorParam) {
    return Response.redirect(
      appendQuery(appReturnUrl, { revolut: "error", reason: errorParam }),
      302,
    );
  }
  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const privateKeyPem = Deno.env.get("REVOLUT_PRIVATE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!clientId || !privateKeyPem || !supabaseUrl || !serviceRole) {
    return new Response("Server misconfigured (missing Revolut or Supabase env)", {
      status: 500,
    });
  }

  try {
    const tokens = await exchangeAuthCode({ clientId, privateKeyPem, code });

    const supabase = createClient(supabaseUrl, serviceRole);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error } = await supabase
      .from("revolut_connection")
      .upsert({
        id: "default",
        client_id: clientId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      });

    if (error) {
      console.error("DB upsert failed", error);
      return new Response("DB error: " + error.message, { status: 500 });
    }

    return Response.redirect(
      appendQuery(appReturnUrl, { revolut: "connected" }),
      302,
    );
  } catch (e) {
    console.error("OAuth callback failed", e);
    return Response.redirect(
      appendQuery(appReturnUrl, { revolut: "error", reason: String(e).slice(0, 200) }),
      302,
    );
  }
});

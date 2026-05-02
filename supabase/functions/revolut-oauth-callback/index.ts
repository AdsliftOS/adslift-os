// OAuth callback. Revolut redirects here with ?code=...
// Exchanges code for access+refresh token, stores in revolut_connection,
// then redirects user back to the app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exchangeAuthCode } from "../_shared/revolut.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");
  const appReturnUrl = Deno.env.get("REVOLUT_APP_RETURN_URL")
    ?? "https://agency-core-os.lovable.app/finances";

  if (errorParam) {
    return Response.redirect(
      `${appReturnUrl}?revolut=error&reason=${encodeURIComponent(errorParam)}`,
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

    return Response.redirect(`${appReturnUrl}?revolut=connected`, 302);
  } catch (e) {
    console.error("OAuth callback failed", e);
    return Response.redirect(
      `${appReturnUrl}?revolut=error&reason=${encodeURIComponent(String(e))}`,
      302,
    );
  }
});

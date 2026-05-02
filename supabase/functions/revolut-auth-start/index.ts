// Returns the Revolut authorization URL the frontend should open.
// GET /functions/v1/revolut-auth-start

import { REVOLUT } from "../_shared/revolut.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const clientId = Deno.env.get("REVOLUT_CLIENT_ID");
  const redirectUri = Deno.env.get("REVOLUT_REDIRECT_URI");
  if (!clientId || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "REVOLUT_CLIENT_ID or REVOLUT_REDIRECT_URI not set" }),
      { status: 500, headers: { ...CORS, "content-type": "application/json" } },
    );
  }

  const url = new URL(REVOLUT.AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");

  return new Response(JSON.stringify({ authUrl: url.toString() }), {
    headers: { ...CORS, "content-type": "application/json" },
  });
});

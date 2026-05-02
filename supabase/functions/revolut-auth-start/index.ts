// Returns the Revolut authorization URL the frontend should open.
// GET /functions/v1/revolut-auth-start?return_to=https://my.app/finances
// The return_to is passed through OAuth `state` so the callback
// redirects back to wherever the user started — works for localhost, Lovable, custom domain.

import { REVOLUT } from "../_shared/revolut.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function isSafeReturnTo(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return true;
  } catch { return false; }
}

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

  const reqUrl = new URL(req.url);
  const returnTo = reqUrl.searchParams.get("return_to") ?? "";
  // Encode returnTo in `state` (URL-safe base64) so callback can route back to caller.
  const state = isSafeReturnTo(returnTo)
    ? btoa(returnTo).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
    : "";

  const url = new URL(REVOLUT.AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  if (state) url.searchParams.set("state", state);

  return new Response(JSON.stringify({ authUrl: url.toString() }), {
    headers: { ...CORS, "content-type": "application/json" },
  });
});

// Server-Proxy zu Anthropic Messages API.
// Hält den ANTHROPIC_API_KEY vom Client fern.
// Forwarded der Body 1:1 — Caller wählt Model, Messages, max_tokens etc. selbst.

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY environment variable is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: { type: "fetch_error", message: e?.message || "Upstream fetch failed" } }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const text = await upstream.text();

  // Anthropic liefert immer JSON. Falls upstream mal HTML/text liefert (Cloudflare-Page,
  // Gateway-Error etc.), wrap als JSON damit der Frontend-Helper sauber parsen kann.
  try {
    JSON.parse(text);
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          type: "upstream_non_json",
          message: `Anthropic upstream returned non-JSON (HTTP ${upstream.status})`,
          raw: text.slice(0, 500),
        },
      }),
      { status: upstream.status >= 400 ? upstream.status : 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

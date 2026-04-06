export const config = { runtime: "edge" };

const CLOSE_API_KEY = process.env.CLOSE_API_KEY;
const BASE_URL = "https://api.close.com/api/v1";

export default async function handler(req: Request) {
  if (!CLOSE_API_KEY) {
    return new Response(JSON.stringify({ error: "No Close API key configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");

  if (!endpoint) {
    return new Response(JSON.stringify({ error: "Missing endpoint param" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Build Close API URL with remaining params
  const closeParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== "endpoint") closeParams.set(key, value);
  }

  const closeUrl = `${BASE_URL}/${endpoint}${closeParams.toString() ? "?" + closeParams.toString() : ""}`;
  const auth = btoa(`${CLOSE_API_KEY}:`);

  try {
    const res = await fetch(closeUrl, {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: req.method === "POST" ? await req.text() : undefined,
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

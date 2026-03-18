export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";

  const CLOSE_API_KEY = process.env.CLOSE_API_KEY;
  if (!CLOSE_API_KEY) {
    return new Response(JSON.stringify({ error: "No API key" }), { status: 500 });
  }

  try {
    const query = encodeURIComponent(`created >= "${dateFrom}" and created <= "${dateTo}"`);
    const res = await fetch(`https://api.close.com/api/v1/lead/?query=${query}&_limit=0&_fields=id`, {
      headers: {
        Authorization: `Basic ${btoa(CLOSE_API_KEY + ":")}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Close API error", status: res.status }), { status: 500 });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ count: data.total_results || 0 }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

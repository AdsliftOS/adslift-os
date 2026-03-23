export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const TOKEN = process.env.META_ACCESS_TOKEN;
  const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "act_1263695578446693";

  const url = new URL(req.url);
  const preset = url.searchParams.get("preset") || "this_month";
  const since = url.searchParams.get("since") || "";
  const until = url.searchParams.get("until") || "";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (!TOKEN)
    return new Response(JSON.stringify({ error: "No token" }), {
      status: 400,
      headers,
    });

  try {
    // Get campaigns
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/campaigns?fields=name,status,objective&limit=50&access_token=${TOKEN}`
    );
    const campaigns = await campaignsRes.json();

    // Get insights with date range
    let insightsUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights?fields=campaign_name,campaign_id,spend,impressions,clicks,ctr,cpm,cpc,actions&level=campaign&limit=50&access_token=${TOKEN}`;

    if (since && until) {
      insightsUrl += `&time_range={"since":"${since}","until":"${until}"}`;
    } else {
      insightsUrl += `&date_preset=${preset}`;
    }

    const insightsRes = await fetch(insightsUrl);
    const insights = await insightsRes.json();

    // Get account-level totals
    let totalsUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights?fields=spend,impressions,clicks,ctr,cpm,cpc,actions&access_token=${TOKEN}`;
    if (since && until) {
      totalsUrl += `&time_range={"since":"${since}","until":"${until}"}`;
    } else {
      totalsUrl += `&date_preset=${preset}`;
    }

    const totalsRes = await fetch(totalsUrl);
    const totals = await totalsRes.json();

    return new Response(
      JSON.stringify({
        campaigns: campaigns.data || [],
        insights: insights.data || [],
        totals: totals.data?.[0] || null,
      }),
      { headers }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers,
    });
  }
}
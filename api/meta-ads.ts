export const config = { runtime: "edge" };

const INSIGHT_FIELDS = [
  "campaign_name",
  "campaign_id",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpm",
  "cpc",
  "actions",
  "video_avg_time_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "cost_per_action_type",
].join(",");

const TOTALS_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpm",
  "cpc",
  "actions",
  "video_avg_time_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "cost_per_action_type",
].join(",");

function buildDateParams(preset: string, since: string, until: string): string {
  if (since && until) {
    return `&time_range={"since":"${since}","until":"${until}"}`;
  }
  return `&date_preset=${preset}`;
}

export default async function handler(req: Request) {
  const TOKEN = process.env.META_ACCESS_TOKEN;
  const DEFAULT_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "act_1263695578446693";

  const url = new URL(req.url);
  const preset = url.searchParams.get("preset") || "this_month";
  const since = url.searchParams.get("since") || "";
  const until = url.searchParams.get("until") || "";
  const breakdown = url.searchParams.get("breakdown") || "";
  const accountParam = url.searchParams.get("account") || "";
  const listAccounts = url.searchParams.get("list_accounts") || "";

  const AD_ACCOUNT = accountParam || DEFAULT_AD_ACCOUNT;

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
    // List all ad accounts
    if (listAccounts === "true") {
      const accountsRes = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id,account_status&limit=50&access_token=${TOKEN}`
      );
      const accounts = await accountsRes.json();
      return new Response(
        JSON.stringify({ accounts: (accounts.data || []).filter((a: any) => a.account_status === 1) }),
        { headers }
      );
    }

    const dateParams = buildDateParams(preset, since, until);

    // Daily breakdown endpoint
    if (breakdown === "daily") {
      const dailyUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights?fields=${TOTALS_FIELDS}&time_increment=1${dateParams}&limit=100&access_token=${TOKEN}`;
      const dailyRes = await fetch(dailyUrl);
      const daily = await dailyRes.json();
      return new Response(
        JSON.stringify({ daily: daily.data || [] }),
        { headers }
      );
    }

    // Get campaigns with run-time fields for the Gantt timeline
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/campaigns?fields=name,status,objective,created_time,start_time,stop_time,daily_budget,lifetime_budget,effective_status&limit=50&access_token=${TOKEN}`
    );
    const campaigns = await campaignsRes.json();

    // Get insights with date range
    const insightsUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights?fields=${INSIGHT_FIELDS}&level=campaign&limit=50${dateParams}&access_token=${TOKEN}`;
    const insightsRes = await fetch(insightsUrl);
    const insights = await insightsRes.json();

    // Get account-level totals
    const totalsUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights?fields=${TOTALS_FIELDS}${dateParams}&access_token=${TOKEN}`;
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

// Live KPI fetcher for a single project's connected Meta Ad-Account.
// Hits the existing /api/meta-ads edge function.

export type ProjectKPIs = {
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  cpm: number;
  cpc: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  loading: false;
  error: string | null;
};

export type Preset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "lifetime";

const PRESET_MAP: Record<Preset, string> = {
  today: "today",
  yesterday: "yesterday",
  last_7d: "last_7d",
  last_14d: "last_14d",
  last_30d: "last_30d",
  this_month: "this_month",
  last_month: "last_month",
  this_quarter: "this_quarter",
  last_quarter: "last_quarter",
  lifetime: "maximum",
};

// ─── Daily Breakdown für Charts ──────────────────────────────────────
export type DailyDataPoint = {
  date: string;       // YYYY-MM-DD
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export async function getDailyBreakdown(
  adAccountId: string,
  preset: Preset = "last_30d",
): Promise<{ daily: DailyDataPoint[]; error: string | null }> {
  if (!adAccountId) return { daily: [], error: "Keine Ad-Account-ID" };
  try {
    const params = new URLSearchParams({
      account: adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`,
      preset: PRESET_MAP[preset],
      breakdown: "daily",
    });
    const res = await fetch(`/api/meta-ads?${params.toString()}`);
    if (!res.ok) return { daily: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const points: DailyDataPoint[] = (data.daily || []).map((d: any) => {
      const actions: { action_type: string; value: string }[] = d.actions || [];
      const leadAction = actions.find((a) =>
        ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"].includes(a.action_type),
      );
      return {
        date: d.date_start,
        spend: Number(d.spend) || 0,
        leads: leadAction ? Number(leadAction.value) || 0 : 0,
        impressions: Number(d.impressions) || 0,
        clicks: Number(d.clicks) || 0,
        ctr: Number(d.ctr) || 0,
        cpc: Number(d.cpc) || 0,
        cpm: Number(d.cpm) || 0,
      };
    });
    return { daily: points, error: null };
  } catch (e: any) {
    return { daily: [], error: e?.message || String(e) };
  }
}

export async function getProjectKPIs(
  adAccountId: string,
  preset: Preset = "this_month",
): Promise<ProjectKPIs> {
  const empty: ProjectKPIs = {
    leads: 0, spend: 0, cpl: 0, ctr: 0, cpm: 0, cpc: 0,
    impressions: 0, reach: 0, frequency: 0, clicks: 0,
    loading: false, error: null,
  };

  if (!adAccountId) return { ...empty, error: "Keine Ad-Account-ID" };

  try {
    const params = new URLSearchParams({
      account: adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`,
      preset: PRESET_MAP[preset],
    });
    const res = await fetch(`/api/meta-ads?${params.toString()}`);
    if (!res.ok) {
      const t = await res.text();
      return { ...empty, error: `HTTP ${res.status}: ${t.slice(0, 120)}` };
    }
    const data = await res.json();
    if (data?.error) return { ...empty, error: String(data.error).slice(0, 200) };

    const totals = data?.totals;
    if (!totals) return { ...empty, error: "Keine Daten im Zeitraum" };

    // Lead count from actions array
    const actions: { action_type: string; value: string }[] = totals.actions || [];
    const leadAction = actions.find((a) =>
      ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"].includes(a.action_type),
    );
    const leads = leadAction ? Number(leadAction.value) || 0 : 0;
    const spend = Number(totals.spend) || 0;

    return {
      leads,
      spend,
      cpl: leads > 0 ? spend / leads : 0,
      ctr: Number(totals.ctr) || 0,
      cpm: Number(totals.cpm) || 0,
      cpc: Number(totals.cpc) || 0,
      impressions: Number(totals.impressions) || 0,
      reach: Number(totals.reach) || 0,
      frequency: Number(totals.frequency) || 0,
      clicks: Number(totals.clicks) || 0,
      loading: false,
      error: null,
    };
  } catch (err: any) {
    return { ...empty, error: err?.message || String(err) };
  }
}

// ─── Campaigns + insights merged ────────────────────────────────────

export type Campaign = {
  id: string;
  name: string;
  status: string;          // ACTIVE / PAUSED / DELETED / ARCHIVED
  effectiveStatus: string;
  objective: string;
  createdTime: string;     // ISO
  startTime: string | null;
  stopTime: string | null; // null = open-ended (running)
  dailyBudget: number;
  lifetimeBudget: number;
  // From insights
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
  impressions: number;
  clicks: number;
};

export async function getProjectCampaigns(
  adAccountId: string,
  preset: Preset = "this_month",
): Promise<{ campaigns: Campaign[]; error: string | null }> {
  if (!adAccountId) return { campaigns: [], error: "Keine Ad-Account-ID" };

  try {
    const params = new URLSearchParams({
      account: adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`,
      preset: PRESET_MAP[preset],
    });
    const res = await fetch(`/api/meta-ads?${params.toString()}`);
    if (!res.ok) {
      const t = await res.text();
      return { campaigns: [], error: `HTTP ${res.status}: ${t.slice(0, 120)}` };
    }
    const data = await res.json();
    if (data?.error) return { campaigns: [], error: String(data.error) };

    const cmps = data?.campaigns || [];
    const insights = data?.insights || [];

    // Merge insights into campaigns by campaign_id
    const insightsByCampaign = new Map<string, any>();
    for (const i of insights) {
      if (i.campaign_id) insightsByCampaign.set(i.campaign_id, i);
    }

    const merged: Campaign[] = cmps.map((c: any) => {
      const ins = insightsByCampaign.get(c.id);
      const actions: { action_type: string; value: string }[] = ins?.actions || [];
      const leadAction = actions.find((a) =>
        ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"].includes(a.action_type),
      );
      const leads = leadAction ? Number(leadAction.value) || 0 : 0;
      const spend = Number(ins?.spend) || 0;
      // Daily budget comes back in cents
      const dailyBudget = Number(c.daily_budget) || 0;
      const lifetimeBudget = Number(c.lifetime_budget) || 0;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        effectiveStatus: c.effective_status || c.status,
        objective: c.objective || "",
        createdTime: c.created_time,
        startTime: c.start_time || null,
        stopTime: c.stop_time || null,
        dailyBudget: dailyBudget / 100,
        lifetimeBudget: lifetimeBudget / 100,
        spend,
        leads,
        ctr: Number(ins?.ctr) || 0,
        cpl: leads > 0 ? spend / leads : 0,
        impressions: Number(ins?.impressions) || 0,
        clicks: Number(ins?.clicks) || 0,
      };
    });

    // Sort: ACTIVE first, then by spend descending
    merged.sort((a, b) => {
      const aActive = a.effectiveStatus === "ACTIVE" ? 0 : 1;
      const bActive = b.effectiveStatus === "ACTIVE" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.spend - a.spend;
    });

    return { campaigns: merged, error: null };
  } catch (err: any) {
    return { campaigns: [], error: err?.message || String(err) };
  }
}

// List available Meta ad accounts for picker UI
export type MetaAccount = { id: string; name: string; account_id: string };
export async function listMetaAccounts(): Promise<MetaAccount[]> {
  try {
    const res = await fetch("/api/meta-ads?list_accounts=true");
    const data = await res.json();
    return (data?.accounts || []).map((a: any) => ({
      id: a.id || `act_${a.account_id}`,
      name: a.name || a.account_id,
      account_id: a.account_id,
    }));
  } catch {
    return [];
  }
}

export function fmtEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

export function fmtNum(n: number, max = 0) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: max }).format(n);
}

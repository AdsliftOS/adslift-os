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

export type Preset = "today" | "yesterday" | "last_7d" | "this_month" | "last_30d";

const PRESET_MAP: Record<Preset, string> = {
  today: "today",
  yesterday: "yesterday",
  last_7d: "last_7d",
  this_month: "this_month",
  last_30d: "last_30d",
};

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

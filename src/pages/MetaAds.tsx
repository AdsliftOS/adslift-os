import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Megaphone,
  Euro,
  Eye,
  MousePointerClick,
  Percent,
  Target,
  TrendingUp,
  Loader2,
  BarChart3,
  Users,
  Repeat,
  Link,
  Play,
  Crosshair,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

/* ── Types ── */
interface MetaAction {
  action_type: string;
  value: string;
}

interface CostPerAction {
  action_type: string;
  value: string;
}

interface CampaignInsight {
  campaign_name: string;
  campaign_id: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  actions?: MetaAction[];
  cost_per_action_type?: CostPerAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

interface TotalsData {
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  actions?: MetaAction[];
  cost_per_action_type?: CostPerAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
}

interface ApiResponse {
  campaigns: Campaign[];
  insights: CampaignInsight[];
  totals: TotalsData | null;
  error?: string;
}

interface DailyData {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  actions?: MetaAction[];
}

interface DailyApiResponse {
  daily: DailyData[];
}

/* ── Helpers ── */
const fmtEur = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(v);

const fmtNum = (v: number) => new Intl.NumberFormat("de-DE").format(v);

const fmtPct = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v) + "%";

const fmtDec = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

function getActionValue(actions: MetaAction[] | undefined, type: string): number {
  if (!actions) return 0;
  const a = actions.find((a) => a.action_type === type);
  return a ? parseInt(a.value, 10) : 0;
}

function getLeads(actions?: MetaAction[]): number {
  return getActionValue(actions, "lead");
}

function getLandingPageViews(actions?: MetaAction[]): number {
  return getActionValue(actions, "landing_page_view");
}

function getLinkClicks(actions?: MetaAction[]): number {
  return getActionValue(actions, "link_click");
}

function getVideoViews(actions?: MetaAction[]): number {
  return getActionValue(actions, "video_view");
}

function get3sVideoViews(actions?: MetaAction[]): number {
  return getActionValue(actions, "video_view");
}

/* ── Presets ── */
const presets = [
  { label: "Heute", value: "today" },
  { label: "Gestern", value: "yesterday" },
  { label: "7 Tage", value: "last_7d" },
  { label: "Diese Woche", value: "this_week_sun_today" },
  { label: "30 Tage", value: "last_30d" },
  { label: "Dieser Monat", value: "this_month" },
  { label: "90 Tage", value: "last_90d" },
  { label: "Dieses Jahr", value: "this_year" },
] as const;

type SortKey =
  | "name"
  | "status"
  | "spend"
  | "impressions"
  | "reach"
  | "frequency"
  | "clicks"
  | "ctr"
  | "cpc"
  | "landingPageViews"
  | "leads"
  | "cpl"
  | "videoViews"
  | "hookRate"
  | "convRate";

/* ── Types for accounts ── */
interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
}

/* ── Component ── */
export default function MetaAds() {
  const [preset, setPreset] = useState("this_month");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roas, setRoas] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("act_1263695578446693");
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Fetch ad accounts
  useEffect(() => {
    fetch("/api/meta-ads?list_accounts=true")
      .then((r) => r.json())
      .then((res) => {
        if (res.accounts) {
          setAccounts(res.accounts);
        }
      })
      .catch(() => {})
      .finally(() => setAccountsLoading(false));
  }, []);

  // Fetch main data
  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/meta-ads?preset=${preset}&account=${selectedAccount}`).then((r) => r.json()),
      fetch(`/api/meta-ads?preset=${preset}&breakdown=daily&account=${selectedAccount}`).then((r) => r.json()),
    ])
      .then(([main, daily]: [ApiResponse, DailyApiResponse]) => {
        if (main.error) {
          setError(main.error);
        } else {
          setData(main);
        }
        setDailyData(daily.daily || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [preset, selectedAccount]);

  // Fetch ROAS from Supabase
  useEffect(() => {
    async function fetchRoas() {
      try {
        const { data: salesData, error: salesErr } = await supabase
          .from("sales_weeks")
          .select("deal_volume, week_start");
        if (salesErr || !salesData) {
          setRoas(null);
          return;
        }
        const totalDealVolume = salesData.reduce(
          (sum: number, r: { deal_volume: number }) => sum + Number(r.deal_volume || 0),
          0
        );
        setRoas(totalDealVolume);
      } catch {
        setRoas(null);
      }
    }
    fetchRoas();
  }, [preset]);

  /* Totals from API */
  const totals = useMemo(() => {
    if (!data?.totals)
      return {
        spend: 0,
        impressions: 0,
        reach: 0,
        frequency: 0,
        clicks: 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        leads: 0,
        cpl: 0,
        landingPageViews: 0,
        costPerLPV: 0,
        linkClicks: 0,
        videoViews: 0,
        hookRate: 0,
        convRate: 0,
      };
    const t = data.totals;
    const spend = parseFloat(t.spend) || 0;
    const impressions = parseInt(t.impressions) || 0;
    const reach = parseInt(t.reach) || 0;
    const frequency = parseFloat(t.frequency) || 0;
    const clicks = parseInt(t.clicks) || 0;
    const ctr = parseFloat(t.ctr) || 0;
    const cpm = parseFloat(t.cpm) || 0;
    const cpc = parseFloat(t.cpc) || 0;
    const leads = getLeads(t.actions);
    const landingPageViews = getLandingPageViews(t.actions);
    const linkClicks = getLinkClicks(t.actions);
    const videoViews = getVideoViews(t.actions);
    const threeSecViews = get3sVideoViews(t.actions);
    const hookRate = impressions > 0 ? (threeSecViews / impressions) * 100 : 0;
    const convRate = linkClicks > 0 ? (leads / linkClicks) * 100 : 0;
    return {
      spend,
      impressions,
      reach,
      frequency,
      clicks,
      ctr,
      cpm,
      cpc,
      leads,
      cpl: leads > 0 ? spend / leads : 0,
      landingPageViews,
      costPerLPV: landingPageViews > 0 ? spend / landingPageViews : 0,
      linkClicks,
      videoViews,
      hookRate,
      convRate,
    };
  }, [data]);

  const roasValue = useMemo(() => {
    if (roas === null || totals.spend === 0) return null;
    return roas / totals.spend;
  }, [roas, totals.spend]);

  /* Merge campaigns + insights */
  const rows = useMemo(() => {
    if (!data) return [];
    const statusMap = new Map(data.campaigns.map((c) => [c.id, c.status]));
    return data.insights.map((ins) => {
      const spend = parseFloat(ins.spend) || 0;
      const impressions = parseInt(ins.impressions) || 0;
      const reach = parseInt(ins.reach) || 0;
      const frequency = parseFloat(ins.frequency) || 0;
      const clicks = parseInt(ins.clicks) || 0;
      const ctr = parseFloat(ins.ctr) || 0;
      const cpc = parseFloat(ins.cpc) || 0;
      const leads = getLeads(ins.actions);
      const landingPageViews = getLandingPageViews(ins.actions);
      const linkClicks = getLinkClicks(ins.actions);
      const videoViews = getVideoViews(ins.actions);
      const threeSecViews = get3sVideoViews(ins.actions);
      const hookRate = impressions > 0 ? (threeSecViews / impressions) * 100 : 0;
      const convRate = linkClicks > 0 ? (leads / linkClicks) * 100 : 0;
      return {
        name: ins.campaign_name,
        status: statusMap.get(ins.campaign_id) || "UNKNOWN",
        spend,
        impressions,
        reach,
        frequency,
        clicks,
        ctr,
        cpc,
        landingPageViews,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
        videoViews,
        hookRate,
        convRate,
      };
    });
  }, [data]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  // Daily chart data
  const chartData = useMemo(() => {
    return dailyData
      .map((d) => ({
        date: d.date_start,
        spend: parseFloat(d.spend) || 0,
        leads: getLeads(d.actions),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyData]);

  const maxSpend = useMemo(
    () => Math.max(...chartData.map((d) => d.spend), 1),
    [chartData]
  );


  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1 inline text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1 inline text-primary" />
    );
  };

  /* KPI color helpers */
  const ctrColor = (v: number) =>
    v >= 2 ? "text-emerald-500" : v >= 1 ? "text-amber-500" : "text-red-500";
  const cplColor = (v: number, spend: number) => {
    if (v === 0) return "text-muted-foreground";
    const ratio = v / (spend || 1);
    return ratio < 0.05 ? "text-emerald-500" : ratio < 0.1 ? "text-amber-500" : "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Ad Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Live-Kampagnendaten &middot; Meta Marketing API
        </p>
      </div>

      {/* Account Selector */}
      {!accountsLoading && accounts.length > 1 && (
        <div className="flex items-center gap-3 rounded-xl border bg-card/80 backdrop-blur-sm p-3 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Ad Account:</span>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Time range selector */}
      <div className="flex items-center justify-center rounded-xl border bg-card/80 backdrop-blur-sm p-2 shadow-sm">
        <ToggleGroup
          type="single"
          value={preset}
          onValueChange={(v) => {
            if (v) setPreset(v);
          }}
          size="sm"
          className="flex flex-wrap gap-1"
        >
          {presets.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value} className="text-xs">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            Daten werden geladen...
          </span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 text-center text-destructive">
            <p className="font-semibold">Fehler</p>
            <p className="text-sm mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs + Charts + Table */}
      {!loading && !error && (
        <>
          {/* ─── Row 1: Big KPI Cards ─── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Gesamtausgaben */}
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent ring-1 ring-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Gesamtausgaben
                  </span>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-500/15 shadow-sm">
                    <Euro className="h-5 w-5 text-red-500" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-red-600 dark:text-red-400">
                  {fmtEur(totals.spend)}
                </div>
              </CardContent>
            </Card>

            {/* Leads */}
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent ring-1 ring-emerald-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Leads
                  </span>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-500/15 shadow-sm">
                    <Target className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {fmtNum(totals.leads)}
                </div>
                {totals.leads > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    CPL: {fmtEur(totals.cpl)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cost per Lead */}
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent ring-1 ring-amber-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cost per Lead
                  </span>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-500/15 shadow-sm">
                    <Crosshair className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
                <div className="text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                  {totals.leads > 0 ? fmtEur(totals.cpl) : "\u2014"}
                </div>
              </CardContent>
            </Card>

            {/* ROAS */}
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent ring-1 ring-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    ROAS
                  </span>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-purple-500/15 shadow-sm">
                    <Zap className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
                <div
                  className={cn(
                    "text-3xl font-black tracking-tight",
                    roasValue !== null && roasValue >= 3
                      ? "text-emerald-600 dark:text-emerald-400"
                      : roasValue !== null && roasValue >= 1
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-purple-600 dark:text-purple-400"
                  )}
                >
                  {roasValue !== null ? `${fmtDec(roasValue)}x` : "\u2014"}
                </div>
                {roasValue !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Deal-Volumen / Ad Spend
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Row 2: Secondary KPIs ─── */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              { label: "Impressions", value: fmtNum(totals.impressions), icon: Eye, color: "blue" },
              { label: "Reach", value: fmtNum(totals.reach), icon: Users, color: "indigo" },
              { label: "Frequency", value: fmtDec(totals.frequency), icon: Repeat, color: "violet" },
              { label: "Clicks", value: fmtNum(totals.clicks), icon: MousePointerClick, color: "amber" },
              {
                label: "CTR",
                value: fmtPct(totals.ctr),
                icon: Percent,
                color: "cyan",
                valueClass: ctrColor(totals.ctr),
              },
              { label: "CPM", value: fmtEur(totals.cpm), icon: TrendingUp, color: "pink" },
              { label: "CPC", value: fmtEur(totals.cpc), icon: MousePointerClick, color: "orange" },
            ].map((kpi) => (
              <Card
                key={kpi.label}
                className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-muted/50 to-transparent ring-1 ring-border/50"
              >
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {kpi.label}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold tracking-tight",
                      kpi.valueClass || "text-foreground"
                    )}
                  >
                    {kpi.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "LP Views", value: fmtNum(totals.landingPageViews), icon: Link },
              {
                label: "Cost / LP View",
                value: totals.landingPageViews > 0 ? fmtEur(totals.costPerLPV) : "\u2014",
                icon: Euro,
              },
              { label: "Link Clicks", value: fmtNum(totals.linkClicks), icon: Link },
              { label: "Video Views", value: fmtNum(totals.videoViews), icon: Play },
              {
                label: "Hook Rate",
                value: fmtPct(totals.hookRate),
                icon: Eye,
                valueClass:
                  totals.hookRate >= 30
                    ? "text-emerald-500"
                    : totals.hookRate >= 15
                    ? "text-amber-500"
                    : "text-red-500",
              },
              {
                label: "Conv. Rate",
                value: totals.linkClicks > 0 ? fmtPct(totals.convRate) : "\u2014",
                icon: Target,
                valueClass:
                  totals.convRate >= 10
                    ? "text-emerald-500"
                    : totals.convRate >= 5
                    ? "text-amber-500"
                    : "text-red-500",
              },
            ].map((kpi) => (
              <Card
                key={kpi.label}
                className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-muted/50 to-transparent ring-1 ring-border/50"
              >
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {kpi.label}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold tracking-tight",
                      kpi.valueClass || "text-foreground"
                    )}
                  >
                    {kpi.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ─── Daily Trend Chart ─── */}
          {chartData.length > 0 && (
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="pb-2 px-6 pt-6">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Tagesverlauf
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {/* Chart area with Y-axis labels */}
                <div className="flex gap-2">
                  {/* Y-axis */}
                  <div className="flex flex-col justify-between h-44 text-[10px] text-muted-foreground pr-1 py-1">
                    <span>{fmtEur(maxSpend)}</span>
                    <span>{fmtEur(maxSpend / 2)}</span>
                    <span>0 €</span>
                  </div>
                  {/* Bars */}
                  <div className="flex-1 flex items-end gap-1.5 h-44 relative border-l border-b border-border/30 pl-1 pb-6">
                    {chartData.map((d, i) => {
                      const barH = maxSpend > 0 ? (d.spend / maxSpend) * 100 : 0;
                      const day = new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
                      const weekday = new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" });
                      return (
                        <div
                          key={d.date}
                          className="flex-1 flex flex-col items-center justify-end relative group cursor-pointer"
                          style={{ height: "100%" }}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-3 hidden group-hover:block z-20 bg-popover border rounded-lg shadow-xl p-3 text-xs whitespace-nowrap pointer-events-none">
                            <p className="font-semibold text-sm mb-1">{weekday}, {day}</p>
                            <div className="flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-sm bg-red-400" />
                              <span>Spend: <span className="font-medium text-red-400">{fmtEur(d.spend)}</span></span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                              <span>Leads: <span className="font-medium text-emerald-400">{d.leads}</span></span>
                            </div>
                          </div>
                          {/* Values above bar */}
                          <div className="flex flex-col items-center mb-1 gap-0.5">
                            <div className="text-[9px] font-medium text-red-400/80">
                              {d.spend >= 1000 ? `${(d.spend/1000).toFixed(1)}k` : d.spend >= 1 ? `${Math.round(d.spend)}€` : ""}
                            </div>
                            {d.leads > 0 && (
                              <div className="text-[9px] font-bold text-emerald-400">
                                {d.leads}L
                              </div>
                            )}
                          </div>
                          {/* Spend bar */}
                          <div
                            className="w-full rounded-t bg-gradient-to-t from-red-500/80 to-red-400/40 transition-all duration-300 hover:from-red-500 hover:to-red-400/70 min-h-[3px]"
                            style={{ height: `${Math.max(barH, 1.5)}%` }}
                          />
                          {/* Date label */}
                          <div className="absolute -bottom-5 text-center w-full">
                            {(chartData.length <= 14 || i % Math.ceil(chartData.length / 8) === 0) && (
                              <span className="text-[9px] text-muted-foreground font-medium">
                                {day}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm bg-gradient-to-t from-red-500/80 to-red-400/40" />
                    Spend
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
                    Leads (Zahl über Balken)
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Campaign Table ─── */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="pb-0 px-6 pt-6">
              <CardTitle className="text-base font-semibold">Kampagnen</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      {(
                        [
                          { key: "name" as SortKey, label: "Kampagne", align: "left" },
                          { key: "status" as SortKey, label: "Status", align: "center" },
                          { key: "spend" as SortKey, label: "Spend", align: "right" },
                          { key: "impressions" as SortKey, label: "Impr.", align: "right" },
                          { key: "reach" as SortKey, label: "Reach", align: "right" },
                          { key: "frequency" as SortKey, label: "Freq.", align: "right" },
                          { key: "clicks" as SortKey, label: "Clicks", align: "right" },
                          { key: "ctr" as SortKey, label: "CTR", align: "right" },
                          { key: "cpc" as SortKey, label: "CPC", align: "right" },
                          { key: "landingPageViews" as SortKey, label: "LP Views", align: "right" },
                          { key: "leads" as SortKey, label: "Leads", align: "right" },
                          { key: "cpl" as SortKey, label: "CPL", align: "right" },
                          { key: "videoViews" as SortKey, label: "Video", align: "right" },
                          { key: "hookRate" as SortKey, label: "Hook %", align: "right" },
                          { key: "convRate" as SortKey, label: "Conv. %", align: "right" },
                        ] as const
                      ).map((col) => (
                        <TableHead
                          key={col.key}
                          className={cn(
                            "text-[10px] uppercase tracking-wider font-semibold cursor-pointer select-none whitespace-nowrap hover:text-primary transition-colors",
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                              ? "text-right"
                              : "text-left pl-6"
                          )}
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                          <SortIcon col={col.key} />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row, idx) => (
                      <TableRow
                        key={row.name + idx}
                        className={cn(
                          "transition-colors duration-150 hover:bg-muted/20",
                          idx % 2 === 1 ? "bg-muted/[0.06]" : ""
                        )}
                      >
                        <TableCell className="pl-6 font-medium max-w-[220px] truncate text-sm">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 shadow-sm",
                              row.status === "ACTIVE"
                                ? "bg-emerald-500 shadow-emerald-500/20 text-white"
                                : row.status === "PAUSED"
                                ? "bg-amber-500 shadow-amber-500/20 text-white"
                                : "bg-gray-500 shadow-gray-500/20 text-white"
                            )}
                          >
                            {row.status === "ACTIVE"
                              ? "Active"
                              : row.status === "PAUSED"
                              ? "Paused"
                              : row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(row.spend)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(row.impressions)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(row.reach)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtDec(row.frequency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(row.clicks)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", ctrColor(row.ctr))}>
                          {fmtPct(row.ctr)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(row.cpc)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(row.landingPageViews)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                          {row.leads}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.leads > 0 ? fmtEur(row.cpl) : "\u2013"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(row.videoViews)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            row.hookRate >= 30
                              ? "text-emerald-500"
                              : row.hookRate >= 15
                              ? "text-amber-500"
                              : "text-red-500"
                          )}
                        >
                          {fmtPct(row.hookRate)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums pr-6",
                            row.convRate >= 10
                              ? "text-emerald-500"
                              : row.convRate >= 5
                              ? "text-amber-500"
                              : "text-red-500"
                          )}
                        >
                          {row.clicks > 0 ? fmtPct(row.convRate) : "\u2013"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                          Keine Kampagnendaten f&uuml;r diesen Zeitraum.
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Totals row */}
                    {sortedRows.length > 0 && (
                      <TableRow className="bg-muted/50 border-t-2 font-semibold hover:bg-muted/50">
                        <TableCell className="pl-6" colSpan={2}>
                          Gesamt
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(totals.spend)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(totals.impressions)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(totals.reach)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtDec(totals.frequency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(totals.clicks)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", ctrColor(totals.ctr))}>
                          {fmtPct(totals.ctr)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtEur(totals.cpc)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(totals.landingPageViews)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {totals.leads}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {totals.leads > 0 ? fmtEur(totals.cpl) : "\u2013"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(totals.videoViews)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            totals.hookRate >= 30
                              ? "text-emerald-500"
                              : totals.hookRate >= 15
                              ? "text-amber-500"
                              : "text-red-500"
                          )}
                        >
                          {fmtPct(totals.hookRate)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums pr-6",
                            totals.convRate >= 10
                              ? "text-emerald-500"
                              : totals.convRate >= 5
                              ? "text-amber-500"
                              : "text-red-500"
                          )}
                        >
                          {totals.linkClicks > 0 ? fmtPct(totals.convRate) : "\u2013"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

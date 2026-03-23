import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface MetaAction {
  action_type: string;
  value: string;
}

interface CampaignInsight {
  campaign_name: string;
  campaign_id: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  actions?: MetaAction[];
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
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  actions?: MetaAction[];
}

interface ApiResponse {
  campaigns: Campaign[];
  insights: CampaignInsight[];
  totals: TotalsData | null;
  error?: string;
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

function getLeads(actions?: MetaAction[]): number {
  if (!actions) return 0;
  const lead = actions.find((a) => a.action_type === "lead");
  return lead ? parseInt(lead.value, 10) : 0;
}

/* ── Presets ── */
const presets = [
  { label: "Heute", value: "today" },
  { label: "Gestern", value: "yesterday" },
  { label: "Diese Woche", value: "this_week_sun_today" },
  { label: "Dieser Monat", value: "this_month" },
  { label: "Dieses Jahr", value: "this_year" },
] as const;

/* ── Component ── */
export default function MetaAds() {
  const [preset, setPreset] = useState("this_month");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/meta-ads?preset=${preset}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [preset]);

  /* Merge campaigns + insights */
  const rows = useMemo(() => {
    if (!data) return [];
    const statusMap = new Map(
      data.campaigns.map((c) => [c.id, c.status])
    );
    return data.insights.map((ins) => ({
      name: ins.campaign_name,
      status: statusMap.get(ins.campaign_id) || "UNKNOWN",
      spend: parseFloat(ins.spend) || 0,
      impressions: parseInt(ins.impressions) || 0,
      clicks: parseInt(ins.clicks) || 0,
      ctr: parseFloat(ins.ctr) || 0,
      leads: getLeads(ins.actions),
      cpl: 0, // computed below
    }));
  }, [data]);

  // compute cpl
  const rowsWithCpl = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        cpl: r.leads > 0 ? r.spend / r.leads : 0,
      })),
    [rows]
  );

  /* Totals from API */
  const totals = useMemo(() => {
    if (!data?.totals)
      return {
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpm: 0,
        leads: 0,
        cpl: 0,
      };
    const t = data.totals;
    const spend = parseFloat(t.spend) || 0;
    const leads = getLeads(t.actions);
    return {
      spend,
      impressions: parseInt(t.impressions) || 0,
      clicks: parseInt(t.clicks) || 0,
      ctr: parseFloat(t.ctr) || 0,
      cpm: parseFloat(t.cpm) || 0,
      leads,
      cpl: leads > 0 ? spend / leads : 0,
    };
  }, [data]);

  /* ── KPI card config ── */
  const kpis = [
    {
      label: "Gesamtausgaben",
      value: fmtEur(totals.spend),
      icon: Euro,
      color: "red",
      gradient:
        "from-red-500/10 via-red-500/5 to-transparent ring-red-500/15",
      textColor: "text-red-600 dark:text-red-400",
      iconBg: "bg-red-500/15",
      iconColor: "text-red-500",
      dotColor: "bg-red-500 shadow-red-500/50",
    },
    {
      label: "Impressions",
      value: fmtNum(totals.impressions),
      icon: Eye,
      color: "blue",
      gradient:
        "from-blue-500/10 via-blue-500/5 to-transparent ring-blue-500/15",
      textColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      dotColor: "bg-blue-500 shadow-blue-500/50",
    },
    {
      label: "Clicks",
      value: fmtNum(totals.clicks),
      icon: MousePointerClick,
      color: "amber",
      gradient:
        "from-amber-500/10 via-amber-500/5 to-transparent ring-amber-500/15",
      textColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500",
      dotColor: "bg-amber-500 shadow-amber-500/50",
    },
    {
      label: "CTR",
      value: fmtPct(totals.ctr),
      icon: Percent,
      color: "cyan",
      gradient:
        "from-cyan-500/10 via-cyan-500/5 to-transparent ring-cyan-500/15",
      textColor: "text-cyan-600 dark:text-cyan-400",
      iconBg: "bg-cyan-500/15",
      iconColor: "text-cyan-500",
      dotColor: "bg-cyan-500 shadow-cyan-500/50",
    },
    {
      label: "CPM",
      value: fmtEur(totals.cpm),
      icon: TrendingUp,
      color: "purple",
      gradient:
        "from-purple-500/10 via-purple-500/5 to-transparent ring-purple-500/15",
      textColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-500",
      dotColor: "bg-purple-500 shadow-purple-500/50",
    },
    {
      label: "Leads",
      value: fmtNum(totals.leads),
      icon: Target,
      color: "emerald",
      gradient:
        "from-emerald-500/10 via-emerald-500/5 to-transparent ring-emerald-500/15",
      textColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      dotColor: "bg-emerald-500 shadow-emerald-500/50",
      sub:
        totals.leads > 0
          ? `CPL: ${fmtEur(totals.cpl)}`
          : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Meta Ads
        </h1>
        <p className="text-sm text-muted-foreground">
          Live-Kampagnendaten aus dem Meta Marketing API.
        </p>
      </div>

      {/* Time range selector */}
      <div className="flex items-center justify-center rounded-xl border bg-card/80 backdrop-blur-sm p-2 shadow-sm">
        <ToggleGroup
          type="single"
          value={preset}
          onValueChange={(v) => {
            if (v) setPreset(v);
          }}
          size="sm"
        >
          {presets.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value}>
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

      {/* KPIs + Table */}
      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <Card
                key={kpi.label}
                className={cn(
                  "overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br ring-1",
                  kpi.gradient
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {kpi.label}
                  </CardTitle>
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shadow-sm",
                      kpi.iconBg
                    )}
                  >
                    <kpi.icon className={cn("h-4 w-4", kpi.iconColor)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      "text-2xl font-black tracking-tight",
                      kpi.textColor
                    )}
                  >
                    {kpi.value}
                  </div>
                  {kpi.sub && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full shadow-sm",
                          kpi.dotColor
                        )}
                      />
                      {kpi.sub}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Campaign Table */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="pb-0 px-6 pt-6">
              <CardTitle className="text-base font-semibold">
                Kampagnen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold pl-6">
                      Kampagne
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">
                      Ausgaben
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">
                      Impressions
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">
                      Clicks
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">
                      CTR
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">
                      Leads
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right pr-6">
                      CPL
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsWithCpl.map((row, idx) => (
                    <TableRow
                      key={row.name + idx}
                      className={cn(
                        "transition-colors duration-150 hover:bg-muted/20",
                        idx % 2 === 1 ? "bg-muted/[0.06]" : ""
                      )}
                    >
                      <TableCell className="pl-6 font-medium max-w-[260px] truncate">
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
                      <TableCell className="text-right tabular-nums">
                        {fmtEur(row.spend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(row.impressions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(row.clicks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPct(row.ctr)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.leads}
                      </TableCell>
                      <TableCell className="text-right tabular-nums pr-6">
                        {row.leads > 0 ? fmtEur(row.cpl) : "\u2013"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rowsWithCpl.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-10 text-muted-foreground"
                      >
                        Keine Kampagnendaten f\u00FCr diesen Zeitraum.
                      </TableCell>
                    </TableRow>
                  )}
                  {/* Totals row */}
                  {rowsWithCpl.length > 0 && (
                    <TableRow className="bg-muted/50 border-t-2 font-semibold hover:bg-muted/50">
                      <TableCell className="pl-6" colSpan={2}>
                        Gesamt
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtEur(totals.spend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(totals.impressions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(totals.clicks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPct(totals.ctr)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {totals.leads}
                      </TableCell>
                      <TableCell className="text-right tabular-nums pr-6">
                        {totals.leads > 0 ? fmtEur(totals.cpl) : "\u2013"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
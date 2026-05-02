import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CheckCircle2, RefreshCw, Link2, AlertTriangle, EyeOff, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import {
  useRevolutTransactions,
  useRevolutConnection,
  syncRevolut,
  getRevolutAuthUrl,
  updateRevolutTx,
  loadRevolut,
} from "@/store/revolut";

const fmt = (n: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(n);

const fmtDate = (iso: string | null) => {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateTime = (iso: string | null) => {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export function RevolutCard({ categories }: { categories: string[] }) {
  const txs = useRevolutTransactions();
  const conn = useRevolutConnection();
  const [syncing, setSyncing] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [search, setSearch] = useState("");

  // React to OAuth callback URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("revolut");
    if (status === "connected") {
      toast.success("Revolut verbunden — synchronisiere Transaktionen…");
      params.delete("revolut");
      window.history.replaceState({}, "", window.location.pathname);
      void runSync();
    } else if (status === "error") {
      toast.error(`Revolut: ${params.get("reason") ?? "Fehler"}`);
      params.delete("revolut"); params.delete("reason");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSync = async () => {
    setSyncing(true);
    const r = await syncRevolut();
    setSyncing(false);
    if (r.ok) toast.success(`Sync OK — ${r.outgoing ?? 0} Ausgaben aktualisiert`);
    else toast.error(`Sync fehlgeschlagen: ${r.error}`);
  };

  const handleConnect = async () => {
    const url = await getRevolutAuthUrl();
    if (!url) { toast.error("Auth-URL konnte nicht geladen werden"); return; }
    window.location.href = url;
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return txs.filter((t) => {
      if (!showIgnored && t.ignored) return false;
      if (!s) return true;
      return (
        (t.merchantName ?? "").toLowerCase().includes(s) ||
        (t.description ?? "").toLowerCase().includes(s) ||
        (t.counterpartyName ?? "").toLowerCase().includes(s) ||
        (t.reference ?? "").toLowerCase().includes(s)
      );
    });
  }, [txs, search, showIgnored]);

  const totalAbs = useMemo(
    () => filtered.filter((t) => !t.ignored).reduce((sum, t) => sum + Math.abs(Number(t.amountEur ?? t.amount)), 0),
    [filtered],
  );

  const isConnected = !!conn?.hasToken;

  if (!isConnected) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Link2 className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Revolut Business verbinden</p>
            <p className="text-sm text-muted-foreground">
              Importiert automatisch alle Ausgaben (Kartenzahlungen, Überweisungen, Gebühren). Eingänge werden ignoriert.
            </p>
          </div>
          <Button onClick={handleConnect} className="gap-2">
            <Link2 className="h-4 w-4" />Verbinden
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Link2 className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base">Revolut Business</CardTitle>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="gap-1 text-[10px] py-0 h-5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />Verbunden
              </Badge>
              <span className="text-xs text-muted-foreground">
                Letzter Sync: {fmtDateTime(conn?.lastSyncedAt ?? null)}
              </span>
              {conn?.lastSyncError && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />{conn.lastSyncError.slice(0, 60)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadRevolut()} className="gap-1.5">
            Neu laden
          </Button>
          <Button onClick={runSync} disabled={syncing} size="sm" className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Synchronisieren
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen…"
              className="pl-9 w-[220px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={showIgnored ? "default" : "outline"}
            size="sm"
            onClick={() => setShowIgnored((v) => !v)}
            className="gap-1.5"
          >
            {showIgnored ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showIgnored ? "Inkl. ignoriert" : "Ignorierte aus"}
          </Button>
          <div className="ml-auto text-sm">
            <span className="text-muted-foreground">Summe sichtbar: </span>
            <span className="font-semibold tabular-nums">{fmt(totalAbs)}</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Noch keine Transaktionen. Klick auf „Synchronisieren".
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Datum</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="w-32">Typ</TableHead>
                  <TableHead className="w-44">Kategorie</TableHead>
                  <TableHead className="w-28 text-right">Betrag</TableHead>
                  <TableHead className="w-20 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const display = Number(t.amountEur ?? t.amount);
                  const cur = t.amountEur != null ? "EUR" : t.currency;
                  const name = t.merchantName ?? t.counterpartyName ?? t.description ?? "—";
                  return (
                    <TableRow key={t.id} className={t.ignored ? "opacity-50" : ""}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {fmtDate(t.txCompletedAt ?? t.txCreatedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{name}</div>
                        {(t.reference || t.description) && t.merchantName !== t.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-md">
                            {t.reference ?? t.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {(t.type ?? "").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.category ?? ""}
                          onValueChange={(v) => updateRevolutTx(t.id, { category: v || null })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-orange-600 dark:text-orange-400">
                        {fmt(Math.abs(display), cur)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => updateRevolutTx(t.id, { ignored: !t.ignored })}
                        >
                          {t.ignored ? "Aktivieren" : "Ignorieren"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

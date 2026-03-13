import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, CalendarCheck, Users, DollarSign, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

type SalesEntry = {
  id: string;
  month: string;
  scheduled: number;
  held: number;
  closed: number;
  dealVolume: number;
};

const months = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const initialEntries: SalesEntry[] = [
  { id: "1", month: "Januar", scheduled: 24, held: 18, closed: 6, dealVolume: 42000 },
  { id: "2", month: "Februar", scheduled: 30, held: 22, closed: 8, dealVolume: 56000 },
  { id: "3", month: "März", scheduled: 28, held: 25, closed: 10, dealVolume: 71500 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function calcShowUpRate(scheduled: number, held: number) {
  if (scheduled === 0) return 0;
  return Math.round((held / scheduled) * 100);
}

function calcCloseRate(held: number, closed: number) {
  if (held === 0) return 0;
  return Math.round((closed / held) * 100);
}

export default function Sales() {
  const [entries, setEntries] = useState<SalesEntry[]>(initialEntries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ month: "", scheduled: "", held: "", closed: "", dealVolume: "" });

  const totals = entries.reduce(
    (acc, e) => ({
      scheduled: acc.scheduled + e.scheduled,
      held: acc.held + e.held,
      closed: acc.closed + e.closed,
      dealVolume: acc.dealVolume + e.dealVolume,
    }),
    { scheduled: 0, held: 0, closed: 0, dealVolume: 0 }
  );

  const overallShowUp = calcShowUpRate(totals.scheduled, totals.held);
  const overallCloseRate = calcCloseRate(totals.held, totals.closed);

  const handleAdd = () => {
    if (!form.month || !form.scheduled || !form.held || !form.closed || !form.dealVolume) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    const entry: SalesEntry = {
      id: Date.now().toString(),
      month: form.month,
      scheduled: parseInt(form.scheduled),
      held: parseInt(form.held),
      closed: parseInt(form.closed),
      dealVolume: parseFloat(form.dealVolume),
    };
    setEntries([...entries, entry]);
    setForm({ month: "", scheduled: "", held: "", closed: "", dealVolume: "" });
    setDialogOpen(false);
    toast.success("Eintrag hinzugefügt");
  };

  const handleDelete = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
    toast.success("Eintrag gelöscht");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Tracker</h1>
          <p className="text-sm text-muted-foreground">Meetings, Show-up Rate & Dealvolumen im Überblick.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Eintrag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuer Sales-Eintrag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Monat</Label>
                <Select value={form.month} onValueChange={(v) => setForm({ ...form, month: v })}>
                  <SelectTrigger><SelectValue placeholder="Monat wählen" /></SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Terminiert</Label>
                  <Input type="number" min="0" placeholder="z.B. 25" value={form.scheduled} onChange={(e) => setForm({ ...form, scheduled: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Stattgefunden</Label>
                  <Input type="number" min="0" placeholder="z.B. 20" value={form.held} onChange={(e) => setForm({ ...form, held: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Abgeschlossen</Label>
                  <Input type="number" min="0" placeholder="z.B. 8" value={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Dealvolumen (€)</Label>
                  <Input type="number" min="0" step="100" placeholder="z.B. 50000" value={form.dealVolume} onChange={(e) => setForm({ ...form, dealVolume: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAdd}>Hinzufügen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Terminiert</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.scheduled}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stattgefunden</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.held}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Show-up Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallShowUp}%</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallShowUp}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Close Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallCloseRate}%</div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${overallCloseRate}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dealvolumen</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.dealVolume)}</div></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatsübersicht</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monat</TableHead>
                <TableHead className="text-center">Terminiert</TableHead>
                <TableHead className="text-center">Stattgefunden</TableHead>
                <TableHead className="text-center">Show-up Rate</TableHead>
                <TableHead className="text-center">Abgeschlossen</TableHead>
                <TableHead className="text-center">Close Rate</TableHead>
                <TableHead className="text-right">Dealvolumen</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const showUp = calcShowUpRate(e.scheduled, e.held);
                const closeRate = calcCloseRate(e.held, e.closed);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.month}</TableCell>
                    <TableCell className="text-center">{e.scheduled}</TableCell>
                    <TableCell className="text-center">{e.held}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={showUp >= 80 ? "default" : showUp >= 60 ? "secondary" : "destructive"}>
                        {showUp}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{e.closed}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={closeRate >= 30 ? "default" : closeRate >= 20 ? "secondary" : "destructive"}>
                        {closeRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(e.dealVolume)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

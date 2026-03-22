import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Plus, Receipt, Filter, Search, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useClients } from "@/store/clients";
import { useDeals } from "@/store/deals";
import { useExpenses } from "@/store/expenses";
import type { Deal } from "@/store/deals";
import type { Expense, ExpenseStatus, MonthlyExpense } from "@/store/expenses";

type PaymentStatus = "paid" | "planned" | "overdue" | "open";

type MonthlyPayment = {
  amount: number;
  status: PaymentStatus;
};

type ServiceType = "done4you" | "donewithyou";

type Deal = {
  id: string;
  startDate: string;
  client: string;
  serviceType: ServiceType;
  netAmount: number;
  taxRate: number;
  paymentMethod: string;
  monthlyPayments: Record<string, MonthlyPayment>; // key: "2026-01" etc.
};

type ExpenseStatus = "bezahlt" | "geplant" | "offen";

type MonthlyExpense = {
  amount: number;
  status: ExpenseStatus;
};

type Expense = {
  id: string;
  name: string;
  category: string;
  description: string;
  monthlyExpenses: Record<string, MonthlyExpense>;
};

const serviceTypes: { value: ServiceType; label: string; description: string }[] = [
  { value: "done4you", label: "Done 4 You", description: "Wir machen alles — Kunde lehnt sich zurück." },
  { value: "donewithyou", label: "Done With You", description: "Zusammenarbeit — Kunde liefert mit zu." },
];

const monthLabels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function getYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${(i + 1).toString().padStart(2, "0")}`,
    label: monthLabels[i],
  }));
}

const currentYear = new Date().getFullYear();
const months = getYearMonths(currentYear);

const expenseCategories = [
  "Team/Gehälter",
  "Software & Tools",
  "Ads/Marketing",
  "Büro & Miete",
  "Freelancer",
  "Steuern & Abgaben",
  "Sonstiges",
];

const initialExpenses: Expense[] = [];

const initialDeals: Deal[] = [];

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const statusConfig: Record<PaymentStatus, { label: string; color: string; variant: string }> = {
  paid: { label: "Bezahlt", color: "bg-emerald-500", variant: "default" },
  planned: { label: "Geplant", color: "bg-blue-500", variant: "secondary" },
  overdue: { label: "Überfällig", color: "bg-red-500", variant: "destructive" },
  open: { label: "Offen", color: "bg-gray-400", variant: "outline" },
};

const expenseStatusConfig: Record<ExpenseStatus, { label: string; color: string }> = {
  bezahlt: { label: "Bezahlt", color: "bg-orange-500" },
  geplant: { label: "Geplant", color: "bg-amber-400" },
  offen: { label: "Offen", color: "bg-red-500" },
};

export default function Finances() {
  const [clientsList] = useClients();
  const clientNames = useMemo(() => clientsList.map((c) => c.name), [clientsList]);
  const [deals, setDeals] = useDeals();
  const [expenses] = useExpenses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [filterServiceType, setFilterProduct] = useState("all");
  const [monthOffset, setMonthOffset] = useState(0);
  const [expenseMonthOffset, setExpenseMonthOffset] = useState(0);
  const [filterExpenseName, setFilterExpenseName] = useState("");
  const [filterExpenseCategory, setFilterExpenseCategory] = useState("all");

  const [form, setForm] = useState({
    client: "",
    serviceType: "done4you" as ServiceType,
    netAmount: "",
    taxRate: "19",
    paymentMethod: "Überweisung",
    monthlyDistribution: {} as Record<string, string>, // month key -> amount string
  });

  // Visible months (6 at a time)
  const allMonths = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = i + monthOffset;
      const year = 2026 + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      result.push({
        key: `${year}-${(month + 1).toString().padStart(2, "0")}`,
        label: `${monthNames[month]} ${year}`,
      });
    }
    return result;
  }, [monthOffset]);

  const visibleMonths = allMonths;

  // Expense visible months
  const expenseAllMonths = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = i + expenseMonthOffset;
      const year = 2026 + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      result.push({
        key: `${year}-${(month + 1).toString().padStart(2, "0")}`,
        label: `${monthNames[month]} ${year}`,
      });
    }
    return result;
  }, [expenseMonthOffset]);

  const expenseVisibleMonths = expenseAllMonths.slice(0, 6);

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (filterClient && !d.client.toLowerCase().includes(filterClient.toLowerCase())) return false;
      if (filterServiceType !== "all" && d.serviceType !== filterServiceType) return false;
      return true;
    });
  }, [deals, filterClient, filterServiceType]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterExpenseName && !e.name.toLowerCase().includes(filterExpenseName.toLowerCase())) return false;
      if (filterExpenseCategory !== "all" && e.category !== filterExpenseCategory) return false;
      return true;
    });
  }, [expenses, filterExpenseName, filterExpenseCategory]);

  // KPIs
  const totalNetto = useMemo(() => deals.reduce((s, d) => s + d.netAmount, 0), [deals]);
  const totalBrutto = useMemo(() => deals.reduce((s, d) => s + d.netAmount * (1 + d.taxRate / 100), 0), [deals]);

  const monthlyStats = useMemo(() => {
    return visibleMonths.map((m) => {
      let invoiced = 0;
      let paid = 0;
      let planned = 0;
      let overdue = 0;
      deals.forEach((d) => {
        const p = d.monthlyPayments[m.key];
        if (!p) return;
        invoiced += p.amount;
        if (p.status === "paid") paid += p.amount;
        else if (p.status === "planned") planned += p.amount;
        else if (p.status === "overdue") overdue += p.amount;
      });
      return { ...m, invoiced, paid, planned, overdue };
    });
  }, [deals, visibleMonths]);

  const totalPaid = useMemo(() => {
    let sum = 0;
    deals.forEach((d) => Object.values(d.monthlyPayments).forEach((p) => { if (p.status === "paid") sum += p.amount; }));
    return sum;
  }, [deals]);

  const totalPlanned = useMemo(() => {
    let sum = 0;
    deals.forEach((d) => Object.values(d.monthlyPayments).forEach((p) => { if (p.status === "planned") sum += p.amount; }));
    return sum;
  }, [deals]);

  const totalOverdue = useMemo(() => {
    let sum = 0;
    deals.forEach((d) => Object.values(d.monthlyPayments).forEach((p) => { if (p.status === "overdue") sum += p.amount; }));
    return sum;
  }, [deals]);

  // Expense KPIs
  const totalExpenses = useMemo(() => {
    let sum = 0;
    expenses.forEach((e) => Object.values(e.monthlyExpenses).forEach((m) => { sum += m.amount; }));
    return sum;
  }, [expenses]);

  const totalExpensesPaid = useMemo(() => {
    let sum = 0;
    expenses.forEach((e) => Object.values(e.monthlyExpenses).forEach((m) => { if (m.status === "bezahlt") sum += m.amount; }));
    return sum;
  }, [expenses]);

  const totalExpensesPlanned = useMemo(() => {
    let sum = 0;
    expenses.forEach((e) => Object.values(e.monthlyExpenses).forEach((m) => { if (m.status === "geplant") sum += m.amount; }));
    return sum;
  }, [expenses]);

  const totalExpensesOpen = useMemo(() => {
    let sum = 0;
    expenses.forEach((e) => Object.values(e.monthlyExpenses).forEach((m) => { if (m.status === "offen") sum += m.amount; }));
    return sum;
  }, [expenses]);

  const avgMonthlyExpense = useMemo(() => {
    const monthTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      Object.entries(e.monthlyExpenses).forEach(([key, m]) => {
        monthTotals[key] = (monthTotals[key] || 0) + m.amount;
      });
    });
    const vals = Object.values(monthTotals);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [expenses]);

  const largestCategory = useMemo(() => {
    const catTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      Object.values(e.monthlyExpenses).forEach((m) => {
        catTotals[e.category] = (catTotals[e.category] || 0) + m.amount;
      });
    });
    let max = 0;
    let maxCat = "";
    Object.entries(catTotals).forEach(([cat, total]) => {
      if (total > max) { max = total; maxCat = cat; }
    });
    return { category: maxCat, amount: max };
  }, [expenses]);

  const totalCashIn = useMemo(() => {
    let sum = 0;
    deals.forEach((d) => Object.values(d.monthlyPayments).forEach((p) => { sum += p.amount; }));
    return sum;
  }, [deals]);

  const profit = totalCashIn - totalExpenses;

  const expenseMonthlyStats = useMemo(() => {
    return expenseVisibleMonths.map((m) => {
      let total = 0;
      let bezahlt = 0;
      let geplant = 0;
      let offen = 0;
      expenses.forEach((e) => {
        const p = e.monthlyExpenses[m.key];
        if (!p) return;
        total += p.amount;
        if (p.status === "bezahlt") bezahlt += p.amount;
        else if (p.status === "geplant") geplant += p.amount;
        else if (p.status === "offen") offen += p.amount;
      });
      return { ...m, total, bezahlt, geplant, offen };
    });
  }, [expenses, expenseVisibleMonths]);

  const maxExpenseMonth = Math.max(...expenseMonthlyStats.map((m) => m.total), 1);

  // Generate month options for distribution
  const distributionMonths = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      result.push({
        key: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return result;
  }, []);

  const distributedTotal = useMemo(() => {
    return Object.values(form.monthlyDistribution).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [form.monthlyDistribution]);

  const handleAddDeal = () => {
    if (!form.client || !form.netAmount) {
      toast.error("Bitte Kunde und Betrag ausfüllen");
      return;
    }
    const netAmount = parseFloat(form.netAmount);
    if (distributedTotal > netAmount) {
      toast.error("Verteilte Beträge übersteigen das Dealvolumen");
      return;
    }

    const monthlyPayments: Record<string, MonthlyPayment> = {};
    Object.entries(form.monthlyDistribution).forEach(([key, val]) => {
      const amount = parseFloat(val);
      if (amount > 0) {
        monthlyPayments[key] = { amount, status: "planned" };
      }
    });

    const newDeal: Deal = {
      id: Date.now().toString(),
      startDate: new Date().toLocaleDateString("de-DE"),
      client: form.client,
      serviceType: form.serviceType,
      netAmount,
      taxRate: parseFloat(form.taxRate),
      paymentMethod: form.paymentMethod,
      monthlyPayments,
    };
    setDeals((prev) => [...prev, newDeal]);
    setForm({ client: "", serviceType: "done4you", netAmount: "", taxRate: "19", paymentMethod: "Überweisung", monthlyDistribution: {} });
    setDialogOpen(false);
    toast.success("Deal hinzugefügt");
  };

  const cycleStatus = (dealId: string, monthKey: string) => {
    const order: PaymentStatus[] = ["planned", "paid", "overdue", "open"];
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const current = d.monthlyPayments[monthKey];
        if (!current) return d;
        const idx = order.indexOf(current.status);
        const next = order[(idx + 1) % order.length];
        return {
          ...d,
          monthlyPayments: { ...d.monthlyPayments, [monthKey]: { ...current, status: next } },
        };
      })
    );
  };

  // Cashflow bar chart data
  const maxMonthInvoiced = Math.max(...monthlyStats.map((m) => m.invoiced), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanzen</h1>
          <p className="text-sm text-muted-foreground">Einnahmen, Ausgaben und Cashflow im Überblick.</p>
        </div>
      </div>

      <Tabs defaultValue="cashin" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="cashin" className="gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Cash-In
          </TabsTrigger>
          <TabsTrigger value="cashout" className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Cash-Out
          </TabsTrigger>
        </TabsList>

        {/* ==================== CASH-IN TAB ==================== */}
        <TabsContent value="cashin" className="space-y-6">
          {/* Add Deal button */}
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />Neuer Deal
              </Button>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Neuen Deal anlegen</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  {/* Kunde */}
                  <div className="grid gap-2">
                    <Label>Kunde</Label>
                    <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                      <SelectTrigger><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
                      <SelectContent>
                        {clientNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Service Type */}
                  <div className="grid gap-2">
                    <Label>Service-Typ</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {serviceTypes.map((st) => (
                        <button
                          key={st.value}
                          onClick={() => setForm({ ...form, serviceType: st.value })}
                          className={`text-left rounded-lg border p-3 transition-all ${
                            form.serviceType === st.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <div className="text-sm font-semibold">{st.label}</div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{st.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dealvolumen + Steuer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Dealvolumen Netto (€)</Label>
                      <Input type="number" placeholder="5000" value={form.netAmount} onChange={(e) => setForm({ ...form, netAmount: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>MwSt. (%)</Label>
                      <Input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
                    </div>
                  </div>

                  {form.netAmount && (
                    <div className="text-sm text-muted-foreground">
                      Brutto: <span className="font-semibold text-foreground">{fmt(parseFloat(form.netAmount || "0") * (1 + parseFloat(form.taxRate || "0") / 100))}</span>
                    </div>
                  )}

                  {/* Zahlart */}
                  <div className="grid gap-2">
                    <Label>Zahlart</Label>
                    <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Überweisung">Überweisung</SelectItem>
                        <SelectItem value="PayPal">PayPal</SelectItem>
                        <SelectItem value="Stripe">Stripe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Monthly Distribution */}
                  {form.netAmount && parseFloat(form.netAmount) > 0 && (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Monatliche Verteilung</Label>
                        <span className={`text-xs tabular-nums ${
                          distributedTotal > parseFloat(form.netAmount) ? "text-red-500 font-bold" :
                          distributedTotal === parseFloat(form.netAmount || "0") ? "text-emerald-500 font-semibold" :
                          "text-muted-foreground"
                        }`}>
                          {fmt(distributedTotal)} / {fmt(parseFloat(form.netAmount))}
                          {distributedTotal === parseFloat(form.netAmount || "0") && " ✓"}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            distributedTotal > parseFloat(form.netAmount) ? "bg-red-500" :
                            distributedTotal === parseFloat(form.netAmount || "0") ? "bg-emerald-500" :
                            "bg-primary"
                          }`}
                          style={{ width: `${Math.min(100, (distributedTotal / parseFloat(form.netAmount || "1")) * 100)}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {distributionMonths.map((m) => {
                          const val = form.monthlyDistribution[m.key] || "";
                          const hasValue = parseFloat(val) > 0;
                          return (
                            <div key={m.key} className={`rounded-lg border p-2 transition-all ${hasValue ? "border-primary/30 bg-primary/5" : ""}`}>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.label}</div>
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-7 text-xs"
                                value={val}
                                onChange={(e) => setForm({
                                  ...form,
                                  monthlyDistribution: { ...form.monthlyDistribution, [m.key]: e.target.value },
                                })}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={handleAddDeal}>Deal anlegen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Hero KPIs - 2 big + 2 small */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Netto */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dealvolumen Netto</p>
                    <p className="text-3xl font-bold tracking-tight">{fmt(totalNetto)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Brutto</p>
                    <p className="text-sm font-semibold">{fmt(totalBrutto)}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Deals</p>
                    <p className="text-sm font-semibold">{deals.length}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ø Deal</p>
                    <p className="text-sm font-semibold">{fmt(deals.length > 0 ? totalNetto / deals.length : 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bezahlt vs. Offen */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bezahlt</p>
                    <p className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{fmt(totalPaid)}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {/* Stacked progress */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    <div className="bg-emerald-500 rounded-l-full transition-all" style={{ width: `${totalNetto > 0 ? (totalPaid / totalNetto) * 100 : 0}%` }} />
                    <div className="bg-blue-400 transition-all" style={{ width: `${totalNetto > 0 ? (totalPlanned / totalNetto) * 100 : 0}%` }} />
                    {totalOverdue > 0 && <div className="bg-red-500 rounded-r-full transition-all" style={{ width: `${(totalOverdue / totalNetto) * 100}%` }} />}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">Bezahlt</span>
                      <span className="font-semibold">{totalNetto > 0 ? Math.round((totalPaid / totalNetto) * 100) : 0}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                      <span className="text-muted-foreground">Geplant</span>
                      <span className="font-semibold">{fmt(totalPlanned)}</span>
                    </div>
                    {totalOverdue > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-red-500 font-semibold">{fmt(totalOverdue)} überfällig</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Cashflow Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Monatlicher Cashflow</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonthOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-3">
                {monthlyStats.map((m) => {
                  const currentMonth = new Date().toISOString().slice(0, 7);
                  const isCurrent = m.key === currentMonth;
                  const barH = m.invoiced > 0 ? Math.max(20, (m.invoiced / maxMonthInvoiced) * 120) : 4;
                  const paidPct = m.invoiced > 0 ? (m.paid / m.invoiced) * 100 : 0;
                  const plannedPct = m.invoiced > 0 ? (m.planned / m.invoiced) * 100 : 0;

                  return (
                    <div key={m.key} className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${isCurrent ? "border-primary/50 bg-primary/[0.03] shadow-sm ring-1 ring-primary/20" : "hover:border-border"}`}>
                      <div className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                        {m.label}
                      </div>

                      {/* Bar */}
                      <div className="flex justify-center mb-3">
                        <div className="w-10 rounded-md overflow-hidden flex flex-col-reverse bg-muted/50" style={{ height: 120 }}>
                          {m.invoiced > 0 ? (
                            <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: barH }}>
                              {m.paid > 0 && <div className="bg-emerald-500" style={{ height: `${paidPct}%` }} />}
                              {m.planned > 0 && <div className="bg-blue-400/80" style={{ height: `${plannedPct}%` }} />}
                              {m.overdue > 0 && <div className="bg-red-500" style={{ height: `${100 - paidPct - plannedPct}%` }} />}
                            </div>
                          ) : (
                            <div className="bg-muted/30 h-1 w-full rounded" />
                          )}
                        </div>
                      </div>

                      <div className={`text-sm font-bold tabular-nums ${m.invoiced === 0 ? "text-muted-foreground/40" : ""}`}>
                        {m.invoiced > 0 ? fmt(m.invoiced) : "–"}
                      </div>

                      {m.invoiced > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {m.paid > 0 && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{fmt(m.paid)} bezahlt</div>
                          )}
                          {m.planned > 0 && (
                            <div className="text-[10px] text-blue-500 font-medium tabular-nums">{fmt(m.planned)} geplant</div>
                          )}
                          {m.overdue > 0 && (
                            <div className="text-[10px] text-red-500 font-medium tabular-nums">{fmt(m.overdue)} offen</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded bg-emerald-500" />Bezahlt
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded bg-blue-400" />Geplant
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded bg-red-500" />Überfällig
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kunde suchen..."
                className="pl-9 w-[200px]"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              />
            </div>
            <Select value={filterServiceType} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="done4you">Done 4 You</SelectItem>
                <SelectItem value="donewithyou">Done With You</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-muted-foreground">
              {filteredDeals.length} von {deals.length} Deals
            </div>
          </div>

          {/* Deal Table */}
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="sticky left-0 bg-muted/30 z-10 min-w-[65px] text-[10px] uppercase tracking-wider">Datum</TableHead>
                    <TableHead className="sticky left-[65px] bg-muted/30 z-10 min-w-[100px] text-[10px] uppercase tracking-wider">Kunde</TableHead>
                    <TableHead className="min-w-[55px] text-[10px] uppercase tracking-wider">Typ</TableHead>
                    <TableHead className="text-right min-w-[70px] text-[10px] uppercase tracking-wider">Netto</TableHead>
                    {visibleMonths.map((m) => {
                      const currentMonth = new Date().toISOString().slice(0, 7);
                      const isCurrent = m.key === currentMonth;
                      return (
                        <TableHead key={m.key} className={`text-center min-w-[68px] text-[10px] uppercase tracking-wider ${isCurrent ? "bg-primary/5" : ""}`}>
                          {m.label}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((deal, idx) => {
                    const brutto = deal.netAmount * (1 + deal.taxRate / 100);
                    return (
                      <TableRow key={deal.id} className={idx % 2 === 0 ? "" : "bg-muted/[0.03]"}>
                        <TableCell className="sticky left-0 bg-card z-10 text-[10px] tabular-nums text-muted-foreground p-1.5">{deal.startDate}</TableCell>
                        <TableCell className="sticky left-[65px] bg-card z-10 font-medium text-xs p-1.5 truncate max-w-[100px]">{deal.client}</TableCell>
                        <TableCell className="p-1.5">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
                            deal.serviceType === "done4you" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}>
                            {deal.serviceType === "done4you" ? "D4Y" : "DWY"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums p-1.5">{fmt(deal.netAmount)}</TableCell>
                        {visibleMonths.map((m) => {
                          const payment = deal.monthlyPayments[m.key];
                          const currentMonth = new Date().toISOString().slice(0, 7);
                          const isCurrent = m.key === currentMonth;
                          if (!payment) return <TableCell key={m.key} className={`text-center ${isCurrent ? "bg-primary/[0.02]" : ""}`}><span className="text-muted-foreground/20">–</span></TableCell>;
                          return (
                            <TableCell key={m.key} className={`text-center p-1 ${isCurrent ? "bg-primary/[0.02]" : ""}`}>
                              <button
                                onClick={() => cycleStatus(deal.id, m.key)}
                                className={`w-full flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-all border ${
                                  payment.status === "paid"
                                    ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : payment.status === "overdue"
                                    ? "bg-red-500/10 border-red-500/20 hover:bg-red-500/20"
                                    : payment.status === "open"
                                    ? "bg-muted/50 border-border hover:bg-muted"
                                    : "bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10"
                                }`}
                              >
                                <span className={`text-xs font-bold tabular-nums ${
                                  payment.status === "paid" ? "text-emerald-600 dark:text-emerald-400" :
                                  payment.status === "overdue" ? "text-red-500" :
                                  payment.status === "open" ? "text-muted-foreground" :
                                  "text-foreground"
                                }`}>
                                  {fmt(payment.amount)}
                                </span>
                                <span className={`text-[9px] font-medium ${
                                  payment.status === "paid" ? "text-emerald-500/70" :
                                  payment.status === "overdue" ? "text-red-400/70" :
                                  payment.status === "open" ? "text-muted-foreground/50" :
                                  "text-blue-500/70"
                                }`}>
                                  {statusConfig[payment.status].label}
                                </span>
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}

                  {/* Summary Row */}
                  <TableRow className="bg-muted/40 border-t-2">
                    <TableCell className="sticky left-0 bg-muted/40 z-10 font-bold text-xs p-1.5" colSpan={2}>
                      Summe
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold tabular-nums text-xs p-1.5">{fmt(filteredDeals.reduce((s, d) => s + d.netAmount, 0))}</TableCell>
                    {visibleMonths.map((m) => {
                      const monthTotal = filteredDeals.reduce((s, d) => s + (d.monthlyPayments[m.key]?.amount || 0), 0);
                      const monthPaid = filteredDeals.reduce((s, d) => {
                        const p = d.monthlyPayments[m.key];
                        return s + (p?.status === "paid" ? p.amount : 0);
                      }, 0);
                      return (
                        <TableCell key={m.key} className="text-center p-1">
                          <div className="text-xs font-bold tabular-nums">{monthTotal > 0 ? fmt(monthTotal) : "–"}</div>
                          {monthPaid > 0 && (
                            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{fmt(monthPaid)}</div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== CASH-OUT TAB ==================== */}
        <TabsContent value="cashout" className="space-y-6">
          {/* Hero KPIs */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Gesamtausgaben */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-full" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <ArrowUpRight className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamtausgaben</p>
                    <p className="text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400">{fmt(totalExpenses)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Ø monatlich</p>
                    <p className="text-sm font-semibold">{fmt(avgMonthlyExpense)}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Posten</p>
                    <p className="text-sm font-semibold">{expenses.length}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Größter Posten</p>
                    <p className="text-sm font-semibold">{largestCategory.category}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gewinn */}
            <Card className="relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 ${profit >= 0 ? "bg-emerald-500/5" : "bg-red-500/5"} rounded-bl-full`} />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className={`h-10 w-10 rounded-xl ${profit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"} flex items-center justify-center`}>
                    <TrendingUp className={`h-5 w-5 ${profit >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gewinn (Cash-In − Cash-Out)</p>
                    <p className={`text-3xl font-bold tracking-tight ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{fmt(profit)}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {/* Stacked progress */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    <div className="bg-orange-500 rounded-l-full transition-all" style={{ width: `${totalExpenses > 0 ? (totalExpensesPaid / totalExpenses) * 100 : 0}%` }} />
                    <div className="bg-amber-400 transition-all" style={{ width: `${totalExpenses > 0 ? (totalExpensesPlanned / totalExpenses) * 100 : 0}%` }} />
                    {totalExpensesOpen > 0 && <div className="bg-red-500 rounded-r-full transition-all" style={{ width: `${(totalExpensesOpen / totalExpenses) * 100}%` }} />}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      <span className="text-muted-foreground">Bezahlt</span>
                      <span className="font-semibold">{fmt(totalExpensesPaid)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="text-muted-foreground">Geplant</span>
                      <span className="font-semibold">{fmt(totalExpensesPlanned)}</span>
                    </div>
                    {totalExpensesOpen > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-red-500 font-semibold">{fmt(totalExpensesOpen)} offen</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Expense Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Monatliche Ausgaben</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpenseMonthOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpenseMonthOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-3">
                {expenseMonthlyStats.map((m) => {
                  const currentMonth = new Date().toISOString().slice(0, 7);
                  const isCurrent = m.key === currentMonth;
                  const barH = m.total > 0 ? Math.max(20, (m.total / maxExpenseMonth) * 120) : 4;
                  const bezahltPct = m.total > 0 ? (m.bezahlt / m.total) * 100 : 0;
                  const geplantPct = m.total > 0 ? (m.geplant / m.total) * 100 : 0;

                  return (
                    <div key={m.key} className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${isCurrent ? "border-orange-500/50 bg-orange-500/[0.03] shadow-sm ring-1 ring-orange-500/20" : "hover:border-border"}`}>
                      <div className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${isCurrent ? "text-orange-500" : "text-muted-foreground"}`}>
                        {m.label}
                      </div>

                      {/* Bar */}
                      <div className="flex justify-center mb-3">
                        <div className="w-10 rounded-md overflow-hidden flex flex-col-reverse bg-muted/50" style={{ height: 120 }}>
                          {m.total > 0 ? (
                            <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: barH }}>
                              {m.bezahlt > 0 && <div className="bg-orange-500" style={{ height: `${bezahltPct}%` }} />}
                              {m.geplant > 0 && <div className="bg-amber-400/80" style={{ height: `${geplantPct}%` }} />}
                              {m.offen > 0 && <div className="bg-red-500" style={{ height: `${100 - bezahltPct - geplantPct}%` }} />}
                            </div>
                          ) : (
                            <div className="bg-muted/30 h-1 w-full rounded" />
                          )}
                        </div>
                      </div>

                      <div className={`text-sm font-bold tabular-nums ${m.total === 0 ? "text-muted-foreground/40" : ""}`}>
                        {m.total > 0 ? fmt(m.total) : "–"}
                      </div>

                      {m.total > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {m.bezahlt > 0 && (
                            <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium tabular-nums">{fmt(m.bezahlt)} bezahlt</div>
                          )}
                          {m.geplant > 0 && (
                            <div className="text-[10px] text-amber-500 font-medium tabular-nums">{fmt(m.geplant)} geplant</div>
                          )}
                          {m.offen > 0 && (
                            <div className="text-[10px] text-red-500 font-medium tabular-nums">{fmt(m.offen)} offen</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded bg-orange-500" />Bezahlt
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded bg-amber-400" />Geplant
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded bg-red-500" />Offen
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expense Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ausgabe suchen..."
                className="pl-9 w-[200px]"
                value={filterExpenseName}
                onChange={(e) => setFilterExpenseName(e.target.value)}
              />
            </div>
            <Select value={filterExpenseCategory} onValueChange={setFilterExpenseCategory}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-muted-foreground">
              {filteredExpenses.length} von {expenses.length} Posten
            </div>
          </div>

          {/* Expense Table */}
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="sticky left-0 bg-muted/30 z-10 min-w-[180px] text-[11px] uppercase tracking-wider">Posten</TableHead>
                    <TableHead className="sticky left-[180px] bg-muted/30 z-10 min-w-[140px] text-[11px] uppercase tracking-wider">Kategorie</TableHead>
                    <TableHead className="min-w-[150px] text-[11px] uppercase tracking-wider">Beschreibung</TableHead>
                    {expenseVisibleMonths.map((m) => {
                      const currentMonth = new Date().toISOString().slice(0, 7);
                      const isCurrent = m.key === currentMonth;
                      return (
                        <TableHead key={m.key} className={`text-center min-w-[110px] text-[11px] uppercase tracking-wider ${isCurrent ? "bg-orange-500/5" : ""}`}>
                          {m.label}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense, idx) => (
                    <TableRow key={expense.id} className={idx % 2 === 0 ? "" : "bg-muted/[0.03]"}>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">{expense.name}</TableCell>
                      <TableCell className="sticky left-[180px] bg-card z-10">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          expense.category === "Team/Gehälter" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" :
                          expense.category === "Software & Tools" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          expense.category === "Ads/Marketing" ? "bg-pink-500/10 text-pink-600 dark:text-pink-400" :
                          expense.category === "Büro & Miete" ? "bg-teal-500/10 text-teal-600 dark:text-teal-400" :
                          expense.category === "Freelancer" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" :
                          expense.category === "Steuern & Abgaben" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {expense.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{expense.description}</TableCell>
                      {expenseVisibleMonths.map((m) => {
                        const entry = expense.monthlyExpenses[m.key];
                        const currentMonth = new Date().toISOString().slice(0, 7);
                        const isCurrent = m.key === currentMonth;
                        if (!entry) return <TableCell key={m.key} className={`text-center ${isCurrent ? "bg-orange-500/[0.02]" : ""}`}><span className="text-muted-foreground/20">–</span></TableCell>;
                        return (
                          <TableCell key={m.key} className={`text-center p-1 ${isCurrent ? "bg-orange-500/[0.02]" : ""}`}>
                            <div
                              className={`w-full flex flex-col items-center gap-0.5 rounded-lg p-1.5 border ${
                                entry.status === "bezahlt"
                                  ? "bg-orange-500/10 border-orange-500/20"
                                  : entry.status === "offen"
                                  ? "bg-red-500/10 border-red-500/20"
                                  : "bg-amber-500/5 border-amber-500/10"
                              }`}
                            >
                              <span className={`text-xs font-bold tabular-nums ${
                                entry.status === "bezahlt" ? "text-orange-600 dark:text-orange-400" :
                                entry.status === "offen" ? "text-red-500" :
                                "text-foreground"
                              }`}>
                                {fmt(entry.amount)}
                              </span>
                              <span className={`text-[9px] font-medium ${
                                entry.status === "bezahlt" ? "text-orange-500/70" :
                                entry.status === "offen" ? "text-red-400/70" :
                                "text-amber-500/70"
                              }`}>
                                {expenseStatusConfig[entry.status].label}
                              </span>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}

                  {/* Summary Row */}
                  <TableRow className="bg-muted/40 border-t-2">
                    <TableCell className="sticky left-0 bg-muted/40 z-10 font-bold text-sm" colSpan={2}>
                      Summe
                    </TableCell>
                    <TableCell />
                    {expenseVisibleMonths.map((m) => {
                      const monthTotal = filteredExpenses.reduce((s, e) => s + (e.monthlyExpenses[m.key]?.amount || 0), 0);
                      const monthPaid = filteredExpenses.reduce((s, e) => {
                        const p = e.monthlyExpenses[m.key];
                        return s + (p?.status === "bezahlt" ? p.amount : 0);
                      }, 0);
                      return (
                        <TableCell key={m.key} className="text-center">
                          <div className="text-sm font-bold tabular-nums">{monthTotal > 0 ? fmt(monthTotal) : "–"}</div>
                          {monthPaid > 0 && (
                            <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium tabular-nums mt-0.5">{fmt(monthPaid)} bezahlt</div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

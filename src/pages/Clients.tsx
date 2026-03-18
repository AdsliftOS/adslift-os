import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users, CheckCircle2, PauseCircle, Trash2, Link2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useClients, setClients } from "@/store/clients";
import type { Client } from "@/store/clients";

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export default function Clients() {
  const [clients] = useClients();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({ name: "", contact: "", email: "", phone: "", company: "" });

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  const activeCount = clients.filter((c) => c.status === "Active").length;
  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);

  const handleAdd = () => {
    if (!form.name || !form.contact) {
      toast.error("Bitte Name und Ansprechpartner ausfüllen");
      return;
    }
    const newClient: Client = {
      id: Date.now().toString(),
      name: form.name,
      contact: form.contact,
      email: form.email,
      phone: form.phone,
      company: form.company || form.name,
      projects: 0,
      revenue: 0,
      status: "Active",
    };
    setClients((prev) => [newClient, ...prev]);
    setForm({ name: "", contact: "", email: "", phone: "", company: "" });
    setDialogOpen(false);
    toast.success("Kunde hinzugefügt");
  };

  const toggleStatus = (id: string) => {
    setClients((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: c.status === "Active" ? "Paused" : "Active" } : c)
    );
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    toast.success("Kunde gelöscht");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kunden</h1>
          <p className="text-sm text-muted-foreground">Alle Kunden und deren Accounts verwalten.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const link = `${window.location.origin}/onboarding`;
              navigator.clipboard.writeText(link);
              toast.success("Onboarding-Link kopiert!", { description: link });
            }}
          >
            <Link2 className="mr-2 h-4 w-4" />Onboarding-Link
            <Copy className="ml-1.5 h-3 w-3 text-muted-foreground" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />Neuer Kunde
            </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neuen Kunden anlegen</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Kundenname</Label>
                <Input placeholder="z.B. Acme Co" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Firma / Rechtsform</Label>
                <Input placeholder="z.B. Acme Co GmbH" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Ansprechpartner</Label>
                  <Input placeholder="Vor- und Nachname" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Telefon</Label>
                  <Input placeholder="+49 170 ..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>E-Mail</Label>
                <Input type="email" placeholder="email@kunde.de" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAdd}>Kunde anlegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{clients.length}</div>
              <div className="text-xs text-muted-foreground">Kunden gesamt</div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Aktive Kunden</div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-bl-full" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <PauseCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{fmt(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Gesamtumsatz</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Kunde suchen..."
          className="pl-9 max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[11px] uppercase tracking-wider">Kunde</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Ansprechpartner</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">E-Mail</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Telefon</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Projekte</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Umsatz</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((c, idx) => (
                <TableRow key={c.id} className={`group ${idx % 2 === 1 ? "bg-muted/[0.03]" : ""}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="font-medium text-sm">{c.name}</span>
                        <div className="text-[10px] text-muted-foreground">{c.company}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.contact}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                  <TableCell className="text-center text-sm font-medium">{c.projects}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{fmt(c.revenue)}</TableCell>
                  <TableCell className="text-center">
                    <button onClick={() => toggleStatus(c.id)}>
                      <Badge
                        variant={c.status === "Active" ? "default" : "secondary"}
                        className={`text-[10px] cursor-pointer ${c.status === "Active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                      >
                        {c.status === "Active" ? "Aktiv" : "Pausiert"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => deleteClient(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Keine Kunden gefunden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

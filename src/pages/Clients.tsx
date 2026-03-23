import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users, CheckCircle2, PauseCircle, Trash2, Link2, Copy, Pencil, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useClients, setClients } from "@/store/clients";
import type { Client, ClientStatus } from "@/store/clients";
import { supabase } from "@/lib/supabase";

type ClientComment = {
  id: string;
  client_id: string;
  author: string;
  text: string;
  created_at: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

const statusLabels: Record<ClientStatus, string> = {
  Active: "Aktiv",
  Paused: "Pausiert",
  Inactive: "Inaktiv",
};

const statusColors: Record<ClientStatus, string> = {
  Active: "bg-emerald-500 hover:bg-emerald-600",
  Paused: "bg-amber-500 hover:bg-amber-600",
  Inactive: "bg-gray-500 hover:bg-gray-600",
};

export default function Clients() {
  const [clients] = useClients();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({ name: "", contact: "", email: "", phone: "", company: "" });
  const [editForm, setEditForm] = useState<{ id: string; name: string; contact: string; email: string; phone: string; company: string; revenue: string; status: ClientStatus; contract_start: string; contract_end: string }>({
    id: "", name: "", contact: "", email: "", phone: "", company: "", revenue: "0", status: "Active", contract_start: "", contract_end: "",
  });

  // Comments state
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentAuthor, setCommentAuthor] = useState<"Alex" | "Daniel">("Alex");
  const [loadingComments, setLoadingComments] = useState(false);

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

  const openEditDialog = (c: Client) => {
    setEditForm({
      id: c.id,
      name: c.name,
      contact: c.contact,
      email: c.email,
      phone: c.phone,
      company: c.company,
      revenue: c.revenue.toString(),
      status: c.status,
      contract_start: c.contract_start || "",
      contract_end: c.contract_end || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === editForm.id
          ? {
              ...c,
              name: editForm.name,
              contact: editForm.contact,
              email: editForm.email,
              phone: editForm.phone,
              company: editForm.company,
              revenue: parseFloat(editForm.revenue) || 0,
              status: editForm.status,
              contract_start: editForm.contract_start || undefined,
              contract_end: editForm.contract_end || undefined,
            }
          : c
      )
    );
    setEditDialogOpen(false);
    toast.success("Kunde aktualisiert");
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    toast.success("Kunde gelöscht");
  };

  // Comments functions
  const loadComments = async (clientId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from("client_comments")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setComments(data);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
    setLoadingComments(false);
  };

  const openComments = (clientId: string) => {
    setSelectedClientId(clientId);
    setCommentDialogOpen(true);
    loadComments(clientId);
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    const comment = {
      client_id: selectedClientId,
      author: commentAuthor,
      text: newComment.trim(),
    };
    try {
      const { error } = await supabase.from("client_comments").insert(comment);
      if (!error) {
        setNewComment("");
        loadComments(selectedClientId);
      } else {
        // Fallback: add locally
        setComments((prev) => [
          ...prev,
          { ...comment, id: Date.now().toString(), created_at: new Date().toISOString() },
        ]);
        setNewComment("");
      }
    } catch {
      setComments((prev) => [
        ...prev,
        { ...comment, id: Date.now().toString(), created_at: new Date().toISOString() },
      ]);
      setNewComment("");
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

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
                <TableHead className="text-[11px] uppercase tracking-wider">Laufzeit</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="w-[100px]" />
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
                  <TableCell className="text-sm text-muted-foreground">
                    {c.contract_end
                      ? `Läuft bis: ${new Date(c.contract_end).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="default"
                      className={`text-[10px] ${statusColors[c.status]}`}
                    >
                      {statusLabels[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditDialog(c)}
                        className="text-muted-foreground hover:text-primary"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openComments(c.id)}
                        className="text-muted-foreground hover:text-primary"
                        title="Kommentare"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteClient(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Keine Kunden gefunden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kunde bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Kundenname</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Firma / Rechtsform</Label>
              <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Ansprechpartner</Label>
                <Input value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Telefon</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>E-Mail</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Umsatz (EUR)</Label>
                <Input type="number" value={editForm.revenue} onChange={(e) => setEditForm({ ...editForm, revenue: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as ClientStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Aktiv</SelectItem>
                    <SelectItem value="Paused">Pausiert</SelectItem>
                    <SelectItem value="Inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Laufzeit */}
            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Laufzeit</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Vertragsbeginn</Label>
                  <Input type="date" value={editForm.contract_start} onChange={(e) => setEditForm({ ...editForm, contract_start: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Vertragsende</Label>
                  <Input type="date" value={editForm.contract_end} onChange={(e) => setEditForm({ ...editForm, contract_end: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleEditSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kommentare — {selectedClient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
              {loadingComments && <p className="text-sm text-muted-foreground">Lade Kommentare...</p>}
              {!loadingComments && comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Noch keine Kommentare.</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">{comment.author}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{comment.text}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">Autor:</Label>
                <Select value={commentAuthor} onValueChange={(v) => setCommentAuthor(v as "Alex" | "Daniel")}>
                  <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alex">Alex</SelectItem>
                    <SelectItem value="Daniel">Daniel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  placeholder="Kommentar schreiben..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      addComment();
                    }
                  }}
                  className="flex-1"
                />
                <Button size="icon" onClick={addComment} className="shrink-0 self-end">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

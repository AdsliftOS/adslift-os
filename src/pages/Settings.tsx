import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTheme } from "next-themes";
import { Sun, Moon, Palette, Users, Building2, Bell, Trash2, Eclipse, Target, Calendar, CheckCircle2, Unplug, Plus, Link2, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/store/settings";
import { getAccounts, removeAccount, connectGoogleCalendar } from "@/lib/google-calendar";
import { getGmailAccounts, removeGmailAccount, connectGmail } from "@/lib/gmail-auth";
import { useOAuthVersion } from "@/lib/oauth-tokens";
import { supabase } from "@/lib/supabase";
import type { NotificationType } from "@/store/notifications";
import {
  useTeamMembers,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from "@/store/teamMembers";
import { getCloseOrgUsers, type CloseOrgUser } from "@/lib/close-user-kpis";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [appSettings, setAppSettings] = useSettings();
  const team = useTeamMembers();
  useOAuthVersion(); // re-render bei Token-Updates

  // Close org users (for mapping)
  const [closeUsers, setCloseUsers] = useState<CloseOrgUser[]>([]);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeDiagnostic, setCloseDiagnostic] = useState<string | null>(null);

  // Known Close-Org members of "Ochs & Goldmann Consulting" — used as fallback
  // if the live /membership call fails. IDs come from a verified Close API
  // response. KPIs still need the proxy to work; this only ensures the
  // connection UI is never empty.
  const KNOWN_CLOSE_FALLBACK: CloseOrgUser[] = [
    { id: "user_MfUpEG0kc0tuHOHH0gvf3ttj1P2zm2R93C2BGweO3Yb", name: "Alexander Goldmann", email: "info@consulting-og.de" },
    { id: "user_lPRiFsx2FMtcUtiEJ0BikFvTwNVEnKrQSibG8oetnmv", name: "Daniel Ochs", email: "d.ochs2020@gmail.com" },
  ];

  const loadCloseUsers = useCallback(async () => {
    setCloseLoading(true);
    setCloseDiagnostic(null);

    const proxyGet = async (endpoint: string) => {
      const res = await fetch(`/api/close-proxy?endpoint=${encodeURIComponent(endpoint)}`);
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      return { res, json, text };
    };

    try {
      // Step 1: /me/ to grab the current org id
      const me = await proxyGet("me/");
      if (!me.res.ok || !me.json) {
        setCloseDiagnostic(`/me/ → HTTP ${me.res.status}: ${(me.text || "").slice(0, 200)}`);
        setCloseUsers(KNOWN_CLOSE_FALLBACK);
        return;
      }

      const orgId =
        me.json?.organizations?.[0]?.id ||
        me.json?.organization_id ||
        null;
      if (!orgId) {
        setCloseDiagnostic(
          `/me/ ok aber keine org_id gefunden. Raw: ${JSON.stringify(me.json).slice(0, 200)}`,
        );
        setCloseUsers(KNOWN_CLOSE_FALLBACK);
        return;
      }

      // Step 2: try the per-org membership endpoint, then fall back
      const attempts = [
        `organization/${orgId}/membership/`,
        `organization/${orgId}/`,
      ];
      for (const ep of attempts) {
        const r = await proxyGet(ep);
        if (!r.res.ok || !r.json) continue;
        // Could be {data:[...]} (membership list) or {memberships:[...]} (org)
        const list: any[] =
          r.json?.data ||
          r.json?.memberships ||
          [];
        if (list.length > 0) {
          const arr = list.map((m: any) => ({
            id: m.user_id || m.id,
            email: m.user_email || m.email || "",
            name:
              [m.user_first_name || m.first_name, m.user_last_name || m.last_name]
                .filter(Boolean)
                .join(" ") ||
              m.user_email ||
              m.email ||
              m.user_id ||
              m.id,
          }));
          setCloseUsers(arr);
          setCloseDiagnostic(null);
          return;
        }
      }

      setCloseDiagnostic(
        `org_id=${orgId} gefunden, aber Membership-Endpoint lieferte 0 Einträge. Fallback aktiv.`,
      );
      setCloseUsers(KNOWN_CLOSE_FALLBACK);
    } catch (err: any) {
      setCloseDiagnostic(`Fetch failed: ${err?.message || String(err)}`);
      setCloseUsers(KNOWN_CLOSE_FALLBACK);
    } finally {
      setCloseLoading(false);
    }
  }, []);

  useEffect(() => { loadCloseUsers(); }, [loadCloseUsers]);

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    role: "Closer",
    closeUserId: "",
    commissionRate: 10,
  });

  const resetAddForm = () => setAddForm({ name: "", email: "", role: "Closer", closeUserId: "", commissionRate: 10 });

  const handleAddMember = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error("Name und E-Mail sind erforderlich");
      return;
    }
    const id = await addTeamMember({
      name: addForm.name.trim(),
      email: addForm.email.trim().toLowerCase(),
      role: addForm.role,
      closeUserId: addForm.closeUserId || null,
      commissionRate: addForm.commissionRate,
      status: "active",
    });
    if (id) {
      toast.success("Mitarbeiter angelegt");
      setAddOpen(false);
      resetAddForm();
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`${name} wirklich löschen?`)) return;
    await deleteTeamMember(id);
    toast.success("Mitarbeiter gelöscht");
  };

  // Notification settings (Supabase-backed)
  const notifTypes: { key: NotificationType; title: string; desc: string }[] = [
    { key: "contract_expiry", title: "Vertrag läuft aus", desc: "Benachrichtigung wenn ein Kundenvertrag in 7 Tagen ausläuft." },
    { key: "onboarding_complete", title: "Neues Onboarding", desc: "Benachrichtigung wenn ein Onboarding abgeschlossen wird." },
    { key: "campaign_underperform", title: "Kampagne underperformt", desc: "Warnung bei niedrigem CTR und hohem Spend." },
    { key: "task_due", title: "Aufgabe fällig", desc: "Erinnerung wenn eine Aufgabe heute fällig ist." },
    { key: "no_show", title: "No-Show Meeting", desc: "Benachrichtigung bei verpassten Meetings." },
  ];
  const [notifSettings, setNotifSettings] = useState<Record<NotificationType, boolean>>({
    contract_expiry: true,
    onboarding_complete: true,
    campaign_underperform: true,
    task_due: true,
    no_show: true,
  });
  const [notifLoaded, setNotifLoaded] = useState(false);

  const loadNotifSettings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return;
    const { data } = await supabase
      .from("notification_settings")
      .select("type, enabled")
      .eq("user_email", session.user.email);
    if (data && data.length > 0) {
      const next = { ...notifSettings };
      for (const row of data) {
        if (row.type in next) {
          (next as any)[row.type] = row.enabled !== false;
        }
      }
      setNotifSettings(next);
    }
    setNotifLoaded(true);
  }, []);

  useEffect(() => { loadNotifSettings(); }, [loadNotifSettings]);

  const toggleNotifSetting = async (type: NotificationType, enabled: boolean) => {
    setNotifSettings((prev) => ({ ...prev, [type]: enabled }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return;
    const { data: existing } = await supabase
      .from("notification_settings")
      .select("id")
      .eq("user_email", session.user.email)
      .eq("type", type)
      .limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("notification_settings").update({ enabled }).eq("id", existing[0].id);
    } else {
      await supabase.from("notification_settings").insert({ user_email: session.user.email, type, enabled });
    }
    toast.success("Einstellung gespeichert");
  };

  const updateSetting = (key: string, value: string | number) => {
    setAppSettings((prev) => ({ ...prev, [key]: value }));
  };

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun, description: "Hell & clean" },
    { value: "dark", label: "Dark Blue", icon: Moon, description: "Dunkelblau — aktuelles Dark Theme" },
    { value: "anthrazit", label: "Anthrazit", icon: Eclipse, description: "Tiefes Schwarz — echtes Dark" },
  ];

  const toggleMemberStatus = (id: string, current: "active" | "inactive") => {
    updateTeamMember(id, { status: current === "active" ? "inactive" : "active" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">App-Einstellungen, Team und Unternehmensdaten verwalten.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Allgemein</TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5"><Target className="h-3.5 w-3.5" />Sales Goals</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Darstellung</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" />Team</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Integrationen</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Benachrichtigungen</TabsTrigger>
        </TabsList>

        {/* ALLGEMEIN */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unternehmen</CardTitle>
              <CardDescription>Grunddaten deiner Agentur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Firmenname</Label>
                  <Input value={appSettings.companyName} onChange={(e) => updateSetting("companyName", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>E-Mail</Label>
                  <Input type="email" value={appSettings.companyEmail} onChange={(e) => updateSetting("companyEmail", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Website</Label>
                  <Input value={appSettings.companyWebsite} onChange={(e) => updateSetting("companyWebsite", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Währung</Label>
                  <Select value={appSettings.currency} onValueChange={(v) => updateSetting("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CHF">CHF (Fr.)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={() => toast.success("Einstellungen gespeichert")}>Speichern</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zeiterfassung</CardTitle>
              <CardDescription>Standardwerte für die Zeiterfassung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Wochenstunden-Ziel</Label>
                  <Input type="number" value={appSettings.weeklyHourTarget} onChange={(e) => updateSetting("weeklyHourTarget", parseInt(e.target.value) || 0)} />
                </div>
                <div className="grid gap-2">
                  <Label>Sprache</Label>
                  <Select value={appSettings.language} onValueChange={(v) => updateSetting("language", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={() => toast.success("Einstellungen gespeichert")}>Speichern</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SALES GOALS */}
        <TabsContent value="sales" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales-Ziele</CardTitle>
              <CardDescription>Deine Umsatz- und Performance-Ziele für den Sales Tracker.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Monatliches Umsatzziel (€)</Label>
                  <Input
                    type="number"
                    value={appSettings.salesGoalMonthly}
                    onChange={(e) => updateSetting("salesGoalMonthly", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Wird automatisch auf Wochen/Jahr umgerechnet.</p>
                </div>
                <div className="grid gap-2">
                  <Label>Calls pro Woche (Ziel)</Label>
                  <Input
                    type="number"
                    value={appSettings.salesGoalScheduledWeekly}
                    onChange={(e) => updateSetting("salesGoalScheduledWeekly", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Wie viele Calls willst du pro Woche haben?</p>
                </div>
                <div className="grid gap-2">
                  <Label>Show-up Rate Ziel (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={appSettings.salesGoalShowUpRate}
                    onChange={(e) => updateSetting("salesGoalShowUpRate", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Wie viel % der gebuchten Calls sollen stattfinden?</p>
                </div>
                <div className="grid gap-2">
                  <Label>Closing Rate Ziel (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={appSettings.salesGoalCloseRate}
                    onChange={(e) => updateSetting("salesGoalCloseRate", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">Wie viel % der Calls sollen zu Deals werden?</p>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vorschau — Berechnete Ziele</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <div className="text-lg font-bold">{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(appSettings.salesGoalMonthly)}</div>
                    <div className="text-[10px] text-muted-foreground">pro Monat</div>
                  </div>
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <div className="text-lg font-bold">{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(appSettings.salesGoalMonthly / 4.33))}</div>
                    <div className="text-[10px] text-muted-foreground">pro Woche</div>
                  </div>
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <div className="text-lg font-bold">{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(appSettings.salesGoalMonthly * 12)}</div>
                    <div className="text-[10px] text-muted-foreground">pro Jahr</div>
                  </div>
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <div className="text-lg font-bold">{appSettings.salesGoalScheduledWeekly}</div>
                    <div className="text-[10px] text-muted-foreground">Calls / Woche</div>
                  </div>
                </div>
              </div>

              <Button size="sm" onClick={() => toast.success("Sales-Ziele gespeichert")}>Speichern</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DARSTELLUNG */}
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Wähle das Farbschema für die App.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {themeOptions.map((opt) => {
                  const isActive = theme === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm ${
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${
                        isActive ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                      {isActive && (
                        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vorschau</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="h-2 w-16 rounded bg-primary" />
                  <div className="h-2 w-24 rounded bg-muted" />
                  <div className="h-2 w-20 rounded bg-muted" />
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/20" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2 w-20 rounded bg-foreground/20" />
                      <div className="h-2 w-full rounded bg-muted" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 rounded bg-muted-foreground/30" />
                    <Badge variant="secondary" className="text-[9px] py-0">Badge</Badge>
                  </div>
                  <Progress value={65} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAM */}
        <TabsContent value="team" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Team-Mitglieder</CardTitle>
                <CardDescription>
                  Verwalte dein Team, verknüpfe Close-Konten und setze Provisionssätze.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {team.filter((m) => m.status === "active").length} aktiv
                </Badge>
                <Button size="sm" onClick={() => { resetAddForm(); setAddOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Mitarbeiter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Rolle</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">E-Mail</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Close-User</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Provision</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Noch keine Team-Mitglieder. Klicke oben auf „Mitarbeiter" um den ersten anzulegen.
                      </TableCell>
                    </TableRow>
                  )}
                  {team.map((member, idx) => (
                    <TableRow key={member.id} className={idx % 2 === 1 ? "bg-muted/[0.03]" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <Input
                            value={member.name}
                            onChange={(e) => updateTeamMember(member.id, { name: e.target.value })}
                            className="h-8 text-sm border-0 bg-transparent focus-visible:bg-muted/30 px-2"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          onValueChange={(v) => updateTeamMember(member.id, { role: v })}
                        >
                          <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/30 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Geschäftsführer">Geschäftsführer</SelectItem>
                            <SelectItem value="Partner">Partner</SelectItem>
                            <SelectItem value="Closer">Closer</SelectItem>
                            <SelectItem value="Setter">Setter</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={member.email}
                          onChange={(e) => updateTeamMember(member.id, { email: e.target.value })}
                          className="h-8 text-xs border-0 bg-transparent focus-visible:bg-muted/30 px-2 font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const linkedCloseUser = member.closeUserId
                            ? closeUsers.find((u) => u.id === member.closeUserId)
                            : null;
                          if (linkedCloseUser) {
                            return (
                              <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15 gap-1">
                                  <Link2 className="h-2.5 w-2.5" />
                                  {linkedCloseUser.name}
                                </Badge>
                                <Select
                                  value={member.closeUserId || ""}
                                  onValueChange={(v) =>
                                    updateTeamMember(member.id, { closeUserId: v === "__none" ? null : v })
                                  }
                                >
                                  <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent hover:bg-muted/30 [&>svg]:hidden flex items-center justify-center">
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none">– trennen –</SelectItem>
                                    {closeUsers.map((u) => (
                                      <SelectItem key={u.id} value={u.id}>
                                        {u.name} ({u.email})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }
                          // Not linked yet — show a clear "Verbinden" button
                          if (closeUsers.length === 0) {
                            return (
                              <span className="text-[10px] text-muted-foreground italic">
                                {closeLoading ? "lade..." : "keine Close-User"}
                              </span>
                            );
                          }
                          return (
                            <Select
                              value=""
                              onValueChange={(v) =>
                                v && updateTeamMember(member.id, { closeUserId: v })
                              }
                            >
                              <SelectTrigger className="h-7 px-2 text-[11px] border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 max-w-[200px]">
                                <Link2 className="h-3 w-3 mr-1" />
                                <span>Mit Close verbinden</span>
                              </SelectTrigger>
                              <SelectContent>
                                {closeUsers.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name} ({u.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={member.commissionRate}
                            onChange={(e) =>
                              updateTeamMember(member.id, { commissionRate: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8 w-16 text-xs text-right border-0 bg-transparent focus-visible:bg-muted/30 px-2 font-mono"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => toggleMemberStatus(member.id, member.status)}>
                          <Badge
                            variant={member.status === "active" ? "default" : "secondary"}
                            className={`text-[10px] cursor-pointer ${member.status === "active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                          >
                            {member.status === "active" ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMember(member.id, member.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* PROMINENT: Close-Konten verbinden */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.06] to-transparent">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  Close-Konten verbinden
                </CardTitle>
                <CardDescription>
                  Wähle pro Mitarbeiter den passenden Close-User aus. Damit fließen seine Anwahlen, Termine, Closes & Pipeline in seinen Mein-Bereich.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadCloseUsers} disabled={closeLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${closeLoading ? "animate-spin" : ""}`} />
                Aktualisieren
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {closeDiagnostic && !closeLoading && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2">
                  <div className="font-medium">
                    Live-Anbindung an Close lieferte nichts — nutze hinterlegten Fallback
                    (Alex + Daniel). Die Verknüpfung funktioniert; KPIs in /me brauchen
                    aber den live API-Key.
                  </div>
                  <div className="font-mono text-[10px] bg-black/20 rounded p-2 border border-amber-500/20 text-amber-200/90 break-all whitespace-pre-wrap">
                    {closeDiagnostic}
                  </div>
                </div>
              )}
              {team.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Mitarbeiter angelegt.</p>
              ) : (
                <div className="space-y-2">
                  {team.map((m) => {
                    const linkedCloseUser = m.closeUserId
                      ? closeUsers.find((u) => u.id === m.closeUserId)
                      : null;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{m.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate">{m.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {linkedCloseUser ? (
                            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15 gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {linkedCloseUser.name}
                            </Badge>
                          ) : null}
                          <Select
                            value={m.closeUserId || "__none"}
                            onValueChange={(v) =>
                              updateTeamMember(m.id, { closeUserId: v === "__none" ? null : v })
                            }
                          >
                            <SelectTrigger
                              className={`h-9 text-xs min-w-[180px] ${
                                linkedCloseUser
                                  ? ""
                                  : "border-primary bg-primary/10 hover:bg-primary/15 text-primary font-medium"
                              }`}
                            >
                              {linkedCloseUser ? (
                                <SelectValue />
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <Link2 className="h-3 w-3" />
                                  Mit Close verbinden
                                </span>
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">– nicht verbunden –</SelectItem>
                              {closeUsers.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}{" "}
                                  <span className="text-muted-foreground">({u.email})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Close users (info card) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  Verfügbare Close-User
                </CardTitle>
                <CardDescription>Mitglieder eurer Close-Org "Ochs & Goldmann Consulting"</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {closeUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {closeLoading ? "Lade Close-User..." : "Keine Close-User gefunden."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {closeUsers.map((u) => {
                    const linked = team.find((m) => m.closeUserId === u.id);
                    return (
                      <div key={u.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">{u.email}</div>
                        </div>
                        {linked ? (
                          <Badge className="text-[9px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15">
                            ↔ {linked.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">frei</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add member dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Neuer Mitarbeiter</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="z.B. Max Müller"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label>E-Mail *</Label>
                  <Input
                    type="email"
                    placeholder="max@adslift.de"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Mit dieser E-Mail wird er sich in der App anmelden.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Rolle</Label>
                    <Select
                      value={addForm.role}
                      onValueChange={(v) => setAddForm((f) => ({ ...f, role: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Closer">Closer</SelectItem>
                        <SelectItem value="Setter">Setter</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Geschäftsführer">Geschäftsführer</SelectItem>
                        <SelectItem value="Partner">Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Provision (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={addForm.commissionRate}
                      onChange={(e) => setAddForm((f) => ({ ...f, commissionRate: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Close-User verknüpfen</Label>
                  <Select
                    value={addForm.closeUserId || "__none"}
                    onValueChange={(v) => setAddForm((f) => ({ ...f, closeUserId: v === "__none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">– später verknüpfen –</SelectItem>
                      {closeUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
                <Button onClick={handleAddMember}>Anlegen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* INTEGRATIONEN */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google Calendar
              </CardTitle>
              <CardDescription>Verbundene Google Accounts für den Kalender.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const accounts = getAccounts();
                return (
                  <>
                    {accounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Noch kein Google Account verbunden.</p>
                    ) : (
                      <div className="space-y-2">
                        {accounts.map((acc) => (
                          <div key={acc.email} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className={`h-3 w-3 rounded-full ${acc.color}`} />
                              <div>
                                <div className="text-sm font-medium">{acc.email}</div>
                                <div className="text-[10px] text-muted-foreground">Google Calendar verbunden</div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-1.5"
                              onClick={() => {
                                removeAccount(acc.email);
                                toast.success(`${acc.email} getrennt`);
                                // Force re-render
                                window.location.reload();
                              }}>
                              <Unplug className="h-3.5 w-3.5" />Trennen
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => connectGoogleCalendar()}>
                      <Plus className="mr-2 h-4 w-4" />
                      {accounts.length > 0 ? "Weiteren Account verbinden" : "Google Account verbinden"}
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <img src="/gmail-icon.svg" alt="" className="h-5 w-5" />
                Gmail
              </CardTitle>
              <CardDescription>E-Mails direkt in Adslift lesen, schreiben und organisieren.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const gmailAccs = getGmailAccounts();
                const connected = gmailAccs.length > 0;
                return (
                  <>
                    {connected ? (
                      <div className="space-y-2">
                        {gmailAccs.map((acc) => (
                          <div key={acc.email} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <img src="/gmail-icon.svg" alt="" className="h-4 w-4" />
                              <div>
                                <div className="text-sm font-medium">{acc.email}</div>
                                <div className="text-[10px] text-muted-foreground">Gmail verbunden</div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-1.5"
                              onClick={() => {
                                removeGmailAccount(acc.email);
                                toast.success(`${acc.email} getrennt`);
                                window.location.reload();
                              }}>
                              <Unplug className="h-3.5 w-3.5" />Trennen
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Noch kein Gmail Account verbunden.</p>
                    )}
                    <Button variant="outline" size="sm" onClick={() => connectGmail()}>
                      <img src="/gmail-icon.svg" alt="" className="mr-2 h-4 w-4" />
                      {connected ? "Weiteren Account verbinden" : "Gmail verbinden"}
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BENACHRICHTIGUNGEN */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Benachrichtigungen</CardTitle>
              <CardDescription>Bestimme welche automatischen Benachrichtigungen du erhalten möchtest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {notifTypes.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                  </div>
                  <Switch
                    checked={notifSettings[item.key]}
                    onCheckedChange={(checked) => toggleNotifSetting(item.key, checked)}
                    disabled={!notifLoaded}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

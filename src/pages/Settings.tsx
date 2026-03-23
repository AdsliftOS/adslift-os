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
import { useTheme } from "next-themes";
import { Sun, Moon, Palette, Users, Building2, Bell, Trash2, Eclipse, Target, Calendar, CheckCircle2, Unplug, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/store/settings";
import { getAccounts, removeAccount, connectGoogleCalendar } from "@/lib/google-calendar";
import { supabase } from "@/lib/supabase";
import type { NotificationType } from "@/store/notifications";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: "active" | "inactive";
  utilization: number;
};

const initialTeam: TeamMember[] = [
  { id: "1", name: "Alex", role: "Geschäftsführer", email: "info@consulting-og.de", status: "active", utilization: 0 },
  { id: "2", name: "Daniel", role: "Partner", email: "office@consulting-og.de", status: "active", utilization: 0 },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [appSettings, setAppSettings] = useSettings();
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);

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

  const toggleMemberStatus = (id: string) => {
    setTeam((prev) =>
      prev.map((m) => m.id === id ? { ...m, status: m.status === "active" ? "inactive" : "active" } : m)
    );
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
                <CardDescription>Verwalte dein Team und deren Rollen.</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {team.filter((m) => m.status === "active").length} aktiv
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Rolle</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">E-Mail</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Auslastung</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((member, idx) => (
                    <TableRow key={member.id} className={idx % 2 === 1 ? "bg-muted/[0.03]" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{member.name.split(" ").map((n) => n[0]).join("")}</span>
                          </div>
                          <span className="font-medium text-sm">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.role}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        {member.status === "active" ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[100px]">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  member.utilization >= 80 ? "bg-emerald-500" :
                                  member.utilization >= 50 ? "bg-yellow-500" :
                                  "bg-red-500"
                                }`}
                                style={{ width: `${member.utilization}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">{member.utilization}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => toggleMemberStatus(member.id)}>
                          <Badge
                            variant={member.status === "active" ? "default" : "secondary"}
                            className={`text-[10px] cursor-pointer ${member.status === "active" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                          >
                            {member.status === "active" ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";

const N8N_WEBHOOK = "https://adsliftauto.app.n8n.cloud/webhook/onboarding-trigger";

export default function CloserHandoff() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    variant: "donewithyou" as "done4you" | "donewithyou",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ name: string; email: string; password: string } | null>(null);

  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim();

  const handleSubmit = async () => {
    if (!valid) {
      toast.error("Bitte Vorname, Nachname und Email ausfüllen");
      return;
    }
    setSubmitting(true);
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const email = form.email.trim().toLowerCase();
    const company = form.company.trim() || fullName;
    const password = Math.random().toString(36).slice(2, 10);

    try {
      // 1. Find or create client by email
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name, email")
        .ilike("email", email)
        .limit(1);

      let clientId: string;
      if (existing && existing.length > 0) {
        clientId = existing[0].id;
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({
            name: fullName,
            contact: fullName,
            email,
            company,
            status: "Active",
            projects: 0,
            revenue: 0,
          })
          .select()
          .single();
        if (clientErr) throw clientErr;
        clientId = newClient.id;
      }

      // 2. Upsert academy_customer — always sync password so email matches DB
      const { data: existingAc } = await supabase
        .from("academy_customers")
        .select("id")
        .or(`client_id.eq.${clientId},email.eq.${email}`)
        .maybeSingle();

      if (existingAc) {
        const { error: upErr } = await supabase
          .from("academy_customers")
          .update({ password_hash: password, status: "active", client_id: clientId, name: fullName, email, company, variant: form.variant === "done4you" ? "d4y" : "dwy", onboarding_completed: false })
          .eq("id", existingAc.id);
        if (upErr) throw upErr;
      } else {
        const { error: acErr } = await supabase.from("academy_customers").insert({
          name: fullName,
          email,
          password_hash: password,
          company,
          status: "active",
          client_id: clientId,
          variant: form.variant === "done4you" ? "d4y" : "dwy",
          onboarding_completed: false,
        });
        if (acErr) throw acErr;
      }

      // 3. Pipeline-Project anlegen (falls noch keins für diesen Client existiert)
      const pipelineVariant = form.variant === "done4you" ? "d4y" : "dwy";
      const { data: existingPipelineProject } = await supabase
        .from("pipeline_projects")
        .select("id")
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle();

      if (!existingPipelineProject) {
        const portalToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
        const { error: ppErr } = await supabase.from("pipeline_projects").insert({
          name: `Meta Ads — ${company}`,
          variant: pipelineVariant,
          client_id: clientId,
          client_email: email,
          status: "draft",
          customer_portal_token: portalToken,
        });
        if (ppErr) console.warn("pipeline_projects insert failed:", ppErr.message);
      }

      // 4. Trigger n8n webhook → Welcome-Email
      const r = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          full_name: fullName,
          company,
          password,
          client_id: clientId,
          variant: form.variant,
        }),
      });
      if (!r.ok) console.warn("n8n webhook failed:", r.status, await r.text().catch(() => ""));

      setDone({ name: fullName, email, password });
      toast.success("Onboarding gestartet — Welcome-Email ist raus");
    } catch (e: any) {
      toast.error("Fehler: " + (e.message ?? "unbekannt"));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Sonner />
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-5">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Onboarding gestartet</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Welcome-Email an <strong>{done.email}</strong> ist raus.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4 text-left text-sm space-y-1">
              <div><span className="text-muted-foreground">Name:</span> <strong>{done.name}</strong></div>
              <div><span className="text-muted-foreground">Email:</span> <strong>{done.email}</strong></div>
              <div><span className="text-muted-foreground">Passwort:</span> <strong className="font-mono">{done.password}</strong></div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setForm({ firstName: "", lastName: "", email: "", company: "", variant: "donewithyou" });
              }}
              className="w-full"
            >
              Nächsten Kunden anlegen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Sonner />
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs uppercase tracking-wider text-primary font-semibold">Closer-Handoff</span>
              </div>
              <h1 className="text-xl font-bold mt-1">Neuer Kunde signed</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daten eintippen → Onboarding läuft automatisch
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">Adslift</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Vorname *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Max"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Nachname *</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Mustermann"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="max@firma.de"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Firma <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Acme GmbH"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Variante</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["donewithyou", "done4you"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setForm({ ...form, variant: v })}
                  className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                    form.variant === v
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {v === "done4you" ? "Done 4 You" : "Done With You"}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="w-full gap-1.5 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Sende ..." : "Onboarding starten"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

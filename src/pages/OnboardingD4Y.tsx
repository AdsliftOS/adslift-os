import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  Target,
  DollarSign,
  KeyRound,
  FolderOpen,
  CheckCircle2,
  Sparkles,
  PlayCircle,
  Receipt,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addProject as addProjectDB } from "@/store/projects";
import type { Project } from "@/store/projects";

type BriefingData = {
  // Step 0: Firma + Rechnung
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingAddress: string;
  vatId: string;

  // Step 1: Zielgruppe
  targetAudience: string;
  audienceLocation: string;
  audienceProblems: string;
  audienceBudget: string;

  // Step 2: Offer
  mainOffer: string;
  priceRange: string;
  usp: string;
  caseStudies: string;

  // Step 3: Material & Zugänge
  driveLink: string;
  websiteForAds: string;
  hasMetaBusinessManager: "yes" | "no" | "";
  metaBusinessManager: string;
  adAccountId: string;
  pixelId: string;
  additionalNotes: string;

  // Social
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
};

const initial: BriefingData = {
  companyName: "", contactName: "", contactEmail: "", contactPhone: "", billingAddress: "", vatId: "",
  targetAudience: "", audienceLocation: "", audienceProblems: "", audienceBudget: "",
  mainOffer: "", priceRange: "", usp: "", caseStudies: "",
  driveLink: "", websiteForAds: "", hasMetaBusinessManager: "", metaBusinessManager: "", adAccountId: "", pixelId: "", additionalNotes: "",
  instagramUrl: "", facebookUrl: "", tiktokUrl: "", linkedinUrl: "",
};

const steps = [
  { title: "Firma & Rechnung", icon: Building2, description: "Wer du bist und wohin die Rechnung geht" },
  { title: "Deine Zielgruppe", icon: Target, description: "Wer soll deine Werbung sehen" },
  { title: "Dein Angebot", icon: DollarSign, description: "Was wir verkaufen werden" },
  { title: "Material & Zugänge", icon: KeyRound, description: "Brand-Assets + Meta Business Manager" },
];

export default function OnboardingD4Y() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<BriefingData>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<{ customer_id: string; email: string; name: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("academy_session");
    if (!stored) { navigate("/academy", { replace: true }); return; }
    try {
      const parsed = JSON.parse(stored);
      if (parsed.variant !== "d4y") {
        navigate("/onboarding?from=academy", { replace: true });
        return;
      }
      setSession(parsed);
      setData((d) => ({
        ...d,
        contactEmail: parsed.email,
        contactName: parsed.name,
      }));
    } catch {
      navigate("/academy", { replace: true });
    }
  }, [navigate]);

  const update = <K extends keyof BriefingData>(field: K, value: BriefingData[K]) =>
    setData((p) => ({ ...p, [field]: value }));

  const canProceed = () => {
    switch (step) {
      case 0: return data.companyName && data.contactName && data.contactEmail && data.contactPhone && data.billingAddress && data.vatId;
      case 1: return data.targetAudience && data.audienceLocation && data.audienceProblems && data.audienceBudget;
      case 2: return data.mainOffer && data.priceRange && data.usp && data.caseStudies;
      case 3: {
        if (!data.hasMetaBusinessManager) return false;
        if (data.hasMetaBusinessManager === "yes") {
          return data.driveLink.startsWith("https://") && data.websiteForAds && data.metaBusinessManager && data.adAccountId && data.pixelId;
        }
        return data.driveLink.startsWith("https://") && data.websiteForAds;
      }
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    const { data: ac } = await supabase
      .from("academy_customers")
      .select("client_id")
      .eq("id", session.customer_id)
      .maybeSingle();

    if (ac?.client_id) {
      await supabase.from("clients").update({
        name: data.companyName,
        contact: data.contactName,
        email: data.contactEmail.trim().toLowerCase(),
        phone: data.contactPhone,
        company: data.companyName,
      }).eq("id", ac.client_id);

      const newProject: Project = {
        id: `onb-d4y-${Date.now()}`,
        client: data.companyName,
        clientId: ac.client_id,
        name: `D4Y — ${data.companyName}`,
        product: "Done 4 You",
        type: "done4you",
        creativeFormat: "beides",
        startDate: new Date().toLocaleDateString("de-DE"),
        assignees: [],
        phases: [],
        briefing: "",
        meetingNotes: "",
        targetAudience: "",
        offer: "",
        comments: [],
        onboarding: { ...data, variant: "done4you" } as unknown as Record<string, unknown>,
      };
      await addProjectDB(newProject as any);
    }

    await supabase.from("academy_customers")
      .update({ onboarding_completed: true })
      .eq("id", session.customer_id);

    // Notify team
    try {
      const { data: members } = await supabase.from("team_members").select("email").eq("status", "active");
      const fallback = [{ email: "info@consulting-og.de" }];
      const recipients = (members && members.length > 0 ? members : fallback) as { email: string }[];
      const rows = recipients.filter((m) => m.email).map((m) => ({
        type: "onboarding_complete",
        title: `D4Y-Briefing fertig: ${data.companyName}`,
        message: `${data.contactName} (${data.contactEmail}) hat das D4Y-Briefing eingereicht. Customer 360 → Onboarding-Tab für Details.`,
        read: false,
        user_email: m.email,
      }));
      if (rows.length > 0) await supabase.from("notifications").insert(rows);
    } catch (e) { console.error(e); }

    const updated = { ...session, onboarding_completed: true, variant: "d4y" };
    localStorage.setItem("academy_session", JSON.stringify(updated));

    setSubmitted(true);
    setTimeout(() => navigate("/portal", { replace: true }), 2500);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30 mb-2">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Briefing eingereicht — danke!</h1>
            <p className="text-muted-foreground">Wir haben deine Daten und legen jetzt los. Du kommst gleich in deinen Kundenbereich.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/adslift-icon.png" alt="Adslift" className="w-8 h-8 rounded-xl" />
            <div>
              <span className="text-base font-bold tracking-tight">Adslift Briefing</span>
              <p className="text-[10px] text-muted-foreground">Done 4 You</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">Schritt {step + 1} von {steps.length}</Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {currentStep.title}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
                  <Sparkles className="h-3.5 w-3.5" /> Schritt {step + 1}
                </div>
                <h2 className="text-2xl font-bold">{currentStep.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{currentStep.description}</p>
              </div>

              {/* Step 0 — Firma + Rechnung */}
              {step === 0 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Firmenname / Geschäftsname</Label>
                    <Input placeholder="z.B. Müller Webdesign GmbH" value={data.companyName} onChange={(e) => update("companyName", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Ansprechpartner</Label>
                      <Input placeholder="Vor- und Nachname" value={data.contactName} onChange={(e) => update("contactName", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Telefon</Label>
                      <Input placeholder="+49 170 ..." value={data.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>E-Mail</Label>
                    <Input type="email" value={data.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
                  </div>
                  <div className="grid gap-3 mt-2 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-emerald-500" />
                      <p className="text-sm font-semibold">Rechnungsdaten (Reverse Charge)</p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Rechnungsadresse</Label>
                      <Textarea rows={3} placeholder="Firma&#10;Straße + Nr.&#10;PLZ + Ort&#10;Land" value={data.billingAddress} onChange={(e) => update("billingAddress", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>USt-ID</Label>
                      <Input placeholder="z.B. DE123456789" value={data.vatId} onChange={(e) => update("vatId", e.target.value.toUpperCase())} />
                      <p className="text-[10px] text-muted-foreground">Format: 2 Buchstaben Ländercode + Zahlen</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1 — Zielgruppe */}
              {step === 1 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Wer ist dein idealer Kunde?</Label>
                    <Textarea rows={3} placeholder="Beschreibe so konkret wie möglich. Bsp: 'Inhaber kleiner Handwerksbetriebe (5-15 Mitarbeiter), 35-55 Jahre, im DACH-Raum, die zu wenig Anfragen haben'" value={data.targetAudience} onChange={(e) => update("targetAudience", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Wo befindet sich die Zielgruppe?</Label>
                    <Input placeholder="z.B. Deutschland, AT, CH oder konkret 'Berlin + Umgebung'" value={data.audienceLocation} onChange={(e) => update("audienceLocation", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Welche Probleme hat die Zielgruppe?</Label>
                    <Textarea rows={3} placeholder="Was raubt deinen Kunden den Schlaf? Welche konkreten Pain-Points lösen wir mit deinem Angebot?" value={data.audienceProblems} onChange={(e) => update("audienceProblems", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Wieviel kann/will die Zielgruppe ausgeben?</Label>
                    <Input placeholder="z.B. 1.500 - 5.000€ einmalig oder 200-500€/Monat" value={data.audienceBudget} onChange={(e) => update("audienceBudget", e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 2 — Offer */}
              {step === 2 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Was ist dein Hauptangebot?</Label>
                    <Textarea rows={3} placeholder="z.B. 'Vollwertige WordPress-Website inkl. SEO + Terminbuchung in 14 Tagen für 2.500€ einmalig'" value={data.mainOffer} onChange={(e) => update("mainOffer", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Preis / Preisrange</Label>
                    <Input placeholder="z.B. 2.500€ einmalig oder ab 199€/Monat" value={data.priceRange} onChange={(e) => update("priceRange", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Was macht dich besonders? (USP)</Label>
                    <Textarea rows={3} placeholder="Warum sollte jemand bei DIR kaufen statt bei der Konkurrenz?" value={data.usp} onChange={(e) => update("usp", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bestehende Case Studies / Referenzen</Label>
                    <Textarea rows={3} placeholder="Hast du Erfolgs-Beispiele die wir in den Ads nutzen können? Stichwortartig reicht." value={data.caseStudies} onChange={(e) => update("caseStudies", e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 3 — Material & Zugänge */}
              {step === 3 && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Google Drive / Dropbox-Link mit Brand-Assets</Label>
                    <Input placeholder="https://drive.google.com/..." value={data.driveLink} onChange={(e) => update("driveLink", e.target.value)} />
                    <p className="text-[10px] text-muted-foreground">Logo, Schriftart, Farben, Bilder, Videos — alles was für Creatives gebraucht wird. Ordner muss freigegeben sein (Editor-Rechte).</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Website / Landing-Page-URL für die Ads</Label>
                    <Input placeholder="z.B. www.deineagentur.de/angebot" value={data.websiteForAds} onChange={(e) => update("websiteForAds", e.target.value)} />
                  </div>
                  <div className="grid gap-2 mt-2">
                    <Label>Hast du schon einen Meta Business Manager?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "yes" as const, label: "Ja, vorhanden" },
                        { value: "no" as const, label: "Nein, brauche Setup-Hilfe" },
                      ].map((opt) => (
                        <button key={opt.value} onClick={() => update("hasMetaBusinessManager", opt.value)}
                          className={`text-left rounded-lg border p-3 transition-all ${data.hasMetaBusinessManager === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                          <span className="text-sm font-medium">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {data.hasMetaBusinessManager === "yes" && (
                    <>
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Wir benötigen Zugang zu deinem Business Manager für die Kampagnen. IDs findest du in den Settings.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Meta Business Manager ID</Label>
                        <Input placeholder="z.B. 123456789012345" value={data.metaBusinessManager} onChange={(e) => update("metaBusinessManager", e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>Ad Account ID</Label>
                          <Input placeholder="act_123..." value={data.adAccountId} onChange={(e) => update("adAccountId", e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Pixel ID</Label>
                          <Input placeholder="123456..." value={data.pixelId} onChange={(e) => update("pixelId", e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                  {data.hasMetaBusinessManager === "no" && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Kein Stress — wir setzen den Meta Business Manager nach dem Kickoff-Call gemeinsam mit dir auf.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="grid gap-2">
                      <Label>Instagram URL</Label>
                      <Input placeholder="https://instagram.com/..." value={data.instagramUrl} onChange={(e) => update("instagramUrl", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Facebook URL</Label>
                      <Input placeholder="https://facebook.com/..." value={data.facebookUrl} onChange={(e) => update("facebookUrl", e.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Sonstiges / Notizen</Label>
                    <Textarea rows={3} placeholder="Anything wir noch wissen sollten?" value={data.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-3">
            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="font-semibold text-sm">Briefing-Übersicht</h3>
                <div className="grid gap-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Firma</span><span className="font-medium truncate ml-2">{data.companyName || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Zielgruppe</span><span className="font-medium truncate ml-2">{data.targetAudience ? "✓" : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Offer</span><span className="font-medium truncate ml-2">{data.mainOffer ? "✓" : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Material</span><span className="font-medium truncate ml-2">{data.driveLink ? "✓" : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">MBM</span><span className="font-medium truncate ml-2">{data.hasMetaBusinessManager === "yes" ? "vorhanden" : data.hasMetaBusinessManager === "no" ? "Setup nötig" : "—"}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">Was passiert dann?</h3>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Du buchst deinen Kickoff-Call</li>
                  <li>Wir gehen das Briefing gemeinsam durch</li>
                  <li>Wir starten Setup + Creatives</li>
                  <li>Live-Schaltung der Kampagne</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Zurück
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600">
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed()} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600">
              Briefing absenden <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

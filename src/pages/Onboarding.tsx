import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Building2, Target, DollarSign, KeyRound, Megaphone, Users, CheckCircle2, Sparkles, FolderOpen, ExternalLink, Handshake } from "lucide-react";
import { addClient as addClientDB } from "@/store/clients";
import { addProject as addProjectDB } from "@/store/projects";
import type { Project } from "@/store/projects";
import { supabase } from "@/lib/supabase";

type OnboardingVariant = "done4you" | "donewithyou" | "";

type OnboardingData = {
  // Step 0 — Variant
  variant: OnboardingVariant;
  // Step 1 — Agentur/Webdesigner
  companyName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  teamSize: string;
  services: string[];
  // Step 2 — Angebot & Positionierung
  mainOffer: string;
  priceRange: string;
  uspChoice: "known" | "unknown" | "";
  usp: string;
  caseStudies: string;
  currentClients: string;
  // Step 3 — Traumkunden
  idealClient: string;
  idealIndustry: string[];
  idealBudget: string;
  clientProblems: string;
  targetAudienceChoice: string;
  // Step 4 — Aktuelle Kundengewinnung
  currentMarketing: string[];
  monthlyLeads: string;
  closingRate: string;
  biggestChallenge: string;
  // Step 5 — Ads & Budget
  adExperience: string;
  monthlyAdBudget: string;
  adGoal: string[];
  targetLeadsPerMonth: string;
  timeline: string;
  // Step 6 — Assets & Material
  driveLink: string;
  existingAds: string;
  // Step 7 — Zugänge
  metaBusinessManager: string;
  adAccountId: string;
  pixelId: string;
  websiteForAds: string;
  additionalNotes: string;
  // Social Links
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
};

const initialData: OnboardingData = {
  variant: "",
  companyName: "", website: "", contactName: "", contactEmail: "", contactPhone: "", teamSize: "", services: [],
  mainOffer: "", priceRange: "", uspChoice: "", usp: "", caseStudies: "", currentClients: "",
  idealClient: "", idealIndustry: [], idealBudget: "", clientProblems: "", targetAudienceChoice: "",
  currentMarketing: [], monthlyLeads: "", closingRate: "", biggestChallenge: "",
  adExperience: "", monthlyAdBudget: "", adGoal: [], targetLeadsPerMonth: "", timeline: "",
  driveLink: "", existingAds: "",
  metaBusinessManager: "", adAccountId: "", pixelId: "", websiteForAds: "", additionalNotes: "",
  instagramUrl: "", facebookUrl: "", tiktokUrl: "", linkedinUrl: "",
};

const serviceOptions = [
  "Website-Design", "Website-Entwicklung", "E-Commerce / Shops", "Landingpages",
  "SEO", "Branding / Logo", "UI/UX Design", "App-Entwicklung",
  "Content-Erstellung", "Wartung & Support", "Hosting",
  "Meta Ads (Facebook/Instagram)", "Google Ads", "TikTok Ads",
  "Social Media Management", "E-Mail Marketing", "Funnel-Building", "GEO",
];

const industryOptions = [
  "Handwerk", "Gastronomie", "Ärzte / Praxen", "Coaches / Berater",
  "Immobilien", "Fitness / Health", "Rechtsanwälte / Steuerberater",
  "E-Commerce", "Startups / Tech", "Lokale Dienstleister", "Alle Branchen",
];

const marketingOptions = [
  "Empfehlungen / Mundpropaganda", "Eigene Website / SEO", "Social Media (organisch)",
  "Meta Ads (Facebook/Instagram)", "Google Ads", "Kaltakquise / Outreach",
  "Netzwerk-Events", "Freelancer-Plattformen", "eBay Kleinanzeigen", "Nichts davon",
];

const steps = [
  { title: "Modell wählen", icon: Handshake, description: "Wie möchtest du mit uns zusammenarbeiten?" },
  { title: "Deine Agentur", icon: Building2, description: "Erzähl uns von deinem Business" },
  { title: "Angebot & USP", icon: Megaphone, description: "Was bietest du an und was macht dich besonders?" },
  { title: "Traumkunden", icon: Target, description: "Welche Kunden willst du gewinnen?" },
  { title: "Aktuelle Situation", icon: Users, description: "Wie gewinnst du bisher Kunden?" },
  { title: "Ads & Budget", icon: DollarSign, description: "Deine Ziele für die Zusammenarbeit" },
  { title: "Material & Assets", icon: FolderOpen, description: "Bilder, Videos und Dateien für die Creatives" },
  { title: "Zugänge", icon: KeyRound, description: "Technisches Setup für deine Ads" },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof OnboardingData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArray = (field: "services" | "idealIndustry" | "currentMarketing", value: string) => {
    setData((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).includes(value)
        ? (prev[field] as string[]).filter((v) => v !== value)
        : [...(prev[field] as string[]), value],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!data.variant;
      case 1: return data.companyName && data.contactName && data.contactEmail && data.contactPhone && data.website && data.teamSize && data.services.length > 0;
      case 2: return data.mainOffer && data.priceRange && data.uspChoice && (data.uspChoice === "unknown" || data.usp) && data.caseStudies && data.currentClients;
      case 3: return data.targetAudienceChoice && data.idealBudget && data.clientProblems && (data.targetAudienceChoice === "together" || data.idealClient);
      case 4: return data.currentMarketing.length > 0 && data.monthlyLeads && data.closingRate && data.biggestChallenge;
      case 5: return data.monthlyAdBudget && data.adGoal.length > 0 && data.adExperience && data.targetLeadsPerMonth;
      case 6: return data.driveLink.startsWith("https://") && data.existingAds;
      case 7: {
        const baseValid = data.additionalNotes !== undefined;
        if (data.variant === "done4you") {
          return data.websiteForAds && data.metaBusinessManager && data.adAccountId && data.pixelId && baseValid;
        }
        // DWY — no Meta Ads fields, no websiteForAds required
        return baseValid;
      }
      default: return true;
    }
  };

  const handleSubmit = async () => {
    // 1. Check if a client with this email already exists
    const normalizedEmail = data.contactEmail.trim().toLowerCase();
    const { data: existing } = await supabase
      .from("clients")
      .select("name, email")
      .ilike("email", normalizedEmail)
      .limit(1);

    const existingClient = existing && existing.length > 0 ? existing[0] : null;
    const clientName = existingClient ? existingClient.name : data.companyName;

    // Only create a new client if none matched the email
    if (!existingClient) {
      await addClientDB({
        name: data.companyName,
        contact: data.contactName,
        email: data.contactEmail,
        phone: data.contactPhone,
        company: data.companyName,
        projects: 1,
        revenue: 0,
        status: "Active" as const,
      });
    }

    // 2. Create project with raw onboarding data in separate field
    const projectType = data.variant === "done4you" ? "done4you" : "donewithyou";
    const newProject: Project = {
      id: `onb-${Date.now()}`,
      client: clientName,
      name: `Meta Ads — ${data.companyName}`,
      product: data.monthlyAdBudget || "TBD",
      type: projectType,
      creativeFormat: "beides",
      startDate: new Date().toLocaleDateString("de-DE"),
      assignees: [],
      phases: [],
      briefing: "",
      meetingNotes: "",
      targetAudience: "",
      offer: "",
      comments: [],
      onboarding: data as unknown as Record<string, unknown>,
    };
    await addProjectDB(newProject as any);

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-32 rounded-full bg-emerald-500/10 animate-ping" />
            </div>
            <div className="relative h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Vielen Dank, {data.contactName}!</h1>
            <p className="text-muted-foreground mt-3 text-base">
              Wir haben alle Infos erhalten und starten direkt mit der Vorbereitung deiner Ad-Kampagne.
            </p>
          </div>
          <Card className="text-left">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm">Zusammenfassung</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Modell</span><span className="font-medium">{data.variant === "done4you" ? "Done 4 You" : "Done With You"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Agentur</span><span className="font-medium">{data.companyName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ziel</span><span className="font-medium">{data.adGoal.join(", ")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ad-Budget</span><span className="font-medium">{data.monthlyAdBudget}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Traumkunden</span><span className="font-medium truncate ml-4">{data.idealClient.slice(0, 50)}{data.idealClient.length > 50 ? "..." : ""}</span></div>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Wir melden uns innerhalb von 24 Stunden bei dir unter <span className="font-medium text-foreground">{data.contactEmail}</span>
            </p>
            <p className="text-xs text-muted-foreground">Du kannst dieses Fenster jetzt schließen.</p>
          </div>
        </div>
      </div>
    );
  }

  const StepIcon = steps[step].icon;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-foreground">Adslift</span>
          <Badge variant="secondary" className="text-xs">Kunden-Onboarding</Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx === step;
              const isDone = idx < step;
              return (
                <div key={idx} className="flex flex-col items-center flex-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    isDone ? "bg-emerald-500 text-white" :
                    isActive ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium text-center hidden sm:block ${isActive ? "text-primary" : "text-muted-foreground"}`}>{s.title}</span>
                </div>
              );
            })}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <StepIcon className="h-5 w-5 text-primary" />
            <span className="text-xs text-primary font-medium uppercase tracking-wider">Schritt {step + 1} von {steps.length}</span>
          </div>
          <h2 className="text-xl font-bold">{steps[step].title}</h2>
          <p className="text-sm text-muted-foreground">{steps[step].description}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Step 0 — Modell wählen (D4Y / DWY) */}
            {step === 0 && (
              <div className="grid gap-4">
                <Label>Welches Modell passt zu dir?</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => update("variant", "done4you")}
                    className={`rounded-xl border-2 p-6 text-center transition-all ${data.variant === "done4you" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}
                  >
                    <div className="text-2xl mb-2">🚀</div>
                    <div className="font-bold text-base">Done 4 You</div>
                    <p className="text-xs text-muted-foreground mt-2">Wir übernehmen alles für dich — Strategie, Creatives, Kampagnen-Management.</p>
                  </button>
                  <button
                    onClick={() => update("variant", "donewithyou")}
                    className={`rounded-xl border-2 p-6 text-center transition-all ${data.variant === "donewithyou" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"}`}
                  >
                    <div className="text-2xl mb-2">🤝</div>
                    <div className="font-bold text-base">Done With You</div>
                    <p className="text-xs text-muted-foreground mt-2">Wir arbeiten zusammen — du bekommst Coaching, Templates und unsere Unterstützung.</p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 1 — Deine Agentur */}
            {step === 1 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Name deiner Agentur / Firma</Label>
                  <Input placeholder="z.B. Pixel Perfect Webdesign" value={data.companyName} onChange={(e) => update("companyName", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Deine Website</Label>
                    <Input placeholder="www.deineagentur.de" value={data.website} onChange={(e) => update("website", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Teamgröße</Label>
                    <Select value={data.teamSize} onValueChange={(v) => update("teamSize", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Solo / Freelancer</SelectItem>
                        <SelectItem value="2-5">2-5 Personen</SelectItem>
                        <SelectItem value="6-15">6-15 Personen</SelectItem>
                        <SelectItem value="15+">15+ Personen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Ansprechpartner</Label>
                  <Input placeholder="Vor- und Nachname" value={data.contactName} onChange={(e) => update("contactName", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>E-Mail</Label>
                    <Input type="email" placeholder="name@agentur.de" value={data.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefon</Label>
                    <Input placeholder="+49 170 ..." value={data.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Welche Services bietest du an?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {serviceOptions.map((svc) => (
                      <button key={svc} onClick={() => toggleArray("services", svc)}
                        className={`text-left rounded-lg border p-2.5 transition-all ${data.services.includes(svc) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div className="flex items-center gap-2"><Checkbox checked={data.services.includes(svc)} /><span className="text-sm">{svc}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Angebot & USP */}
            {step === 2 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Was ist dein Hauptangebot?</Label>
                  <Textarea rows={3} placeholder="z.B. Professionelle Websites für Handwerker in 14 Tagen — WordPress, SEO-optimiert, mit Terminbuchung." value={data.mainOffer} onChange={(e) => update("mainOffer", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">Beschreibe dein Kernangebot so, wie du es einem potenziellen Kunden erklären würdest.</p>
                </div>
                <div className="grid gap-2">
                  <Label>Preisrange deiner Website-Projekte</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["500 - 1.500€", "1.500 - 3.000€", "3.000 - 5.000€", "5.000 - 10.000€", "10.000€+", "Individuell"].map((p) => (
                      <button key={p} onClick={() => update("priceRange", p)}
                        className={`rounded-lg border p-3 text-center transition-all ${data.priceRange === p ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <span className="text-sm font-medium">{p}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Was macht dich besonders? (USP)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "known" as const, label: "Ich kenne meinen USP" },
                      { value: "unknown" as const, label: "Ich habe noch keinen USP" },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => { update("uspChoice", opt.value); if (opt.value === "unknown") update("usp", ""); }}
                        className={`text-left rounded-lg border p-3 transition-all ${data.uspChoice === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {data.uspChoice === "known" && (
                    <Textarea rows={3} placeholder="Warum sollte jemand DICH buchen und nicht die Konkurrenz? (z.B. Branchenfokus, Schnelligkeit, Design-Stil, Garantie...)" value={data.usp} onChange={(e) => update("usp", e.target.value)} className="mt-2" />
                  )}
                  {data.uspChoice === "unknown" && (
                    <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">Wir arbeiten deinen USP gemeinsam heraus</p>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Hast du Case Studies / Referenzen?</Label>
                  <Textarea rows={2} placeholder="Links zu fertigen Projekten, Testimonials, Vorher/Nachher..." value={data.caseStudies} onChange={(e) => update("caseStudies", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Wie viele Kunden hast du aktuell ca.?</Label>
                  <Select value={data.currentClients} onValueChange={(v) => update("currentClients", v)}>
                    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-5">0-5 Kunden</SelectItem>
                      <SelectItem value="5-15">5-15 Kunden</SelectItem>
                      <SelectItem value="15-30">15-30 Kunden</SelectItem>
                      <SelectItem value="30+">30+ Kunden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3 — Traumkunden */}
            {step === 3 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Beschreibe deinen Traumkunden</Label>
                  <Textarea rows={4} placeholder="Wer ist dein idealer Kunde? (z.B. Handwerker mit 5-20 Mitarbeitern, die keine Website haben oder eine veraltete, und bereit sind 3-5k zu investieren)" value={data.idealClient} onChange={(e) => update("idealClient", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Zielgruppe</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "existing", label: "Ich habe bereits eine Zielgruppe" },
                      { value: "together", label: "Wir müssen gemeinsam eine Zielgruppe auswählen" },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => update("targetAudienceChoice", opt.value)}
                        className={`text-left rounded-lg border p-3 transition-all ${data.targetAudienceChoice === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {data.targetAudienceChoice === "existing" && (
                    <Textarea rows={3} placeholder="Beschreibe deine Zielgruppe (z.B. Handwerker, 25-55 Jahre, Umkreis 50km, Umsatz 500k+)" value={data.idealClient} onChange={(e) => update("idealClient", e.target.value)} className="mt-2" />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Budget deiner Traumkunden</Label>
                  <Select value={data.idealBudget} onValueChange={(v) => update("idealBudget", v)}>
                    <SelectTrigger><SelectValue placeholder="Was geben deine Wunschkunden für eine Website aus?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500-1500">500 - 1.500€</SelectItem>
                      <SelectItem value="1500-3000">1.500 - 3.000€</SelectItem>
                      <SelectItem value="3000-5000">3.000 - 5.000€</SelectItem>
                      <SelectItem value="5000+">5.000€+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Welche Probleme haben deine Kunden typischerweise?</Label>
                  <Textarea rows={3} placeholder="z.B. Keine Online-Präsenz, veraltete Website, keine Anfragen über die Website, nicht auf Google sichtbar..." value={data.clientProblems} onChange={(e) => update("clientProblems", e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 4 — Aktuelle Kundengewinnung */}
            {step === 4 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Wie gewinnst du aktuell Kunden?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {marketingOptions.map((opt) => (
                      <button key={opt} onClick={() => toggleArray("currentMarketing", opt)}
                        className={`text-left rounded-lg border p-2.5 transition-all ${data.currentMarketing.includes(opt) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div className="flex items-center gap-2"><Checkbox checked={data.currentMarketing.includes(opt)} /><span className="text-sm">{opt}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Wie viele Anfragen bekommst du pro Monat?</Label>
                    <Select value={data.monthlyLeads} onValueChange={(v) => update("monthlyLeads", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-2">0-2 Anfragen</SelectItem>
                        <SelectItem value="3-5">3-5 Anfragen</SelectItem>
                        <SelectItem value="5-10">5-10 Anfragen</SelectItem>
                        <SelectItem value="10+">10+ Anfragen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Wie viele davon werden zu Kunden?</Label>
                    <Select value={data.closingRate} onValueChange={(v) => update("closingRate", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unter20">Unter 20%</SelectItem>
                        <SelectItem value="20-40">20-40%</SelectItem>
                        <SelectItem value="40-60">40-60%</SelectItem>
                        <SelectItem value="60+">Über 60%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Was ist deine größte Herausforderung bei der Kundengewinnung?</Label>
                  <Textarea rows={3} placeholder="z.B. Zu wenig Anfragen, falsche Zielgruppe, zu niedrige Budgets, keine Zeit für Marketing..." value={data.biggestChallenge} onChange={(e) => update("biggestChallenge", e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 5 — Ads & Budget */}
            {step === 5 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Hast du schon mal Ads geschaltet?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Nein, noch nie", "Ja, aber ohne Erfolg", "Ja, mit Erfahrung"].map((opt) => (
                      <button key={opt} onClick={() => update("adExperience", opt)}
                        className={`rounded-lg border p-3 text-center text-sm transition-all ${data.adExperience === opt ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Was ist dein Ziel? (Mehrfachauswahl möglich)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Mehr Anfragen / Leads", "Mehr Sichtbarkeit / Brand Awareness", "Erstgespräche buchen lassen", "Direkt Projekte verkaufen"].map((goal) => (
                      <button key={goal} onClick={() => toggleArray("adGoal", goal)}
                        className={`text-left rounded-lg border p-3 transition-all ${data.adGoal.includes(goal) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div className="flex items-center gap-2"><Checkbox checked={data.adGoal.includes(goal)} /><span className="text-sm">{goal}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Monatliches Ad-Budget</Label>
                    <Select value={data.monthlyAdBudget} onValueChange={(v) => update("monthlyAdBudget", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500-1000€">500 - 1.000€</SelectItem>
                        <SelectItem value="1000-2000€">1.000 - 2.000€</SelectItem>
                        <SelectItem value="2000-3000€">2.000 - 3.000€</SelectItem>
                        <SelectItem value="3000-5000€">3.000 - 5.000€</SelectItem>
                        <SelectItem value="5000€+">5.000€+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Ziel: Anfragen pro Monat</Label>
                    <Select value={data.targetLeadsPerMonth} onValueChange={(v) => update("targetLeadsPerMonth", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5-10">5-10 Anfragen</SelectItem>
                        <SelectItem value="10-20">10-20 Anfragen</SelectItem>
                        <SelectItem value="20-50">20-50 Anfragen</SelectItem>
                        <SelectItem value="50+">50+ Anfragen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6 — Material & Assets */}
            {step === 6 && (
              <div className="grid gap-4">
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Warum brauchen wir deine Dateien?</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Wir nutzen deine Bilder, Videos und Logos um professionelle Ad-Creatives für deine Kampagnen zu erstellen.
                        Dazu gehören Facebook & Instagram Anzeigen, Stories, Reels und mehr. Je mehr Material du bereitstellst,
                        desto besser können wir deine Marke in den Ads repräsentieren.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Google Drive / Dropbox Link</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://drive.google.com/drive/folders/..."
                      value={data.driveLink}
                      onChange={(e) => update("driveLink", e.target.value)}
                      className={`flex-1 ${data.driveLink && !data.driveLink.startsWith("https://") ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    {data.driveLink && (
                      <a href={data.driveLink} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <Button variant="outline" size="icon" type="button">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                  {data.driveLink && !data.driveLink.startsWith("https://") && (
                    <p className="text-[10px] text-red-500">Bitte gib einen gültigen Link ein (muss mit https:// beginnen)</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Erstelle einen Google Drive oder Dropbox Ordner mit deinen Dateien und teile den Link mit uns.
                    Stelle sicher, dass wir Zugriff haben (Link-Freigabe auf "Jeder mit dem Link").
                  </p>
                </div>

                <div className="rounded-lg border border-dashed p-4 space-y-2">
                  <p className="text-sm font-medium">Was sollte im Ordner sein?</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">1.</span> Logo (als PNG mit transparentem Hintergrund wenn möglich)</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">2.</span> Fotos von dir / deinem Team (für Vertrauen in den Ads)</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">3.</span> Screenshots von Kundenprojekten / Referenzen</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">4.</span> Vorhandene Videos (Testimonials, Behind the Scenes, etc.)</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">5.</span> Brand Guidelines / Farbcodes (falls vorhanden)</li>
                  </ul>
                </div>

                <div className="grid gap-2">
                  <Label>Hast du schon mal Ads geschaltet? Wenn ja, was hat funktioniert?</Label>
                  <Textarea
                    rows={3}
                    placeholder="z.B. Instagram Story Ads haben gut funktioniert, Carousel Ads weniger..."
                    value={data.existingAds}
                    onChange={(e) => update("existingAds", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 7 — Zugänge */}
            {step === 7 && (
              <div className="grid gap-4">
                {/* Meta Ads access — only for D4Y */}
                {data.variant === "done4you" && (
                  <>
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Als Done 4 You Kunde benötigen wir Zugang zu deinen Meta Ads Accounts.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Meta Business Manager ID</Label>
                      <Input placeholder="z.B. 123456789012345" value={data.metaBusinessManager} onChange={(e) => update("metaBusinessManager", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Ad Account ID</Label>
                        <Input placeholder="act_123456789" value={data.adAccountId} onChange={(e) => update("adAccountId", e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Pixel ID</Label>
                        <Input placeholder="123456789012345" value={data.pixelId} onChange={(e) => update("pixelId", e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                {data.variant === "done4you" && (
                  <div className="grid gap-2">
                    <Label>Auf welche Website sollen die Ads verlinken?</Label>
                    <Input placeholder="z.B. www.deineagentur.de/angebot" value={data.websiteForAds} onChange={(e) => update("websiteForAds", e.target.value)} />
                  </div>
                )}

                {/* Social Media Links — both variants */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Deine Social Media Profile helfen uns, deine Marke besser zu verstehen.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Instagram URL</Label>
                    <Input placeholder="https://instagram.com/..." value={data.instagramUrl} onChange={(e) => update("instagramUrl", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Facebook URL</Label>
                    <Input placeholder="https://facebook.com/..." value={data.facebookUrl} onChange={(e) => update("facebookUrl", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>TikTok URL</Label>
                    <Input placeholder="https://tiktok.com/@..." value={data.tiktokUrl} onChange={(e) => update("tiktokUrl", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>LinkedIn URL</Label>
                    <Input placeholder="https://linkedin.com/company/..." value={data.linkedinUrl} onChange={(e) => update("linkedinUrl", e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Noch etwas das wir wissen sollten?</Label>
                  <Textarea rows={4} placeholder="Besondere Wünsche, Erfahrungen, Bedenken — alles was dir wichtig ist..." value={data.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />Zurück
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="gap-1.5">
              Weiter<ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed()} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600">
              <Sparkles className="h-4 w-4" />Onboarding abschließen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

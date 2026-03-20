import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Building2, Target, DollarSign, KeyRound, Megaphone, Users, CheckCircle2, Sparkles, FolderOpen, ExternalLink } from "lucide-react";
import { setClients } from "@/store/clients";
import { setProjects } from "@/store/projects";
import type { Project } from "@/store/projects";

type OnboardingData = {
  // Step 1 — Unternehmen
  companyName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  teamSize: string;
  specialization: string[];
  // Step 2 — Angebot & Positionierung
  mainOffer: string;
  targetRevenue: string;
  usp: string;
  certifications: string;
  currentClients: string;
  avgClientValue: string;
  // Step 3 — Traumkunden
  idealClient: string;
  idealAge: string;
  idealIncome: string;
  idealSituation: string[];
  clientProblems: string;
  // Step 4 — Aktuelle Kundengewinnung
  currentMarketing: string[];
  monthlyLeads: string;
  closingRate: string;
  biggestChallenge: string;
  // Step 5 — Ads & Budget
  adExperience: string;
  monthlyAdBudget: string;
  adGoal: string;
  targetLeadsPerMonth: string;
  timeline: string;
  // Step 6 — Assets & Material
  driveLink: string;
  existingContent: string;
  // Step 7 — Zugänge
  metaBusinessManager: string;
  adAccountId: string;
  pixelId: string;
  websiteForAds: string;
  additionalNotes: string;
};

const initialData: OnboardingData = {
  companyName: "", website: "", contactName: "", contactEmail: "", contactPhone: "", teamSize: "", specialization: [],
  mainOffer: "", targetRevenue: "", usp: "", certifications: "", currentClients: "", avgClientValue: "",
  idealClient: "", idealAge: "", idealIncome: "", idealSituation: [], clientProblems: "",
  currentMarketing: [], monthlyLeads: "", closingRate: "", biggestChallenge: "",
  adExperience: "", monthlyAdBudget: "", adGoal: "", targetLeadsPerMonth: "", timeline: "",
  driveLink: "", existingContent: "",
  metaBusinessManager: "", adAccountId: "", pixelId: "", websiteForAds: "", additionalNotes: "",
};

const specializationOptions = [
  "Altersvorsorge", "Vermögensaufbau", "Immobilienfinanzierung", "Versicherungen",
  "Kapitalanlagen", "Steueroptimierung", "Ruhestandsplanung", "Unternehmensberatung",
  "Erbschaftsplanung", "Private Krankenversicherung", "Berufsunfähigkeit", "Sachversicherungen",
];

const situationOptions = [
  "Berufseinsteiger (25-35)", "Familiengründung", "Immobilienkauf", "Gutverdiener (80k+)",
  "Selbstständige / Unternehmer", "Kurz vor der Rente", "Erben / Vermögende",
  "Unsicher über Finanzen", "Wechselwillige (bestehender Berater)",
];

const marketingOptions = [
  "Empfehlungen / Mundpropaganda", "Eigene Website / SEO", "Social Media (organisch)",
  "Meta Ads (Facebook/Instagram)", "Google Ads", "LinkedIn", "Seminare / Vorträge",
  "Kooperationen (Steuerberater, Makler)", "Kaltakquise", "Nichts davon",
];

const steps = [
  { title: "Unternehmen", icon: Building2, description: "Erzähl uns von deinem Finanzberatungs-Business" },
  { title: "Angebot & USP", icon: Megaphone, description: "Was bietest du an und was macht dich besonders?" },
  { title: "Traumkunden", icon: Target, description: "Welche Kunden willst du gewinnen?" },
  { title: "Aktuelle Situation", icon: Users, description: "Wie gewinnst du bisher Kunden?" },
  { title: "Ads & Budget", icon: DollarSign, description: "Deine Ziele für die Zusammenarbeit" },
  { title: "Material & Assets", icon: FolderOpen, description: "Bilder, Videos und Dateien für die Creatives" },
  { title: "Zugänge", icon: KeyRound, description: "Technisches Setup für deine Ads" },
];

export default function OnboardingFinanzberater() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof OnboardingData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArray = (field: "specialization" | "idealSituation" | "currentMarketing", value: string) => {
    setData((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).includes(value)
        ? (prev[field] as string[]).filter((v) => v !== value)
        : [...(prev[field] as string[]), value],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return data.companyName && data.contactName && data.contactEmail;
      case 1: return data.mainOffer;
      case 2: return data.idealClient;
      case 3: return data.currentMarketing.length > 0;
      case 4: return data.monthlyAdBudget && data.adGoal;
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  };

  const handleSubmit = () => {
    // 1. Create client
    setClients((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: data.companyName,
        contact: data.contactName,
        email: data.contactEmail,
        phone: data.contactPhone,
        company: data.companyName,
        projects: 1,
        revenue: 0,
        status: "Active" as const,
      },
    ]);

    // 2. Create project
    const newProject: Project = {
      id: `onb-fb-${Date.now()}`,
      client: data.companyName,
      name: `Meta Ads — ${data.companyName}`,
      product: data.monthlyAdBudget || "TBD",
      type: "neukunde",
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
    setProjects((prev) => [newProject, ...prev]);
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
              Wir haben alle Infos erhalten und starten direkt mit der Vorbereitung deiner Ad-Kampagne für dein Finanzberatungs-Business.
            </p>
          </div>
          <Card className="text-left">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-sm">Zusammenfassung</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Unternehmen</span><span className="font-medium">{data.companyName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ziel</span><span className="font-medium">{data.adGoal}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ad-Budget</span><span className="font-medium">{data.monthlyAdBudget}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Spezialisierung</span><span className="font-medium truncate ml-4">{data.specialization.slice(0, 3).join(", ")}</span></div>
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
          <Badge variant="secondary" className="text-xs">Onboarding — Finanzberater</Badge>
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
            {/* Step 1 — Unternehmen */}
            {step === 0 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Name deines Unternehmens / Kanzlei *</Label>
                  <Input placeholder="z.B. Mustermann Finanzberatung" value={data.companyName} onChange={(e) => update("companyName", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Website</Label>
                    <Input placeholder="www.deine-beratung.de" value={data.website} onChange={(e) => update("website", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Teamgröße</Label>
                    <Select value={data.teamSize} onValueChange={(v) => update("teamSize", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Einzelberater</SelectItem>
                        <SelectItem value="2-5">2-5 Berater</SelectItem>
                        <SelectItem value="6-15">6-15 Mitarbeiter</SelectItem>
                        <SelectItem value="15+">15+ Mitarbeiter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Ansprechpartner *</Label>
                  <Input placeholder="Vor- und Nachname" value={data.contactName} onChange={(e) => update("contactName", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>E-Mail *</Label>
                    <Input type="email" placeholder="name@beratung.de" value={data.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefon</Label>
                    <Input placeholder="+49 170 ..." value={data.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>In welchen Bereichen berätst du?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {specializationOptions.map((spec) => (
                      <button key={spec} onClick={() => toggleArray("specialization", spec)}
                        className={`text-left rounded-lg border p-2.5 transition-all ${data.specialization.includes(spec) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div className="flex items-center gap-2"><Checkbox checked={data.specialization.includes(spec)} /><span className="text-sm">{spec}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Angebot & USP */}
            {step === 1 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Was ist dein Hauptangebot? *</Label>
                  <Textarea rows={3} placeholder="z.B. Ganzheitliche Finanzplanung für junge Familien — von der Absicherung bis zum Vermögensaufbau. Erstberatung kostenlos." value={data.mainOffer} onChange={(e) => update("mainOffer", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Durchschnittlicher Kundenwert (jährlich)</Label>
                    <Select value={data.avgClientValue} onValueChange={(v) => update("avgClientValue", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500-1500">500 - 1.500€</SelectItem>
                        <SelectItem value="1500-3000">1.500 - 3.000€</SelectItem>
                        <SelectItem value="3000-5000">3.000 - 5.000€</SelectItem>
                        <SelectItem value="5000+">5.000€+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Anzahl aktuelle Kunden</Label>
                    <Select value={data.currentClients} onValueChange={(v) => update("currentClients", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-50">0-50</SelectItem>
                        <SelectItem value="50-150">50-150</SelectItem>
                        <SelectItem value="150-300">150-300</SelectItem>
                        <SelectItem value="300+">300+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Was macht dich besonders? (USP)</Label>
                  <Textarea rows={3} placeholder="Warum sollten Kunden zu DIR kommen? (z.B. Spezialisierung, Erfahrung, Auszeichnungen, Methode...)" value={data.usp} onChange={(e) => update("usp", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Zertifizierungen / Qualifikationen</Label>
                  <Input placeholder="z.B. CFP, IHK-Fachberater, §34f, §34d..." value={data.certifications} onChange={(e) => update("certifications", e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 3 — Traumkunden */}
            {step === 2 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Beschreibe deinen Traumkunden *</Label>
                  <Textarea rows={4} placeholder="Wer ist dein idealer Mandant? (z.B. Gutverdiener 35-50 mit Familie, die endlich ihre Finanzen in den Griff bekommen wollen)" value={data.idealClient} onChange={(e) => update("idealClient", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>In welcher Lebenssituation befindet sich dein Traumkunde?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {situationOptions.map((sit) => (
                      <button key={sit} onClick={() => toggleArray("idealSituation", sit)}
                        className={`text-left rounded-lg border p-2.5 transition-all ${data.idealSituation.includes(sit) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <div className="flex items-center gap-2"><Checkbox checked={data.idealSituation.includes(sit)} /><span className="text-sm">{sit}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Alter der Zielgruppe</Label>
                    <Input placeholder="z.B. 30-55 Jahre" value={data.idealAge} onChange={(e) => update("idealAge", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Einkommenslevel</Label>
                    <Select value={data.idealIncome} onValueChange={(v) => update("idealIncome", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40-60k">40.000 - 60.000€</SelectItem>
                        <SelectItem value="60-80k">60.000 - 80.000€</SelectItem>
                        <SelectItem value="80-120k">80.000 - 120.000€</SelectItem>
                        <SelectItem value="120k+">120.000€+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Welche Probleme hat dein Traumkunde?</Label>
                  <Textarea rows={3} placeholder="z.B. Keine Übersicht über Finanzen, Angst vor Altersarmut, zu viele Versicherungen, falsch beraten worden..." value={data.clientProblems} onChange={(e) => update("clientProblems", e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 4 — Aktuelle Kundengewinnung */}
            {step === 3 && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Wie gewinnst du aktuell Kunden? *</Label>
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
                    <Label>Anfragen pro Monat</Label>
                    <Select value={data.monthlyLeads} onValueChange={(v) => update("monthlyLeads", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-5">0-5</SelectItem>
                        <SelectItem value="5-15">5-15</SelectItem>
                        <SelectItem value="15-30">15-30</SelectItem>
                        <SelectItem value="30+">30+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Abschlussquote</Label>
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
                  <Label>Größte Herausforderung bei der Kundengewinnung?</Label>
                  <Textarea rows={3} placeholder="z.B. Zu wenig Anfragen, falsche Zielgruppe, Vertrauen aufbauen, zu viel Konkurrenz..." value={data.biggestChallenge} onChange={(e) => update("biggestChallenge", e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 5 — Ads & Budget */}
            {step === 4 && (
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
                  <Label>Was ist dein Ziel? *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Mehr Erstgespräche buchen", "Mehr Sichtbarkeit / Vertrauen", "Bestandskunden reaktivieren", "Neue Zielgruppe erschließen"].map((goal) => (
                      <button key={goal} onClick={() => update("adGoal", goal)}
                        className={`text-left rounded-lg border p-3 transition-all ${data.adGoal === goal ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                        <span className="text-sm">{goal}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Monatliches Ad-Budget *</Label>
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
                    <Label>Ziel: Erstgespräche pro Monat</Label>
                    <Select value={data.targetLeadsPerMonth} onValueChange={(v) => update("targetLeadsPerMonth", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5-10">5-10</SelectItem>
                        <SelectItem value="10-20">10-20</SelectItem>
                        <SelectItem value="20-40">20-40</SelectItem>
                        <SelectItem value="40+">40+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Wann willst du starten?</Label>
                  <Select value={data.timeline} onValueChange={(v) => update("timeline", v)}>
                    <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sofort">Sofort / ASAP</SelectItem>
                      <SelectItem value="1-2wochen">In 1-2 Wochen</SelectItem>
                      <SelectItem value="1monat">In ca. 1 Monat</SelectItem>
                      <SelectItem value="offen">Noch offen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 6 — Material & Assets */}
            {step === 5 && (
              <div className="grid gap-4">
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Warum brauchen wir deine Dateien?</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Wir erstellen professionelle Ad-Creatives für deine Kampagnen — Facebook & Instagram Anzeigen, Stories und Reels.
                        Dein Auftreten als vertrauenswürdiger Finanzberater ist dabei entscheidend.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Google Drive / Dropbox Link</Label>
                  <div className="flex gap-2">
                    <Input placeholder="https://drive.google.com/drive/folders/..." value={data.driveLink} onChange={(e) => update("driveLink", e.target.value)} className="flex-1" />
                    {data.driveLink && (
                      <a href={data.driveLink} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon" type="button"><ExternalLink className="h-4 w-4" /></Button></a>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Erstelle einen Ordner mit deinen Dateien und teile den Link.</p>
                </div>
                <div className="rounded-lg border border-dashed p-4 space-y-2">
                  <p className="text-sm font-medium">Was sollte im Ordner sein?</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">1.</span> Professionelles Foto von dir (seriös, vertrauenswürdig)</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">2.</span> Logo deiner Kanzlei / Firma</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">3.</span> Kundenstimmen / Testimonials (Text oder Video)</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">4.</span> Zertifikate / Auszeichnungen (als Bild)</li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">5.</span> Vorhandene Videos (Vorträge, Erklärvideos, etc.)</li>
                  </ul>
                </div>
                <div className="grid gap-2">
                  <Label>Hast du schon Content erstellt?</Label>
                  <Textarea rows={3} placeholder="z.B. YouTube-Videos, Blog-Artikel, LinkedIn Posts, Webinare..." value={data.existingContent} onChange={(e) => update("existingContent", e.target.value)} />
                </div>
              </div>
            )}

            {/* Step 7 — Zugänge */}
            {step === 6 && (
              <div className="grid gap-4">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Falls du die IDs nicht zur Hand hast — kein Problem. Wir helfen dir im Kick-off Call dabei.
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
                <div className="grid gap-2">
                  <Label>Auf welche Seite sollen die Ads verlinken?</Label>
                  <Input placeholder="z.B. www.deine-beratung.de/erstgespraech" value={data.websiteForAds} onChange={(e) => update("websiteForAds", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Noch etwas das wir wissen sollten?</Label>
                  <Textarea rows={4} placeholder="Besondere Wünsche, Compliance-Anforderungen, BaFin-Regularien..." value={data.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)} />
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
            <Button onClick={handleSubmit} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600">
              <Sparkles className="h-4 w-4" />Onboarding abschließen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

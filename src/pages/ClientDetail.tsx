import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Building2, Mail, Phone, Calendar, FileText, GraduationCap,
  Briefcase, CheckSquare, DollarSign, MessageSquare, Loader2, ClipboardList,
} from "lucide-react";
import { useClients } from "@/store/clients";
import { CustomerAcademyOverview } from "@/components/CustomerAcademyOverview";

const fmtEUR = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString("de-DE") : "—";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [clients] = useClients();
  const client = clients.find((c) => c.id === id);

  const [pipelineProjects, setPipelineProjects] = useState<any[]>([]);
  const [legacyProjects, setLegacyProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [pp, lp, t, d, e, co] = await Promise.all([
        supabase.from("pipeline_projects").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("deals").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("calendar_events").select("*").eq("client_id", id).order("date_iso", { ascending: false }).limit(50),
        supabase.from("client_comments").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);
      setPipelineProjects(pp.data ?? []);
      setLegacyProjects(lp.data ?? []);
      setTasks(t.data ?? []);
      setDeals(d.data ?? []);
      setEvents(e.data ?? []);
      setComments(co.data ?? []);
      setLoading(false);
    })();
  }, [id]);

  const stats = useMemo(() => ({
    projects: pipelineProjects.length + legacyProjects.length,
    tasks: tasks.length,
    openTasks: tasks.filter((t) => t.status !== "done" && t.status !== "completed").length,
    deals: deals.length,
    dealsValue: deals.reduce((s, d) => s + (Number(d.value) || Number(d.amount) || 0), 0),
    events: events.length,
  }), [pipelineProjects, legacyProjects, tasks, deals, events]);

  if (!client) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/clients")} className="gap-1.5 mb-4">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>
        <Card><CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Kunde nicht gefunden</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/clients")} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Zurück zu Kunden
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-primary">{client.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
              {client.company && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{client.company}</span>}
              {client.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
              {client.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
            </div>
          </div>
        </div>
        <Badge variant={client.status === "Active" ? "default" : "secondary"}>{client.status}</Badge>
      </div>

      {/* KPI-Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Briefcase} label="Projekte" value={stats.projects} />
        <KpiCard icon={CheckSquare} label="Tasks (offen)" value={`${stats.openTasks} / ${stats.tasks}`} />
        <KpiCard icon={DollarSign} label="Deals" value={`${stats.deals}`} sub={fmtEUR(stats.dealsValue)} />
        <KpiCard icon={Calendar} label="Events" value={stats.events} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5"><FileText className="h-4 w-4" />Übersicht</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5"><ClipboardList className="h-4 w-4" />Onboarding</TabsTrigger>
          <TabsTrigger value="academy" className="gap-1.5"><GraduationCap className="h-4 w-4" />Academy</TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5"><Briefcase className="h-4 w-4" />Projekte ({stats.projects})</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5"><CheckSquare className="h-4 w-4" />Tasks ({stats.tasks})</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5"><DollarSign className="h-4 w-4" />Deals ({stats.deals})</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><Calendar className="h-4 w-4" />Kalender ({stats.events})</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5"><MessageSquare className="h-4 w-4" />Notizen ({comments.length})</TabsTrigger>
        </TabsList>

        {loading && (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade ...
          </div>
        )}

        <TabsContent value="overview" className="space-y-4 mt-4">
          <CustomerAcademyOverview clientId={client.id} clientEmail={client.email} clientName={client.name} />
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider">Vertrag & Stammdaten</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Field label="Status" value={client.status} />
                <Field label="Umsatz" value={fmtEUR(client.revenue)} />
                <Field label="Projekte (legacy)" value={String(client.projects)} />
                <Field label="Vertrag Start" value={fmtDate(client.contract_start)} />
                <Field label="Vertrag Ende" value={fmtDate(client.contract_end)} />
                {client.drive_link && (
                  <Field label="Drive" value={<a href={client.drive_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">Öffnen</a>} />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academy" className="space-y-4 mt-4">
          <CustomerAcademyOverview clientId={client.id} clientEmail={client.email} clientName={client.name} />
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4 mt-4">
          <OnboardingDetails projects={legacyProjects} />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4 mt-4">
          <Section
            title="Pipeline-Projekte"
            empty="Keine Pipeline-Projekte"
            items={pipelineProjects}
            render={(p) => (
              <RowCard key={p.id} onClick={() => navigate(`/pipeline?project=${p.id}`)}>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">Status: {p.status} · {fmtDate(p.start_date)}</div>
              </RowCard>
            )}
          />
          <Section
            title="Legacy-Projekte"
            empty="Keine Legacy-Projekte"
            items={legacyProjects}
            render={(p) => (
              <RowCard key={p.id}>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.type} · {p.start_date}</div>
              </RowCard>
            )}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-2 mt-4">
          {tasks.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keine Tasks für diesen Kunden.</CardContent></Card>
          ) : tasks.map((t) => (
            <RowCard key={t.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{t.title}</div>
                <Badge variant={t.status === "done" ? "default" : "secondary"} className="text-[10px]">{t.status}</Badge>
              </div>
              {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
            </RowCard>
          ))}
        </TabsContent>

        <TabsContent value="deals" className="space-y-2 mt-4">
          {deals.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keine Deals.</CardContent></Card>
          ) : deals.map((d) => (
            <RowCard key={d.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{d.product || d.title || "Deal"}</div>
                <span className="text-sm font-mono">{fmtEUR(Number(d.value) || Number(d.amount) || 0)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{d.status || d.stage || "—"}</div>
            </RowCard>
          ))}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-2 mt-4">
          {events.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keine Kalender-Events.</CardContent></Card>
          ) : events.map((e) => (
            <RowCard key={e.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{e.title}</div>
                <span className="text-xs text-muted-foreground">{fmtDate(e.date_iso)}</span>
              </div>
              {e.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.notes}</div>}
            </RowCard>
          ))}
        </TabsContent>

        <TabsContent value="notes" className="space-y-2 mt-4">
          {comments.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keine Notizen.</CardContent></Card>
          ) : comments.map((c) => (
            <RowCard key={c.id}>
              <div className="text-xs text-muted-foreground">{c.author} · {fmtDate(c.created_at)}</div>
              <div className="text-sm whitespace-pre-wrap mt-1">{c.text}</div>
            </RowCard>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight">{value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Section<T>({ title, empty, items, render }: { title: string; empty: string; items: T[]; render: (item: T) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground text-center">{empty}</CardContent></Card>
      ) : (
        <div className="space-y-2">{items.map(render)}</div>
      )}
    </div>
  );
}

function RowCard({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Card className={onClick ? "cursor-pointer hover:border-primary/30 transition-all" : ""}>
      <CardContent className="p-3" onClick={onClick}>{children}</CardContent>
    </Card>
  );
}

export function OnboardingDetails({ projects }: { projects: any[] }) {
  // Find the most recent project that has onboarding data
  const projectWithOnboarding = projects.find((p) => p.onboarding && Object.keys(p.onboarding).length > 0);
  const data = projectWithOnboarding?.onboarding;

  if (!data) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        Kunde hat den Onboarding-Bogen noch nicht ausgefüllt.
      </CardContent></Card>
    );
  }

  const sections: { title: string; fields: { label: string; value: any }[] }[] = [
    {
      title: "Basisdaten",
      fields: [
        { label: "Modell", value: data.variant === "done4you" ? "Done 4 You" : data.variant === "donewithyou" ? "Done With You" : "—" },
        { label: "Firma", value: data.companyName },
        { label: "Website", value: data.website },
        { label: "Ansprechpartner", value: data.contactName },
        { label: "E-Mail", value: data.contactEmail },
        { label: "Telefon", value: data.contactPhone },
        { label: "Teamgröße", value: data.teamSize },
        { label: "Services", value: Array.isArray(data.services) ? data.services.join(", ") : "—" },
      ],
    },
    {
      title: "Angebot & Positionierung",
      fields: [
        { label: "Hauptangebot", value: data.mainOffer },
        { label: "Preisrange", value: data.priceRange },
        { label: "USP", value: data.uspChoice === "known" ? data.usp : "Wird gemeinsam erarbeitet" },
        { label: "Case Studies", value: data.caseStudies },
        { label: "Aktuelle Kunden", value: data.currentClients },
      ],
    },
    {
      title: "Traumkunden",
      fields: [
        { label: "Zielgruppen-Wahl", value: data.targetAudienceChoice === "existing" ? "Hat eigene Zielgruppe" : data.targetAudienceChoice === "together" ? "Wird gemeinsam erarbeitet" : "—" },
        { label: "Idealer Kunde", value: data.idealClient },
        { label: "Kundenbudget", value: data.idealBudget },
        { label: "Kundenprobleme", value: data.clientProblems },
      ],
    },
    {
      title: "Aktuelle Situation",
      fields: [
        { label: "Marketing-Kanäle", value: Array.isArray(data.currentMarketing) ? data.currentMarketing.join(", ") : "—" },
        { label: "Anfragen / Monat", value: data.monthlyLeads },
        { label: "Closing-Rate", value: data.closingRate },
        { label: "Größte Herausforderung", value: data.biggestChallenge },
      ],
    },
    {
      title: "Ads & Budget",
      fields: [
        { label: "Ad-Erfahrung", value: data.adExperience },
        { label: "Ziele", value: Array.isArray(data.adGoal) ? data.adGoal.join(", ") : "—" },
        { label: "Monatliches Ad-Budget", value: data.monthlyAdBudget },
        { label: "Ziel-Anfragen / Monat", value: data.targetLeadsPerMonth },
      ],
    },
    {
      title: "Material & Assets",
      fields: [
        { label: "Drive-Link", value: data.driveLink ? <a href={data.driveLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Öffnen</a> : "—" },
        { label: "Bestehende Ads", value: data.existingAds },
      ],
    },
    {
      title: "Meta Ads Zugänge",
      fields: data.variant === "done4you" ? [
        { label: "Hat MBM?", value: data.hasMetaBusinessManager === "yes" ? "Ja" : data.hasMetaBusinessManager === "no" ? "Nein, brauche Setup" : "—" },
        { label: "Meta Business Manager ID", value: data.metaBusinessManager || "—" },
        { label: "Ad Account ID", value: data.adAccountId || "—" },
        { label: "Pixel ID", value: data.pixelId || "—" },
        { label: "Website für Ads", value: data.websiteForAds || "—" },
      ] : [],
    },
    {
      title: "Social Media",
      fields: [
        { label: "Instagram", value: data.instagramUrl ? <a href={data.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{data.instagramUrl}</a> : "—" },
        { label: "Facebook", value: data.facebookUrl ? <a href={data.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{data.facebookUrl}</a> : "—" },
        { label: "TikTok", value: data.tiktokUrl ? <a href={data.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{data.tiktokUrl}</a> : "—" },
        { label: "LinkedIn", value: data.linkedinUrl ? <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{data.linkedinUrl}</a> : "—" },
      ],
    },
    {
      title: "Notizen",
      fields: [
        { label: "Anmerkungen vom Kunde", value: data.additionalNotes },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const visibleFields = s.fields.filter((f) => f.value && f.value !== "—" && f.value !== "");
        if (visibleFields.length === 0) return null;
        return (
          <Card key={s.title}>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider">{s.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {visibleFields.map((f) => (
                  <div key={f.label}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.label}</div>
                    <div className="text-sm font-medium mt-0.5 whitespace-pre-wrap break-words">{f.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

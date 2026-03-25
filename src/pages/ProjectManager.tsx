import { useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, ChevronRight, ChevronDown, Clock, CheckCircle2, AlertCircle, ArrowLeft, MessageSquare, FileText, ListChecks, Send, Trash2, GripVertical, ChevronUp, Wrench, ClipboardList, Building2, Target, DollarSign, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useClients } from "@/store/clients";
import { useProjects, addProject as addProjectDB, updateProject as updateProjectDB, deleteProject as deleteProjectDB } from "@/store/projects";
import type { Project, Phase, Task, Comment, TaskStatus, ProjectType, CreativeFormat } from "@/store/projects";

// --- Types (re-exported from store) ---

// Types imported from @/store/projects

const creativeFormats: { value: CreativeFormat; label: string; icon: string }[] = [
  { value: "video", label: "Video", icon: "🎬" },
  { value: "bild", label: "Bilder", icon: "🖼️" },
  { value: "beides", label: "Beides", icon: "🎬🖼️" },
];

// --- Project Type Config ---

const projectTypes: { value: ProjectType; label: string; description: string; color: string; badge?: string }[] = [
  { value: "neukunde-meta", label: "Neukunde Meta", description: "Neukunden-Kampagne nur über Meta Ads.", color: "bg-blue-600", badge: "D4Y" },
  { value: "neukunde-meta-linkedin", label: "Neukunde Meta & LinkedIn", description: "Neukunden-Kampagne über Meta Ads + LinkedIn Outreach.", color: "bg-indigo-500", badge: "D4Y" },
  { value: "optimierung", label: "Optimierung / Retargeting", description: "Bestehende Kampagne optimieren — neue Creatives, Angles, A/B Tests.", color: "bg-amber-500", badge: "D4Y" },
  { value: "donewithyou", label: "Done With You", description: "Zusammenarbeit — Kunde liefert mit zu.", color: "bg-cyan-500" },
  { value: "custom", label: "Custom Projekt", description: "Phasen selbst zusammenstellen per Drag & Drop.", color: "bg-pink-500", badge: "D4Y" },
];

const legacyTypes: typeof projectTypes = [
  { value: "neukunde", label: "Neukunde (Legacy)", description: "", color: "bg-violet-500" },
  { value: "neue-kampagne", label: "Neue Kampagne (Legacy)", description: "", color: "bg-blue-500" },
  { value: "done4you", label: "Done 4 You (Legacy)", description: "", color: "bg-emerald-500" },
];
const projectTypeMap = Object.fromEntries([...projectTypes, ...legacyTypes].map((t) => [t.value, t]));

// --- Phase templates per project type ---

const phaseTemplates: Record<ProjectType, { title: string; tasks: string[] }[]> = {
  neukunde: [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Zugänge einrichten (Ad Manager, Pixel, etc.)", "Fragebogen / Briefing-Dokument senden", "Assets vom Kunden einsammeln"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen", "Angebots-Positionierung klären", "Budget & Laufzeit planen"],
    },
    {
      title: "Creative Production",
      tasks: ["Hooks & Angles brainstormen", "Ad Creatives designen", "Video-Skripte schreiben", "Creator/UGC beauftragen (falls nötig)", "Creatives finalisieren"],
    },
    {
      title: "Ad Copy",
      tasks: ["Primary Text schreiben (3+ Varianten)", "Headlines schreiben", "Descriptions schreiben", "CTA festlegen"],
    },
    {
      title: "Kampagnen-Setup",
      tasks: ["Ad Manager verbinden", "Pixel / Conversion API einrichten", "Custom Audiences erstellen", "Lookalike Audiences erstellen", "Kampagnenstruktur aufsetzen", "Anzeigen einpflegen"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "Feedback einarbeiten", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budget-Check nach 48h", "Erste Optimierungen"],
    },
    {
      title: "Reporting",
      tasks: ["KPIs tracken", "Wöchentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschläge dokumentieren"],
    },
  ],
  "neue-kampagne": [
    {
      title: "Briefing & Strategie",
      tasks: ["Neues Kampagnenziel definieren", "Zielgruppe überprüfen / anpassen", "Neuen Angle / Hook festlegen", "Budget & Laufzeit planen"],
    },
    {
      title: "Creative Production",
      tasks: ["Neue Hooks & Angles brainstormen", "Ad Creatives designen", "Video-Skripte schreiben", "Creator/UGC beauftragen (falls nötig)", "Creatives finalisieren"],
    },
    {
      title: "Ad Copy",
      tasks: ["Primary Text schreiben (3+ Varianten)", "Headlines schreiben", "Descriptions schreiben", "CTA festlegen"],
    },
    {
      title: "Kampagnen-Setup",
      tasks: ["Neue Kampagnenstruktur aufsetzen", "Audiences aktualisieren", "Anzeigen einpflegen", "Budget verteilen"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "Feedback einarbeiten", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budget-Check nach 48h", "Erste Optimierungen"],
    },
    {
      title: "Reporting",
      tasks: ["KPIs tracken", "Wöchentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschläge dokumentieren"],
    },
  ],
  donewithyou: [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "WhatsApp Gruppe erstellen", "Material zugesendet", "Fragebogen / Briefing-Dokument senden", "Briefing ausgefüllt"],
    },
    {
      title: "Zielgruppe & Offer",
      tasks: ["Zielgruppen Material zugesendet", "Zielgruppe gefunden", "Offer Building Material zugesendet", "Offer gefunden"],
    },
    {
      title: "Coldcall",
      tasks: ["Coldcall Skripte gesendet", "Leadgen Tutorial gesendet", "Tracking Exceltabelle gesendet"],
    },
    {
      title: "Sales",
      tasks: ["Skripte gesendet", "Setting geübt", "Closing geübt", "Sales-Sparring gehabt"],
    },
    {
      title: "LinkedIn",
      tasks: ["LinkedIn Outreach Skripte gesendet", "LinkedIn Branding gesendet", "LinkedIn Profil ready", "Prosp AI Tutorial gesendet", "Prosp AI eingerichtet", "Kampagne läuft"],
    },
    {
      title: "Email / Instantly",
      tasks: ["Instantly Tutorial senden", "Instantly eingerichtet", "Email warmgelaufen", "Email Outreach Skripte senden", "Email Outreach Nachrichten eingereicht", "Email Nachrichten ready", "Email Kampagne läuft"],
    },
  ],
  done4you: [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Zugänge einrichten (Ad Manager, Pixel, etc.)", "Fragebogen / Briefing-Dokument senden", "Assets vom Kunden einsammeln"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen", "Angebots-Positionierung klären", "Budget & Laufzeit planen"],
    },
    {
      title: "Creative Production",
      tasks: ["Hooks & Angles brainstormen", "Ad Creatives designen", "Video-Skripte schreiben", "Creator/UGC beauftragen (falls nötig)", "Creatives finalisieren"],
    },
    {
      title: "Ad Copy",
      tasks: ["Primary Text schreiben (3+ Varianten)", "Headlines schreiben", "Descriptions schreiben", "CTA festlegen"],
    },
    {
      title: "Kampagnen-Setup",
      tasks: ["Ad Manager verbinden", "Pixel / Conversion API einrichten", "Custom Audiences erstellen", "Lookalike Audiences erstellen", "Kampagnenstruktur aufsetzen", "Anzeigen einpflegen"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "Feedback einarbeiten", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budget-Check nach 48h", "Erste Optimierungen"],
    },
    {
      title: "Reporting",
      tasks: ["KPIs tracken", "Wöchentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschläge dokumentieren"],
    },
  ],
  optimierung: [
    {
      title: "Analyse",
      tasks: ["Aktuelle Performance auswerten (CTR, CPL, ROAS)", "Top & Flop Ads identifizieren", "Zielgruppen-Performance checken", "Ad Fatigue prüfen (Frequency)", "Schwachstellen dokumentieren"],
    },
    {
      title: "Neue Angles & Hooks",
      tasks: ["Neue Hooks brainstormen", "Winning Ads als Vorlage nutzen", "Konkurrenz-Analyse (Ad Library)", "Angle-Strategie festlegen"],
    },
    {
      title: "Creative Refresh",
      tasks: ["Creative Projekt-Ordner updaten", "Neue Bilder vorbereiten", "Neue Creatives produzieren", "Creatives feedbacken lassen"],
    },
    {
      title: "Ad Copy Refresh",
      tasks: ["Neue Ad Copy Varianten schreiben", "Überschriften testen", "Description anpassen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Kampagnen-Umbau",
      tasks: ["Neue Kampagnenstruktur aufsetzen", "Audiences aktualisieren / neue Lookalikes", "Budget neu verteilen", "A/B Test-Struktur aufsetzen"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "Überarbeitungsschleifen schließen", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Optimierte Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h", "Gewinner skalieren"],
    },
    {
      title: "Reporting",
      tasks: ["Vorher/Nachher Vergleich", "KPI-Entwicklung dokumentieren", "Kunden-Call / Update", "Nächste Optimierungsrunde planen"],
    },
  ],
  "neukunde-meta": [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Meta Ad Manager aufsetzen und als Partner connecten", "Rechnung raussenden", "Rechnung bestätigen", "Onboarding-Formular prüfen", "Startzeitpunkt auswählen"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"],
    },
    {
      title: "Creative Production",
      tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten für Creatives", "Creatives produzieren", "Creatives feedbacken lassen"],
    },
    {
      title: "Ad Copy",
      tasks: ["Ad Copy schreiben (Primärer Text)", "Ad Copy Überschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Meta Kampagnen-Setup",
      tasks: ["Kampagne aufsetzen", "Falls nötig Pixel und Conversion API einrichten"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "Überarbeitungsschleifen schließen", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h"],
    },
  ],
  "neukunde-meta-linkedin": [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Meta Ad Manager aufsetzen und als Partner connecten", "Rechnung raussenden", "Rechnung bestätigen", "Onboarding-Formular prüfen", "Startzeitpunkt auswählen"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"],
    },
    {
      title: "Creative Production",
      tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten für Creatives", "Creatives produzieren", "Creatives feedbacken lassen"],
    },
    {
      title: "Ad Copy",
      tasks: ["Ad Copy schreiben (Primärer Text)", "Ad Copy Überschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Meta Kampagnen-Setup",
      tasks: ["Kampagne aufsetzen", "Falls nötig Pixel und Conversion API einrichten"],
    },
    {
      title: "LinkedIn Kampagnen-Setup",
      tasks: ["Prosp AI Account aufsetzen lassen und mit LinkedIn verbinden", "Account-Daten von Prosp.ai anfordern", "LinkedIn Outreach-Message und Follow-Up-Nachrichten skripten", "LinkedIn-Profil ready machen", "Durch Sales Navigator Lead-Liste aufbauen (Loom Video)"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "Überarbeitungsschleifen schließen", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h"],
    },
  ],
  custom: [],
};

// All available phase blocks (superset for custom builder)
const allPhaseBlocks: { key: string; title: string; tasks: string[] }[] = [
  { key: "onboarding", title: "Onboarding", tasks: ["Kick-off Call", "Meta Ad Manager aufsetzen und als Partner connecten", "Rechnung raussenden", "Rechnung bestätigen", "Onboarding-Formular prüfen", "Startzeitpunkt auswählen"] },
  { key: "briefing", title: "Briefing & Strategie", tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"] },
  { key: "creative", title: "Creative Production", tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten für Creatives", "Creatives produzieren", "Creatives feedbacken lassen"] },
  { key: "adcopy", title: "Ad Copy", tasks: ["Ad Copy schreiben (Primärer Text)", "Ad Copy Überschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"] },
  { key: "meta-setup", title: "Meta Kampagnen-Setup", tasks: ["Kampagne aufsetzen", "Falls nötig Pixel und Conversion API einrichten"] },
  { key: "linkedin-setup", title: "LinkedIn Kampagnen-Setup", tasks: ["Prosp AI Account aufsetzen lassen und mit LinkedIn verbinden", "Account-Daten von Prosp.ai anfordern", "LinkedIn Outreach-Message und Follow-Up-Nachrichten skripten", "LinkedIn-Profil ready machen", "Durch Sales Navigator Lead-Liste aufbauen (Loom Video)"] },
  { key: "coldcall", title: "Coldcall", tasks: ["Coldcall Skripte gesendet", "Leadgen Tutorial gesendet", "Tracking Exceltabelle gesendet"] },
  { key: "sales", title: "Sales", tasks: ["Skripte gesendet", "Setting geübt", "Closing geübt", "Sales-Sparring gehabt"] },
  { key: "linkedin-outreach", title: "LinkedIn Outreach", tasks: ["LinkedIn Outreach Skripte gesendet", "LinkedIn Branding gesendet", "LinkedIn Profil ready", "Prosp AI Tutorial gesendet", "Prosp AI eingerichtet", "Kampagne läuft"] },
  { key: "email-instantly", title: "Email / Instantly", tasks: ["Instantly Tutorial senden", "Instantly eingerichtet", "Email warmgelaufen", "Email Outreach Skripte senden", "Email Outreach Nachrichten eingereicht", "Email Nachrichten ready", "Email Kampagne läuft"] },
  { key: "analyse", title: "Analyse", tasks: ["Aktuelle Performance auswerten", "Top & Flop Ads identifizieren", "Zielgruppen-Performance checken", "Schwachstellen dokumentieren"] },
  { key: "angles", title: "Neue Angles & Hooks", tasks: ["Neue Hooks brainstormen", "Winning Ads als Vorlage nutzen", "Konkurrenz-Analyse (Ad Library)", "Angle-Strategie festlegen"] },
  { key: "abtests", title: "A/B Tests & Setup", tasks: ["Test-Struktur aufsetzen", "Audiences splitten", "Budget-Allokation für Tests", "Anzeigen einpflegen"] },
  { key: "review", title: "Review & Freigabe", tasks: ["Interne Review", "Kundenfreigabe einholen", "Überarbeitungsschleifen schließen", "Finale Freigabe"] },
  { key: "launch", title: "Launch", tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h"] },
  { key: "reporting", title: "Reporting", tasks: ["KPIs tracken", "Wöchentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschläge dokumentieren"] },
];

const allPhaseBlockMap = Object.fromEntries(allPhaseBlocks.map((b) => [b.key, b]));

const creativeTasks: Record<CreativeFormat, string[]> = {
  video: [
    "Hooks & Angles brainstormen",
    "Video-Skripte schreiben",
    "Storyboard erstellen",
    "Creator/UGC beauftragen",
    "Video-Dreh koordinieren",
    "Videos schneiden & bearbeiten",
    "Creatives finalisieren",
  ],
  bild: [
    "Hooks & Angles brainstormen",
    "Ad Creatives designen",
    "Bild-Varianten erstellen (Formate: Feed, Story, Reel)",
    "Creatives finalisieren",
  ],
  beides: [
    "Hooks & Angles brainstormen",
    "Ad Creatives designen (Bilder)",
    "Video-Skripte schreiben",
    "Creator/UGC beauftragen (falls nötig)",
    "Video-Dreh koordinieren / Schnitt",
    "Bild-Varianten erstellen (Formate: Feed, Story, Reel)",
    "Creatives finalisieren",
  ],
};

function createPhases(type: ProjectType, customPhaseKeys?: string[], creativeFormat: CreativeFormat = "beides"): Phase[] {
  const template = type === "custom" && customPhaseKeys
    ? customPhaseKeys.map((key) => allPhaseBlockMap[key]).filter(Boolean)
    : phaseTemplates[type] ?? [];
  return template.map((p, pIdx) => {
    // Swap creative tasks based on format
    const isCreativePhase = p.title === "Creative Production" || p.title === "Creative Refresh";
    const tasks = isCreativePhase ? creativeTasks[creativeFormat] : p.tasks;
    return {
      id: `phase-${pIdx}`,
      title: p.title,
      tasks: tasks.map((t, tIdx) => ({
        id: `task-${pIdx}-${tIdx}`,
        title: t,
        status: "todo" as TaskStatus,
      })),
    };
  });
}

// --- Demo data ---

// Client list comes from shared store (see usage in component)

const initialProjects: Project[] = [];

const teamMembers = ["Alexander", "Daniel"];

const products = ["Done for you", "Done with you"];

// --- Helpers ---

function getPhaseProgress(phase: Phase): number {
  if (phase.tasks.length === 0) return 0;
  const done = phase.tasks.filter((t) => t.status === "done").length;
  return Math.round((done / phase.tasks.length) * 100);
}

function getProjectProgress(project: Project): number {
  const total = project.phases.reduce((s, p) => s + p.tasks.length, 0);
  const done = project.phases.reduce((s, p) => s + p.tasks.filter((t) => t.status === "done").length, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function getCurrentPhase(project: Project): Phase | null {
  for (const phase of project.phases) {
    const allDone = phase.tasks.every((t) => t.status === "done");
    if (!allDone) return phase;
  }
  return project.phases[project.phases.length - 1];
}

function getProjectStatus(project: Project): { label: string; color: string } {
  const progress = getProjectProgress(project);
  if (progress === 100) return { label: "Abgeschlossen", color: "bg-emerald-500" };
  if (progress === 0) return { label: "Neu", color: "bg-gray-400" };
  const current = getCurrentPhase(project);
  if (current) return { label: current.title, color: "bg-primary" };
  return { label: "In Arbeit", color: "bg-primary" };
}

const phaseColors = [
  "bg-violet-500", "bg-blue-500", "bg-cyan-500", "bg-emerald-500",
  "bg-yellow-500", "bg-orange-500", "bg-rose-500", "bg-pink-500",
];

// --- Component ---

export default function ProjectManager() {
  const [clientsList] = useClients();
  const existingClients = useMemo(() => clientsList.map((c) => c.name), [clientsList]);
  const [projects, setProjectsLocal] = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<"alle" | "alex" | "daniel">("alle");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    client: "",
    clientCustom: "",
    name: "",
    product: "Done for you",
    type: "neukunde" as ProjectType,
    creativeFormat: "beides" as CreativeFormat,
    assignees: [] as string[],
  });
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [dragPhaseIdx, setDragPhaseIdx] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    // Filter by assignee
    if (viewFilter === "alex") filtered = filtered.filter((p) => p.assignees.some((a) => a.toLowerCase().includes("alex")));
    if (viewFilter === "daniel") filtered = filtered.filter((p) => p.assignees.some((a) => a.toLowerCase().includes("daniel")));
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.client.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [projects, searchQuery, viewFilter]);

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) ?? null : null;

  // Stats (based on filtered)
  const activeCount = filteredProjects.filter((p) => { const prog = getProjectProgress(p); return prog > 0 && prog < 100; }).length;
  const completedCount = filteredProjects.filter((p) => getProjectProgress(p) === 100).length;
  const newCount = filteredProjects.filter((p) => getProjectProgress(p) === 0).length;

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const toggleTask = (projectId: string, phaseId: string, taskId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const newPhases = project.phases.map((ph) => {
      if (ph.id !== phaseId) return ph;
      return { ...ph, tasks: ph.tasks.map((t) => t.id !== taskId ? t : { ...t, status: t.status === "done" ? "todo" as TaskStatus : "done" as TaskStatus }) };
    });
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, phases: newPhases } : p));
    updateProjectDB(projectId, { phases: newPhases });
  };

  const toggleCustomPhase = (key: string) => {
    setCustomPhases((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const moveCustomPhase = (fromIdx: number, toIdx: number) => {
    setCustomPhases((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  };

  const handleAddProject = async () => {
    const clientName = form.client === "__custom" ? form.clientCustom : form.client;
    if (!clientName || !form.name) {
      toast.error("Bitte Kunde und Projektname ausfüllen");
      return;
    }
    if (form.type === "custom" && customPhases.length === 0) {
      toast.error("Bitte mindestens eine Phase auswählen");
      return;
    }
    const newProject = {
      client: clientName,
      name: form.name,
      product: form.product,
      type: form.type,
      creativeFormat: form.creativeFormat,
      startDate: new Date().toLocaleDateString("de-DE"),
      assignees: form.assignees,
      phases: form.type === "custom" ? createPhases("custom", customPhases, form.creativeFormat) : createPhases(form.type, undefined, form.creativeFormat),
      briefing: "",
      meetingNotes: "",
      targetAudience: "",
      offer: "",
      comments: [],
    };
    await addProjectDB(newProject as any);
    setForm({ client: "", clientCustom: "", name: "", product: "Done for you", type: "neukunde", creativeFormat: "beides", assignees: [] });
    setDialogOpen(false);
    toast.success("Projekt erstellt");
  };

  const addComment = (projectId: string) => {
    if (!commentText.trim()) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const comment: Comment = {
      id: Date.now().toString(),
      author: "Alex",
      text: commentText.trim(),
      timestamp: new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    const newComments = [...project.comments, comment];
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, comments: newComments } : p));
    updateProjectDB(projectId, { comments: newComments });
    setCommentText("");
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProjectDB(projectId);
    setSelectedProjectId(null);
    toast.success("Projekt gelöscht");
  };

  const deleteComment = (projectId: string, commentId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const newComments = project.comments.filter((c) => c.id !== commentId);
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, comments: newComments } : p));
    updateProjectDB(projectId, { comments: newComments });
  };

  // Update local state immediately while typing — save to Supabase only on blur
  const updateProjectFieldLocal = useCallback((projectId: string, field: keyof Project, value: string) => {
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, [field]: value } : p));
  }, []);

  const saveProjectField = useCallback((projectId: string, field: keyof Project, value: string) => {
    updateProjectDB(projectId, { [field]: value } as Partial<Project>);
  }, []);

  const toggleAssignee = (name: string) => {
    setForm((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(name)
        ? prev.assignees.filter((a) => a !== name)
        : [...prev.assignees, name],
    }));
  };

  // --- Project Detail View ---
  if (selectedProject) {
    const progress = getProjectProgress(selectedProject);
    const status = getProjectStatus(selectedProject);
    const currentPhase = getCurrentPhase(selectedProject);

    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => { setSelectedProjectId(null); setExpandedPhases(new Set()); }}>
              <ArrowLeft className="h-4 w-4" />Zurück
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteProject(selectedProject.id)}>
              <Trash2 className="h-3.5 w-3.5" />Löschen
            </Button>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm text-muted-foreground">{selectedProject.client}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-sm text-muted-foreground">{selectedProject.product}</span>
                <Badge className={`${projectTypeMap[selectedProject.type].color} text-white text-[9px] px-1.5 py-0`}>
                  {projectTypeMap[selectedProject.type].label}
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {creativeFormats.find((f) => f.value === selectedProject.creativeFormat)?.icon}{" "}
                  {creativeFormats.find((f) => f.value === selectedProject.creativeFormat)?.label}
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{selectedProject.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tracking-tight">{progress}%</div>
              <div className="text-xs text-muted-foreground">abgeschlossen</div>
            </div>
          </div>
        </div>

        {/* Progress bar + meta */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <Badge className={`${status.color} text-white text-xs`}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">Start: {selectedProject.startDate}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                {teamMembers.map((m) => {
                  const isAssigned = selectedProject.assignees.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        const newAssignees = isAssigned
                          ? selectedProject.assignees.filter((a) => a !== m)
                          : [...selectedProject.assignees, m];
                        setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, assignees: newAssignees } : p));
                        updateProjectDB(selectedProject.id, { assignees: newAssignees });
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        isAssigned
                          ? "bg-primary text-primary-foreground ring-1 ring-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 ring-1 ring-border"
                      }`}
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">{m[0]}</span>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Phase progress pipeline */}
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {selectedProject.phases.map((phase, idx) => {
                const pProg = getPhaseProgress(phase);
                const isCurrent = phase.id === currentPhase?.id;
                return (
                  <div
                    key={phase.id}
                    className="flex-1 bg-muted/50 rounded-sm overflow-hidden relative"
                  >
                    <div
                      className={`h-full transition-all ${phaseColors[idx % phaseColors.length]} ${pProg === 100 ? "" : "opacity-80"}`}
                      style={{ width: `${pProg}%` }}
                    />
                    {isCurrent && pProg < 100 && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-foreground/20 animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex mt-1.5">
              {selectedProject.phases.map((phase, idx) => (
                <div key={phase.id} className="flex-1 text-center">
                  <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider leading-none">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detail Tabs */}
        <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" />Pipeline</TabsTrigger>
            {selectedProject.onboarding && (
              <TabsTrigger value="onboarding" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Onboarding</TabsTrigger>
            )}
            <TabsTrigger value="briefing" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Briefing & Infos</TabsTrigger>
            <TabsTrigger value="comments" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Kommentare
              {selectedProject.comments.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary px-1">
                  {selectedProject.comments.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* PIPELINE TAB */}
          <TabsContent value="pipeline" className="space-y-3 mt-4">
            {/* Empty pipeline — choose project type */}
            {selectedProject.phases.length === 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center mb-5">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <ListChecks className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Pipeline einrichten</h3>
                    <p className="text-sm text-muted-foreground mt-1">Wähle den Projekttyp — die passenden Phasen werden automatisch erstellt.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {projectTypes.filter((pt) => pt.value !== "custom").map((pt) => (
                      <button
                        key={pt.value}
                        onClick={() => {
                          const newPhases = createPhases(pt.value, undefined, selectedProject.creativeFormat);
                          setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, type: pt.value, phases: newPhases } : p));
                          updateProjectDB(selectedProject.id, { type: pt.value, phases: newPhases });
                          toast.success(`Pipeline "${pt.label}" erstellt`);
                        }}
                        className="text-left rounded-xl border p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`h-2.5 w-2.5 rounded-full ${pt.color}`} />
                          <span className="text-sm font-semibold group-hover:text-primary transition-colors">{pt.label}</span>
                          {(pt as any).badge && <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-500 rounded px-1.5 py-0.5">{(pt as any).badge}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{pt.description}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-2">{phaseTemplates[pt.value]?.length || 0} Phasen</p>
                      </button>
                    ))}
                    {/* Custom option */}
                    <button
                      onClick={() => {
                        const allKeys = allPhaseBlocks.map((b) => b.key);
                        const newPhases = createPhases("custom" as ProjectType, allKeys, selectedProject.creativeFormat);
                        setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, type: "custom" as ProjectType, phases: newPhases } : p));
                        updateProjectDB(selectedProject.id, { type: "custom" as ProjectType, phases: newPhases });
                        toast.success("Custom Pipeline erstellt — du kannst Phasen entfernen");
                      }}
                      className="text-left rounded-xl border border-dashed p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Wrench className="h-3.5 w-3.5 text-pink-500" />
                        <span className="text-sm font-semibold group-hover:text-primary transition-colors">Custom Projekt</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Alle Phasen — entferne was du nicht brauchst.</p>
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedProject.phases.map((phase, phaseIdx) => {
              const pProg = getPhaseProgress(phase);
              const isExpanded = expandedPhases.has(phase.id) || phase.id === currentPhase?.id;
              const isCurrent = phase.id === currentPhase?.id;
              const allDone = pProg === 100;
              const doneTasks = phase.tasks.filter((t) => t.status === "done").length;

              return (
                <Card
                  key={phase.id}
                  className={`transition-all ${isCurrent ? "ring-1 ring-primary/30 shadow-sm" : ""} ${allDone ? "opacity-75" : ""}`}
                >
                  <button
                    className="w-full text-left p-4 flex items-center gap-3"
                    onClick={() => togglePhase(phase.id)}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${allDone ? "bg-emerald-500/10" : isCurrent ? "bg-primary/10" : "bg-muted"}`}>
                      {allDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <span className={`text-sm font-bold ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>{phaseIdx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${allDone ? "line-through text-muted-foreground" : ""}`}>{phase.title}</span>
                        {isCurrent && !allDone && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Aktuell</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[200px]">
                          <div className={`h-full rounded-full transition-all ${allDone ? "bg-emerald-500" : phaseColors[phaseIdx % phaseColors.length]}`} style={{ width: `${pProg}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{doneTasks}/{phase.tasks.length}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4">
                      <div className="ml-11 space-y-1 border-l-2 border-border/50 pl-4">
                        {phase.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 py-1.5 group cursor-pointer"
                            onClick={() => toggleTask(selectedProject.id, phase.id, task.id)}
                          >
                            <Checkbox
                              checked={task.status === "done"}
                              className="shrink-0"
                              onCheckedChange={() => toggleTask(selectedProject.id, phase.id, task.id)}
                            />
                            <span className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"} group-hover:text-primary transition-colors`}>
                              {task.title}
                            </span>
                            {task.status === "in-progress" && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto text-primary border-primary/30">
                                In Arbeit
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          {/* ONBOARDING TAB */}
          {selectedProject.onboarding && (
            <TabsContent value="onboarding" className="space-y-4 mt-4">
              {(() => {
                const ob = selectedProject.onboarding as Record<string, unknown>;
                const sections: { title: string; icon: typeof Building2; fields: { label: string; value: unknown }[] }[] = [
                  {
                    title: "Agentur",
                    icon: Building2,
                    fields: [
                      { label: "Firmenname", value: ob.companyName },
                      { label: "Website", value: ob.website },
                      { label: "Teamgröße", value: ob.teamSize },
                      { label: "Ansprechpartner", value: ob.contactName },
                      { label: "E-Mail", value: ob.contactEmail },
                      { label: "Telefon", value: ob.contactPhone },
                      { label: "Services", value: Array.isArray(ob.services) ? (ob.services as string[]).join(", ") : ob.services },
                    ],
                  },
                  {
                    title: "Angebot & USP",
                    icon: FileText,
                    fields: [
                      { label: "Hauptangebot", value: ob.mainOffer },
                      { label: "Preisrange", value: ob.priceRange },
                      { label: "USP", value: ob.usp },
                      { label: "Case Studies", value: ob.caseStudies },
                      { label: "Aktuelle Kunden", value: ob.currentClients },
                    ],
                  },
                  {
                    title: "Traumkunden",
                    icon: Target,
                    fields: [
                      { label: "Idealer Kunde", value: ob.idealClient },
                      { label: "Zielbranchen", value: Array.isArray(ob.idealIndustry) ? (ob.idealIndustry as string[]).join(", ") : ob.idealIndustry },
                      { label: "Kundenbudget", value: ob.idealBudget },
                      { label: "Pain Points", value: ob.clientProblems },
                    ],
                  },
                  {
                    title: "Aktuelle Kundengewinnung",
                    icon: MessageSquare,
                    fields: [
                      { label: "Marketing-Kanäle", value: Array.isArray(ob.currentMarketing) ? (ob.currentMarketing as string[]).join(", ") : ob.currentMarketing },
                      { label: "Anfragen / Monat", value: ob.monthlyLeads },
                      { label: "Closing Rate", value: ob.closingRate },
                      { label: "Größte Herausforderung", value: ob.biggestChallenge },
                    ],
                  },
                  {
                    title: "Ads & Budget",
                    icon: DollarSign,
                    fields: [
                      { label: "Ad-Erfahrung", value: ob.adExperience },
                      { label: "Kampagnenziel", value: ob.adGoal },
                      { label: "Monatliches Ad-Budget", value: ob.monthlyAdBudget },
                      { label: "Ziel Leads / Monat", value: ob.targetLeadsPerMonth },
                      { label: "Gewünschter Start", value: ob.timeline },
                    ],
                  },
                  {
                    title: "Material & Assets",
                    icon: ClipboardList,
                    fields: [
                      { label: "Google Drive / Dropbox Link", value: ob.driveLink },
                      { label: "Bisherige Ad-Erfahrung", value: ob.existingAds },
                    ],
                  },
                  {
                    title: "Zugänge & Technisches",
                    icon: KeyRound,
                    fields: [
                      { label: "Business Manager ID", value: ob.metaBusinessManager },
                      { label: "Ad Account ID", value: ob.adAccountId },
                      { label: "Pixel ID", value: ob.pixelId },
                      { label: "Landingpage für Ads", value: ob.websiteForAds },
                      { label: "Sonstige Notizen", value: ob.additionalNotes },
                    ],
                  },
                ];

                const iconMap: Record<string, typeof Building2> = {
                  "Agentur": Building2,
                  "Angebot & USP": FileText,
                  "Traumkunden": Target,
                  "Aktuelle Kundengewinnung": MessageSquare,
                  "Ads & Budget": DollarSign,
                  "Material & Assets": ClipboardList,
                  "Zugänge & Technisches": KeyRound,
                };

                return (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {sections.map((section) => {
                      const Icon = iconMap[section.title] || FileText;
                      const hasData = section.fields.some((f) => f.value);
                      if (!hasData) return null;
                      return (
                        <Card key={section.title}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary" />{section.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2.5">
                              {section.fields.map((field) => {
                                if (!field.value) return null;
                                const isLong = typeof field.value === "string" && field.value.length > 60;
                                return (
                                  <div key={field.label} className={isLong ? "" : "flex items-start justify-between gap-4"}>
                                    <span className="text-xs text-muted-foreground shrink-0">{field.label}</span>
                                    <span className={`text-sm font-medium ${isLong ? "block mt-0.5" : "text-right"}`}>
                                      {String(field.value)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          )}

          {/* BRIEFING & INFOS TAB */}
          <TabsContent value="briefing" className="space-y-4 mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />Briefing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Was will der Kunde? Ziele, Budget, Zeitrahmen, besondere Wünsche..."
                    rows={6}
                    value={selectedProject.briefing}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "briefing", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "briefing", e.target.value)}
                    className="resize-none"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />Meeting-Notizen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Notizen aus Kick-off, Calls, Meetings..."
                    rows={6}
                    value={selectedProject.meetingNotes}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "meetingNotes", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "meetingNotes", e.target.value)}
                    className="resize-none"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Zielgruppe</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Wer soll angesprochen werden? Alter, Interessen, Verhalten..."
                    rows={4}
                    value={selectedProject.targetAudience}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "targetAudience", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "targetAudience", e.target.value)}
                    className="resize-none"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Angebot / Offer</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Was ist das Angebot? Rabatt, Freebie, Trial..."
                    rows={4}
                    value={selectedProject.offer}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "offer", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "offer", e.target.value)}
                    className="resize-none"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Project Meta */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Projektdetails</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-5">
                  <div>
                    <Label className="text-xs text-muted-foreground">Kunde</Label>
                    <p className="text-sm font-medium mt-0.5">{selectedProject.client}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Offer</Label>
                    <p className="text-sm font-medium mt-0.5">{selectedProject.product}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Start</Label>
                    <p className="text-sm font-medium mt-0.5">{selectedProject.startDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Deadline</Label>
                    <Input
                      type="date"
                      className="h-8 mt-0.5 text-sm"
                      value={selectedProject.deadline || ""}
                      onChange={(e) => updateProjectFieldLocal(selectedProject.id, "deadline", e.target.value)}
                      onBlur={(e) => saveProjectField(selectedProject.id, "deadline", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Team</Label>
                    <div className="flex gap-1 mt-0.5">
                      {selectedProject.assignees.map((a) => (
                        <span key={a} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KOMMENTARE TAB */}
          <TabsContent value="comments" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {/* Comment Input */}
                <div className="flex gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-xs font-bold text-primary">A</span>
                  </div>
                  <div className="flex-1">
                    <Textarea
                      placeholder="Kommentar schreiben... (Updates, Feedback, Notizen)"
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          addComment(selectedProject.id);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">Cmd+Enter zum Senden</span>
                      <Button size="sm" onClick={() => addComment(selectedProject.id)} disabled={!commentText.trim()}>
                        <Send className="h-3.5 w-3.5 mr-1.5" />Senden
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Comments List */}
                {selectedProject.comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Noch keine Kommentare.</p>
                    <p className="text-xs mt-1">Halte hier Updates, Feedback und Notizen fest.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...selectedProject.comments].reverse().map((comment) => (
                      <div key={comment.id} className="flex gap-3 group">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{comment.author[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{comment.author}</span>
                            <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
                            <button
                              onClick={() => deleteComment(selectedProject.id, comment.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // --- Overview ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projekte</h1>
          <p className="text-sm text-muted-foreground">Alle Kundenprojekte und ihr Fortschritt.</p>
          {/* Team Filter */}
          <div className="flex items-center gap-1 mt-3">
            {([
              { key: "alle", label: "Alle" },
              { key: "alex", label: "Alexander" },
              { key: "daniel", label: "Daniel" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setViewFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />Neues Projekt
          </Button>
          <DialogContent className={form.type === "custom" ? "sm:max-w-xl max-h-[85vh] overflow-y-auto" : "sm:max-w-md"}>
            <DialogHeader>
              <DialogTitle>Neues Projekt anlegen</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Kunde</Label>
                <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                  <SelectTrigger><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
                  <SelectContent>
                    {existingClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom">+ Neuer Kunde</SelectItem>
                  </SelectContent>
                </Select>
                {form.client === "__custom" && (
                  <Input placeholder="Neuen Kundennamen eingeben" className="mt-2" value={form.clientCustom} onChange={(e) => setForm({ ...form, clientCustom: e.target.value })} />
                )}
              </div>
              <div className="grid gap-2">
                <Label>Projektname</Label>
                <Input placeholder="z.B. Spring Campaign 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Projekttyp</Label>
                <div className="grid gap-2">
                  {projectTypes.map((pt) => (
                    <button
                      key={pt.value}
                      onClick={() => setForm({ ...form, type: pt.value })}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        form.type === pt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${pt.color}`} />
                        <span className="text-sm font-semibold">{pt.label}</span>
                        {(pt as any).badge && <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-500 rounded px-1.5 py-0.5">{(pt as any).badge}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-4">{pt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative Format */}
              <div className="grid gap-2">
                <Label>Creative-Format</Label>
                <div className="flex gap-2">
                  {creativeFormats.map((cf) => (
                    <button
                      key={cf.value}
                      onClick={() => setForm({ ...form, creativeFormat: cf.value })}
                      className={`flex-1 rounded-lg border p-2.5 text-center transition-all ${
                        form.creativeFormat === cf.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="text-lg">{cf.icon}</div>
                      <div className="text-xs font-medium mt-0.5">{cf.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Phase Builder */}
              {form.type === "custom" && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />Phasen zusammenstellen</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Wähle Phasen aus und sortiere sie per Drag & Drop.</p>

                  {/* Selected phases (sortable) */}
                  {customPhases.length > 0 && (
                    <div className="space-y-1 mb-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Ausgewählt ({customPhases.length})</div>
                      {customPhases.map((key, idx) => {
                        const block = allPhaseBlockMap[key];
                        if (!block) return null;
                        return (
                          <div
                            key={key}
                            draggable
                            onDragStart={() => setDragPhaseIdx(idx)}
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={() => {
                              if (dragPhaseIdx !== null && dragPhaseIdx !== idx) {
                                moveCustomPhase(dragPhaseIdx, idx);
                              }
                              setDragPhaseIdx(null);
                            }}
                            className={`flex items-center gap-2 rounded-lg border bg-card p-2.5 cursor-grab active:cursor-grabbing transition-all ${
                              dragPhaseIdx === idx ? "opacity-50 ring-2 ring-primary" : "hover:shadow-sm"
                            }`}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                            <span className="text-xs font-bold text-primary w-5">{idx + 1}</span>
                            <span className="text-sm font-medium flex-1">{block.title}</span>
                            <span className="text-[10px] text-muted-foreground">{block.tasks.length} Tasks</span>
                            <div className="flex gap-0.5">
                              <button
                                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                disabled={idx === 0}
                                onClick={(e) => { e.stopPropagation(); moveCustomPhase(idx, idx - 1); }}
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                disabled={idx === customPhases.length - 1}
                                onClick={(e) => { e.stopPropagation(); moveCustomPhase(idx, idx + 1); }}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-0.5 text-muted-foreground hover:text-destructive ml-1"
                                onClick={(e) => { e.stopPropagation(); toggleCustomPhase(key); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Available phases */}
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Verfügbare Bausteine</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {allPhaseBlocks.filter((b) => !customPhases.includes(b.key)).map((block) => (
                      <button
                        key={block.key}
                        onClick={() => toggleCustomPhase(block.key)}
                        className="text-left rounded-lg border border-dashed border-border p-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <div className="flex items-center gap-1.5">
                          <Plus className="h-3 w-3 text-primary shrink-0" />
                          <span className="text-xs font-medium">{block.title}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 ml-[18px]">{block.tasks.length} Tasks</p>
                      </button>
                    ))}
                  </div>
                  {allPhaseBlocks.filter((b) => !customPhases.includes(b.key)).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Alle Phasen ausgewählt.</p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label>Offer</Label>
                <Select value={form.product} onValueChange={(v) => setForm({ ...form, product: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Team</Label>
                <div className="flex gap-2">
                  {teamMembers.map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleAssignee(m)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                        form.assignees.includes(m)
                          ? "bg-primary/10 border-primary/30 text-primary ring-1 ring-primary/20"
                          : "bg-muted border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleAddProject}>Projekt anlegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Aktive Projekte</div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-bl-full" />
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{newCount}</div>
              <div className="text-xs text-muted-foreground">Neue Projekte</div>
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
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="text-xs text-muted-foreground">Abgeschlossen</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Projekt oder Kunde suchen..."
          className="pl-9 max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Project Cards */}
      <div className="space-y-3">
        {filteredProjects.map((project) => {
          const progress = getProjectProgress(project);
          const status = getProjectStatus(project);
          const current = getCurrentPhase(project);
          const currentIdx = current ? project.phases.indexOf(current) : -1;

          return (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/20 group"
              onClick={() => {
                setSelectedProjectId(project.id);
                // Auto-expand current phase
                if (current) setExpandedPhases(new Set([current.id]));
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Progress circle */}
                  <div className="relative h-14 w-14 shrink-0">
                    <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" className="stroke-muted" strokeWidth="4" />
                      <circle
                        cx="28" cy="28" r="24" fill="none"
                        className={progress === 100 ? "stroke-emerald-500" : "stroke-primary"}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold tabular-nums">{progress}%</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-muted-foreground">{project.client}</span>
                      <Badge className={`${projectTypeMap[project.type].color} text-white text-[9px] px-1.5 py-0`}>{projectTypeMap[project.type].label}</Badge>
                      <Badge className={`${status.color} text-white text-[9px] px-1.5 py-0`}>{status.label}</Badge>
                    </div>
                    <h3 className="text-base font-semibold group-hover:text-primary transition-colors truncate">{project.name}</h3>

                    {/* Phase pipeline mini */}
                    <div className="flex gap-0.5 mt-2.5 h-2 rounded-full overflow-hidden">
                      {project.phases.map((phase, idx) => {
                        const pProg = getPhaseProgress(phase);
                        return (
                          <div key={phase.id} className="flex-1 bg-muted/50 rounded-sm overflow-hidden">
                            <div
                              className={`h-full ${phaseColors[idx % phaseColors.length]} transition-all`}
                              style={{ width: `${pProg}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {project.phases.map((ph, idx) => (
                        <div key={ph.id} className="flex-1 text-center">
                          <span className={`text-[7px] uppercase tracking-wider ${idx === currentIdx ? "text-primary font-bold" : "text-muted-foreground/40"}`}>
                            {ph.title.split(" ")[0].slice(0, 4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {creativeFormats.find((f) => f.value === project.creativeFormat)?.icon}{" "}
                        {project.product}
                      </span>
                    </div>
                    <div className="flex -space-x-1">
                      {project.assignees.map((a) => (
                        <span key={a} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary ring-2 ring-card">
                          {a[0]}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{project.startDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Keine Projekte gefunden.</p>
          </div>
        )}
      </div>
    </div>
  );
}

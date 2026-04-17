import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Send, Trash2, GripVertical, ChevronUp, ChevronDown, Wrench, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useClients } from "@/store/clients";
import { useProjects, addProject as addProjectDB, updateProject as updateProjectDB, deleteProject as deleteProjectDB } from "@/store/projects";
import type { Project, Phase, Task, Comment, TaskStatus, ProjectType, CreativeFormat } from "@/store/projects";
import { searchLeadByName, searchLeads, getLeadActivities, getLeadOpportunities } from "@/lib/close-api-client";
import type { CloseActivity, CloseOpportunity } from "@/lib/close-api-client";

// --- Types (re-exported from store) ---

// Types imported from @/store/projects

const creativeFormats: { value: CreativeFormat; label: string; icon: string }[] = [
  { value: "video", label: "Video", icon: "\u{1F3AC}" },
  { value: "bild", label: "Bilder", icon: "\u{1F5BC}\uFE0F" },
  { value: "beides", label: "Beides", icon: "\u{1F3AC}\u{1F5BC}\uFE0F" },
];

// --- Project Type Config ---

const projectTypes: { value: ProjectType; label: string; description: string; color: string; badge?: string }[] = [
  { value: "neukunde-meta", label: "Neukunde Meta", description: "Neukunden-Kampagne nur \u00FCber Meta Ads.", color: "bg-blue-600", badge: "D4Y" },
  { value: "neukunde-meta-linkedin", label: "Neukunde Meta & LinkedIn", description: "Neukunden-Kampagne \u00FCber Meta Ads + LinkedIn Outreach.", color: "bg-indigo-500", badge: "D4Y" },
  { value: "kunde-meta", label: "Kunde Meta", description: "Neue Kampagne f\u00FCr bestehenden Meta-Kunden \u2014 kein Onboarding n\u00F6tig.", color: "bg-sky-500", badge: "D4Y" },
  { value: "optimierung", label: "Optimierung / Retargeting", description: "Bestehende Kampagne optimieren \u2014 neue Creatives, Angles, A/B Tests.", color: "bg-amber-500", badge: "D4Y" },
  { value: "donewithyou", label: "Done With You (Full)", description: "Zusammenarbeit inkl. Coldcall, LinkedIn, Sales & Email/Instantly.", color: "bg-cyan-500", badge: "DWY" },
  { value: "donewithyou-no-email", label: "Done With You (ohne Email)", description: "Zusammenarbeit inkl. Coldcall, LinkedIn & Sales \u2014 ohne Email/Instantly.", color: "bg-teal-500", badge: "DWY" },
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
      tasks: ["Kick-off Call", "Zug\u00E4nge einrichten (Ad Manager, Pixel, etc.)", "Fragebogen / Briefing-Dokument senden", "Assets vom Kunden einsammeln"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen", "Angebots-Positionierung kl\u00E4ren", "Budget & Laufzeit planen"],
    },
    {
      title: "Creative Production",
      tasks: ["Hooks & Angles brainstormen", "Ad Creatives designen", "Video-Skripte schreiben", "Creator/UGC beauftragen (falls n\u00F6tig)", "Creatives finalisieren"],
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
      tasks: ["KPIs tracken", "W\u00F6chentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschl\u00E4ge dokumentieren"],
    },
  ],
  "neue-kampagne": [
    {
      title: "Briefing & Strategie",
      tasks: ["Neues Kampagnenziel definieren", "Zielgruppe \u00FCberpr\u00FCfen / anpassen", "Neuen Angle / Hook festlegen", "Budget & Laufzeit planen"],
    },
    {
      title: "Creative Production",
      tasks: ["Neue Hooks & Angles brainstormen", "Ad Creatives designen", "Video-Skripte schreiben", "Creator/UGC beauftragen (falls n\u00F6tig)", "Creatives finalisieren"],
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
      tasks: ["KPIs tracken", "W\u00F6chentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschl\u00E4ge dokumentieren"],
    },
  ],
  donewithyou: [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "WhatsApp Gruppe erstellen", "Material zugesendet", "Fragebogen / Briefing-Dokument senden", "Briefing ausgef\u00FCllt"],
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
      tasks: ["Skripte gesendet", "Setting ge\u00FCbt", "Closing ge\u00FCbt", "Sales-Sparring gehabt"],
    },
    {
      title: "LinkedIn",
      tasks: ["LinkedIn Outreach Skripte gesendet", "LinkedIn Branding gesendet", "LinkedIn Profil ready", "Prosp AI Tutorial gesendet", "Prosp AI eingerichtet", "Kampagne l\u00E4uft"],
    },
    {
      title: "Email / Instantly",
      tasks: ["Instantly Tutorial senden", "Instantly eingerichtet", "Email warmgelaufen", "Email Outreach Skripte senden", "Email Outreach Nachrichten eingereicht", "Email Nachrichten ready", "Email Kampagne l\u00E4uft"],
    },
  ],
  "donewithyou-no-email": [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "WhatsApp Gruppe erstellen", "Material zugesendet", "Fragebogen / Briefing-Dokument senden", "Briefing ausgef\u00FCllt"],
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
      tasks: ["Skripte gesendet", "Setting ge\u00FCbt", "Closing ge\u00FCbt", "Sales-Sparring gehabt"],
    },
    {
      title: "LinkedIn",
      tasks: ["LinkedIn Outreach Skripte gesendet", "LinkedIn Branding gesendet", "LinkedIn Profil ready", "Prosp AI Tutorial gesendet", "Prosp AI eingerichtet", "Kampagne l\u00E4uft"],
    },
  ],
  done4you: [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Zug\u00E4nge einrichten (Ad Manager, Pixel, etc.)", "Fragebogen / Briefing-Dokument senden", "Assets vom Kunden einsammeln"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen", "Angebots-Positionierung kl\u00E4ren", "Budget & Laufzeit planen"],
    },
    {
      title: "Creative Production",
      tasks: ["Hooks & Angles brainstormen", "Ad Creatives designen", "Video-Skripte schreiben", "Creator/UGC beauftragen (falls n\u00F6tig)", "Creatives finalisieren"],
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
      tasks: ["KPIs tracken", "W\u00F6chentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschl\u00E4ge dokumentieren"],
    },
  ],
  optimierung: [
    {
      title: "Analyse",
      tasks: ["Aktuelle Performance auswerten (CTR, CPL, ROAS)", "Top & Flop Ads identifizieren", "Zielgruppen-Performance checken", "Ad Fatigue pr\u00FCfen (Frequency)", "Schwachstellen dokumentieren"],
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
      tasks: ["Neue Ad Copy Varianten schreiben", "\u00DCberschriften testen", "Description anpassen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Kampagnen-Umbau",
      tasks: ["Neue Kampagnenstruktur aufsetzen", "Audiences aktualisieren / neue Lookalikes", "Budget neu verteilen", "A/B Test-Struktur aufsetzen"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "\u00DCberarbeitungsschleifen schlie\u00DFen", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Optimierte Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h", "Gewinner skalieren"],
    },
    {
      title: "Reporting",
      tasks: ["Vorher/Nachher Vergleich", "KPI-Entwicklung dokumentieren", "Kunden-Call / Update", "N\u00E4chste Optimierungsrunde planen"],
    },
  ],
  "neukunde-meta": [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Meta Ad Manager aufsetzen und als Partner connecten", "Rechnung raussenden", "Rechnung best\u00E4tigen", "Onboarding-Formular pr\u00FCfen", "Startzeitpunkt ausw\u00E4hlen"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"],
    },
    {
      title: "Creative Production",
      tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten f\u00FCr Creatives", "Creatives produzieren", "Creatives feedbacken lassen"],
    },
    {
      title: "Ad Copy",
      tasks: ["Ad Copy schreiben (Prim\u00E4rer Text)", "Ad Copy \u00DCberschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Meta Kampagnen-Setup",
      tasks: ["Kampagne aufsetzen", "Falls n\u00F6tig Pixel und Conversion API einrichten"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "\u00DCberarbeitungsschleifen schlie\u00DFen", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h"],
    },
  ],
  "neukunde-meta-linkedin": [
    {
      title: "Onboarding",
      tasks: ["Kick-off Call", "Meta Ad Manager aufsetzen und als Partner connecten", "Rechnung raussenden", "Rechnung best\u00E4tigen", "Onboarding-Formular pr\u00FCfen", "Startzeitpunkt ausw\u00E4hlen"],
    },
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"],
    },
    {
      title: "Creative Production",
      tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten f\u00FCr Creatives", "Creatives produzieren", "Creatives feedbacken lassen"],
    },
    {
      title: "Ad Copy",
      tasks: ["Ad Copy schreiben (Prim\u00E4rer Text)", "Ad Copy \u00DCberschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Meta Kampagnen-Setup",
      tasks: ["Kampagne aufsetzen", "Falls n\u00F6tig Pixel und Conversion API einrichten"],
    },
    {
      title: "LinkedIn Kampagnen-Setup",
      tasks: ["Prosp AI Account aufsetzen lassen und mit LinkedIn verbinden", "Account-Daten von Prosp.ai anfordern", "LinkedIn Outreach-Message und Follow-Up-Nachrichten skripten", "LinkedIn-Profil ready machen", "Durch Sales Navigator Lead-Liste aufbauen (Loom Video)"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "\u00DCberarbeitungsschleifen schlie\u00DFen", "Finale Freigabe"],
    },
    {
      title: "Launch",
      tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h"],
    },
  ],
  "kunde-meta": [
    {
      title: "Briefing & Strategie",
      tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"],
    },
    {
      title: "Creative Production",
      tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten f\u00FCr Creatives", "Creatives produzieren", "Creatives feedbacken lassen"],
    },
    {
      title: "Ad Copy",
      tasks: ["Ad Copy schreiben (Prim\u00E4rer Text)", "Ad Copy \u00DCberschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"],
    },
    {
      title: "Meta Kampagnen-Setup",
      tasks: ["Kampagne aufsetzen", "Falls n\u00F6tig Pixel und Conversion API einrichten"],
    },
    {
      title: "Review & Freigabe",
      tasks: ["Interne Review", "Kundenfreigabe einholen", "\u00DCberarbeitungsschleifen schlie\u00DFen", "Finale Freigabe"],
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
  { key: "onboarding", title: "Onboarding", tasks: ["Kick-off Call", "Meta Ad Manager aufsetzen und als Partner connecten", "Rechnung raussenden", "Rechnung best\u00E4tigen", "Onboarding-Formular pr\u00FCfen", "Startzeitpunkt ausw\u00E4hlen"] },
  { key: "briefing", title: "Briefing & Strategie", tasks: ["Zielgruppe definieren", "Offer definieren", "Wettbewerbsanalyse", "Funnel-Strategie festlegen"] },
  { key: "creative", title: "Creative Production", tasks: ["Creative Projekt-Ordner in Cloud anlegen", "Bilder vorbereiten f\u00FCr Creatives", "Creatives produzieren", "Creatives feedbacken lassen"] },
  { key: "adcopy", title: "Ad Copy", tasks: ["Ad Copy schreiben (Prim\u00E4rer Text)", "Ad Copy \u00DCberschriften festlegen", "Ad Copy Description festlegen", "Ad Copy feedbacken lassen"] },
  { key: "meta-setup", title: "Meta Kampagnen-Setup", tasks: ["Kampagne aufsetzen", "Falls n\u00F6tig Pixel und Conversion API einrichten"] },
  { key: "linkedin-setup", title: "LinkedIn Kampagnen-Setup", tasks: ["Prosp AI Account aufsetzen lassen und mit LinkedIn verbinden", "Account-Daten von Prosp.ai anfordern", "LinkedIn Outreach-Message und Follow-Up-Nachrichten skripten", "LinkedIn-Profil ready machen", "Durch Sales Navigator Lead-Liste aufbauen (Loom Video)"] },
  { key: "coldcall", title: "Coldcall", tasks: ["Coldcall Skripte gesendet", "Leadgen Tutorial gesendet", "Tracking Exceltabelle gesendet"] },
  { key: "sales", title: "Sales", tasks: ["Skripte gesendet", "Setting ge\u00FCbt", "Closing ge\u00FCbt", "Sales-Sparring gehabt"] },
  { key: "linkedin-outreach", title: "LinkedIn Outreach", tasks: ["LinkedIn Outreach Skripte gesendet", "LinkedIn Branding gesendet", "LinkedIn Profil ready", "Prosp AI Tutorial gesendet", "Prosp AI eingerichtet", "Kampagne l\u00E4uft"] },
  { key: "email-instantly", title: "Email / Instantly", tasks: ["Instantly Tutorial senden", "Instantly eingerichtet", "Email warmgelaufen", "Email Outreach Skripte senden", "Email Outreach Nachrichten eingereicht", "Email Nachrichten ready", "Email Kampagne l\u00E4uft"] },
  { key: "analyse", title: "Analyse", tasks: ["Aktuelle Performance auswerten", "Top & Flop Ads identifizieren", "Zielgruppen-Performance checken", "Schwachstellen dokumentieren"] },
  { key: "angles", title: "Neue Angles & Hooks", tasks: ["Neue Hooks brainstormen", "Winning Ads als Vorlage nutzen", "Konkurrenz-Analyse (Ad Library)", "Angle-Strategie festlegen"] },
  { key: "abtests", title: "A/B Tests & Setup", tasks: ["Test-Struktur aufsetzen", "Audiences splitten", "Budget-Allokation f\u00FCr Tests", "Anzeigen einpflegen"] },
  { key: "review", title: "Review & Freigabe", tasks: ["Interne Review", "Kundenfreigabe einholen", "\u00DCberarbeitungsschleifen schlie\u00DFen", "Finale Freigabe"] },
  { key: "launch", title: "Launch", tasks: ["Kampagnen live schalten", "Initiales Monitoring (24h)", "Budgetcheck nach 48h"] },
  { key: "reporting", title: "Reporting", tasks: ["KPIs tracken", "W\u00F6chentliches Reporting erstellen", "Kunden-Call / Update", "Optimierungsvorschl\u00E4ge dokumentieren"] },
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
    "Creator/UGC beauftragen (falls n\u00F6tig)",
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

// --- Date helpers ---

function parseDeDate(s: string): Date | null {
  if (!s) return null;
  // Handle "dd.mm.yyyy" (German) or "yyyy-mm-dd" (ISO)
  if (s.includes(".")) {
    const [d, m, y] = s.split(".");
    return new Date(+y, +m - 1, +d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysRunning(project: Project): number | null {
  const start = parseDeDate(project.startDate);
  if (!start) return null;
  return daysBetween(start, new Date());
}

function getDaysLeft(project: Project): number | null {
  if (!project.deadline) return null;
  const deadline = parseDeDate(project.deadline);
  if (!deadline) return null;
  return daysBetween(new Date(), deadline);
}

function getTimeProgress(project: Project): number | null {
  const start = parseDeDate(project.startDate);
  if (!start || !project.deadline) return null;
  const deadline = parseDeDate(project.deadline);
  if (!deadline) return null;
  const total = daysBetween(start, deadline);
  if (total <= 0) return 100;
  const elapsed = daysBetween(start, new Date());
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

type HealthStatus = "green" | "yellow" | "red";

function getHealthScore(project: Project): { status: HealthStatus; label: string; reason: string } {
  const progress = getProjectProgress(project);
  const daysLeft = getDaysLeft(project);
  const timeProgress = getTimeProgress(project);

  // Completed
  if (progress === 100) return { status: "green", label: "Done", reason: "Projekt abgeschlossen" };

  // Overdue
  if (daysLeft !== null && daysLeft < 0) return { status: "red", label: "\u00DCberf\u00E4llig", reason: `${Math.abs(daysLeft)} Tage \u00FCber Deadline` };

  // Deadline soon + low progress
  if (daysLeft !== null && daysLeft <= 3 && progress < 80) return { status: "red", label: "Kritisch", reason: `Nur noch ${daysLeft}d, aber erst ${progress}%` };

  // Time vs progress mismatch
  if (timeProgress !== null && timeProgress > 0) {
    const ratio = progress / timeProgress;
    if (ratio < 0.5) return { status: "red", label: "At Risk", reason: `${timeProgress}% Zeit verbraucht, nur ${progress}% fertig` };
    if (ratio < 0.75) return { status: "yellow", label: "Achtung", reason: `Fortschritt hinkt der Zeit hinterher` };
  }

  // No deadline set on active project
  if (progress > 0 && !project.deadline) return { status: "yellow", label: "Keine Deadline", reason: "Deadline fehlt" };

  // Default
  if (progress > 0) return { status: "green", label: "On Track", reason: "L\u00E4uft planm\u00E4\u00DFig" };
  return { status: "green", label: "Neu", reason: "Noch nicht gestartet" };
}

function getNextOpenTask(project: Project): { phase: string; task: string } | null {
  for (const phase of project.phases) {
    for (const task of phase.tasks) {
      if (task.status !== "done") return { phase: phase.title, task: task.title };
    }
  }
  return null;
}

// Kanban columns for overview
const kanbanColumns = [
  { key: "new", label: "Neu", color: "bg-gray-400" },
  { key: "onboarding", label: "Onboarding", color: "bg-violet-500" },
  { key: "active", label: "In Arbeit", color: "bg-blue-500" },
  { key: "review", label: "Review / Freigabe", color: "bg-amber-500" },
  { key: "done", label: "Abgeschlossen", color: "bg-emerald-500" },
] as const;

type KanbanKey = typeof kanbanColumns[number]["key"];

function isRunningCampaign(project: Project): boolean {
  // A project is a "running campaign" if it has completed the Launch phase or is 100% done
  const progress = getProjectProgress(project);
  if (progress === 100) return true;
  const launchPhase = project.phases.find((p) => p.title.toLowerCase().includes("launch"));
  if (launchPhase) {
    const launchDone = launchPhase.tasks.length > 0 && launchPhase.tasks.every((t) => t.status === "done");
    if (launchDone) return true;
  }
  return false;
}

function getKanbanColumn(project: Project): KanbanKey {
  const progress = getProjectProgress(project);
  if (progress === 100) return "done";
  if (progress === 0) return "new";
  const current = getCurrentPhase(project);
  if (!current) return "active";
  const title = current.title.toLowerCase();
  if (title.includes("onboarding") || title.includes("kick-off")) return "onboarding";
  if (title.includes("review") || title.includes("freigabe")) return "review";
  return "active";
}

// --- Component (Clean Rewrite) ---

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
  const [overviewTab, setOverviewTab] = useState<"alle" | "aktiv" | "kampagnen" | "neu" | "done">("alle");

  // Close CRM state for project detail
  const [closeActivities, setCloseActivities] = useState<CloseActivity[]>([]);
  const [closeOpportunities, setCloseOpportunities] = useState<CloseOpportunity[]>([]);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeLeadId, setCloseLeadId] = useState<string | null>(null);
  const [closeFetched, setCloseFetched] = useState<string | null>(null);

  // Lead Finder state
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadSearchResults, setLeadSearchResults] = useState<{ id: string; name: string; status: string; contacts: any[] }[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);

  // Pipeline editor state
  const [pipelineEditing, setPipelineEditing] = useState(false);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (viewFilter === "alex") filtered = filtered.filter((p) => p.assignees.some((a) => a.toLowerCase().includes("alex")));
    if (viewFilter === "daniel") filtered = filtered.filter((p) => p.assignees.some((a) => a.toLowerCase().includes("daniel")));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.client.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [projects, searchQuery, viewFilter]);

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) ?? null : null;

  const allActive = filteredProjects.filter((p) => { const prog = getProjectProgress(p); return prog > 0 && prog < 100; });
  const allDoneProjects = filteredProjects.filter((p) => getProjectProgress(p) === 100);
  const allNew = filteredProjects.filter((p) => getProjectProgress(p) === 0);
  const allAtRisk = filteredProjects.filter((p) => { const h = getHealthScore(p); return h.status === "red" || h.status === "yellow"; });
  const runningCampaigns = filteredProjects.filter(isRunningCampaign);
  const allOverdue = filteredProjects.filter((p) => { const dl = getDaysLeft(p); return dl !== null && dl < 0; });

  const tabFilteredProjects = useMemo(() => {
    switch (overviewTab) {
      case "aktiv": return filteredProjects.filter((p) => { const prog = getProjectProgress(p); return prog > 0 && prog < 100; });
      case "neu": return filteredProjects.filter((p) => getProjectProgress(p) === 0);
      case "done": return filteredProjects.filter((p) => getProjectProgress(p) === 100);
      case "kampagnen": return runningCampaigns;
      default: return filteredProjects;
    }
  }, [filteredProjects, overviewTab, runningCampaigns]);

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
      toast.error("Bitte Kunde und Projektname ausf\u00FCllen");
      return;
    }
    if (form.type === "custom" && customPhases.length === 0) {
      toast.error("Bitte mindestens eine Phase ausw\u00E4hlen");
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
    toast.success("Projekt gel\u00F6scht");
  };

  const deleteComment = (projectId: string, commentId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const newComments = project.comments.filter((c) => c.id !== commentId);
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, comments: newComments } : p));
    updateProjectDB(projectId, { comments: newComments });
  };

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

  // Load Close data when project detail opens
  useEffect(() => {
    if (!selectedProject || closeFetched === selectedProject.id) return;
    let cancelled = false;
    (async () => {
      setCloseLoading(true);
      try {
        const lead = await searchLeadByName(selectedProject.client);
        if (cancelled) return;
        if (lead) {
          setCloseLeadId(lead.id);
          const [acts, opps] = await Promise.all([
            getLeadActivities(lead.id),
            getLeadOpportunities(lead.id),
          ]);
          if (cancelled) return;
          setCloseActivities(acts);
          setCloseOpportunities(opps);
        } else {
          setCloseLeadId(null);
          setCloseActivities([]);
          setCloseOpportunities([]);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) {
          setCloseLoading(false);
          setCloseFetched(selectedProject.id);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProject?.id]);

  const goBack = useCallback(() => {
    setSelectedProjectId(null);
    setExpandedPhases(new Set());
    setCloseFetched(null);
    setCloseActivities([]);
    setCloseOpportunities([]);
    setCloseLeadId(null);
    setLeadSearchQuery("");
    setLeadSearchResults([]);
    setPipelineEditing(false);
  }, []);

  const searchCloseLead = useCallback(async (query: string) => {
    if (!query.trim()) { setLeadSearchResults([]); return; }
    setLeadSearching(true);
    try {
      const results = await searchLeads(query);
      setLeadSearchResults(results);
    } catch {
      setLeadSearchResults([]);
    } finally {
      setLeadSearching(false);
    }
  }, []);

  const connectLead = useCallback(async (leadId: string) => {
    setCloseLoading(true);
    try {
      setCloseLeadId(leadId);
      const [acts, opps] = await Promise.all([
        getLeadActivities(leadId),
        getLeadOpportunities(leadId),
      ]);
      setCloseActivities(acts);
      setCloseOpportunities(opps);
    } catch {
      // fail silently
    } finally {
      setCloseLoading(false);
      setLeadSearchQuery("");
      setLeadSearchResults([]);
    }
  }, []);

  const addPhaseToProject = useCallback((projectId: string, blockKey: string, creativeFormat: CreativeFormat) => {
    const block = allPhaseBlockMap[blockKey];
    if (!block) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const isCreativePhase = block.title === "Creative Production" || block.title === "Creative Refresh";
    const tasks = isCreativePhase ? creativeTasks[creativeFormat] : block.tasks;
    const newPhase: Phase = {
      id: `phase-${Date.now()}`,
      title: block.title,
      tasks: tasks.map((t, tIdx) => ({ id: `task-${Date.now()}-${tIdx}`, title: t, status: "todo" as TaskStatus })),
    };
    const newPhases = [...project.phases, newPhase];
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, phases: newPhases } : p));
    updateProjectDB(projectId, { phases: newPhases });
    toast.success(`Phase "${block.title}" hinzugef\u00FCgt`);
  }, [projects]);

  const removePhaseFromProject = useCallback((projectId: string, phaseId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const newPhases = project.phases.filter((p) => p.id !== phaseId);
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, phases: newPhases } : p));
    updateProjectDB(projectId, { phases: newPhases });
    toast.success("Phase entfernt");
  }, [projects]);

  const movePhaseInProject = useCallback((projectId: string, fromIdx: number, toIdx: number) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const newPhases = [...project.phases];
    const [item] = newPhases.splice(fromIdx, 1);
    newPhases.splice(toIdx, 0, item);
    setProjectsLocal((prev) => prev.map((p) => p.id === projectId ? { ...p, phases: newPhases } : p));
    updateProjectDB(projectId, { phases: newPhases });
  }, [projects]);

  // =====================================================================
  // PROJECT DETAIL VIEW — Single scrollable document, no tabs
  // =====================================================================
  if (selectedProject) {
    const progress = getProjectProgress(selectedProject);
    const currentPhase = getCurrentPhase(selectedProject);
    const health = getHealthScore(selectedProject);
    const daysRunningDetail = getDaysRunning(selectedProject);
    const daysLeftDetail = getDaysLeft(selectedProject);
    const isLive = isRunningCampaign(selectedProject) && progress < 100;
    const typeInfo = projectTypeMap[selectedProject.type];
    const formatInfo = creativeFormats.find((f) => f.value === selectedProject.creativeFormat);

    return (
      <div className="space-y-8 max-w-3xl mx-auto pb-16">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              \u2190 Projekte / {selectedProject.client}
            </button>
            <button
              onClick={() => handleDeleteProject(selectedProject.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{selectedProject.client}</div>
            <h1 className="text-lg font-semibold mt-0.5">{selectedProject.name}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              {typeInfo?.label || selectedProject.type}
              {" \u00B7 "}
              {selectedProject.product}
              {formatInfo && <>{" \u00B7 "}{formatInfo.icon} {formatInfo.label}</>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {selectedProject.startDate && <>Started {selectedProject.startDate}</>}
              {daysRunningDetail !== null && daysRunningDetail > 0 && <> \u00B7 {daysRunningDetail} Tage</>}
              {daysLeftDetail !== null && (
                <> \u00B7 {daysLeftDetail < 0 ? `${Math.abs(daysLeftDetail)} Tage \u00FCberf\u00E4llig` : `Deadline in ${daysLeftDetail} Tagen`}</>
              )}
            </div>
          </div>

          {/* Team + Progress */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {teamMembers.map((m) => {
                const isAssigned = selectedProject.assignees.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => {
                      const newAssignees = isAssigned ? selectedProject.assignees.filter((a) => a !== m) : [...selectedProject.assignees, m];
                      setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, assignees: newAssignees } : p));
                      updateProjectDB(selectedProject.id, { assignees: newAssignees });
                    }}
                    className={`text-sm transition-colors ${isAssigned ? "text-foreground font-medium" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <span className="text-2xl font-bold tabular-nums">{progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : "bg-foreground"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* ──────── PHASEN ──────── */}
        <div>
          <div className="border-t border-border/50 mb-8" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Phasen</div>

          {selectedProject.phases.length === 0 && !pipelineEditing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Keine Pipeline eingerichtet. W\u00E4hle einen Projekttyp:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {projectTypes.filter((pt) => pt.value !== "custom").map((pt) => (
                  <button key={pt.value} onClick={() => {
                    const newPhases = createPhases(pt.value, undefined, selectedProject.creativeFormat);
                    setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, type: pt.value, phases: newPhases } : p));
                    updateProjectDB(selectedProject.id, { type: pt.value, phases: newPhases });
                    toast.success(`Pipeline "${pt.label}" erstellt`);
                  }} className="text-left border border-border/50 rounded px-3 py-2 hover:bg-muted/30 transition-colors">
                    <span className="text-sm font-medium">{pt.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{pt.description}</p>
                  </button>
                ))}
                <button onClick={() => {
                  const allKeys = allPhaseBlocks.map((b) => b.key);
                  const newPhases = createPhases("custom" as ProjectType, allKeys, selectedProject.creativeFormat);
                  setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, type: "custom" as ProjectType, phases: newPhases } : p));
                  updateProjectDB(selectedProject.id, { type: "custom" as ProjectType, phases: newPhases });
                  toast.success("Custom Pipeline erstellt");
                }} className="text-left border border-dashed border-border/50 rounded px-3 py-2 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium">Custom Projekt</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Alle Phasen \u2014 entferne was du nicht brauchst.</p>
                </button>
              </div>
            </div>
          )}

          {/* Pipeline editor mode */}
          {pipelineEditing && selectedProject.phases.length > 0 && (
            <div className="space-y-3 mb-4">
              {selectedProject.phases.map((phase, idx) => {
                const doneTasks = phase.tasks.filter((t) => t.status === "done").length;
                return (
                  <div key={phase.id} className="flex items-center gap-2 py-1.5">
                    <div className="flex gap-0.5 shrink-0">
                      <button className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={idx === 0} onClick={() => movePhaseInProject(selectedProject.id, idx, idx - 1)}><ChevronUp className="h-3 w-3" /></button>
                      <button className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={idx === selectedProject.phases.length - 1} onClick={() => movePhaseInProject(selectedProject.id, idx, idx + 1)}><ChevronDown className="h-3 w-3" /></button>
                    </div>
                    <span className="text-xs text-muted-foreground w-4 text-center tabular-nums">{idx + 1}</span>
                    <span className="text-sm flex-1">{phase.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{doneTasks}/{phase.tasks.length}</span>
                    <button className="p-0.5 text-muted-foreground hover:text-destructive transition-colors" onClick={() => removePhaseFromProject(selectedProject.id, phase.id)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                );
              })}
              {allPhaseBlocks.filter((b) => !selectedProject.phases.some((p) => p.title === b.title)).length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-2">Phase hinzuf\u00FCgen</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {allPhaseBlocks.filter((b) => !selectedProject.phases.some((p) => p.title === b.title)).map((block) => (
                      <button key={block.key} onClick={() => addPhaseToProject(selectedProject.id, block.key, selectedProject.creativeFormat)} className="text-left border border-dashed border-border/50 rounded px-2.5 py-1.5 hover:bg-muted/30 transition-colors">
                        <span className="text-xs">{block.title}</span>
                        <span className="text-xs text-muted-foreground ml-1">({block.tasks.length})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase list (flat) */}
          {!pipelineEditing && selectedProject.phases.length > 0 && (
            <div className="space-y-1">
              {selectedProject.phases.map((phase, phaseIdx) => {
                const pProg = getPhaseProgress(phase);
                const allPhaseDone = pProg === 100;
                const isCurrent = phase.id === currentPhase?.id;
                const isExpanded = expandedPhases.has(phase.id) || isCurrent;
                const doneTasks = phase.tasks.filter((t) => t.status === "done").length;

                return (
                  <div key={phase.id}>
                    <button
                      className="w-full text-left flex items-center gap-2 py-1.5 group"
                      onClick={() => togglePhase(phase.id)}
                    >
                      <span className="text-sm shrink-0 w-5 text-center">
                        {allPhaseDone ? "\u2713" : isCurrent ? "\u25B8" : "\u00B7"}
                      </span>
                      <span className={`text-sm flex-1 ${allPhaseDone ? "text-muted-foreground line-through" : isCurrent ? "text-foreground font-medium" : "text-muted-foreground/60"}`}>
                        {phaseIdx + 1}. {phase.title}
                        {isCurrent && !allPhaseDone && <span className="text-xs text-muted-foreground ml-1">(Aktuell)</span>}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{doneTasks}/{phase.tasks.length}</span>
                    </button>

                    {isExpanded && (
                      <div className="ml-8 space-y-0.5 pb-2">
                        {phase.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 py-1 cursor-pointer rounded-sm hover:bg-muted/30 px-1 -mx-1 transition-colors"
                            onClick={() => toggleTask(selectedProject.id, phase.id, task.id)}
                          >
                            <Checkbox
                              checked={task.status === "done"}
                              className="shrink-0 h-3.5 w-3.5"
                              onCheckedChange={() => toggleTask(selectedProject.id, phase.id, task.id)}
                            />
                            <span className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setPipelineEditing(!pipelineEditing)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
          >
            {pipelineEditing ? "Fertig" : "Pipeline bearbeiten"}
          </button>
        </div>

        {/* ──────── BRIEFING & STRATEGIE ──────── */}
        <div>
          <div className="border-t border-border/50 mb-8" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Briefing & Strategie</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Briefing</label>
              <Textarea
                placeholder="Was will der Kunde? Ziele, Budget, Zeitrahmen..."
                rows={4}
                value={selectedProject.briefing}
                onChange={(e) => updateProjectFieldLocal(selectedProject.id, "briefing", e.target.value)}
                onBlur={(e) => saveProjectField(selectedProject.id, "briefing", e.target.value)}
                className="resize-none text-sm border-border/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Zielgruppe</label>
              <Textarea
                placeholder="Wer soll angesprochen werden? Alter, Interessen..."
                rows={4}
                value={selectedProject.targetAudience}
                onChange={(e) => updateProjectFieldLocal(selectedProject.id, "targetAudience", e.target.value)}
                onBlur={(e) => saveProjectField(selectedProject.id, "targetAudience", e.target.value)}
                className="resize-none text-sm border-border/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Meeting-Notizen</label>
              <Textarea
                placeholder="Notizen aus Kick-off, Calls, Meetings..."
                rows={4}
                value={selectedProject.meetingNotes}
                onChange={(e) => updateProjectFieldLocal(selectedProject.id, "meetingNotes", e.target.value)}
                onBlur={(e) => saveProjectField(selectedProject.id, "meetingNotes", e.target.value)}
                className="resize-none text-sm border-border/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Angebot / Offer</label>
              <Textarea
                placeholder="Was ist das Angebot? Rabatt, Freebie, Trial..."
                rows={4}
                value={selectedProject.offer}
                onChange={(e) => updateProjectFieldLocal(selectedProject.id, "offer", e.target.value)}
                onBlur={(e) => saveProjectField(selectedProject.id, "offer", e.target.value)}
                className="resize-none text-sm border-border/50"
              />
            </div>
          </div>
        </div>

        {/* ──────── LINKS & RESSOURCEN ──────── */}
        <div>
          <div className="border-t border-border/50 mb-8" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Links & Ressourcen</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Google Drive", placeholder: "Drive-Link einf\u00FCgen..." },
              { label: "Landingpage", placeholder: "URL der Landingpage..." },
              { label: "Ad Manager", placeholder: "Ad Account Link..." },
            ].map((link) => (
              <div key={link.label}>
                <label className="text-xs text-muted-foreground block mb-1">{link.label}</label>
                <Input placeholder={link.placeholder} className="h-8 text-sm border-dashed border-border/50" />
              </div>
            ))}
          </div>
        </div>

        {/* ──────── ONBOARDING-DATEN ──────── */}
        {selectedProject.onboarding && (() => {
          const ob = selectedProject.onboarding as Record<string, unknown>;
          const sections: { title: string; fields: { label: string; value: unknown }[] }[] = [
            { title: "Agentur", fields: [
              { label: "Firmenname", value: ob.companyName }, { label: "Website", value: ob.website }, { label: "Gr\u00F6\u00DFe", value: ob.teamSize },
              { label: "Ansprechpartner", value: ob.contactName }, { label: "E-Mail", value: ob.contactEmail }, { label: "Telefon", value: ob.contactPhone },
              { label: "Services", value: Array.isArray(ob.services) ? (ob.services as string[]).join(", ") : ob.services },
            ]},
            { title: "Angebot & USP", fields: [
              { label: "Hauptangebot", value: ob.mainOffer }, { label: "Preisrange", value: ob.priceRange },
              { label: "USP", value: ob.usp }, { label: "Case Studies", value: ob.caseStudies }, { label: "Aktuelle Kunden", value: ob.currentClients },
            ]},
            { title: "Traumkunden", fields: [
              { label: "Idealer Kunde", value: ob.idealClient }, { label: "Zielbranchen", value: Array.isArray(ob.idealIndustry) ? (ob.idealIndustry as string[]).join(", ") : ob.idealIndustry },
              { label: "Kundenbudget", value: ob.idealBudget }, { label: "Pain Points", value: ob.clientProblems },
            ]},
            { title: "Aktuelle Kundengewinnung", fields: [
              { label: "Marketing-Kan\u00E4le", value: Array.isArray(ob.currentMarketing) ? (ob.currentMarketing as string[]).join(", ") : ob.currentMarketing },
              { label: "Anfragen / Monat", value: ob.monthlyLeads }, { label: "Closing Rate", value: ob.closingRate }, { label: "Gr\u00F6\u00DFte Herausforderung", value: ob.biggestChallenge },
            ]},
            { title: "Ads & Budget", fields: [
              { label: "Ad-Erfahrung", value: ob.adExperience }, { label: "Kampagnenziel", value: ob.adGoal },
              { label: "Monatliches Ad-Budget", value: ob.monthlyAdBudget }, { label: "Ziel Leads / Monat", value: ob.targetLeadsPerMonth }, { label: "Gew\u00FCnschter Start", value: ob.timeline },
            ]},
            { title: "Material & Assets", fields: [
              { label: "Google Drive / Dropbox Link", value: ob.driveLink }, { label: "Bisherige Ad-Erfahrung", value: ob.existingAds },
            ]},
            { title: "Zug\u00E4nge & Technisches", fields: [
              { label: "Business Manager ID", value: ob.metaBusinessManager }, { label: "Ad Account ID", value: ob.adAccountId },
              { label: "Pixel ID", value: ob.pixelId }, { label: "Landingpage f\u00FCr Ads", value: ob.websiteForAds }, { label: "Sonstige Notizen", value: ob.additionalNotes },
            ]},
          ];
          const hasSomeData = sections.some((s) => s.fields.some((f) => f.value));
          if (!hasSomeData) return null;
          return (
            <div>
              <div className="border-t border-border/50 mb-8" />
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Onboarding-Daten</div>
              <div className="grid gap-6 lg:grid-cols-2">
                {sections.map((section) => {
                  const hasData = section.fields.some((f) => f.value);
                  if (!hasData) return null;
                  return (
                    <div key={section.title}>
                      <div className="text-xs font-medium mb-2">{section.title}</div>
                      <div className="space-y-1">
                        {section.fields.map((field) => {
                          if (!field.value) return null;
                          return (
                            <div key={field.label} className="flex items-start justify-between gap-4">
                              <span className="text-xs text-muted-foreground shrink-0">{field.label}</span>
                              <span className="text-xs text-right">{String(field.value)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ──────── CRM ──────── */}
        <div>
          <div className="border-t border-border/50 mb-8" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">CRM</div>

          {closeLoading && <p className="text-sm text-muted-foreground">Laden...</p>}

          {!closeLoading && closeLeadId && (
            <div className="space-y-4">
              {closeOpportunities.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Deals</div>
                  {closeOpportunities.map((opp) => (
                    <div key={opp.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground capitalize">{opp.status_label || opp.status_type}</span>
                      <span className="text-sm font-medium tabular-nums">
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(opp.value / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {closeActivities.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Letzte Aktivit\u00E4ten</div>
                  {closeActivities.slice(0, 5).map((act, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground py-0.5">
                      {act._type}
                      {act.user_name && <> \u2014 {act.user_name}</>}
                      {act.date_created && <> \u2014 {new Date(act.date_created).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}, {new Date(act.date_created).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</>}
                      {act.duration && <> \u2014 {Math.round(act.duration / 60)} Min.</>}
                      {act.subject && <> \u2014 {act.subject}</>}
                      {act.title && <> \u2014 {act.title}</>}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => window.open(`https://app.close.com/lead/${closeLeadId}/`, "_blank")}
                className="inline-flex items-center gap-1 text-xs text-foreground hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> In Close \u00F6ffnen
              </button>
            </div>
          )}

          {!closeLoading && !closeLeadId && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Kein Lead verkn\u00FCpft.</div>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Lead suchen..."
                  className="h-8 text-sm flex-1 border-border/50"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") searchCloseLead(leadSearchQuery); }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => searchCloseLead(selectedProject.client)}
                  disabled={leadSearching}
                >
                  {leadSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Suchen"}
                </Button>
              </div>
              {leadSearchResults.length > 0 && (
                <div className="space-y-0.5">
                  {leadSearchResults.map((lead) => (
                    <button key={lead.id} onClick={() => connectLead(lead.id)} className="w-full text-left py-1.5 px-1 -mx-1 text-sm hover:bg-muted/30 rounded-sm transition-colors">
                      <span>{lead.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{lead.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ──────── PROJEKT-DETAILS ──────── */}
        <div>
          <div className="border-t border-border/50 mb-8" />
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Projekt-Details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted-foreground">Kunde</span>
              <span className="text-sm">{selectedProject.client}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted-foreground">Produkt</span>
              <span className="text-sm">{selectedProject.product}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted-foreground">Typ</span>
              <span className="text-sm">{typeInfo?.label || selectedProject.type}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted-foreground">Creative</span>
              <span className="text-sm">{formatInfo ? `${formatInfo.icon} ${formatInfo.label}` : selectedProject.creativeFormat}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-muted-foreground">Start</span>
              <span className="text-sm">{selectedProject.startDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Deadline</span>
              <Input
                type="date"
                className="h-7 text-xs w-36 border-border/50"
                value={selectedProject.deadline || ""}
                onChange={(e) => updateProjectFieldLocal(selectedProject.id, "deadline", e.target.value)}
                onBlur={(e) => saveProjectField(selectedProject.id, "deadline", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-muted-foreground block mb-1.5">Team</span>
            <div className="flex gap-2">
              {teamMembers.map((m) => {
                const isAssigned = selectedProject.assignees.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => {
                      const newAssignees = isAssigned ? selectedProject.assignees.filter((a) => a !== m) : [...selectedProject.assignees, m];
                      setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, assignees: newAssignees } : p));
                      updateProjectDB(selectedProject.id, { assignees: newAssignees });
                    }}
                    className={`text-sm transition-colors ${isAssigned ? "text-foreground font-medium" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                  >
                    {m} {isAssigned ? "\u25CF" : "\u25CB"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ──────── NOTIZEN ──────── */}
        <div>
          <div className="border-t border-border/50 mb-8" />
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notizen</div>
            {selectedProject.comments.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{selectedProject.comments.length}</span>
            )}
          </div>

          {/* Composer */}
          <div className="mb-4">
            <Textarea
              placeholder="Kommentar schreiben..."
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="resize-none text-sm border-border/50"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(selectedProject.id); }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">Cmd+Enter</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => addComment(selectedProject.id)} disabled={!commentText.trim()}>
                <Send className="h-3 w-3" /> Senden
              </Button>
            </div>
          </div>

          {/* Thread */}
          {selectedProject.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Noch keine Notizen.</p>
          ) : (
            <div className="space-y-4">
              {[...selectedProject.comments].reverse().map((comment) => (
                <div key={comment.id} className="group">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{comment.author[0]}</span>
                    <span className="text-xs">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">\u00B7 {comment.timestamp}</span>
                    <button
                      onClick={() => deleteComment(selectedProject.id, comment.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 ml-5 whitespace-pre-wrap">{comment.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =====================================================================
  // OVERVIEW PAGE — Data Table
  // =====================================================================
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Projekte</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allActive.length > 0 && <><span>{allActive.length}</span> aktiv</>}
            {allNew.length > 0 && <> \u00B7 {allNew.length} neu</>}
            {runningCampaigns.length > 0 && <> \u00B7 {runningCampaigns.length} live</>}
            {allOverdue.length > 0 && <> \u00B7 <span className="text-red-500">{allOverdue.length} \u00FCberf\u00E4llig</span></>}
            {allActive.length === 0 && allNew.length === 0 && `${filteredProjects.length} Projekte`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Neu
          </Button>

          {/* NEW PROJECT DIALOG */}
          <DialogContent className={form.type === "custom" ? "sm:max-w-xl max-h-[85vh] overflow-y-auto" : "sm:max-w-md"}>
            <DialogHeader>
              <DialogTitle className="text-base">Neues Projekt</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              {/* Client */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Kunde</Label>
                <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Kunde w\u00E4hlen..." /></SelectTrigger>
                  <SelectContent>
                    {existingClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom">+ Neuer Kunde</SelectItem>
                  </SelectContent>
                </Select>
                {form.client === "__custom" && (
                  <Input placeholder="Kundennamen eingeben" className="h-8 text-sm" value={form.clientCustom} onChange={(e) => setForm({ ...form, clientCustom: e.target.value })} />
                )}
              </div>

              {/* Name */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Projektname</Label>
                <Input placeholder="z.B. Spring Campaign 2026" className="h-8 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              {/* Type */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Projekttyp</Label>
                <div className="grid gap-1.5">
                  {projectTypes.map((pt) => (
                    <button key={pt.value} onClick={() => setForm({ ...form, type: pt.value })} className={`text-left rounded-md border px-3 py-2 transition-all ${form.type === pt.value ? "border-foreground" : "border-border/50 hover:border-border"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{pt.label}</span>
                        {pt.badge && <span className="text-xs text-muted-foreground">{pt.badge}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{pt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative Format */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Creative-Format</Label>
                <div className="flex gap-2">
                  {creativeFormats.map((cf) => (
                    <button key={cf.value} onClick={() => setForm({ ...form, creativeFormat: cf.value })} className={`flex-1 rounded-md border py-2 text-center transition-all ${form.creativeFormat === cf.value ? "border-foreground" : "border-border/50 hover:border-border"}`}>
                      <div className="text-base">{cf.icon}</div>
                      <div className="text-xs mt-0.5">{cf.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Phase Builder */}
              {form.type === "custom" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Wrench className="h-3 w-3" />Phasen zusammenstellen</Label>
                  {customPhases.length > 0 && (
                    <div className="space-y-1 mb-1">
                      <div className="text-xs text-muted-foreground">Ausgew\u00E4hlt ({customPhases.length})</div>
                      {customPhases.map((key, idx) => {
                        const block = allPhaseBlockMap[key];
                        if (!block) return null;
                        return (
                          <div key={key} draggable onDragStart={() => setDragPhaseIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragPhaseIdx !== null && dragPhaseIdx !== idx) moveCustomPhase(dragPhaseIdx, idx); setDragPhaseIdx(null); }}
                            className={`flex items-center gap-2 border border-border/50 rounded px-2.5 py-1.5 cursor-grab active:cursor-grabbing transition-all ${dragPhaseIdx === idx ? "opacity-50" : ""}`}>
                            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            <span className="text-xs text-muted-foreground w-4 tabular-nums">{idx + 1}</span>
                            <span className="text-xs font-medium flex-1">{block.title}</span>
                            <span className="text-xs text-muted-foreground">{block.tasks.length} Tasks</span>
                            <div className="flex gap-0.5">
                              <button className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveCustomPhase(idx, idx - 1); }}><ChevronUp className="h-3 w-3" /></button>
                              <button className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={idx === customPhases.length - 1} onClick={(e) => { e.stopPropagation(); moveCustomPhase(idx, idx + 1); }}><ChevronDown className="h-3 w-3" /></button>
                              <button className="p-0.5 text-muted-foreground hover:text-destructive ml-0.5" onClick={(e) => { e.stopPropagation(); toggleCustomPhase(key); }}><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">Verf\u00FCgbare Bausteine</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {allPhaseBlocks.filter((b) => !customPhases.includes(b.key)).map((block) => (
                      <button key={block.key} onClick={() => toggleCustomPhase(block.key)} className="text-left border border-dashed border-border/50 rounded px-2 py-1.5 hover:bg-muted/30 transition-colors">
                        <span className="text-xs">{block.title}</span>
                        <span className="text-xs text-muted-foreground ml-1">({block.tasks.length})</span>
                      </button>
                    ))}
                  </div>
                  {allPhaseBlocks.filter((b) => !customPhases.includes(b.key)).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">Alle Phasen ausgew\u00E4hlt.</p>
                  )}
                </div>
              )}

              {/* Offer */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Offer</Label>
                <Select value={form.product} onValueChange={(v) => setForm({ ...form, product: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Team */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Team</Label>
                <div className="flex gap-2">
                  {teamMembers.map((m) => (
                    <button key={m} onClick={() => toggleAssignee(m)} className={`text-sm px-3 py-1 rounded border transition-all ${form.assignees.includes(m) ? "border-foreground text-foreground" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button size="sm" onClick={handleAddProject}>Erstellen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Status filters — plain text with underline */}
          <div className="flex items-center gap-3">
            {([
              { key: "alle" as const, label: "Alle" },
              { key: "aktiv" as const, label: "In Arbeit" },
              { key: "kampagnen" as const, label: "Live" },
              { key: "neu" as const, label: "Neu" },
              { key: "done" as const, label: "Fertig" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOverviewTab(tab.key)}
                className={`text-xs pb-0.5 transition-colors ${overviewTab === tab.key ? "text-foreground border-b border-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Team filter */}
          <div className="flex items-center gap-2 border-l border-border/50 pl-4">
            {([
              { key: "alle" as const, label: "Alle" },
              { key: "alex" as const, label: "Alex" },
              { key: "daniel" as const, label: "Daniel" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setViewFilter(f.key)}
                className={`text-xs transition-colors ${viewFilter === f.key ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Suchen..." className="pl-8 h-7 w-44 text-xs border-border/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Data Table */}
      <div>
        {/* Header row */}
        <div className="grid grid-cols-[1fr_1.5fr_1fr_60px_60px_60px] gap-2 px-2 pb-2 border-b border-border/50">
          <span className="text-xs text-muted-foreground">Kunde</span>
          <span className="text-xs text-muted-foreground">Projekt</span>
          <span className="text-xs text-muted-foreground">Phase</span>
          <span className="text-xs text-muted-foreground text-right">%</span>
          <span className="text-xs text-muted-foreground text-center">Team</span>
          <span className="text-xs text-muted-foreground text-right">Tage</span>
        </div>

        {/* Project rows */}
        {tabFilteredProjects.map((project) => {
          const progress = getProjectProgress(project);
          const health = getHealthScore(project);
          const current = getCurrentPhase(project);
          const daysRunning = getDaysRunning(project);
          const projectIsLive = isRunningCampaign(project) && progress < 100;

          return (
            <div
              key={project.id}
              className="grid grid-cols-[1fr_1.5fr_1fr_60px_60px_60px] gap-2 px-2 py-3 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors items-center"
              onClick={() => {
                setSelectedProjectId(project.id);
                if (current) setExpandedPhases(new Set([current.id]));
              }}
            >
              {/* Kunde */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${health.status === "green" ? "bg-emerald-500" : health.status === "yellow" ? "bg-amber-500" : "bg-red-500"}`}
                  title={health.reason}
                />
                <span className="text-sm text-muted-foreground truncate">{project.client}</span>
              </div>

              {/* Projekt */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium truncate">{project.name}</span>
                {projectIsLive && <span className="text-xs text-emerald-500 shrink-0">live</span>}
              </div>

              {/* Phase */}
              <span className="text-sm text-muted-foreground truncate">
                {current ? current.title : "\u2014"}
              </span>

              {/* % */}
              <span className={`text-sm tabular-nums text-right ${progress === 0 ? "text-muted-foreground/40" : progress === 100 ? "text-emerald-500" : ""}`}>
                {progress}
              </span>

              {/* Team */}
              <span className="text-xs text-muted-foreground text-center">
                {project.assignees.map((a) => a[0]).join(" ")}
              </span>

              {/* Tage */}
              <span className="text-xs text-muted-foreground text-right tabular-nums">
                {daysRunning !== null && daysRunning > 0 ? daysRunning : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      {tabFilteredProjects.length > 0 && (
        <p className="text-xs text-muted-foreground">{tabFilteredProjects.length} Projekte</p>
      )}

      {tabFilteredProjects.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">Noch keine Projekte.</p>
      )}
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, ChevronRight, ChevronDown, CheckCircle2, MessageSquare, FileText, ListChecks, Send, Trash2, GripVertical, ChevronUp, Wrench, ClipboardList, Building2, Target, DollarSign, KeyRound, ExternalLink, Globe, FolderOpen, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useClients } from "@/store/clients";
import { useProjects, addProject as addProjectDB, updateProject as updateProjectDB, deleteProject as deleteProjectDB } from "@/store/projects";
import type { Project, Phase, Task, Comment, TaskStatus, ProjectType, CreativeFormat } from "@/store/projects";
import { searchLeadByName, searchLeads, getLeadActivities, getLeadOpportunities } from "@/lib/close-api-client";
import type { CloseActivity, CloseOpportunity } from "@/lib/close-api-client";

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
  { value: "kunde-meta", label: "Kunde Meta", description: "Neue Kampagne für bestehenden Meta-Kunden — kein Onboarding nötig.", color: "bg-sky-500", badge: "D4Y" },
  { value: "optimierung", label: "Optimierung / Retargeting", description: "Bestehende Kampagne optimieren — neue Creatives, Angles, A/B Tests.", color: "bg-amber-500", badge: "D4Y" },
  { value: "donewithyou", label: "Done With You (Full)", description: "Zusammenarbeit inkl. Coldcall, LinkedIn, Sales & Email/Instantly.", color: "bg-cyan-500", badge: "DWY" },
  { value: "donewithyou-no-email", label: "Done With You (ohne Email)", description: "Zusammenarbeit inkl. Coldcall, LinkedIn & Sales — ohne Email/Instantly.", color: "bg-teal-500", badge: "DWY" },
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
  "donewithyou-no-email": [
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
  "kunde-meta": [
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
  if (daysLeft !== null && daysLeft < 0) return { status: "red", label: "Überfällig", reason: `${Math.abs(daysLeft)} Tage über Deadline` };

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
  if (progress > 0) return { status: "green", label: "On Track", reason: "Läuft planmäßig" };
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

  // Detail tab state — "overview" is now the default
  const [detailTab, setDetailTab] = useState<"overview" | "pipeline" | "client" | "comments">("overview");

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
    setDetailTab("overview");
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
    toast.success(`Phase "${block.title}" hinzugefügt`);
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

  // Helper: get all open tasks across phases (for overview tab)
  const getOpenTasks = useCallback((project: Project): { phaseTitle: string; phaseId: string; task: Task }[] => {
    const result: { phaseTitle: string; phaseId: string; task: Task }[] = [];
    for (const phase of project.phases) {
      for (const task of phase.tasks) {
        if (task.status !== "done") result.push({ phaseTitle: phase.title, phaseId: phase.id, task });
      }
    }
    return result;
  }, []);

  // =====================================================================
  // PROJECT DETAIL VIEW
  // =====================================================================
  if (selectedProject) {
    const progress = getProjectProgress(selectedProject);
    const currentPhase = getCurrentPhase(selectedProject);
    const health = getHealthScore(selectedProject);
    const daysRunningDetail = getDaysRunning(selectedProject);
    const daysLeftDetail = getDaysLeft(selectedProject);
    const nextTask = getNextOpenTask(selectedProject);
    const currentPhaseIdx = selectedProject.phases.findIndex((p) => p.id === currentPhase?.id);
    const isLive = isRunningCampaign(selectedProject) && progress < 100;

    return (
      <div className="space-y-5">
        {/* Back link */}
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Zurück zu Projekte
        </button>

        {/* Hero Section */}
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{selectedProject.client}</span>
                <span>·</span>
                <Badge className={`${projectTypeMap[selectedProject.type]?.color || "bg-gray-500"} text-white text-[9px] px-1.5 py-0`}>{projectTypeMap[selectedProject.type]?.label || selectedProject.type}</Badge>
                {projectTypeMap[selectedProject.type]?.badge && (
                  <span className={`text-[9px] font-bold rounded px-1 py-0 ${projectTypeMap[selectedProject.type].badge === "DWY" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>{projectTypeMap[selectedProject.type].badge}</span>
                )}
              </div>
              <h1 className="text-base font-semibold">{selectedProject.name}</h1>
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 ${health.status === "green" ? "text-emerald-500" : health.status === "yellow" ? "text-amber-500" : "text-red-500"}`}>
                  <span className={`h-2 w-2 rounded-full ${health.status === "green" ? "bg-emerald-500" : health.status === "yellow" ? "bg-amber-500" : "bg-red-500"}`} />
                  {health.label}
                </span>
                {daysRunningDetail !== null && daysRunningDetail > 0 && (
                  <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">Seit {daysRunningDetail} Tagen</span></>
                )}
                {daysLeftDetail !== null && (
                  <><span className="text-muted-foreground">·</span><span className={daysLeftDetail < 0 ? "text-red-500" : daysLeftDetail <= 3 ? "text-amber-500" : "text-muted-foreground"}>
                    {daysLeftDetail < 0 ? `${Math.abs(daysLeftDetail)} Tage überfällig` : `Deadline in ${daysLeftDetail} Tagen`}
                  </span></>
                )}
                {isLive && <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0">Live</Badge>}
              </div>
              {/* Team pills */}
              <div className="flex items-center gap-1.5 pt-1">
                {teamMembers.map((m) => {
                  const isAssigned = selectedProject.assignees.includes(m);
                  return (
                    <button key={m} onClick={() => {
                      const newAssignees = isAssigned ? selectedProject.assignees.filter((a) => a !== m) : [...selectedProject.assignees, m];
                      setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, assignees: newAssignees } : p));
                      updateProjectDB(selectedProject.id, { assignees: newAssignees });
                    }} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${isAssigned ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 text-[8px] font-bold">{m[0]}</span>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tabular-nums">{progress}%</span>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-8 px-2" onClick={() => handleDeleteProject(selectedProject.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Full-width phase progress bar */}
          {selectedProject.phases.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                {selectedProject.phases.map((phase, idx) => {
                  const pProg = getPhaseProgress(phase);
                  return (
                    <div key={phase.id} className="flex-1 bg-muted/50 rounded-sm overflow-hidden">
                      <div className={`h-full ${phaseColors[idx % phaseColors.length]}`} style={{ width: `${pProg}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-0.5">
                {selectedProject.phases.map((phase, idx) => {
                  const isCur = phase.id === currentPhase?.id;
                  return (
                    <div key={phase.id} className="flex-1 text-center">
                      <span className={`text-[9px] truncate block ${isCur ? "text-primary font-semibold" : "text-muted-foreground/60"}`}>
                        {isCur ? "\u2605" : ""}{idx + 1}·{phase.title.length > 12 ? phase.title.slice(0, 11) + "\u2026" : phase.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation (underline style) */}
        <div className="flex items-center gap-1 border-b border-border">
          {([
            { key: "overview" as const, label: "Übersicht" },
            { key: "pipeline" as const, label: "Pipeline" },
            { key: "client" as const, label: "Kundenbereich" },
            { key: "comments" as const, label: "Notizen" },
          ] as { key: typeof detailTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                detailTab === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.key === "comments" && selectedProject.comments.length > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground ml-1">{selectedProject.comments.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* =================== TAB 1: ÜBERSICHT =================== */}
        {detailTab === "overview" && (
          <div className="space-y-5">
            {/* Top metrics row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Fortschritt */}
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 24 24)" />
                  <text x="24" y="26" textAnchor="middle" className="fill-foreground text-[11px] font-bold">{progress}%</text>
                </svg>
                <div>
                  <div className="text-[10px] text-muted-foreground">Fortschritt</div>
                  <div className="text-sm font-semibold">{progress}%</div>
                </div>
              </div>
              {/* Aktuelle Phase */}
              <div className="rounded-lg border p-3">
                <div className="text-[10px] text-muted-foreground">Aktuelle Phase</div>
                <div className="text-sm font-semibold mt-1 truncate">{currentPhase?.title || "Keine"}</div>
                {currentPhaseIdx >= 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[9px] font-bold rounded px-1 py-0 ${phaseColors[currentPhaseIdx % phaseColors.length]} text-white`}>{currentPhaseIdx + 1}/{selectedProject.phases.length}</span>
                  </div>
                )}
              </div>
              {/* Laufzeit */}
              <div className="rounded-lg border p-3">
                <div className="text-[10px] text-muted-foreground">Laufzeit</div>
                <div className="text-sm font-semibold mt-1">{daysRunningDetail !== null && daysRunningDetail > 0 ? `${daysRunningDetail} Tage` : "Nicht gestartet"}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Start: {selectedProject.startDate}</div>
              </div>
              {/* Nächster Schritt */}
              <div className="rounded-lg border p-3">
                <div className="text-[10px] text-muted-foreground">Nächster Schritt</div>
                <div className="text-sm font-semibold mt-1 truncate">{nextTask?.task || "Alles erledigt"}</div>
                {nextTask && <div className="text-[10px] text-muted-foreground mt-1 truncate">{nextTask.phase}</div>}
              </div>
            </div>

            {/* Two columns: Activity + Open Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Letzte Aktivität */}
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium mb-3">Letzte Aktivität</div>
                {selectedProject.comments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="h-5 w-5 mx-auto mb-1.5 opacity-20" />
                    <p className="text-xs">Noch keine Aktivität</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {[...selectedProject.comments].reverse().slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[8px] font-bold text-primary">{c.author[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs"><span className="font-medium">{c.author}:</span> <span className="text-muted-foreground">{c.text.length > 60 ? c.text.slice(0, 60) + "\u2026" : c.text}</span></span>
                          <div className="text-[10px] text-muted-foreground">{c.timestamp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Offene Tasks */}
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium mb-3">Offene Tasks</div>
                {(() => {
                  const openTasks = getOpenTasks(selectedProject).slice(0, 8);
                  if (openTasks.length === 0) return (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 mx-auto mb-1.5 opacity-20" />
                      <p className="text-xs">Alle Tasks erledigt</p>
                    </div>
                  );
                  return (
                    <div className="space-y-0.5">
                      {openTasks.map((item) => (
                        <div key={item.task.id} className="flex items-center gap-2 py-1 group cursor-pointer rounded-sm hover:bg-muted/30 px-1 -mx-1 transition-colors"
                          onClick={() => toggleTask(selectedProject.id, item.phaseId, item.task.id)}>
                          <Checkbox checked={false} className="shrink-0 h-3.5 w-3.5" onCheckedChange={() => toggleTask(selectedProject.id, item.phaseId, item.task.id)} />
                          <span className="text-xs flex-1 truncate">{item.task.title}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0">{item.phaseTitle.length > 15 ? item.phaseTitle.slice(0, 14) + "\u2026" : item.phaseTitle}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium">Quick Links</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { icon: FolderOpen, label: "Google Drive", placeholder: "Drive-Link einfügen..." },
                  { icon: Globe, label: "Landingpage", placeholder: "URL der Landingpage..." },
                  { icon: BarChart3, label: "Ad Manager", placeholder: "Ad Account Link..." },
                ].map((link) => (
                  <div key={link.label} className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-2 hover:border-primary/30 transition-colors">
                    <link.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-muted-foreground">{link.label}</div>
                      <Input placeholder={link.placeholder} className="h-5 text-xs border-0 p-0 shadow-none focus-visible:ring-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================== TAB 2: PIPELINE =================== */}
        {detailTab === "pipeline" && (
          <div className="space-y-2">
            {/* Editor toggle */}
            {selectedProject.phases.length > 0 && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">{selectedProject.phases.length} Phasen · {selectedProject.phases.reduce((s, p) => s + p.tasks.length, 0)} Tasks</span>
                <Button
                  variant={pipelineEditing ? "default" : "ghost"}
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => setPipelineEditing(!pipelineEditing)}
                >
                  <Wrench className="h-3 w-3" />{pipelineEditing ? "Fertig" : "Bearbeiten"}
                </Button>
              </div>
            )}

            {/* Pipeline Editor */}
            {pipelineEditing && selectedProject.phases.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Pipeline-Baukasten</span>
                </div>
                <div className="space-y-1">
                  {selectedProject.phases.map((phase, idx) => {
                    const pProg = getPhaseProgress(phase);
                    return (
                      <div key={phase.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
                        <div className="flex gap-0.5 shrink-0">
                          <button className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={idx === 0} onClick={() => movePhaseInProject(selectedProject.id, idx, idx - 1)}><ChevronUp className="h-3 w-3" /></button>
                          <button className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={idx === selectedProject.phases.length - 1} onClick={() => movePhaseInProject(selectedProject.id, idx, idx + 1)}><ChevronDown className="h-3 w-3" /></button>
                        </div>
                        <span className="text-[10px] font-bold text-primary w-4 text-center">{idx + 1}</span>
                        <span className="text-xs font-medium flex-1">{phase.title}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{phase.tasks.filter((t) => t.status === "done").length}/{phase.tasks.length}</span>
                        <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${pProg === 100 ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pProg}%` }} />
                        </div>
                        <button className="p-0.5 text-muted-foreground hover:text-destructive transition-colors" onClick={() => removePhaseFromProject(selectedProject.id, phase.id)}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    );
                  })}
                </div>
                {/* Add phase blocks */}
                {allPhaseBlocks.filter((b) => !selectedProject.phases.some((p) => p.title === b.title)).length > 0 && (
                  <>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pt-1">Phase hinzufügen</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {allPhaseBlocks.filter((b) => !selectedProject.phases.some((p) => p.title === b.title)).map((block) => (
                        <button key={block.key} onClick={() => addPhaseToProject(selectedProject.id, block.key, selectedProject.creativeFormat)} className="text-left rounded-md border border-dashed px-2.5 py-2 hover:border-primary/40 hover:bg-primary/5 transition-all">
                          <div className="flex items-center gap-1.5">
                            <Plus className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-xs font-medium">{block.title}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 ml-[18px]">{block.tasks.length} Tasks</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Empty state — pick pipeline type */}
            {selectedProject.phases.length === 0 && (
              <div className="rounded-lg border p-6">
                <div className="text-center mb-5">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">Pipeline einrichten</h3>
                  <p className="text-xs text-muted-foreground mt-1">Projekttyp wählen — Phasen werden automatisch erstellt.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {projectTypes.filter((pt) => pt.value !== "custom").map((pt) => (
                    <button key={pt.value} onClick={() => {
                      const newPhases = createPhases(pt.value, undefined, selectedProject.creativeFormat);
                      setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, type: pt.value, phases: newPhases } : p));
                      updateProjectDB(selectedProject.id, { type: pt.value, phases: newPhases });
                      toast.success(`Pipeline "${pt.label}" erstellt`);
                    }} className="text-left rounded-lg border p-3 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`h-2 w-2 rounded-full ${pt.color}`} />
                        <span className="text-xs font-semibold group-hover:text-primary">{pt.label}</span>
                        {pt.badge && <span className={`text-[9px] font-bold rounded px-1 py-0 ${pt.badge === "DWY" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>{pt.badge}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-4">{pt.description}</p>
                    </button>
                  ))}
                  <button onClick={() => {
                    const allKeys = allPhaseBlocks.map((b) => b.key);
                    const newPhases = createPhases("custom" as ProjectType, allKeys, selectedProject.creativeFormat);
                    setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, type: "custom" as ProjectType, phases: newPhases } : p));
                    updateProjectDB(selectedProject.id, { type: "custom" as ProjectType, phases: newPhases });
                    toast.success("Custom Pipeline erstellt");
                  }} className="text-left rounded-lg border border-dashed p-3 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Wrench className="h-3 w-3 text-pink-500" />
                      <span className="text-xs font-semibold group-hover:text-primary">Custom Projekt</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground ml-5">Alle Phasen — entferne was du nicht brauchst.</p>
                  </button>
                </div>
              </div>
            )}

            {/* Phase cards (expandable) */}
            {!pipelineEditing && selectedProject.phases.map((phase, phaseIdx) => {
              const pProg = getPhaseProgress(phase);
              const isExpanded = expandedPhases.has(phase.id) || phase.id === currentPhase?.id;
              const isCurrent = phase.id === currentPhase?.id;
              const allPhaseDone = pProg === 100;
              const doneTasks = phase.tasks.filter((t) => t.status === "done").length;

              return (
                <div key={phase.id} className={`rounded-lg border transition-all ${isCurrent ? "border-primary/30 bg-primary/[0.02]" : ""} ${allPhaseDone ? "opacity-60" : ""}`}>
                  <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => togglePhase(phase.id)}>
                    <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${allPhaseDone ? "bg-emerald-500/10 text-emerald-500" : isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {allPhaseDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : phaseIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${allPhaseDone ? "line-through text-muted-foreground" : ""}`}>{phase.title}</span>
                        {isCurrent && !allPhaseDone && <span className="text-[10px] text-primary font-medium">Aktuell</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums mr-2">{doneTasks}/{phase.tasks.length}</span>
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0 mr-2">
                      <div className={`h-full rounded-full transition-all ${allPhaseDone ? "bg-emerald-500" : phaseColors[phaseIdx % phaseColors.length]}`} style={{ width: `${pProg}%` }} />
                    </div>
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <div className="ml-9 space-y-0.5 border-l border-border/50 pl-4">
                        {phase.tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-2.5 py-1 group cursor-pointer rounded-sm hover:bg-muted/30 px-1 -mx-1 transition-colors" onClick={() => toggleTask(selectedProject.id, phase.id, task.id)}>
                            <Checkbox checked={task.status === "done"} className="shrink-0 h-3.5 w-3.5" onCheckedChange={() => toggleTask(selectedProject.id, phase.id, task.id)} />
                            <span className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* =================== TAB 3: KUNDENBEREICH =================== */}
        {detailTab === "client" && (
          <div className="space-y-5">

            {/* Briefing & Strategie */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Briefing & Strategie</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Briefing</Label>
                  <Textarea placeholder="Was will der Kunde? Ziele, Budget, Zeitrahmen, besondere Wünsche..." rows={5}
                    value={selectedProject.briefing}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "briefing", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "briefing", e.target.value)}
                    className="resize-none text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Zielgruppe</Label>
                  <Textarea placeholder="Wer soll angesprochen werden? Alter, Interessen, Verhalten..." rows={5}
                    value={selectedProject.targetAudience}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "targetAudience", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "targetAudience", e.target.value)}
                    className="resize-none text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Angebot / Offer</Label>
                  <Textarea placeholder="Was ist das Angebot? Rabatt, Freebie, Trial..." rows={5}
                    value={selectedProject.offer}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "offer", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "offer", e.target.value)}
                    className="resize-none text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Meeting-Notizen</Label>
                  <Textarea placeholder="Notizen aus Kick-off, Calls, Meetings..." rows={5}
                    value={selectedProject.meetingNotes}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "meetingNotes", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "meetingNotes", e.target.value)}
                    className="resize-none text-sm" />
                </div>
              </div>
            </div>

            {/* Onboarding-Daten (only if exists) */}
            {selectedProject.onboarding && (() => {
              const ob = selectedProject.onboarding as Record<string, unknown>;
              const sections: { title: string; icon: typeof Building2; fields: { label: string; value: unknown }[] }[] = [
                { title: "Agentur", icon: Building2, fields: [
                  { label: "Firmenname", value: ob.companyName }, { label: "Website", value: ob.website }, { label: "Größe", value: ob.teamSize },
                  { label: "Ansprechpartner", value: ob.contactName }, { label: "E-Mail", value: ob.contactEmail }, { label: "Telefon", value: ob.contactPhone },
                  { label: "Services", value: Array.isArray(ob.services) ? (ob.services as string[]).join(", ") : ob.services },
                ]},
                { title: "Angebot & USP", icon: FileText, fields: [
                  { label: "Hauptangebot", value: ob.mainOffer }, { label: "Preisrange", value: ob.priceRange },
                  { label: "USP", value: ob.usp }, { label: "Case Studies", value: ob.caseStudies }, { label: "Aktuelle Kunden", value: ob.currentClients },
                ]},
                { title: "Traumkunden", icon: Target, fields: [
                  { label: "Idealer Kunde", value: ob.idealClient }, { label: "Zielbranchen", value: Array.isArray(ob.idealIndustry) ? (ob.idealIndustry as string[]).join(", ") : ob.idealIndustry },
                  { label: "Kundenbudget", value: ob.idealBudget }, { label: "Pain Points", value: ob.clientProblems },
                ]},
                { title: "Aktuelle Kundengewinnung", icon: MessageSquare, fields: [
                  { label: "Marketing-Kanäle", value: Array.isArray(ob.currentMarketing) ? (ob.currentMarketing as string[]).join(", ") : ob.currentMarketing },
                  { label: "Anfragen / Monat", value: ob.monthlyLeads }, { label: "Closing Rate", value: ob.closingRate }, { label: "Größte Herausforderung", value: ob.biggestChallenge },
                ]},
                { title: "Ads & Budget", icon: DollarSign, fields: [
                  { label: "Ad-Erfahrung", value: ob.adExperience }, { label: "Kampagnenziel", value: ob.adGoal },
                  { label: "Monatliches Ad-Budget", value: ob.monthlyAdBudget }, { label: "Ziel Leads / Monat", value: ob.targetLeadsPerMonth }, { label: "Gewünschter Start", value: ob.timeline },
                ]},
                { title: "Material & Assets", icon: ClipboardList, fields: [
                  { label: "Google Drive / Dropbox Link", value: ob.driveLink }, { label: "Bisherige Ad-Erfahrung", value: ob.existingAds },
                ]},
                { title: "Zugänge & Technisches", icon: KeyRound, fields: [
                  { label: "Business Manager ID", value: ob.metaBusinessManager }, { label: "Ad Account ID", value: ob.adAccountId },
                  { label: "Pixel ID", value: ob.pixelId }, { label: "Landingpage für Ads", value: ob.websiteForAds }, { label: "Sonstige Notizen", value: ob.additionalNotes },
                ]},
              ];
              const hasSomeData = sections.some((s) => s.fields.some((f) => f.value));
              if (!hasSomeData) return null;
              return (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Onboarding-Daten</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {sections.map((section) => {
                      const hasData = section.fields.some((f) => f.value);
                      if (!hasData) return null;
                      const Icon = section.icon;
                      return (
                        <div key={section.title} className="rounded-md border p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">{section.title}</span>
                          </div>
                          <div className="space-y-1.5">
                            {section.fields.map((field) => {
                              if (!field.value) return null;
                              const isLong = typeof field.value === "string" && field.value.length > 60;
                              return (
                                <div key={field.label} className={isLong ? "" : "flex items-start justify-between gap-4"}>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{field.label}</span>
                                  <span className={`text-xs font-medium ${isLong ? "block mt-0.5" : "text-right"}`}>{String(field.value)}</span>
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

            {/* CRM Integration (Close) */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">CRM Integration (Close)</span>
              </div>

              {closeLoading && (
                <div className="text-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-1.5">CRM-Daten laden...</p>
                </div>
              )}

              {!closeLoading && closeLeadId && (
                <div className="space-y-3">
                  {/* Opportunities */}
                  {closeOpportunities.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">Deals</div>
                      {closeOpportunities.map((opp) => (
                        <div key={opp.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${opp.status_type === "won" ? "bg-emerald-500/10 text-emerald-600" : opp.status_type === "lost" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                            {opp.status_label || opp.status_type}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(opp.value / 100)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Activities */}
                  {closeActivities.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">Letzte Aktivitäten</div>
                      {closeActivities.slice(0, 5).map((act, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs py-1">
                          {act._type === "Call" && <span className="text-[10px]">📞</span>}
                          {act._type === "Email" && <span className="text-[10px]">📧</span>}
                          {act._type === "Meeting" && <span className="text-[10px]">📅</span>}
                          {!["Call", "Email", "Meeting"].includes(act._type) && <span className="text-[10px]">📝</span>}
                          <span className="text-muted-foreground flex-1 truncate">{act._type}: {(act as any).subject || (act as any).note || (act as any).direction || "Aktivität"}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{act.date_created ? new Date(act.date_created).toLocaleDateString("de-DE") : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={() => window.open(`https://app.close.com/lead/${closeLeadId}/`, "_blank")} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />In Close öffnen
                  </button>
                </div>
              )}

              {!closeLoading && !closeLeadId && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Kein Lead verknüpft. Suche nach dem Kunden:</div>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                      <Input placeholder="Lead suchen..." className="h-6 text-[10px] pl-6" value={leadSearchQuery}
                        onChange={(e) => setLeadSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") searchCloseLead(leadSearchQuery); }} />
                    </div>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => searchCloseLead(selectedProject.client)} disabled={leadSearching}>
                      {leadSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{selectedProject.client} suchen</>}
                    </Button>
                  </div>
                  {leadSearchResults.length > 0 && (
                    <div className="space-y-1">
                      {leadSearchResults.map((lead) => (
                        <button key={lead.id} onClick={() => connectLead(lead.id)} className="w-full text-left rounded-md border px-2 py-1.5 text-[10px] hover:bg-muted/50 transition-colors">
                          <span className="font-medium">{lead.name}</span>
                          <span className="text-muted-foreground ml-1">{lead.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Projekt-Details */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Projekt-Details</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-[10px] text-muted-foreground">Kunde</div>
                  <div className="text-sm font-medium">{selectedProject.client}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Offer</div>
                  <div className="text-sm font-medium">{selectedProject.product}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Projekttyp</div>
                  <Badge className={`${projectTypeMap[selectedProject.type]?.color || "bg-gray-500"} text-white text-[9px] px-1.5 py-0`}>{projectTypeMap[selectedProject.type]?.label || selectedProject.type}</Badge>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Creative-Format</div>
                  <div className="text-sm">
                    {creativeFormats.find((f) => f.value === selectedProject.creativeFormat)?.icon}{" "}
                    {creativeFormats.find((f) => f.value === selectedProject.creativeFormat)?.label}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Startdatum</div>
                  <div className="text-sm font-medium">{selectedProject.startDate}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Deadline</div>
                  <Input type="date" className="h-7 text-xs w-36 mt-0.5" value={selectedProject.deadline || ""}
                    onChange={(e) => updateProjectFieldLocal(selectedProject.id, "deadline", e.target.value)}
                    onBlur={(e) => saveProjectField(selectedProject.id, "deadline", e.target.value)} />
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-[10px] text-muted-foreground mb-1.5">Team</div>
                <div className="flex gap-1.5">
                  {teamMembers.map((m) => {
                    const isAssigned = selectedProject.assignees.includes(m);
                    return (
                      <button key={m} onClick={() => {
                        const newAssignees = isAssigned ? selectedProject.assignees.filter((a) => a !== m) : [...selectedProject.assignees, m];
                        setProjectsLocal((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, assignees: newAssignees } : p));
                        updateProjectDB(selectedProject.id, { assignees: newAssignees });
                      }} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${isAssigned ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">{m[0]}</span>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================== TAB 4: NOTIZEN =================== */}
        {detailTab === "comments" && (
          <div className="space-y-4">
            {/* Composer */}
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <span className="text-[10px] font-bold text-primary">A</span>
              </div>
              <div className="flex-1">
                <Textarea placeholder="Kommentar schreiben..." rows={2}
                  value={commentText} onChange={(e) => setCommentText(e.target.value)} className="resize-none text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(selectedProject.id); }} />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">Cmd+Enter</span>
                  <Button size="sm" className="h-7 text-xs" onClick={() => addComment(selectedProject.id)} disabled={!commentText.trim()}>
                    <Send className="h-3 w-3 mr-1" />Senden
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
            {selectedProject.comments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Noch keine Notizen.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...selectedProject.comments].reverse().map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{comment.author[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.author}</span>
                        <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
                        <button onClick={() => deleteComment(selectedProject.id, comment.id)} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // OVERVIEW PAGE — Project Grid
  // =====================================================================
  return (
    <div className="space-y-4">
      {/* Header area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projekte</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allActive.length > 0 && <><span className="text-foreground">{allActive.length}</span> aktiv</>}
            {allNew.length > 0 && <> · {allNew.length} neu</>}
            {runningCampaigns.length > 0 && <> · {runningCampaigns.length} live Kampagnen</>}
            {allOverdue.length > 0 && <> · <span className="text-red-500">{allOverdue.length} überfällig</span></>}
            {allActive.length === 0 && allNew.length === 0 && `${filteredProjects.length} Projekte`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />Neues Projekt
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
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
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
                    <button key={pt.value} onClick={() => setForm({ ...form, type: pt.value })} className={`text-left rounded-md border px-3 py-2 transition-all ${form.type === pt.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${pt.color}`} />
                        <span className="text-sm font-medium">{pt.label}</span>
                        {pt.badge && <span className={`text-[9px] font-bold rounded px-1 py-0 ${pt.badge === "DWY" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>{pt.badge}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-4">{pt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative Format */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Creative-Format</Label>
                <div className="flex gap-2">
                  {creativeFormats.map((cf) => (
                    <button key={cf.value} onClick={() => setForm({ ...form, creativeFormat: cf.value })} className={`flex-1 rounded-md border py-2 text-center transition-all ${form.creativeFormat === cf.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"}`}>
                      <div className="text-base">{cf.icon}</div>
                      <div className="text-[10px] font-medium mt-0.5">{cf.label}</div>
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
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Ausgewählt ({customPhases.length})</div>
                      {customPhases.map((key, idx) => {
                        const block = allPhaseBlockMap[key];
                        if (!block) return null;
                        return (
                          <div key={key} draggable onDragStart={() => setDragPhaseIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragPhaseIdx !== null && dragPhaseIdx !== idx) moveCustomPhase(dragPhaseIdx, idx); setDragPhaseIdx(null); }}
                            className={`flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 cursor-grab active:cursor-grabbing transition-all ${dragPhaseIdx === idx ? "opacity-50 ring-2 ring-primary" : "hover:shadow-sm"}`}>
                            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            <span className="text-[10px] font-bold text-primary w-4">{idx + 1}</span>
                            <span className="text-xs font-medium flex-1">{block.title}</span>
                            <span className="text-[10px] text-muted-foreground">{block.tasks.length} Tasks</span>
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
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Verfügbare Bausteine</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {allPhaseBlocks.filter((b) => !customPhases.includes(b.key)).map((block) => (
                      <button key={block.key} onClick={() => toggleCustomPhase(block.key)} className="text-left rounded-md border border-dashed px-2 py-1.5 hover:border-primary/40 hover:bg-primary/5 transition-all">
                        <div className="flex items-center gap-1.5"><Plus className="h-3 w-3 text-primary shrink-0" /><span className="text-xs font-medium">{block.title}</span></div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 ml-[18px]">{block.tasks.length} Tasks</p>
                      </button>
                    ))}
                  </div>
                  {allPhaseBlocks.filter((b) => !customPhases.includes(b.key)).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">Alle Phasen ausgewählt.</p>
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
                    <button key={m} onClick={() => toggleAssignee(m)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-all ${form.assignees.includes(m) ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/30"}`}>
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

      {/* Filter row: tabs + team pills + search */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Status tabs */}
          <div className="flex items-center gap-0.5">
            {([
              { key: "alle" as const, label: "Alle" },
              { key: "aktiv" as const, label: "In Arbeit" },
              { key: "kampagnen" as const, label: "Live Kampagnen" },
              { key: "neu" as const, label: "Neu" },
              { key: "done" as const, label: "Abgeschlossen" },
            ]).map((tab) => (
              <button key={tab.key} onClick={() => setOverviewTab(tab.key)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${overviewTab === tab.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          {/* Team filter pills */}
          <div className="flex items-center gap-1 border-l border-border pl-3">
            {([
              { key: "alle" as const, label: "Alle" },
              { key: "alex" as const, label: "Alex" },
              { key: "daniel" as const, label: "Daniel" },
            ] as const).map((f) => (
              <button key={f.key} onClick={() => setViewFilter(f.key)} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${viewFilter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Suchen..." className="pl-8 h-7 w-44 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Project Grid (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tabFilteredProjects.map((project) => {
          const progress = getProjectProgress(project);
          const health = getHealthScore(project);
          const daysRunning = getDaysRunning(project);
          const current = getCurrentPhase(project);
          const nextOpenTask = getNextOpenTask(project);
          const projectIsLive = isRunningCampaign(project) && progress < 100;
          const currentPhaseIndex = project.phases.findIndex((p) => p.id === current?.id);

          return (
            <div
              key={project.id}
              className="rounded-lg border p-4 cursor-pointer hover:border-primary/40 transition-all space-y-3"
              onClick={() => {
                setSelectedProjectId(project.id);
                if (current) setExpandedPhases(new Set([current.id]));
              }}
            >
              {/* Row 1: health dot, client, type badge, D4Y badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${health.status === "green" ? "bg-emerald-500" : health.status === "yellow" ? "bg-amber-500" : "bg-red-500"}`} title={health.reason} />
                  <span className="text-xs text-muted-foreground truncate">{project.client}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`${projectTypeMap[project.type]?.color || "bg-gray-500"} text-white text-[9px] px-1.5 py-0`}>{projectTypeMap[project.type]?.label || project.type}</Badge>
                  {projectTypeMap[project.type]?.badge && (
                    <span className={`text-[9px] font-bold rounded px-1 py-0 ${projectTypeMap[project.type].badge === "DWY" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}>{projectTypeMap[project.type].badge}</span>
                  )}
                </div>
              </div>

              {/* Row 2: project name + progress or Live badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{project.name}</span>
                {projectIsLive ? (
                  <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 shrink-0">Live</Badge>
                ) : (
                  <span className="text-sm font-bold tabular-nums shrink-0">{progress}%</span>
                )}
              </div>

              {/* Phase progress bar (multi-segment, thin) */}
              {project.phases.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                    {project.phases.map((phase, idx) => {
                      const pProg = getPhaseProgress(phase);
                      return (
                        <div key={phase.id} className="flex-1 bg-muted/50 rounded-sm overflow-hidden">
                          <div className={`h-full ${phaseColors[idx % phaseColors.length]}`} style={{ width: `${pProg}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  {/* Phase labels */}
                  <div className="flex gap-0.5">
                    {project.phases.map((phase, idx) => {
                      const isCur = phase.id === current?.id;
                      const abbreviatedTitle = phase.title.length > 10 ? phase.title.slice(0, 9) + "\u2026" : phase.title;
                      return (
                        <div key={phase.id} className="flex-1 text-center">
                          <span className={`text-[8px] truncate block ${isCur ? "text-primary font-semibold" : "text-muted-foreground/50"}`}>
                            {isCur ? "\u2605" : ""}{abbreviatedTitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom row: assignees, days, next task */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {/* Assignee initials */}
                <div className="flex -space-x-1 shrink-0">
                  {project.assignees.map((a) => (
                    <span key={a} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-card">{a[0]}</span>
                  ))}
                </div>
                {daysRunning !== null && daysRunning > 0 && (
                  <><span>·</span><span>Seit {daysRunning} Tagen</span></>
                )}
                {nextOpenTask && (
                  <><span>·</span><span className="truncate">Nächster: {nextOpenTask.task}</span></>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {tabFilteredProjects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground rounded-lg border">
          <p className="text-sm">Keine Projekte in dieser Ansicht.</p>
        </div>
      )}
    </div>
  );
}

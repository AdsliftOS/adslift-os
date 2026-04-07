import { listAllEvents, getAccounts, type GoogleCalendarEvent } from "@/lib/google-calendar";
import { getActivities, type CloseActivity } from "@/lib/close-api-client";
import { getExistingSourceIds, bulkAddTimeEntries } from "@/store/timeEntries";
import type { Category } from "@/store/timeEntries";

// --- Category detection (mirrors TimeTracking.tsx keywords) ---

const categoryKeywords: { keywords: string[]; category: Category }[] = [
  { keywords: [
    "creative erstellen", "creatives erstellen", "creatives", "creative", "design", "hook", "hooks", "angle", "angles",
    "video", "videos", "schnitt", "schneiden", "grafik", "grafiken", "thumbnail", "thumbnails",
    "canva", "figma", "photoshop", "illustrator", "after effects", "premiere",
    "mockup", "mockups", "visual", "visuals", "storyboard", "animation",
    "bildbearbeitung", "reels", "reel", "ugc", "script", "skript",
    "vorlage", "vorlagen", "template", "templates", "banner", "ad design",
  ], category: "creative" },
  { keywords: [
    "sales call", "sales", "closing", "closer", "discovery", "discovery call",
    "lead", "leads", "angebot", "angebote", "pitch", "pitchen",
    "setter", "setting", "setter call", "deal", "deals",
    "verhandlung", "verhandeln", "akquise", "kaltakquise", "cold call",
    "nachfassen", "follow up", "followup", "follow-up",
    "einwandbehandlung", "qualifizierung", "qualifizieren",
    "crm", "close crm", "pipeline", "upsell", "cross-sell",
    "provisionen", "conversion", "abschluss", "abschließen",
  ], category: "sales" },
  { keywords: [
    "fulfillment", "fulfilment", "kunde einarbeiten", "kunden einarbeiten",
    "onboarding", "einarbeiten", "einarbeitung",
    "kampagne", "kampagnen", "ad copy", "adcopy", "copy schreiben", "texte schreiben",
    "ads", "meta ads", "facebook ads", "instagram ads", "google ads",
    "reporting", "report", "berichte", "bericht", "auswertung",
    "zielgruppe", "zielgruppen", "targeting", "retargeting", "lookalike",
    "pixel", "pixel einrichten", "conversion api",
    "ad manager", "werbeanzeigenmanager", "business manager",
    "briefing", "kundenarbeit", "kundenprojekt",
    "a/b test", "split test", "skalieren", "budget",
    "landingpage", "landing page", "funnel bauen",
    "loom", "kundenvideo", "walkthrough",
  ], category: "fulfillment" },
  { keywords: [
    "admin", "administration", "email", "emails", "e-mail", "e-mails",
    "slack", "buchhaltung", "buchführung", "rechnung", "rechnungen",
    "steuer", "steuern", "steuererklärung", "finanzamt",
    "organisation", "organisieren", "planung", "tagesplanung", "wochenplanung",
    "dokument", "dokumente", "dokumentation", "vertrag", "verträge",
    "büro", "office", "aufräumen", "sortieren", "ablage",
    "datev", "sevdesk", "lexoffice", "banking",
    "passwort", "passwörter", "lastpass", "1password",
    "kalender", "termine planen", "termin", "versicherung",
    "postfach", "inbox", "inbox zero",
  ], category: "admin" },
  { keywords: [
    "growth", "wachstum", "strategie", "strategisch",
    "content", "content strategie", "content plan", "contentplan",
    "funnel", "funnel optimierung", "conversion rate",
    "optimierung", "optimieren", "analyse", "analysieren", "analytics",
    "skalierung", "skalieren", "prozess", "prozesse",
    "automation", "automatisierung", "zapier", "make", "n8n",
    "system", "systeme", "workflow", "workflows",
    "kpi", "kpis", "metriken", "dashboard",
    "marktanalyse", "wettbewerb", "konkurrenz", "benchmark",
    "brainstorm", "brainstorming", "ideation", "innovation",
    "test", "testen", "experiment", "hypothese",
    "roadmap", "quartalsziele", "jahresziele", "okr", "okrs",
  ], category: "growth" },
  { keywords: [
    "meeting", "meetings", "call", "calls", "zoom", "zoom call",
    "google meet", "teams", "microsoft teams",
    "besprechung", "besprechungen", "sync", "daily sync",
    "standup", "stand-up", "daily", "weekly",
    "abstimmung", "abstimmen", "teammeeting", "team meeting",
    "jour fixe", "retrospektive", "retro",
    "workshop", "brainstorming session",
    "kundencall", "kunden call", "interncall", "intern call",
    "präsentation", "demo", "vorstellung",
  ], category: "meeting" },
  { keywords: [
    "pause", "mittag", "mittagspause", "mittagessen",
    "break", "essen", "kaffee", "kaffeepause",
    "spaziergang", "spazieren", "frische luft",
    "auszeit", "erholung", "gym", "sport", "training",
  ], category: "pause" },
];

function detectCategory(text: string): Category {
  const lower = text.toLowerCase().trim();
  if (!lower) return "meeting"; // default for calendar events

  let bestMatch: { category: Category; length: number } | null = null;
  for (const { keywords, category } of categoryKeywords) {
    for (const kw of keywords) {
      if (lower.includes(kw) && (!bestMatch || kw.length > bestMatch.length)) {
        bestMatch = { category, length: kw.length };
      }
    }
  }
  return bestMatch?.category ?? "meeting";
}

// Round minutes to nearest 15-minute block
function roundTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

// --- Google Calendar Sync ---

export async function syncGoogleCalendarToTimeEntries(
  weekStart: Date,
  weekEnd: Date,
  assignee = "alex"
): Promise<{ synced: number; skipped: number }> {
  const accounts = getAccounts();
  if (accounts.length === 0) throw new Error("Kein Google Account verbunden");

  const timeMin = weekStart.toISOString();
  const timeMax = weekEnd.toISOString();

  const allResults = await listAllEvents(timeMin, timeMax);
  const existingIds = getExistingSourceIds("google-calendar");

  // Map email to assignee
  const emailToAssignee: Record<string, string> = {
    "info@consulting-og.de": "alex",
    "office@consulting-og.de": "daniel",
  };

  const newEntries: Parameters<typeof bulkAddTimeEntries>[0] = [];
  let skipped = 0;

  for (const { email, events } of allResults) {
    for (const event of events) {
      const sourceId = `gcal-${email}-${event.id}`;

      // Skip if already synced
      if (existingIds.has(sourceId)) {
        skipped++;
        continue;
      }

      // Skip all-day events (no dateTime)
      if (!event.start.dateTime || !event.end.dateTime) continue;

      const startDt = new Date(event.start.dateTime);
      const endDt = new Date(event.end.dateTime);

      // Skip events shorter than 5 minutes
      if (endDt.getTime() - startDt.getTime() < 5 * 60 * 1000) continue;

      const date = event.start.dateTime.split("T")[0];
      const startHour = startDt.getHours();
      const startMinute = roundTo15(startDt.getMinutes());
      let endHour = endDt.getHours();
      let endMinute = roundTo15(endDt.getMinutes());

      // Handle rounding overflow
      if (startMinute >= 60) continue; // edge case
      if (endMinute >= 60) {
        endMinute = 0;
        endHour += 1;
      }

      // Skip if start == end after rounding
      if (startHour === endHour && startMinute === endMinute) continue;

      const title = event.summary || "(Kein Titel)";
      const category = detectCategory(title);
      const entryAssignee = emailToAssignee[email] || assignee;

      newEntries.push({
        date,
        startHour,
        startMinute,
        endHour,
        endMinute,
        category,
        note: `${title}`,
        assignee: entryAssignee,
        source: "google-calendar",
        sourceId,
      });
    }
  }

  const synced = await bulkAddTimeEntries(newEntries);
  return { synced, skipped };
}

// --- Close CRM Sync ---

export async function syncCloseActivitiesToTimeEntries(
  weekStart: Date,
  weekEnd: Date,
  assignee = "alex"
): Promise<{ synced: number; skipped: number }> {
  const dateGte = weekStart.toISOString().slice(0, 10);
  const dateLte = weekEnd.toISOString().slice(0, 10);

  const activities = await getActivities({
    date_created__gte: dateGte,
    date_created__lte: dateLte,
    _limit: "200",
  });

  // Only sync calls and meetings (they have duration/time)
  const syncable = activities.filter(
    (a) => (a._type === "Call" || a._type === "call" || a._type === "Meeting" || a._type === "meeting") && a.duration
  );

  const existingIds = getExistingSourceIds("close-crm");
  const newEntries: Parameters<typeof bulkAddTimeEntries>[0] = [];
  let skipped = 0;

  for (const activity of syncable) {
    const sourceId = `close-${activity.id}`;

    if (existingIds.has(sourceId)) {
      skipped++;
      continue;
    }

    const createdAt = new Date(activity.date_created);
    const date = activity.date_created.slice(0, 10);
    const startHour = createdAt.getHours();
    const startMinute = roundTo15(createdAt.getMinutes());

    // Calculate end time from duration (seconds)
    const durationMinutes = Math.ceil((activity.duration || 0) / 60);
    const totalEndMinutes = startHour * 60 + startMinute + Math.max(roundTo15(durationMinutes), 15);
    let endHour = Math.floor(totalEndMinutes / 60);
    let endMinute = totalEndMinutes % 60;

    // Clamp to 24:00
    if (endHour >= 24) { endHour = 24; endMinute = 0; }

    const isMeeting = activity._type === "Meeting" || activity._type === "meeting";
    const category: Category = isMeeting ? "meeting" : "sales";

    // Build descriptive note
    const parts: string[] = [];
    if (activity.lead_name) parts.push(activity.lead_name);
    if (activity.title) parts.push(activity.title);
    if (activity.disposition) parts.push(activity.disposition);
    if (!isMeeting && activity.direction) parts.push(activity.direction === "outbound" ? "Outbound Call" : "Inbound Call");

    const note = parts.length > 0 ? parts.join(" — ") : (isMeeting ? "Meeting (Close)" : "Call (Close)");

    newEntries.push({
      date,
      startHour,
      startMinute,
      endHour,
      endMinute,
      category,
      note,
      assignee,
      source: "close-crm",
      sourceId,
    });
  }

  const synced = await bulkAddTimeEntries(newEntries);
  return { synced, skipped };
}

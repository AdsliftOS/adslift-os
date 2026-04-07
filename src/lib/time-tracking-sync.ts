import { listAllEvents, getAccounts, type GoogleCalendarEvent } from "@/lib/google-calendar";
import { getActivities, type CloseActivity } from "@/lib/close-api-client";
import { getExistingSourceIds, bulkAddTimeEntries, hasTimeOverlap } from "@/store/timeEntries";
import type { Category } from "@/store/timeEntries";

// --- Sales Call detection (only sales calls get special treatment, everything else = meeting) ---

const SALES_PATTERNS = [
  /meeting mit.*von adslift/i,
  /meeting with.*von adslift/i,
  /termin mit.*von adslift/i,
  /call mit.*von adslift/i,
  /sales call/i,
  /discovery call/i,
  /setter call/i,
  /closing call/i,
  /📞.*call/i,
  /linkedin.*outreach/i,
];

function isSalesEvent(title: string, description?: string): boolean {
  const text = `${title} ${description || ""}`;
  return SALES_PATTERNS.some((p) => p.test(text));
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
      // Sales calls get "sales", everything else defaults to "meeting"
      const category: Category = isSalesEvent(title, event.description) ? "sales" : "meeting";
      const entryAssignee = emailToAssignee[email] || assignee;

      // Skip if overlaps with an existing entry for same person
      if (hasTimeOverlap(date, startHour, startMinute, endHour, endMinute, entryAssignee)) {
        skipped++;
        continue;
      }

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

// Map Close CRM user names to assignees
function closeUserToAssignee(userName: string): string {
  const lower = userName.toLowerCase();
  if (lower.includes("daniel")) return "daniel";
  if (lower.includes("alex")) return "alex";
  return "alex"; // fallback
}

export async function syncCloseActivitiesToTimeEntries(
  weekStart: Date,
  weekEnd: Date,
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
    const isCall = !isMeeting;

    // Calls from Close = sales, Meetings = meeting (unless it matches a sales pattern)
    let category: Category;
    if (isCall) {
      category = "sales";
    } else {
      const meetingText = [activity.title, activity.lead_name].filter(Boolean).join(" ");
      category = isSalesEvent(meetingText) ? "sales" : "meeting";
    }

    // Build descriptive note
    const parts: string[] = [];
    if (activity.lead_name) parts.push(activity.lead_name);
    if (activity.title) parts.push(activity.title);
    if (activity.disposition) parts.push(activity.disposition);
    if (isCall && activity.direction) parts.push(activity.direction === "outbound" ? "Outbound Call" : "Inbound Call");

    const note = parts.length > 0 ? parts.join(" — ") : (isMeeting ? "Meeting (Close)" : "Sales Call (Close)");
    const activityAssignee = closeUserToAssignee(activity.user_name);

    // Skip if overlaps with an existing entry for same person
    if (hasTimeOverlap(date, startHour, startMinute, endHour, endMinute, activityAssignee)) {
      skipped++;
      continue;
    }

    newEntries.push({
      date,
      startHour,
      startMinute,
      endHour,
      endMinute,
      category,
      note,
      assignee: activityAssignee,
      source: "close-crm",
      sourceId,
    });
  }

  const synced = await bulkAddTimeEntries(newEntries);
  return { synced, skipped };
}

import { useState, useMemo, useEffect, useCallback } from "react";
import { PopupModal } from "react-calendly";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Phone, PhoneForwarded, Users, Flag, Briefcase, Calendar as CalendarIcon, Trash2, LayoutGrid, List, Video, ExternalLink, FolderKanban, RefreshCw, DollarSign, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useCalendar, setGoogleEvents as setGlobalGoogleEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/store/calendar";
import type { CalendarEvent } from "@/store/calendar";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useNoShows, markNoShow, unmarkNoShow, isNoShow } from "@/store/noshows";
import { isSalesMeeting, isClientMeeting, isLinkedInSetting } from "@/lib/sales-meetings";
import { isGoogleConnected, getAccounts, getValidToken, listAllEvents, type GoogleCalendarEvent } from "@/lib/google-calendar";

const eventTypes: { value: CalendarEvent["type"]; label: string; color: string; bgLight: string; icon: typeof Phone; creatable?: boolean }[] = [
  { value: "anruf", label: "Anruf", color: "bg-sky-500", bgLight: "bg-sky-500/20 text-white dark:text-white", icon: Phone, creatable: true },
  { value: "call", label: "Rückruf", color: "bg-blue-500", bgLight: "bg-blue-500/20 text-white dark:text-white", icon: PhoneForwarded, creatable: true },
  { value: "meeting", label: "Meeting", color: "bg-violet-500", bgLight: "bg-violet-500/20 text-white dark:text-white", icon: Users },
  { value: "sales-call", label: "Sales Call", color: "bg-amber-500", bgLight: "bg-amber-500/20 text-white dark:text-white", icon: DollarSign },
  { value: "kundenmeeting", label: "Kundenmeeting", color: "bg-teal-500", bgLight: "bg-teal-500/20 text-white dark:text-white", icon: Users },
  { value: "deadline", label: "Deadline", color: "bg-red-500", bgLight: "bg-red-500/20 text-white dark:text-white", icon: Flag },
  { value: "internal", label: "Intern", color: "bg-emerald-500", bgLight: "bg-emerald-500/20 text-white dark:text-white", icon: Briefcase },
  { value: "sonstiges", label: "Sonstiges", color: "bg-zinc-500", bgLight: "bg-zinc-500/20 text-white dark:text-white", icon: CalendarIcon },
  { value: "other", label: "Andere", color: "bg-gray-500", bgLight: "bg-gray-500/20 text-white dark:text-white", icon: CalendarIcon },
];
const creatableEventTypes = eventTypes.filter((t) => t.creatable);

const eventTypeMap = Object.fromEntries(eventTypes.map((t) => [t.value, t]));

const SLOT_HEIGHT = 40;
const DAY_START = 5;
const TOTAL_HOURS = 24;
const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => (i + DAY_START) % 24);

const timeOptions: string[] = [];
for (let i = 0; i <= TOTAL_HOURS; i++) {
  const h = (i + DAY_START) % 24;
  for (const m of [0, 15, 30, 45]) {
    if (i === TOTAL_HOURS && m > 0) break;
    timeOptions.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

function hourToSlotIndex(h: number): number {
  const idx = h >= DAY_START ? h - DAY_START : h + 24 - DAY_START;
  return idx;
}

interface LayoutInfo {
  column: number;
  totalColumns: number;
}

function layoutOverlappingEvents(events: CalendarEvent[]): Map<string, LayoutInfo> {
  const layout = new Map<string, LayoutInfo>();
  if (events.length === 0) return layout;

  // Convert events to time ranges in minutes — minimum 20 min visual height for overlap detection
  const ranges = events.map((e) => {
    const [sh, sm] = (e.startTime || "00:00").split(":").map(Number);
    const [eh, em] = (e.endTime || e.startTime || "00:00").split(":").map(Number);
    const startMin = hourToSlotIndex(sh) * 60 + (sm || 0);
    let endMin = hourToSlotIndex(eh) * 60 + (em || 0);
    if (endMin <= startMin) endMin = startMin + 20;
    // Minimum visual height of 20 min for overlap detection
    if (endMin - startMin < 20) endMin = startMin + 20;
    return { id: e.id, start: startMin, end: endMin };
  }).sort((a, b) => a.start - b.start || b.end - a.end);

  // Check visual overlap — events that share any visual space
  function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
    return a.start < b.end && b.start < a.end;
  }

  // Build full adjacency graph
  const adj = new Map<string, Set<string>>();
  for (const r of ranges) adj.set(r.id, new Set());
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (overlaps(ranges[i], ranges[j])) {
        adj.get(ranges[i].id)!.add(ranges[j].id);
        adj.get(ranges[j].id)!.add(ranges[i].id);
      }
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>();
  const clusters: string[][] = [];
  for (const r of ranges) {
    if (visited.has(r.id)) continue;
    const cluster: string[] = [];
    const queue = [r.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      cluster.push(id);
      for (const neighbor of adj.get(id)!) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    clusters.push(cluster);
  }

  // Greedy column assignment within each cluster
  const rangeMap = new Map(ranges.map((r) => [r.id, r]));
  for (const cluster of clusters) {
    cluster.sort((a, b) => rangeMap.get(a)!.start - rangeMap.get(b)!.start);
    const colAssignment = new Map<string, number>();
    for (const id of cluster) {
      const usedCols = new Set<number>();
      for (const n of adj.get(id)!) {
        if (colAssignment.has(n)) usedCols.add(colAssignment.get(n)!);
      }
      let col = 0;
      while (usedCols.has(col)) col++;
      colAssignment.set(id, col);
    }
    const totalCols = Math.max(...Array.from(colAssignment.values())) + 1;
    for (const id of cluster) {
      layout.set(id, { column: colAssignment.get(id)!, totalColumns: totalCols });
    }
  }

  return layout;
}

function getMeetingPlatform(link: string): { label: string; icon: typeof Video } | null {
  if (!link) return null;
  if (link.includes("zoom")) return { label: "Zoom", icon: Video };
  if (link.includes("meet.google")) return { label: "Google Meet", icon: Video };
  if (link.includes("teams.microsoft")) return { label: "Teams", icon: Video };
  return { label: "Meeting", icon: Video };
}

const timezones = [
  { key: "Europe/Berlin", label: "DE", flag: "🇩🇪", offset: "CET" },
  { key: "Europe/Nicosia", label: "CY", flag: "🇨🇾", offset: "EET" },
];

function getTimeInZone(tz: string): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(str);
}

export default function Calendar() {
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const today = getTimeInZone(timezone);
  const [events] = useCalendar();
  const [clients] = useClients();
  const [projects] = useProjects();
  const clientNames = useMemo(() => clients.map((c) => c.name), [clients]);

  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [monthDate, setMonthDate] = useState(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  // Google Calendar — Multi-Account
  const [googleAccounts, setGoogleAccounts] = useState(getAccounts());
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const noshowList = useNoShows();

  // Calendly integration
  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [calendlyStep, setCalendlyStep] = useState<"select" | "book">("select");
  const [calendlyTypes, setCalendlyTypes] = useState<{name: string; slug: string; duration: number; url: string; color: string; owner?: string}[]>([]);
  const [calendlySelectedUrl, setCalendlySelectedUrl] = useState("");
  const [calendlyClient, setCalendlyClient] = useState("");
  const [calendlyClientEmail, setCalendlyClientEmail] = useState("");
  const [calendlyClientPhone, setCalendlyClientPhone] = useState("");
  const [calendlyBookOpen, setCalendlyBookOpen] = useState(false);

  // Calendly person selector
  const [calendlyPerson, setCalendlyPerson] = useState<"all" | "alex" | "daniel">("all");

  useEffect(() => {
    const userParam = calendlyPerson === "all" ? "" : `&user=${calendlyPerson}`;
    fetch(`/api/calendly?action=event_types${userParam}`)
      .then(r => r.json())
      .then(d => { if (d.types) setCalendlyTypes(d.types); })
      .catch(() => {});
  }, [calendlyPerson]);

  // Drag & Drop state
  const [dragEvent, setDragEvent] = useState<CalendarEvent | null>(null);
  const [dragConfirmOpen, setDragConfirmOpen] = useState(false);
  const [dragTarget, setDragTarget] = useState<{ date: string; hour: number } | null>(null);
  const [dragUpdating, setDragUpdating] = useState(false);

  const openCalendlyBooking = () => {
    if (!calendlySelectedUrl) { toast.error("Bitte Event-Typ auswählen"); return; }
    setCalendlyOpen(false);
    setCalendlyBookOpen(true);
  };

  const syncGoogleCalendar = useCallback(async () => {
    const accounts = getAccounts();
    if (accounts.length === 0) return;
    setSyncing(true);
    try {
      const currentYear = today.getFullYear();
      const timeMin = `${currentYear}-01-01T00:00:00Z`;
      const timeMax = `${currentYear}-12-31T23:59:59Z`;
      const allResults = await listAllEvents(timeMin, timeMax);
      const mapped: CalendarEvent[] = allResults.flatMap(({ email, events: gEvents }) => {
        const account = accounts.find((a) => a.email === email);
        return gEvents.map((ge: GoogleCalendarEvent) => {
          const start = ge.start.dateTime || ge.start.date || "";
          const end = ge.end.dateTime || ge.end.date || "";
          const startDate = start.split("T")[0];
          const startTime = start.includes("T") ? start.split("T")[1]?.substring(0, 5) : "00:00";
          const endTime = end.includes("T") ? end.split("T")[1]?.substring(0, 5) : "23:59";

          let meetingLink = ge.hangoutLink || "";
          if (!meetingLink && ge.conferenceData?.entryPoints) {
            const video = ge.conferenceData.entryPoints.find((ep) => ep.entryPointType === "video");
            if (video) meetingLink = video.uri;
          }
          if (!meetingLink && ge.location && (ge.location.includes("zoom") || ge.location.includes("meet.google") || ge.location.includes("teams"))) {
            meetingLink = ge.location;
          }

          return {
            id: `gcal-${email}-${ge.id}`,
            title: ge.summary || "(Kein Titel)",
            date: startDate,
            startTime,
            endTime,
            type: meetingLink ? "meeting" as const : "other" as const,
            description: ge.description,
            meetingLink: meetingLink || undefined,
            client: accounts.length > 1 ? email.split("@")[0] : undefined,
            accountColor: account?.color,
            accountColorLight: account?.colorLight,
            googleEventId: ge.id,
            accountEmail: email,
          };
        });
      });
      setGoogleEvents(mapped);
      setGlobalGoogleEvents(mapped); // Also set in global store for Sales page
      toast.success(`${mapped.length} Events von ${allResults.length} Account${allResults.length > 1 ? "s" : ""} geladen`);
    } catch (err: any) {
      toast.error("Fehler beim Laden: " + err.message);
    }
    setSyncing(false);
  }, [today]);

  useEffect(() => {
    if (googleAccounts.length > 0) syncGoogleCalendar();
  }, [googleAccounts.length]);

  useEffect(() => {
    setGoogleAccounts(getAccounts());
  }, []);

  const [form, setForm] = useState({
    title: "",
    date: format(today, "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    type: "call" as CalendarEvent["type"],
    client: "",
    description: "",
    meetingLink: "",
  });

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Merge project deadlines into events
  const allEvents = useMemo(() => {
    const deadlineEvents: CalendarEvent[] = projects
      .filter((p) => p.deadline)
      .map((p) => ({
        id: `proj-deadline-${p.id}`,
        title: `Deadline: ${p.name}`,
        date: p.deadline!,
        startTime: "09:00",
        endTime: "09:30",
        type: "deadline" as const,
        client: p.client,
        description: `Projekt-Deadline für ${p.name}`,
        projectId: p.id,
      }));
    return [...events, ...deadlineEvents, ...googleEvents];
  }, [events, projects, googleEvents]);

  // Month grid
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthStartPad = (getDay(monthStart) + 6) % 7;

  // Today's events for sidebar
  const todayStr = format(today, "yyyy-MM-dd");
  const todayEvents = useMemo(() =>
    allEvents.filter((e) => e.date === todayStr).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  [allEvents, todayStr]);

  // Upcoming events (next 7 days, excluding today)
  const upcomingEvents = useMemo(() => {
    const next7 = Array.from({ length: 7 }, (_, i) => format(addDays(today, i + 1), "yyyy-MM-dd"));
    return allEvents
      .filter((e) => next7.includes(e.date) && !e.id.startsWith("proj-deadline-"))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 5);
  }, [allEvents, today]);

  const openNew = (date?: string, hour?: number, minute?: number) => {
    const d = date || format(today, "yyyy-MM-dd");
    const h = hour ?? 9;
    const m = minute ?? 0;
    const startH = h.toString().padStart(2, "0");
    const startM = m.toString().padStart(2, "0");
    // End time = start + 30 min
    const endTotalMin = h * 60 + m + 30;
    const endH = (Math.floor(endTotalMin / 60) % 24).toString().padStart(2, "0");
    const endM = (endTotalMin % 60).toString().padStart(2, "0");
    setForm({ title: "", date: d, startTime: `${startH}:${startM}`, endTime: `${endH}:${endM}`, type: "call", client: "", description: "", meetingLink: "" });
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    if (event.id.startsWith("proj-deadline-") || event.id.startsWith("gcal-")) {
      // Read-only events: show detail dialog
      setDetailEvent(event);
      return;
    }
    setForm({ title: event.title, date: event.date, startTime: event.startTime, endTime: event.endTime, type: event.type, client: event.client || "", description: event.description || "", meetingLink: event.meetingLink || "" });
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error("Bitte Titel eingeben"); return; }
    const eventData = {
      title: form.title, date: form.date, startTime: form.startTime, endTime: form.endTime,
      type: form.type, client: form.client || undefined, description: form.description || undefined,
      meetingLink: form.meetingLink || undefined,
    };
    if (editingEvent) {
      await updateCalendarEvent(editingEvent.id, eventData);
      toast.success("Event aktualisiert");
    } else {
      await addCalendarEvent(eventData as Omit<CalendarEvent, "id">);
      toast.success("Event erstellt");
    }
    setDialogOpen(false);
  };

  const deleteEvent = async (id: string) => {
    await deleteCalendarEvent(id);
    toast.success("Event gelöscht");
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    if (!event.googleEventId) return;
    e.dataTransfer.setData("text/plain", event.id);
    e.dataTransfer.effectAllowed = "move";
    setDragEvent(event);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dateStr: string, hour: number) => {
    e.preventDefault();
    if (!dragEvent) return;
    setDragTarget({ date: dateStr, hour });
    // For local events, move directly without confirmation
    if (!dragEvent.googleEventId) {
      moveLocalEvent(dateStr, hour);
    } else {
      setDragConfirmOpen(true);
    }
  };

  const moveLocalEvent = (dateStr: string, hour: number) => {
    if (!dragEvent) return;
    const [origSH, origSM] = dragEvent.startTime.split(":").map(Number);
    const [origEH, origEM] = dragEvent.endTime.split(":").map(Number);
    const durationMin = (origEH * 60 + origEM) - (origSH * 60 + origSM);
    const newStartM = origSM;
    const newEndTotalMin = hour * 60 + newStartM + (durationMin > 0 ? durationMin : 30);
    const newEndH = Math.floor(newEndTotalMin / 60) % 24;
    const newEndM = newEndTotalMin % 60;
    const newStart = `${hour.toString().padStart(2, "0")}:${newStartM.toString().padStart(2, "0")}`;
    const newEnd = `${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}`;
    updateCalendarEvent(dragEvent.id, { date: dateStr, startTime: newStart, endTime: newEnd });
    toast.success("Event verschoben");
    setDragEvent(null);
    setDragTarget(null);
  };

  const confirmDragMove = async () => {
    if (!dragEvent || !dragTarget || !dragEvent.googleEventId || !dragEvent.accountEmail) {
      setDragConfirmOpen(false);
      setDragEvent(null);
      setDragTarget(null);
      return;
    }

    setDragUpdating(true);
    try {
      // Calculate new start and end times
      const [origSH, origSM] = dragEvent.startTime.split(":").map(Number);
      const [origEH, origEM] = dragEvent.endTime.split(":").map(Number);
      const durationMin = (origEH * 60 + origEM) - (origSH * 60 + origSM);

      const newStartH = dragTarget.hour;
      const newStartM = origSM;
      const newEndTotalMin = newStartH * 60 + newStartM + (durationMin > 0 ? durationMin : 30);
      const newEndH = Math.floor(newEndTotalMin / 60) % 24;
      const newEndM = newEndTotalMin % 60;

      const newStart = `${dragTarget.date}T${newStartH.toString().padStart(2, "0")}:${newStartM.toString().padStart(2, "0")}:00`;
      const newEnd = `${dragTarget.date}T${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}:00`;

      // Get valid token for the account
      const accounts = getAccounts();
      const account = accounts.find(a => a.email === dragEvent.accountEmail);
      if (!account) {
        toast.error("Konto nicht gefunden");
        setDragUpdating(false);
        setDragConfirmOpen(false);
        return;
      }

      const token = await getValidToken(account);

      // Determine timezone from original event or default
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${dragEvent.googleEventId}?sendUpdates=all`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: { dateTime: newStart, timeZone: tz },
            end: { dateTime: newEnd, timeZone: tz },
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error: ${res.status}`);
      }

      toast.success("Event verschoben & Teilnehmer benachrichtigt");
      // Re-sync to pick up the change
      await syncGoogleCalendar();
    } catch (err: any) {
      toast.error("Fehler beim Verschieben: " + err.message);
    }
    setDragUpdating(false);
    setDragConfirmOpen(false);
    setDragEvent(null);
    setDragTarget(null);
  };

  // Now line
  const nowH = today.getHours();
  const nowM = today.getMinutes();
  const nowSlotIdx = hourToSlotIndex(nowH);
  const nowPos = (nowSlotIdx * 60 + nowM) / 60 * SLOT_HEIGHT;
  const nowInRange = true;

  // Get event colors — account color overrides type color for Google events
  const getEventColors = (event: CalendarEvent) => {
    const et = eventTypeMap[event.type] || eventTypes[4];
    // LinkedIn Setting Calls → hellgelb/gold
    if (isLinkedInSetting(event)) {
      return { color: "bg-teal-500", bgLight: "bg-teal-500/25 text-white border-l-[3px] border-teal-400" };
    }
    // Client meetings → green
    if (isClientMeeting(event)) {
      return { color: "bg-emerald-500", bgLight: "bg-emerald-500/30 text-white" };
    }
    // Google Calendar events with account color
    if (event.accountColor) {
      return { color: event.accountColor, bgLight: event.accountColorLight || et.bgLight };
    }
    return { color: et.color, bgLight: et.bgLight };
  };

  const renderEventBlock = (event: CalendarEvent, height: number) => {
    const ec = getEventColors(event); const et = eventTypeMap[event.type];
    const platform = event.meetingLink ? getMeetingPlatform(event.meetingLink) : null;
    const isProjectDeadline = event.id.startsWith("proj-deadline-");
    const isSales = isSalesMeeting(event);
    const noShow = isNoShow(event.id);

    const handleNoShowClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (noShow) { unmarkNoShow(event.id); toast.success("No-Show entfernt"); }
      else { markNoShow(event.id, event.title, event.date); toast.success("Als No-Show markiert"); }
    };

    if (noShow) {
      return (
        <div className="h-full flex flex-col relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black text-red-500 uppercase tracking-widest">NO SHOW</span>
          </div>
          <span className="text-[9px] text-muted-foreground/50 truncate">{event.title}</span>
        </div>
      );
    }

    const linkedIn = isLinkedInSetting(event);

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1">
          {isProjectDeadline && <FolderKanban className="h-2.5 w-2.5 shrink-0 opacity-60" />}
          {isSales && <span className="shrink-0 inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-emerald-500/30 ring-1 ring-emerald-400/50"><DollarSign className="h-3 w-3 text-emerald-300" strokeWidth={2.5} /></span>}
          {linkedIn && <span className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#0A66C2]/20 ring-1 ring-[#0A66C2]/40"><svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></span>}
          <span className="text-[11px] font-semibold truncate">{event.title}</span>
        </div>
        {height > 32 && (
          <span className="text-[10px] opacity-60">{event.startTime} – {event.endTime}</span>
        )}
        {height > 48 && event.client && (
          <span className="text-[10px] opacity-50 mt-0.5">{event.client}</span>
        )}
        {height > 60 && platform && event.meetingLink && (
          <a
            href={event.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-auto inline-flex items-center gap-1 text-[10px] font-medium bg-white/20 dark:bg-black/20 rounded px-1.5 py-0.5 hover:bg-white/40 dark:hover:bg-black/40 transition-colors w-fit"
          >
            <Video className="h-2.5 w-2.5" />
            {platform.label} beitreten
            <ExternalLink className="h-2 w-2" />
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kalender</h1>
          <p className="text-sm text-muted-foreground">Calls, Meetings und Deadlines planen.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Timezone Toggle */}
          <div className="flex items-center rounded-lg border bg-card p-0.5 gap-0.5">
            {timezones.map((tz) => (
              <button key={tz.key} onClick={() => setTimezone(tz.key)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                  timezone === tz.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                <span>{tz.flag}</span>
                <span>{tz.label}</span>
              </button>
            ))}
          </div>
          {googleAccounts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={syncGoogleCalendar} disabled={syncing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync..." : "Sync"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setCalendlySelectedUrl(""); setCalendlyClient(""); setCalendlyClientEmail(""); setCalendlyClientPhone(""); setCalendlyOpen(true); }}>
            <img src="/calendly-logo.ico" alt="" className="mr-1 h-4 w-4 rounded-sm" />Calendly
          </Button>
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" />Neues Event
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Main Calendar */}
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => view === "week" ? setWeekStart(subWeeks(weekStart, 1)) : setMonthDate(subMonths(monthDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setWeekStart(startOfWeek(today, { weekStartsOn: 1 })); setMonthDate(today); }}>
                Heute
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => view === "week" ? setWeekStart(addWeeks(weekStart, 1)) : setMonthDate(addMonths(monthDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium ml-2">
                {view === "week"
                  ? `${format(weekDays[0], "d. MMM", { locale: de })} – ${format(weekDays[6], "d. MMM yyyy", { locale: de })}`
                  : format(monthDate, "MMMM yyyy", { locale: de })
                }
              </span>
            </div>
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              <button onClick={() => setView("week")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <LayoutGrid className="h-3.5 w-3.5 inline mr-1" />Woche
              </button>
              <button onClick={() => setView("month")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <List className="h-3.5 w-3.5 inline mr-1" />Monat
              </button>
            </div>

            {/* Today's meeting counts */}
            {(() => {
              const todayMeetings = allEvents.filter((e) => e.date === todayStr && !e.id.startsWith("proj-deadline-"));
              const clientCount = todayMeetings.filter((e) => isClientMeeting(e)).length;
              const salesCount = todayMeetings.filter((e) => isSalesMeeting(e)).length;
              const linkedInCount = todayMeetings.filter((e) => isLinkedInSetting(e)).length;
              if (clientCount === 0 && salesCount === 0 && linkedInCount === 0) return null;
              return (
                <div className="flex items-center gap-3 flex-wrap">
                  {linkedInCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1">
                      <Phone className="h-3 w-3 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{linkedInCount} Setting</span>
                    </div>
                  )}
                  {salesCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1">
                      <DollarSign className="h-3 w-3 text-blue-500" />
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{salesCount} Sales</span>
                    </div>
                  )}
                  {clientCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
                      <Users className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{clientCount} Kunden</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* WEEK VIEW */}
          {view === "week" && (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-[55px_repeat(7,1fr)] border-b sticky top-0 bg-card z-20">
                    <div className="p-2" />
                    {weekDays.map((day) => {
                      const isToday = isSameDay(day, today);
                      return (
                        <div key={day.toISOString()} className={`p-2 text-center border-l ${isToday ? "bg-primary/5" : ""}`}>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{format(day, "EEE", { locale: de })}</div>
                          <div className={`text-base font-semibold mt-0.5 ${isToday ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm" : ""}`}>
                            {format(day, "d")}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Deadline banners */}
                  {(() => {
                    const hasDeadlines = weekDays.some((d) => allEvents.some((e) => e.id.startsWith("proj-deadline-") && e.date === format(d, "yyyy-MM-dd")));
                    if (!hasDeadlines) return null;
                    return (
                      <div className="grid grid-cols-[55px_repeat(7,1fr)] border-b bg-red-500/5">
                        <div className="p-1 flex items-center justify-end pr-2">
                          <Flag className="h-3 w-3 text-red-500" />
                        </div>
                        {weekDays.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const deadlines = allEvents.filter((e) => e.id.startsWith("proj-deadline-") && e.date === dateStr);
                          return (
                            <div key={dateStr} className="border-l p-1 space-y-0.5">
                              {deadlines.map((dl) => (
                                <div key={dl.id} className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-600 dark:text-red-400 truncate">
                                  {dl.title.replace("Deadline: ", "")}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-[55px_repeat(7,1fr)]">
                    <div className="relative">
                      {hours.map((hour) => (
                        <div key={hour} className="border-t" style={{ height: SLOT_HEIGHT }}>
                          <div className="flex items-start justify-end pr-2 pt-1">
                            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{hour.toString().padStart(2, "0")}:00</span>
                          </div>
                        </div>
                      ))}
                      {nowInRange && weekDays.some((d) => isSameDay(d, today)) && (
                        <div className="absolute right-0 pointer-events-none -translate-y-1/2" style={{ top: nowPos }}>
                          <span className="text-[9px] font-bold text-red-500 tabular-nums bg-card px-0.5 rounded">{nowH.toString().padStart(2, "0")}:{nowM.toString().padStart(2, "0")}</span>
                        </div>
                      )}
                    </div>

                    {weekDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const isToday = isSameDay(day, today);
                      const dayEvents = allEvents.filter((e) => e.date === dateStr && !e.id.startsWith("proj-deadline-"));

                      return (
                        <div key={dateStr} className={`border-l relative ${isToday ? "bg-primary/[0.02]" : ""}`} style={{ height: hours.length * SLOT_HEIGHT }}>
                          {hours.map((hour, hIdx) => (
                            <div
                              key={hIdx}
                              className="absolute w-full border-t cursor-pointer hover:bg-primary/5 transition-colors"
                              style={{ top: hIdx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                              onClick={() => openNew(dateStr, hour, 0)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, dateStr, hour)}
                            />
                          ))}

                          {isToday && nowInRange && (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowPos }}>
                              <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-[5px] shrink-0" />
                              <div className="h-[2px] w-full bg-red-500" />
                            </div>
                          )}

                          {(() => {
                            const validDayEvents = dayEvents.filter((e) => e.startTime && e.endTime && e.startTime.includes(":") && e.endTime.includes(":"));
                            const eventLayout = layoutOverlappingEvents(validDayEvents);
                            return validDayEvents.map((event) => {
                            const [sh, sm] = event.startTime.split(":").map(Number);
                            const [eh, em] = event.endTime.split(":").map(Number);
                            const startIdx = hourToSlotIndex(sh);
                            const endIdx = hourToSlotIndex(eh);
                            const top = (startIdx * 60 + sm) / 60 * SLOT_HEIGHT;
                            const duration = endIdx > startIdx || (endIdx === startIdx && em > sm)
                              ? (endIdx * 60 + em - startIdx * 60 - sm)
                              : ((endIdx + 24) * 60 + em - startIdx * 60 - sm);
                            const height = Math.max(duration / 60 * SLOT_HEIGHT, 24);
                            const ec = getEventColors(event);
                            const li = eventLayout.get(event.id) || { column: 0, totalColumns: 1 };
                            const colWidth = 100 / li.totalColumns;
                            const leftPercent = li.column * colWidth;

                            const salesMeeting = isSalesMeeting(event);
                            const eventNoShow = isNoShow(event.id);

                            const noShowStyle = eventNoShow ? "bg-red-500/30 text-white border-l-[3px] border-red-600" : ec.bgLight;
                            const noShowBar = eventNoShow ? "bg-red-600" : ec.color;

                            const isGoogleEvent = !!event.googleEventId;

                            return (
                              <div
                                key={event.id}
                                className={`absolute rounded-lg cursor-pointer hover:shadow-md transition-all overflow-hidden group ${noShowStyle}`}
                                style={{ top: top + 1, height: height - 2, zIndex: 10, left: `calc(${leftPercent}% + 2px)`, width: `calc(${colWidth}% - 4px)` }}
                                draggable
                                onDragStart={(e) => handleDragStart(e, event)}
                                onClick={(e) => {
                                  if (salesMeeting) {
                                    e.stopPropagation();
                                    if (eventNoShow) { unmarkNoShow(event.id); toast.success("No-Show entfernt"); }
                                    else { markNoShow(event.id, event.title, event.date); toast.success("Als No-Show markiert"); }
                                  } else {
                                    openEdit(event);
                                  }
                                }}
                              >
                                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${noShowBar}`} />
                                <div className="pl-2.5 pr-1.5 py-1 h-full">
                                  {renderEventBlock(event, height)}
                                </div>
                              </div>
                            );
                          });
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MONTH VIEW */}
          {view === "month" && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-px">
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: monthStartPad }).map((_, i) => (
                    <div key={`pad-${i}`} className="min-h-[90px]" />
                  ))}
                  {monthDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isToday = isSameDay(day, today);
                    const dayEvents = allEvents.filter((e) => e.date === dateStr);
                    return (
                      <div
                        key={dateStr}
                        className={`min-h-[90px] rounded-lg border p-1.5 cursor-pointer transition-colors hover:bg-accent/50 ${isToday ? "border-primary bg-primary/5" : "border-transparent"}`}
                        onClick={() => { setView("week"); setWeekStart(startOfWeek(day, { weekStartsOn: 1 })); }}
                        onDoubleClick={(e) => { e.stopPropagation(); openNew(dateStr); }}
                      >
                        <span className={`text-xs font-medium ${isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayEvents.slice(0, 3).map((event) => {
                            const ec = getEventColors(event); const et = eventTypeMap[event.type];
                            return (
                              <div key={event.id} className="flex items-center gap-1" onClick={(e) => { e.stopPropagation(); openEdit(event); }}>
                                <span className={`h-1.5 w-1.5 rounded-full ${ec.color} shrink-0`} />
                                <span className="text-[9px] truncate">{event.title}</span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Today */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Heute — {format(today, "d. MMMM", { locale: de })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Keine Events heute.</p>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((event) => {
                    const ec = getEventColors(event); const et = eventTypeMap[event.type];
                    const platform = event.meetingLink ? getMeetingPlatform(event.meetingLink) : null;
                    const isSales = isSalesMeeting(event);
                    const noShow = isNoShow(event.id);
                    return (
                      <div key={event.id} className={`rounded-lg p-2.5 ${ec.bgLight} ${noShow ? "opacity-50" : ""} cursor-pointer`}
                        onClick={() => {
                          if (isSales) {
                            if (noShow) { unmarkNoShow(event.id); toast.success("No-Show entfernt"); }
                            else { markNoShow(event.id, event.title, event.date); toast.success("Als No-Show markiert"); }
                          } else { openEdit(event); }
                        }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${ec.color}`} />
                          {isSales && <DollarSign className="h-2.5 w-2.5 text-emerald-500" />}
                          <span className={`text-xs font-semibold truncate ${noShow ? "line-through" : ""}`}>{event.title}</span>
                        </div>
                        {noShow && <div className="text-[10px] font-black text-red-500 ml-3 uppercase tracking-wider">NO SHOW</div>}
                        {!noShow && <div className="text-[10px] opacity-60 ml-3">{event.startTime} – {event.endTime}</div>}
                        {!noShow && platform && event.meetingLink && (
                          <a
                            href={event.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 ml-3 inline-flex items-center gap-1 text-[10px] font-semibold bg-primary text-primary-foreground rounded-md px-2 py-1 hover:opacity-90 transition-opacity"
                          >
                            <Video className="h-3 w-3" />
                            {platform.label} beitreten
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Kommende Events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Keine Events in den nächsten 7 Tagen.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => {
                    const ec = getEventColors(event); const et = eventTypeMap[event.type];
                    const eventDate = new Date(event.date + "T00:00:00");
                    return (
                      <div key={event.id} className="flex items-start gap-2.5 py-1.5 cursor-pointer hover:bg-accent/50 rounded-md px-1 -mx-1" onClick={() => openEdit(event)}>
                        <div className="text-center shrink-0 w-10">
                          <div className="text-[10px] text-muted-foreground uppercase">{format(eventDate, "EEE", { locale: de })}</div>
                          <div className="text-sm font-bold">{format(eventDate, "d")}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${ec.color} shrink-0`} />
                            <span className="text-xs font-medium truncate">{event.title}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground ml-3">{event.startTime} – {event.endTime}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Deadlines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderKanban className="h-3.5 w-3.5 text-red-500" />Projekt-Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projects.filter((p) => p.deadline).length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Keine Deadlines gesetzt.</p>
              ) : (
                <div className="space-y-2">
                  {projects.filter((p) => p.deadline).sort((a, b) => (a.deadline || "").localeCompare(b.deadline || "")).map((p) => {
                    const deadlineDate = new Date(p.deadline + "T00:00:00");
                    const isPast = deadlineDate < today && !isSameDay(deadlineDate, today);
                    const isToday2 = isSameDay(deadlineDate, today);
                    return (
                      <div key={p.id} className={`flex items-center gap-2.5 rounded-md p-2 ${isPast ? "bg-red-500/10" : isToday2 ? "bg-amber-500/10" : "bg-muted/50"}`}>
                        <Flag className={`h-3.5 w-3.5 shrink-0 ${isPast ? "text-red-500" : isToday2 ? "text-amber-500" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">{p.client}</div>
                        </div>
                        <span className={`text-[10px] font-medium shrink-0 ${isPast ? "text-red-500" : ""}`}>
                          {format(deadlineDate, "d. MMM", { locale: de })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 justify-center">
            {eventTypes.map((et) => (
              <div key={et.value} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${et.color}`} />{et.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Event bearbeiten" : "Neues Event"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input placeholder="z.B. Kick-off Call — Acme Co" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Typ</Label>
              <div className="flex flex-wrap gap-2">
                {creatableEventTypes.map((et) => (
                  <button key={et.value} onClick={() => setForm({ ...form, type: et.value })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      form.type === et.value ? `${et.bgLight} ring-1 ring-current/20` : "border-border hover:border-primary/30"
                    }`}>
                    <span className={`h-2 w-2 rounded-full ${et.color}`} />{et.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Datum</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Von</Label>
                <Select value={form.startTime} onValueChange={(v) => setForm({ ...form, startTime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">{timeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Bis</Label>
                <Select value={form.endTime} onValueChange={(v) => setForm({ ...form, endTime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">{timeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Kunde (optional)</Label>
              <Select value={form.client} onValueChange={(v) => setForm({ ...form, client: v })}>
                <SelectTrigger><SelectValue placeholder="Kein Kunde" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Kein Kunde</SelectItem>
                  {clientNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />Meeting-Link (Zoom, Google Meet, etc.)</Label>
              <Input placeholder="https://zoom.us/j/..." value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung</Label>
              <Textarea rows={2} placeholder="Notizen zum Event..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingEvent && (
              <Button variant="destructive" size="sm" onClick={() => { deleteEvent(editingEvent.id); setDialogOpen(false); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>{editingEvent ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog (read-only for Google Calendar & Deadline events) */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => { if (!open) setDetailEvent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailEvent && (() => {
                const et = eventTypeMap[detailEvent.type];
                return et ? <div className={`h-3 w-3 rounded-full ${et.color}`} /> : null;
              })()}
              {detailEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {detailEvent && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Datum</p>
                  <p className="text-sm font-medium">{detailEvent.date}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Uhrzeit</p>
                  <p className="text-sm font-medium">{detailEvent.startTime} – {detailEvent.endTime}</p>
                </div>
              </div>
              {detailEvent.type && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Typ</p>
                  <p className="text-sm font-medium">{eventTypeMap[detailEvent.type]?.label || detailEvent.type}</p>
                </div>
              )}
              {detailEvent.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Beschreibung</p>
                  <p className="text-sm whitespace-pre-wrap">{detailEvent.description}</p>
                </div>
              )}
              {detailEvent.client && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Kunde</p>
                  <p className="text-sm font-medium">{detailEvent.client}</p>
                </div>
              )}
              {detailEvent.meetingLink && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Meeting Link</p>
                  <a href={detailEvent.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-sm font-medium hover:bg-primary/20 transition-colors">
                    <Video className="h-4 w-4" />
                    {getMeetingPlatform(detailEvent.meetingLink)?.label || "Meeting beitreten"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {detailEvent.id.startsWith("gcal-") && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Google Calendar Event
                </p>
              )}
              {detailEvent.id.startsWith("proj-deadline-") && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                  Projekt-Deadline
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailEvent(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendly Selection Dialog */}
      <Dialog open={calendlyOpen} onOpenChange={setCalendlyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Meeting planen (Calendly)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Person selector */}
            <div>
              <Label className="text-xs mb-1.5 block">Person</Label>
              <div className="flex items-center rounded-lg border bg-card p-0.5 gap-0.5">
                {([
                  { key: "all" as const, label: "Alle" },
                  { key: "alex" as const, label: "Alex" },
                  { key: "daniel" as const, label: "Daniel" },
                ] as const).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setCalendlyPerson(p.key); setCalendlySelectedUrl(""); }}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all text-center ${
                      calendlyPerson === p.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Event-Typ</Label>
              <Select value={calendlySelectedUrl} onValueChange={setCalendlySelectedUrl}>
                <SelectTrigger><SelectValue placeholder="Event-Typ wählen" /></SelectTrigger>
                <SelectContent>
                  {(() => {
                    const alexTypes = calendlyTypes.filter(t => t.owner === "Alex");
                    const danielTypes = calendlyTypes.filter(t => t.owner === "Daniel");
                    const ungrouped = calendlyTypes.filter(t => !t.owner);
                    const showGroups = alexTypes.length > 0 && danielTypes.length > 0;
                    if (!showGroups) {
                      return calendlyTypes.map((t) => (
                        <SelectItem key={t.slug + (t.owner || "")} value={t.url}>
                          {t.owner ? `[${t.owner}] ` : ""}{t.name} ({t.duration} min)
                        </SelectItem>
                      ));
                    }
                    return (
                      <>
                        {alexTypes.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Alex</div>
                            {alexTypes.map((t) => (
                              <SelectItem key={t.slug + "alex"} value={t.url}>
                                {t.name} ({t.duration} min)
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {danielTypes.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Daniel</div>
                            {danielTypes.map((t) => (
                              <SelectItem key={t.slug + "daniel"} value={t.url}>
                                {t.name} ({t.duration} min)
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {ungrouped.map((t) => (
                          <SelectItem key={t.slug} value={t.url}>
                            {t.name} ({t.duration} min)
                          </SelectItem>
                        ))}
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kunde</Label>
              <Select value={calendlyClient} onValueChange={(v) => {
                setCalendlyClient(v);
                const client = clients.find((c) => c.name === v);
                if (client?.email) setCalendlyClientEmail(client.email);
                if (client?.phone) setCalendlyClientPhone(client.phone);
              }}>
                <SelectTrigger><SelectValue placeholder="Kunde auswählen (optional)" /></SelectTrigger>
                <SelectContent>
                  {clientNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">E-Mail (optional)</Label>
              <Input value={calendlyClientEmail} onChange={(e) => setCalendlyClientEmail(e.target.value)} placeholder="kunde@example.com" />
            </div>
            <Button onClick={openCalendlyBooking} className="w-full">Buchungsfenster öffnen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drag & Drop Confirmation Dialog */}
      <Dialog open={dragConfirmOpen} onOpenChange={(open) => { if (!open) { setDragConfirmOpen(false); setDragEvent(null); setDragTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Meeting verschieben?</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {dragEvent && dragTarget && (
              <>
                <p className="text-sm font-medium">{dragEvent.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{dragEvent.date} {dragEvent.startTime}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{dragTarget.date} {dragTarget.hour.toString().padStart(2, "0")}:00</span>
                </div>
                <p className="text-xs text-muted-foreground">Soll die Änderung an alle Teilnehmer gesendet werden?</p>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setDragConfirmOpen(false); setDragEvent(null); setDragTarget(null); }} disabled={dragUpdating}>
              Nein, abbrechen
            </Button>
            <Button onClick={confirmDragMove} disabled={dragUpdating}>
              {dragUpdating ? "Aktualisiere..." : "Ja, aktualisieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendly Popup Embed */}
      {calendlyBookOpen && calendlySelectedUrl && (
        <PopupModal
          url={calendlySelectedUrl}
          rootElement={document.getElementById("root")!}
          onModalClose={() => setCalendlyBookOpen(false)}
          open={calendlyBookOpen}
          prefill={{
            name: calendlyClient,
            email: calendlyClientEmail,
            customAnswers: calendlyClientPhone ? { a1: calendlyClientPhone } : undefined,
          }}
          pageSettings={{
            backgroundColor: "1a1a2e",
            primaryColor: "3b82f6",
            textColor: "ffffff",
            hideLandingPageDetails: false,
            hideEventTypeDetails: false,
            hideGdprBanner: true,
          }}
        />
      )}
    </div>
  );
}

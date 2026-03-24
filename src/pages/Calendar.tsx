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
import { ChevronLeft, ChevronRight, Plus, Phone, Users, Flag, Briefcase, Calendar as CalendarIcon, Trash2, LayoutGrid, List, Video, ExternalLink, FolderKanban, RefreshCw, DollarSign, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useCalendar, setGoogleEvents as setGlobalGoogleEvents } from "@/store/calendar";
import type { CalendarEvent } from "@/store/calendar";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useNoShows, markNoShow, unmarkNoShow, isNoShow } from "@/store/noshows";
import { isSalesMeeting, isClientMeeting } from "@/lib/sales-meetings";
import { isGoogleConnected, getAccounts, listAllEvents, type GoogleCalendarEvent } from "@/lib/google-calendar";

const eventTypes: { value: CalendarEvent["type"]; label: string; color: string; bgLight: string; icon: typeof Phone }[] = [
  { value: "call", label: "Call", color: "bg-blue-500", bgLight: "bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: Phone },
  { value: "meeting", label: "Meeting", color: "bg-violet-500", bgLight: "bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: Users },
  { value: "deadline", label: "Deadline", color: "bg-red-500", bgLight: "bg-red-500/10 text-red-700 dark:text-red-300", icon: Flag },
  { value: "internal", label: "Intern", color: "bg-emerald-500", bgLight: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: Briefcase },
  { value: "other", label: "Sonstiges", color: "bg-gray-500", bgLight: "bg-gray-500/10 text-gray-700 dark:text-gray-300", icon: CalendarIcon },
];

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

  // Convert events to time ranges in minutes from DAY_START
  const ranges = events.map((e) => {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    const startMin = hourToSlotIndex(sh) * 60 + sm;
    const endMin = hourToSlotIndex(eh) * 60 + em + (hourToSlotIndex(eh) < hourToSlotIndex(sh) ? 24 * 60 : 0);
    return { id: e.id, start: startMin, end: Math.max(endMin, startMin + 15) };
  }).sort((a, b) => a.start - b.start || a.end - b.end);

  // Group overlapping events into clusters
  const clusters: typeof ranges[] = [];
  let current: typeof ranges = [ranges[0]];
  let clusterEnd = ranges[0].end;

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < clusterEnd) {
      current.push(ranges[i]);
      clusterEnd = Math.max(clusterEnd, ranges[i].end);
    } else {
      clusters.push(current);
      current = [ranges[i]];
      clusterEnd = ranges[i].end;
    }
  }
  clusters.push(current);

  // Assign columns within each cluster
  for (const cluster of clusters) {
    const columns: number[][] = []; // columns[col] = list of end times
    for (const ev of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastEnd = columns[col][columns[col].length - 1];
        if (ev.start >= lastEnd) {
          columns[col].push(ev.end);
          layout.set(ev.id, { column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev.end]);
        layout.set(ev.id, { column: columns.length - 1, totalColumns: 0 });
      }
    }
    // Set totalColumns for all events in this cluster
    for (const ev of cluster) {
      const info = layout.get(ev.id)!;
      info.totalColumns = columns.length;
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
  const [timezone, setTimezone] = useState("Europe/Nicosia");
  const today = getTimeInZone(timezone);
  const [events, setEvents] = useCalendar();
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
  const [calendlyTypes, setCalendlyTypes] = useState<{name: string; slug: string; duration: number; url: string; color: string}[]>([]);
  const [calendlySelectedUrl, setCalendlySelectedUrl] = useState("");
  const [calendlyClient, setCalendlyClient] = useState("");
  const [calendlyClientEmail, setCalendlyClientEmail] = useState("");
  const [calendlyBookOpen, setCalendlyBookOpen] = useState(false);

  useEffect(() => {
    fetch("/api/calendly?action=event_types")
      .then(r => r.json())
      .then(d => { if (d.types) setCalendlyTypes(d.types); })
      .catch(() => {});
  }, []);

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
      const timeMin = format(subWeeks(today, 4), "yyyy-MM-dd'T'00:00:00'Z'");
      const timeMax = format(addWeeks(today, 8), "yyyy-MM-dd'T'23:59:59'Z'");
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

  const openNew = (date?: string, hour?: number) => {
    const d = date || format(today, "yyyy-MM-dd");
    const h = hour ?? 9;
    setForm({ title: "", date: d, startTime: `${h.toString().padStart(2, "0")}:00`, endTime: `${(h + 1).toString().padStart(2, "0")}:00`, type: "call", client: "", description: "", meetingLink: "" });
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

  const handleSave = () => {
    if (!form.title) { toast.error("Bitte Titel eingeben"); return; }
    const event: CalendarEvent = {
      id: editingEvent?.id ?? Date.now().toString(),
      title: form.title, date: form.date, startTime: form.startTime, endTime: form.endTime,
      type: form.type, client: form.client || undefined, description: form.description || undefined,
      meetingLink: form.meetingLink || undefined,
    };
    if (editingEvent) {
      setEvents((prev) => prev.map((e) => e.id === editingEvent.id ? event : e));
      toast.success("Event aktualisiert");
    } else {
      setEvents((prev) => [...prev, event]);
      toast.success("Event erstellt");
    }
    setDialogOpen(false);
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    toast.success("Event gelöscht");
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
    // Client meetings → green
    if (isClientMeeting(event)) {
      return { color: "bg-emerald-500", bgLight: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
    }
    // Sales meetings → keep account color or type color
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

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1">
          {isProjectDeadline && <FolderKanban className="h-2.5 w-2.5 shrink-0 opacity-60" />}
          {isSales && <DollarSign className="h-2.5 w-2.5 shrink-0 text-emerald-500" />}
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
          <Button size="sm" variant="outline" onClick={() => { setCalendlyLink(""); setCalendlyCopied(false); setCalendlyOpen(true); }}>
            <Link2 className="mr-2 h-4 w-4" />Calendly
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
              if (clientCount === 0 && salesCount === 0) return null;
              return (
                <div className="flex items-center gap-3">
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
                        <div key={dateStr} className={`border-l relative ${isToday ? "bg-primary/[0.02]" : ""}`} style={{ height: hours.length * SLOT_HEIGHT }} onDoubleClick={() => openNew(dateStr)}>
                          {hours.map((_, hIdx) => (
                            <div key={hIdx} className="absolute w-full border-t" style={{ top: hIdx * SLOT_HEIGHT }} />
                          ))}

                          {isToday && nowInRange && (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowPos }}>
                              <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-[5px] shrink-0" />
                              <div className="h-[2px] w-full bg-red-500" />
                            </div>
                          )}

                          {(() => {
                            const eventLayout = layoutOverlappingEvents(dayEvents);
                            return dayEvents.map((event) => {
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

                            return (
                              <div
                                key={event.id}
                                className={`absolute rounded-lg cursor-pointer hover:shadow-md transition-all overflow-hidden group ${ec.bgLight}`}
                                style={{ top: top + 1, height: height - 2, zIndex: 1, left: `calc(${leftPercent}% + 2px)`, width: `calc(${colWidth}% - 4px)` }}
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
                                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${ec.color}`} />
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
                {eventTypes.map((et) => (
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
            <div>
              <Label className="text-xs">Event-Typ</Label>
              <Select value={calendlySelectedUrl} onValueChange={setCalendlySelectedUrl}>
                <SelectTrigger><SelectValue placeholder="Event-Typ wählen" /></SelectTrigger>
                <SelectContent>
                  {calendlyTypes.map((t) => (
                    <SelectItem key={t.slug} value={t.url}>
                      {t.name} ({t.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kunde</Label>
              <Select value={calendlyClient} onValueChange={(v) => {
                setCalendlyClient(v);
                const client = clients.find((c) => c.name === v);
                if (client?.email) setCalendlyClientEmail(client.email);
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

import { useState, useMemo, useEffect, useCallback } from "react";
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
import { ChevronLeft, ChevronRight, Plus, Phone, Users, Flag, Briefcase, Calendar as CalendarIcon, Trash2, LayoutGrid, List, Video, ExternalLink, FolderKanban, RefreshCw, Unplug, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCalendar } from "@/store/calendar";
import type { CalendarEvent } from "@/store/calendar";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { connectGoogleCalendar, isGoogleConnected, getAccounts, removeAccount, listAllEvents, type GoogleCalendarEvent } from "@/lib/google-calendar";

const eventTypes: { value: CalendarEvent["type"]; label: string; color: string; bgLight: string; icon: typeof Phone }[] = [
  { value: "call", label: "Call", color: "bg-blue-500", bgLight: "bg-blue-500/10 text-blue-700 dark:text-blue-300", icon: Phone },
  { value: "meeting", label: "Meeting", color: "bg-violet-500", bgLight: "bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: Users },
  { value: "deadline", label: "Deadline", color: "bg-red-500", bgLight: "bg-red-500/10 text-red-700 dark:text-red-300", icon: Flag },
  { value: "internal", label: "Intern", color: "bg-emerald-500", bgLight: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: Briefcase },
  { value: "other", label: "Sonstiges", color: "bg-gray-500", bgLight: "bg-gray-500/10 text-gray-700 dark:text-gray-300", icon: CalendarIcon },
];

const eventTypeMap = Object.fromEntries(eventTypes.map((t) => [t.value, t]));

const SLOT_HEIGHT = 56;
const START_HOUR = 7;
const END_HOUR = 20;
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

const timeOptions: string[] = [];
for (let h = START_HOUR; h <= END_HOUR; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === END_HOUR && m > 0) break;
    timeOptions.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

function getMeetingPlatform(link: string): { label: string; icon: typeof Video } | null {
  if (!link) return null;
  if (link.includes("zoom")) return { label: "Zoom", icon: Video };
  if (link.includes("meet.google")) return { label: "Google Meet", icon: Video };
  if (link.includes("teams.microsoft")) return { label: "Teams", icon: Video };
  return { label: "Meeting", icon: Video };
}

export default function Calendar() {
  const today = new Date();
  const [events, setEvents] = useCalendar();
  const [clients] = useClients();
  const [projects] = useProjects();
  const clientNames = useMemo(() => clients.map((c) => c.name), [clients]);

  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [monthDate, setMonthDate] = useState(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Google Calendar — Multi-Account
  const [googleAccounts, setGoogleAccounts] = useState(getAccounts());
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [syncing, setSyncing] = useState(false);

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
      .filter((e) => next7.includes(e.date))
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
    if (event.id.startsWith("proj-deadline-") || event.id.startsWith("gcal-")) return; // read-only events
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
  const nowPos = ((nowH - START_HOUR) * 60 + nowM) / 60 * SLOT_HEIGHT;
  const nowInRange = nowH >= START_HOUR && nowH < END_HOUR;

  // Get event colors — account color overrides type color for Google events
  const getEventColors = (event: CalendarEvent) => {
    const ec = getEventColors(event); const et = eventTypeMap[event.type];
    if (event.accountColor) {
      return { color: event.accountColor, bgLight: event.accountColorLight || et.bgLight };
    }
    return { color: et.color, bgLight: et.bgLight };
  };

  const renderEventBlock = (event: CalendarEvent, height: number) => {
    const ec = getEventColors(event); const et = eventTypeMap[event.type];
    const platform = event.meetingLink ? getMeetingPlatform(event.meetingLink) : null;
    const isProjectDeadline = event.id.startsWith("proj-deadline-");

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1">
          {isProjectDeadline && <FolderKanban className="h-2.5 w-2.5 shrink-0 opacity-60" />}
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
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" />Neues Event
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {googleAccounts.length > 0 && (
            <Button variant="outline" size="sm" onClick={syncGoogleCalendar} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync..." : "Sync"}
            </Button>
          )}
          {googleAccounts.map((acc) => (
            <Badge key={acc.email} variant="secondary" className="gap-1.5 text-xs py-1 pr-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {acc.email}
              <button
                className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                onClick={() => {
                  removeAccount(acc.email);
                  setGoogleAccounts(getAccounts());
                  setGoogleEvents((prev) => prev.filter((e) => !e.id.includes(acc.email)));
                  toast.success(`${acc.email} getrennt`);
                }}
              >
                <Unplug className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          <Button variant="outline" size="sm" onClick={() => connectGoogleCalendar()}>
            <svg className="mr-1.5 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {googleAccounts.length > 0 ? "Weiteren Account" : "Google Calendar verbinden"}
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
                      const dayEvents = allEvents.filter((e) => e.date === dateStr);

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

                          {dayEvents.map((event) => {
                            const [sh, sm] = event.startTime.split(":").map(Number);
                            const [eh, em] = event.endTime.split(":").map(Number);
                            const top = ((sh - START_HOUR) * 60 + sm) / 60 * SLOT_HEIGHT;
                            const height = Math.max(((eh - START_HOUR) * 60 + em - (sh - START_HOUR) * 60 - sm) / 60 * SLOT_HEIGHT, 24);
                            const ec = getEventColors(event);

                            return (
                              <div
                                key={event.id}
                                className={`absolute left-1 right-1 rounded-lg cursor-pointer hover:shadow-md transition-all overflow-hidden group ${ec.bgLight}`}
                                style={{ top: top + 1, height: height - 2, zIndex: 1 }}
                                onClick={() => openEdit(event)}
                              >
                                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${ec.color}`} />
                                <div className="pl-2.5 pr-1.5 py-1 h-full">
                                  {renderEventBlock(event, height)}
                                </div>
                              </div>
                            );
                          })}
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
                    return (
                      <div key={event.id} className={`rounded-lg p-2.5 ${ec.bgLight} cursor-pointer`} onClick={() => openEdit(event)}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${et.color}`} />
                          <span className="text-xs font-semibold truncate">{event.title}</span>
                        </div>
                        <div className="text-[10px] opacity-60 ml-3">{event.startTime} – {event.endTime}</div>
                        {platform && event.meetingLink && (
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
    </div>
  );
}

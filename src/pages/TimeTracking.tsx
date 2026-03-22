import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Clock, Trash2, Plus, BarChart3, CalendarDays, TrendingUp, Target } from "lucide-react";
import { toast } from "sonner";

type Category = "fulfillment" | "sales" | "admin" | "growth" | "meeting" | "creative" | "pause";

type TimeEntry = {
  id: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  category: Category;
  note: string;
};

const categories: { value: Category; label: string; color: string; bg: string }[] = [
  { value: "fulfillment", label: "Fulfillment", color: "bg-blue-500", bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { value: "sales", label: "Sales", color: "bg-emerald-500", bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "admin", label: "Admin", color: "bg-orange-500", bg: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { value: "growth", label: "Growth", color: "bg-purple-500", bg: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { value: "meeting", label: "Meeting", color: "bg-pink-500", bg: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  { value: "creative", label: "Creative", color: "bg-yellow-500", bg: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  { value: "pause", label: "Pause", color: "bg-gray-400", bg: "bg-gray-400/15 text-gray-600 dark:text-gray-400" },
];

const categoryMap = Object.fromEntries(categories.map((c) => [c.value, c]));

const START_HOUR = 5;
const END_HOUR = 24;
const SLOT_HEIGHT = 10;
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

const timeOptions: string[] = [];
for (let h = START_HOUR; h <= END_HOUR; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === END_HOUR && m > 0) break;
    timeOptions.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

const todayStr = format(new Date(), "yyyy-MM-dd");

const initialEntries: TimeEntry[] = [];

// Auto-detect category from note text
const categoryKeywords: { keywords: string[]; category: Category }[] = [
  // Creative — zuerst, damit "creative erstellen" nicht als fulfillment matcht
  { keywords: [
    "creative erstellen", "creatives erstellen", "creatives", "creative", "design", "hook", "hooks", "angle", "angles",
    "video", "videos", "schnitt", "schneiden", "grafik", "grafiken", "thumbnail", "thumbnails",
    "canva", "figma", "photoshop", "illustrator", "after effects", "premiere",
    "mockup", "mockups", "visual", "visuals", "storyboard", "animation",
    "bildbearbeitung", "reels", "reel", "ugc", "script", "skript",
    "vorlage", "vorlagen", "template", "templates", "banner", "ad design",
  ], category: "creative" },
  // Sales
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
  // Fulfillment
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
  // Admin
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
  // Growth
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
  // Meeting
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
  // Pause
  { keywords: [
    "pause", "mittag", "mittagspause", "mittagessen",
    "break", "essen", "kaffee", "kaffeepause",
    "spaziergang", "spazieren", "frische luft",
    "auszeit", "erholung", "gym", "sport", "training",
  ], category: "pause" },
];

function detectCategory(note: string): Category {
  const lower = note.toLowerCase().trim();
  if (!lower) return "admin";

  // Find all matches, prefer longest keyword match
  let bestMatch: { category: Category; length: number } | null = null;
  for (const { keywords, category } of categoryKeywords) {
    for (const kw of keywords) {
      if (lower.includes(kw) && (!bestMatch || kw.length > bestMatch.length)) {
        bestMatch = { category, length: kw.length };
      }
    }
  }
  return bestMatch?.category ?? "admin";
}

function getCurrentTimeRounded(): { start: string; end: string } {
  const now = new Date();
  const h = now.getHours();
  const m = Math.floor(now.getMinutes() / 15) * 15;
  const endM = m + 15;
  const endH = endM >= 60 ? h + 1 : h;
  const endMFinal = endM >= 60 ? endM - 60 : endM;
  return {
    start: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
    end: `${endH.toString().padStart(2, "0")}:${endMFinal.toString().padStart(2, "0")}`,
  };
}

function toSlotIndex(hour: number, minute: number) {
  return (hour - START_HOUR) * 4 + minute / 15;
}

function fromSlotIndex(slot: number): { hour: number; minute: number } {
  const hour = START_HOUR + Math.floor(slot / 4);
  const minute = (slot % 4) * 15;
  return { hour, minute };
}

function hasOverlap(entries: TimeEntry[], date: string, startSlot: number, endSlot: number, excludeId?: string): boolean {
  return entries.some((e) => {
    if (e.date !== date) return false;
    if (excludeId && e.id === excludeId) return false;
    const eStart = toSlotIndex(e.startHour, e.startMinute);
    const eEnd = toSlotIndex(e.endHour, e.endMinute);
    return startSlot < eEnd && endSlot > eStart;
  });
}

export default function TimeTracking() {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState(() => {
    const { start, end } = getCurrentTimeRounded();
    return {
      category: "fulfillment" as Category,
      note: "",
      startTime: start,
      endTime: end,
      date: todayStr,
    };
  });

  // Drag state
  const [dragEntry, setDragEntry] = useState<TimeEntry | null>(null);
  const [dragGhostDate, setDragGhostDate] = useState<string | null>(null);
  const [dragGhostSlot, setDragGhostSlot] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0); // slot offset from top of entry
  const dayColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Live clock for "now" line
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const nowHour = now.getHours();
  const nowMinute = now.getMinutes();
  const nowSlotPos = ((nowHour - START_HOUR) * 60 + nowMinute) / 15 * SLOT_HEIGHT;
  const nowInRange = nowHour >= START_HOUR && nowHour < END_HOUR;

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekStats = useMemo(() => {
    const stats: Record<Category, number> = { fulfillment: 0, sales: 0, admin: 0, growth: 0, meeting: 0, creative: 0, pause: 0 };
    const weekDates = new Set(weekDays.map((d) => format(d, "yyyy-MM-dd")));
    entries.forEach((e) => {
      if (!weekDates.has(e.date)) return;
      const slots = toSlotIndex(e.endHour, e.endMinute) - toSlotIndex(e.startHour, e.startMinute);
      stats[e.category] += slots;
    });
    return stats;
  }, [entries, weekDays]);

  const totalWeekMinutes = useMemo(() => {
    const weekDates = new Set(weekDays.map((d) => format(d, "yyyy-MM-dd")));
    return entries
      .filter((e) => weekDates.has(e.date) && e.category !== "pause")
      .reduce((sum, e) => sum + (toSlotIndex(e.endHour, e.endMinute) - toSlotIndex(e.startHour, e.startMinute)) * 15, 0);
  }, [entries, weekDays]);

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return { hour: h, minute: m };
  };

  const openNewDialog = (date: string, hour?: number) => {
    let startTime: string;
    let endTime: string;
    if (hour !== undefined) {
      startTime = `${hour.toString().padStart(2, "0")}:00`;
      const endH = hour;
      const endM = 15;
      endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
    } else {
      const current = getCurrentTimeRounded();
      startTime = current.start;
      endTime = current.end;
    }
    setForm({
      category: "fulfillment",
      note: "",
      startTime,
      endTime,
      date,
    });
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const openEditDialog = (entry: TimeEntry) => {
    setForm({
      category: entry.category,
      note: entry.note,
      startTime: `${entry.startHour.toString().padStart(2, "0")}:${entry.startMinute.toString().padStart(2, "0")}`,
      endTime: `${entry.endHour.toString().padStart(2, "0")}:${entry.endMinute.toString().padStart(2, "0")}`,
      date: entry.date,
    });
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.note.trim()) {
      toast.error("Bitte beschreibe was du gemacht hast");
      return;
    }
    const start = parseTime(form.startTime);
    const end = parseTime(form.endTime);
    const startSlot = toSlotIndex(start.hour, start.minute);
    const endSlot = toSlotIndex(end.hour, end.minute);

    if (endSlot <= startSlot) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return;
    }

    if (hasOverlap(entries, form.date, startSlot, endSlot, editingEntry?.id)) {
      toast.error("Zeitraum überschneidet sich mit einem bestehenden Eintrag");
      return;
    }

    const entry: TimeEntry = {
      id: editingEntry?.id ?? Date.now().toString(),
      date: form.date,
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
      category: form.category,
      note: form.note,
    };

    if (editingEntry) {
      setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? entry : e)));
      toast.success("Eintrag aktualisiert");
    } else {
      setEntries((prev) => [...prev, entry]);
      toast.success("Eintrag hinzugefügt");
    }
    setDialogOpen(false);
    setEditingEntry(null);
  };

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Eintrag gelöscht");
  };

  // --- Drag & Drop ---
  const handleDragStart = useCallback((entry: TimeEntry, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const colEl = dayColumnRefs.current.get(entry.date);
    if (!colEl) return;

    const rect = colEl.getBoundingClientRect();
    const yInCol = e.clientY - rect.top;
    const slotAtMouse = Math.floor(yInCol / SLOT_HEIGHT);
    const entryStartSlot = toSlotIndex(entry.startHour, entry.startMinute);
    const offset = slotAtMouse - entryStartSlot;

    setDragEntry(entry);
    setDragOffset(offset);
    setDragGhostDate(entry.date);
    setDragGhostSlot(entryStartSlot);
  }, []);

  const handleMouseMoveGrid = useCallback((e: React.MouseEvent) => {
    if (!dragEntry) return;

    const entrySlots = toSlotIndex(dragEntry.endHour, dragEntry.endMinute) - toSlotIndex(dragEntry.startHour, dragEntry.startMinute);
    const maxSlot = (END_HOUR - START_HOUR) * 4;

    // Find which day column we're over
    for (const [dateStr, colEl] of dayColumnRefs.current.entries()) {
      const rect = colEl.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        const yInCol = e.clientY - rect.top;
        let newStartSlot = Math.round(yInCol / SLOT_HEIGHT) - dragOffset;
        newStartSlot = Math.max(0, Math.min(newStartSlot, maxSlot - entrySlots));

        setDragGhostDate(dateStr);
        setDragGhostSlot(newStartSlot);
        break;
      }
    }
  }, [dragEntry, dragOffset]);

  const handleMouseUpGrid = useCallback(() => {
    if (!dragEntry || dragGhostDate === null || dragGhostSlot === null) {
      setDragEntry(null);
      return;
    }

    const entrySlots = toSlotIndex(dragEntry.endHour, dragEntry.endMinute) - toSlotIndex(dragEntry.startHour, dragEntry.startMinute);
    const newStart = fromSlotIndex(dragGhostSlot);
    const newEnd = fromSlotIndex(dragGhostSlot + entrySlots);

    // Check overlap
    if (hasOverlap(entries, dragGhostDate, dragGhostSlot, dragGhostSlot + entrySlots, dragEntry.id)) {
      toast.error("Kann nicht verschieben — Zeitraum ist belegt");
      setDragEntry(null);
      setDragGhostDate(null);
      setDragGhostSlot(null);
      return;
    }

    setEntries((prev) =>
      prev.map((en) =>
        en.id === dragEntry.id
          ? { ...en, date: dragGhostDate!, startHour: newStart.hour, startMinute: newStart.minute, endHour: newEnd.hour, endMinute: newEnd.minute }
          : en
      )
    );

    setDragEntry(null);
    setDragGhostDate(null);
    setDragGhostSlot(null);
  }, [dragEntry, dragGhostDate, dragGhostSlot, entries]);

  // Ghost info for rendering
  const ghostInfo = useMemo(() => {
    if (!dragEntry || dragGhostDate === null || dragGhostSlot === null) return null;
    const entrySlots = toSlotIndex(dragEntry.endHour, dragEntry.endMinute) - toSlotIndex(dragEntry.startHour, dragEntry.startMinute);
    const blocked = hasOverlap(entries, dragGhostDate, dragGhostSlot, dragGhostSlot + entrySlots, dragEntry.id);
    return { date: dragGhostDate, startSlot: dragGhostSlot, slots: entrySlots, blocked };
  }, [dragEntry, dragGhostDate, dragGhostSlot, entries]);

  // --- Auswertung Data ---
  const dailyTotals = useMemo(() => {
    return weekDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = entries.filter((e) => e.date === dateStr);
      const byCategory: Record<Category, number> = { fulfillment: 0, sales: 0, admin: 0, growth: 0, meeting: 0, creative: 0, pause: 0 };
      dayEntries.forEach((e) => {
        const slots = toSlotIndex(e.endHour, e.endMinute) - toSlotIndex(e.startHour, e.startMinute);
        byCategory[e.category] += slots * 15;
      });
      const totalWork = Object.entries(byCategory).reduce((s, [k, v]) => k !== "pause" ? s + v : s, 0);
      return { date: day, dateStr, byCategory, totalWork, totalPause: byCategory.pause };
    });
  }, [entries, weekDays]);

  const weekTotalWork = dailyTotals.reduce((s, d) => s + d.totalWork, 0);
  const weekTotalPause = dailyTotals.reduce((s, d) => s + d.totalPause, 0);
  const weekTarget = 40 * 60; // 40h target
  const weekProgress = Math.min(100, Math.round((weekTotalWork / weekTarget) * 100));

  const topCategory = useMemo(() => {
    const sums: Record<string, number> = {};
    categories.filter((c) => c.value !== "pause").forEach((c) => {
      sums[c.value] = dailyTotals.reduce((s, d) => s + d.byCategory[c.value], 0);
    });
    const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[1] > 0 ? sorted[0] : null;
  }, [dailyTotals]);

  const avgDailyWork = useMemo(() => {
    const daysWithWork = dailyTotals.filter((d) => d.totalWork > 0).length;
    return daysWithWork > 0 ? Math.round(weekTotalWork / daysWithWork) : 0;
  }, [dailyTotals, weekTotalWork]);

  // Bar chart max for scaling
  const maxDayMinutes = Math.max(...dailyTotals.map((d) => d.totalWork), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zeiterfassung</h1>
          <p className="text-sm text-muted-foreground">Woche tracken in 15-Minuten-Blöcken.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold tracking-tight">{formatMinutes(totalWeekMinutes)}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">diese Woche</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="kalender">
        <TabsList>
          <TabsTrigger value="kalender" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Kalender</TabsTrigger>
          <TabsTrigger value="auswertung" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Auswertung</TabsTrigger>
        </TabsList>

        <TabsContent value="kalender" className="space-y-4 mt-4">

      {/* Week Navigation + Stats in one row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))}>
            Heute
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {format(weekDays[0], "d. MMM", { locale: de })} – {format(weekDays[6], "d. MMM yyyy", { locale: de })}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.filter((c) => c.value !== "pause").map((cat) => {
            const mins = weekStats[cat.value] * 15;
            if (mins === 0) return null;
            return (
              <div key={cat.value} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cat.color}`} />
                {cat.label}: {formatMinutes(mins)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div
            className="min-w-[900px]"
            onMouseMove={handleMouseMoveGrid}
            onMouseUp={handleMouseUpGrid}
            onMouseLeave={handleMouseUpGrid}
          >
            {/* Day Headers */}
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b sticky top-0 bg-card z-20">
              <div className="p-2" />
              {weekDays.map((day) => {
                const isToday = isSameDay(day, today);
                const dateStr = format(day, "yyyy-MM-dd");
                const dayMins = entries
                  .filter((e) => e.date === dateStr && e.category !== "pause")
                  .reduce((s, e) => s + (toSlotIndex(e.endHour, e.endMinute) - toSlotIndex(e.startHour, e.startMinute)) * 15, 0);
                return (
                  <div
                    key={dateStr}
                    className={`p-2 text-center border-l ${isToday ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{format(day, "EEE", { locale: de })}</div>
                    <div className={`text-lg font-semibold mt-0.5 ${isToday ? "inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}>
                      {format(day, "d")}
                    </div>
                    {dayMins > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{formatMinutes(dayMins)}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div className="grid grid-cols-[70px_repeat(7,1fr)]">
              {/* Time label column */}
              <div className="relative">
                {hours.map((hour) => (
                  <div key={hour} className="border-t" style={{ height: SLOT_HEIGHT * 4 }}>
                    <div className="flex items-start justify-end pr-3 pt-1">
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {hour.toString().padStart(2, "0")}:00
                      </span>
                    </div>
                  </div>
                ))}
                {/* Current time label */}
                {nowInRange && weekDays.some((d) => isSameDay(d, today)) && (
                  <div
                    className="absolute right-1 pointer-events-none -translate-y-1/2"
                    style={{ top: nowSlotPos }}
                  >
                    <span className="text-[10px] font-bold text-red-500 tabular-nums bg-card px-1 rounded">
                      {nowHour.toString().padStart(2, "0")}:{nowMinute.toString().padStart(2, "0")}
                    </span>
                  </div>
                )}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const isToday = isSameDay(day, today);
                const dayEntries = entries.filter((e) => e.date === dateStr);

                return (
                  <div
                    key={dateStr}
                    ref={(el) => { if (el) dayColumnRefs.current.set(dateStr, el); }}
                    className={`border-l relative ${isToday ? "bg-primary/[0.03]" : ""}`}
                    style={{ height: hours.length * SLOT_HEIGHT * 4 }}
                    onDoubleClick={() => openNewDialog(dateStr)}
                  >
                    {/* Hour lines */}
                    {hours.map((hour, hIdx) => (
                      <div key={hour} className="absolute w-full border-t" style={{ top: hIdx * SLOT_HEIGHT * 4 }}>
                        {[1, 2, 3].map((q) => (
                          <div
                            key={q}
                            className="absolute w-full border-t border-dashed border-border/30"
                            style={{ top: SLOT_HEIGHT * q }}
                          />
                        ))}
                      </div>
                    ))}

                    {/* Drag ghost preview */}
                    {ghostInfo && ghostInfo.date === dateStr && (
                      <div
                        className={`absolute left-1 right-1 rounded-md border-2 border-dashed pointer-events-none z-10 ${
                          ghostInfo.blocked
                            ? "border-destructive bg-destructive/10"
                            : "border-primary bg-primary/10"
                        }`}
                        style={{
                          top: ghostInfo.startSlot * SLOT_HEIGHT + 1,
                          height: ghostInfo.slots * SLOT_HEIGHT - 2,
                        }}
                      />
                    )}

                    {/* Current time line */}
                    {isToday && nowInRange && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                        style={{ top: nowSlotPos }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-[5px] shrink-0" />
                        <div className="h-[2px] w-full bg-red-500" />
                      </div>
                    )}

                    {/* Entry blocks */}
                    {dayEntries.map((entry) => {
                      const cat = categoryMap[entry.category];
                      const startSlot = toSlotIndex(entry.startHour, entry.startMinute);
                      const endSlot = toSlotIndex(entry.endHour, entry.endMinute);
                      const slotCount = endSlot - startSlot;
                      const top = startSlot * SLOT_HEIGHT;
                      const height = slotCount * SLOT_HEIGHT;
                      const isDragging = dragEntry?.id === entry.id;

                      return (
                        <div
                          key={entry.id}
                          className={`absolute left-1.5 right-1 rounded-lg cursor-grab active:cursor-grabbing transition-all overflow-hidden ${
                            isDragging ? "opacity-40 ring-2 ring-primary shadow-lg" : "hover:shadow-md hover:brightness-[0.98]"
                          }`}
                          style={{ top: top + 1, height: height - 2, zIndex: isDragging ? 5 : 1 }}
                          onMouseDown={(e) => handleDragStart(entry, e)}
                          onClick={(e) => {
                            if (!dragEntry) {
                              e.stopPropagation();
                              openEditDialog(entry);
                            }
                          }}
                        >
                          {/* Colored left stripe */}
                          <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg ${cat.color}`} />
                          <div className={`h-full ${cat.bg} pl-2 pr-1.5 py-1 flex flex-col select-none`}>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold truncate">{cat.label}</span>
                              <span className="text-[9px] opacity-50 ml-auto shrink-0 tabular-nums">
                                {entry.startHour.toString().padStart(2, "0")}:{entry.startMinute.toString().padStart(2, "0")}
                              </span>
                            </div>
                            {height > 15 && (
                              <p className="text-[10px] opacity-60 leading-tight mt-0.5 line-clamp-2">{entry.note}</p>
                            )}
                            {height > 35 && (
                              <div className="mt-auto">
                                <span className="text-[9px] opacity-40 tabular-nums">
                                  {entry.endHour.toString().padStart(2, "0")}:{entry.endMinute.toString().padStart(2, "0")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Add buttons per day */}
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-t">
              <div className="p-1" />
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                return (
                  <div key={dateStr} className="p-1.5 border-l flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground gap-1"
                      onClick={() => openNewDialog(dateStr)}
                    >
                      <Plus className="h-3 w-3" />
                      Eintrag
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        {/* AUSWERTUNG TAB */}
        <TabsContent value="auswertung" className="space-y-5 mt-4">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))}>
              Heute
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium ml-2">
              {format(weekDays[0], "d. MMM", { locale: de })} – {format(weekDays[6], "d. MMM yyyy", { locale: de })}
            </span>
          </div>

          {/* Hero KPIs */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamtzeit</p>
                    <p className="text-3xl font-bold tracking-tight">{formatMinutes(weekTotalWork)}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5 bg-muted/50">
                    <div className="bg-primary rounded-full transition-all" style={{ width: `${weekProgress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{weekProgress}% vom 40h Ziel</span>
                    <span className="font-medium">{formatMinutes(Math.max(0, weekTarget - weekTotalWork))} übrig</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Ø pro Tag</p>
                    <p className="text-sm font-semibold">{formatMinutes(avgDailyWork)}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tage gearbeitet</p>
                    <p className="text-sm font-semibold">{dailyTotals.filter((d) => d.totalWork > 0).length} / 7</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pausenzeit</p>
                    <p className="text-sm font-semibold">{formatMinutes(weekTotalPause)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Category + Category Ring */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Top Kategorie</p>
                    {topCategory ? (
                      <p className="text-3xl font-bold tracking-tight">{categoryMap[topCategory[0]]?.label}</p>
                    ) : (
                      <p className="text-xl text-muted-foreground">–</p>
                    )}
                  </div>
                </div>
                {/* Category breakdown */}
                <div className="space-y-2.5">
                  {categories.filter((c) => c.value !== "pause").map((cat) => {
                    const totalMins = dailyTotals.reduce((s, d) => s + d.byCategory[cat.value], 0);
                    const pct = weekTotalWork > 0 ? Math.round((totalMins / weekTotalWork) * 100) : 0;
                    if (totalMins === 0) return null;
                    return (
                      <div key={cat.value} className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${cat.color} shrink-0`} />
                        <span className="text-xs font-medium w-20 truncate">{cat.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${cat.color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">{formatMinutes(totalMins)}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/60 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tagesübersicht — Vertical bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tagesübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-[180px] pb-8 relative">
                {/* Y-axis guide lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-0 right-0 border-t border-dashed border-border/30"
                    style={{ bottom: `${pct * 140 + 32}px` }}
                  >
                    <span className="absolute -top-2.5 -left-0 text-[9px] text-muted-foreground/50 tabular-nums">
                      {formatMinutes(Math.round(maxDayMinutes * (1 - pct)))}
                    </span>
                  </div>
                ))}
                {dailyTotals.map((day) => {
                  const isToday = isSameDay(day.date, today);
                  const totalH = maxDayMinutes > 0 ? (day.totalWork / maxDayMinutes) * 140 : 0;
                  return (
                    <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col-reverse rounded-lg overflow-hidden" style={{ height: totalH || 4 }}>
                        {day.totalWork > 0 ? (
                          categories.filter((c) => c.value !== "pause" && day.byCategory[c.value] > 0).map((cat) => {
                            const catH = (day.byCategory[cat.value] / maxDayMinutes) * 140;
                            return <div key={cat.value} className={`${cat.color} w-full`} style={{ height: catH }} />;
                          })
                        ) : (
                          <div className="bg-muted/30 w-full h-full rounded" />
                        )}
                      </div>
                      <div className="text-center mt-1">
                        <div className={`text-[10px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                          {format(day.date, "EEE", { locale: de })}
                        </div>
                        <div className={`text-xs font-bold ${isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]" : ""}`}>
                          {format(day.date, "d")}
                        </div>
                        {day.totalWork > 0 && (
                          <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">{formatMinutes(day.totalWork)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-2 pt-3 border-t">
                {categories.filter((c) => c.value !== "pause").map((cat) => {
                  const totalMins = dailyTotals.reduce((s, d) => s + d.byCategory[cat.value], 0);
                  if (totalMins === 0) return null;
                  return (
                    <div key={cat.value} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className={`h-2 w-2 rounded ${cat.color}`} />
                      {cat.label}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Alle Einträge der Woche */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Alle Einträge dieser Woche</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {entries
                .filter((e) => weekDays.some((d) => format(d, "yyyy-MM-dd") === e.date))
                .length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Keine Einträge in dieser Woche.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[11px] uppercase tracking-wider">Tag</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Zeit</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Kategorie</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Beschreibung</TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">Dauer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries
                      .filter((e) => weekDays.some((d) => format(d, "yyyy-MM-dd") === e.date))
                      .sort((a, b) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return toSlotIndex(a.startHour, a.startMinute) - toSlotIndex(b.startHour, b.startMinute);
                      })
                      .map((entry, idx) => {
                        const cat = categoryMap[entry.category];
                        const date = weekDays.find((d) => format(d, "yyyy-MM-dd") === entry.date)!;
                        const durationMins = (toSlotIndex(entry.endHour, entry.endMinute) - toSlotIndex(entry.startHour, entry.startMinute)) * 15;
                        return (
                          <TableRow key={entry.id} className={`cursor-pointer hover:bg-accent/50 ${idx % 2 === 1 ? "bg-muted/[0.03]" : ""}`} onClick={() => openEditDialog(entry)}>
                            <TableCell className="text-sm font-medium">{format(date, "EEE d.", { locale: de })}</TableCell>
                            <TableCell className="text-sm tabular-nums text-muted-foreground">
                              {entry.startHour.toString().padStart(2, "0")}:{entry.startMinute.toString().padStart(2, "0")} – {entry.endHour.toString().padStart(2, "0")}:{entry.endMinute.toString().padStart(2, "0")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${cat.color}`} />
                                <span className="text-xs font-medium">{cat.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm max-w-[250px] truncate text-muted-foreground">{entry.note}</TableCell>
                            <TableCell className="text-right text-sm font-semibold tabular-nums">{formatMinutes(durationMins)}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Eintrag bearbeiten" : "Neuer Eintrag"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Kategorie</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setForm({ ...form, category: cat.value })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${cat.bg} ${
                      form.category === cat.value ? "ring-2 ring-offset-2 ring-offset-background ring-current" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${cat.color}`} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Von</Label>
                <Select value={form.startTime} onValueChange={(v) => setForm({ ...form, startTime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Bis</Label>
                <Select value={form.endTime} onValueChange={(v) => setForm({ ...form, endTime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {timeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Was hast du gemacht?</Label>
              <Textarea
                placeholder="z.B. Ad Creatives für Acme Co erstellt, 3 Varianten..."
                rows={3}
                value={form.note}
                onChange={(e) => {
                  const note = e.target.value;
                  const detected = detectCategory(note);
                  setForm({ ...form, note, category: detected });
                }}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingEntry && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleDelete(editingEntry.id);
                  setDialogOpen(false);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>{editingEntry ? "Speichern" : "Hinzufügen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

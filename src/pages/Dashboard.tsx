import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { useAllCalendarEvents } from "@/store/calendar";
import { FolderKanban, Users, DollarSign, TrendingUp, Clock, ArrowRight, Sparkles, BarChart3, ArrowUpRight, Flag, AlertTriangle, CalendarDays, CheckCircle2, ListTodo, Phone, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isPast, addDays, isToday as isDateToday } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { isSalesMeeting } from "@/lib/sales-meetings";

const emailToName: Record<string, string> = {
  "info@consulting-og.de": "Alex",
  "office@consulting-og.de": "Daniel",
};

function getMeetingPlatform(link: string) {
  if (link.includes("zoom")) return "Zoom";
  if (link.includes("meet.google")) return "Meet";
  if (link.includes("teams")) return "Teams";
  return "Meeting";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients] = useClients();
  const [projects] = useProjects();
  const calendarEvents = useAllCalendarEvents();
  const [userName, setUserName] = useState("Alex");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      if (email && emailToName[email]) setUserName(emailToName[email]);
    });
  }, []);

  const today = new Date();
  const activeClients = clients.filter((c) => c.status === "Active").length;
  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
  const fmt = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  const hour = today.getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Nachmittag" : "Guten Abend";

  // Projects with progress
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.phases.length > 0).map((p) => {
      const total = p.phases.reduce((s, ph) => s + ph.tasks.length, 0);
      const done = p.phases.reduce((s, ph) => s + ph.tasks.filter((t) => t.status === "done").length, 0);
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const currentPhase = p.phases.find((ph) => !ph.tasks.every((t) => t.status === "done"));
      return { ...p, progress, currentPhase: currentPhase?.title || "Abgeschlossen", total, done };
    }).sort((a, b) => b.progress === 100 ? -1 : a.progress - b.progress).slice(0, 5);
  }, [projects]);

  // Today's events
  const todayStr = format(today, "yyyy-MM-dd");
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === todayStr && !e.id.startsWith("proj-deadline-"))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 6),
  [calendarEvents, todayStr]);

  // Deadlines
  const deadlines = useMemo(() => {
    return projects.filter((p) => p.deadline).map((p) => {
      const d = new Date(p.deadline + "T00:00:00");
      const isOverdue = isPast(new Date(p.deadline + "T23:59:59")) && !isSameDay(d, today);
      return { ...p, deadlineDate: d, isOverdue, isToday: isSameDay(d, today) };
    }).sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime()).slice(0, 5);
  }, [projects, today]);

  // Top clients
  const topClients = useMemo(() => [...clients].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [clients]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/favicon.png" className="h-5 w-5 rounded" />
              <span className="text-xs font-medium text-primary uppercase tracking-wider">Adslift OS</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{greeting}, {userName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(today, "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {[
              { value: String(clients.length), label: "Kunden", icon: Users, color: "bg-blue-500/15 text-blue-500" },
              { value: String(projects.length), label: "Projekte", icon: FolderKanban, color: "bg-violet-500/15 text-violet-500" },
              { value: fmt(totalRevenue), label: "Umsatz", icon: DollarSign, color: "bg-emerald-500/15 text-emerald-500" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 rounded-xl bg-card/50 border px-4 py-2.5">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-lg font-bold leading-tight">{s.value}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { title: "Projekte", value: `${projects.length}`, path: "/projects", icon: FolderKanban, color: "bg-violet-500/15 text-violet-500" },
          { title: "Kunden", value: `${activeClients} aktiv`, path: "/clients", icon: Users, color: "bg-blue-500/15 text-blue-500" },
          { title: "Finanzen", value: "Cash-In/Out", path: "/finances", icon: DollarSign, color: "bg-emerald-500/15 text-emerald-500" },
          { title: "Sales", value: "Funnel", path: "/sales", icon: BarChart3, color: "bg-pink-500/15 text-pink-500" },
          { title: "Kalender", value: `${todayEvents.length} heute`, path: "/calendar", icon: CalendarDays, color: "bg-amber-500/15 text-amber-500" },
        ].map((item) => (
          <Card key={item.path} className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group" onClick={() => navigate(item.path)}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold group-hover:text-primary transition-colors">{item.title}</div>
                <div className="text-[10px] text-muted-foreground">{item.value}</div>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary transition-all" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid — 3 columns */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Today's Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Heute — {format(today, "d. MMM", { locale: de })}
            </CardTitle>
            <button onClick={() => navigate("/calendar")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Kalender <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent>
            {todayEvents.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground">Keine Events heute.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((event) => {
                  const isSales = isSalesMeeting(event);
                  return (
                    <div key={event.id} className={`rounded-lg p-2 cursor-pointer hover:bg-accent/50 transition-colors ${event.accountColorLight || "bg-muted/30"}`} onClick={() => navigate("/calendar")}>
                      <div className="flex items-center gap-2">
                        {isSales && <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />}
                        <span className="text-xs font-medium truncate">{event.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{event.startTime} – {event.endTime}</span>
                        {event.meetingLink && (
                          <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-[9px] font-medium text-primary hover:underline">
                            <Video className="h-2.5 w-2.5" />{getMeetingPlatform(event.meetingLink)}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Aktive Projekte</CardTitle>
            <button onClick={() => navigate("/projects")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              Alle <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <div className="text-center py-6">
                <FolderKanban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground">Keine Projekte.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((p) => (
                  <div key={p.id} className="cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate("/projects")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{p.name}</span>
                      <span className="text-[10px] font-bold tabular-nums ml-2">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} className="h-1.5" />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-muted-foreground">{p.client}</span>
                      <span className="text-[9px] text-primary">{p.currentPhase}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deadlines + Top Clients */}
        <div className="space-y-5">
          {/* Deadlines */}
          {deadlines.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-red-500" />Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deadlines.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2.5 rounded-lg p-2 ${p.isOverdue ? "bg-red-500/5" : p.isToday ? "bg-amber-500/5" : ""}`}>
                      <Flag className={`h-3 w-3 shrink-0 ${p.isOverdue ? "text-red-500" : p.isToday ? "text-amber-500" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{p.name}</div>
                        <div className="text-[9px] text-muted-foreground">{p.client}</div>
                      </div>
                      <span className={`text-[10px] font-medium shrink-0 ${p.isOverdue ? "text-red-500" : ""}`}>
                        {p.isToday ? "Heute" : format(p.deadlineDate, "d. MMM", { locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Clients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Top Kunden</CardTitle>
              <button onClick={() => navigate("/clients")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                Alle <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </CardHeader>
            <CardContent>
              {topClients.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Kunden.</p>
              ) : (
                <div className="space-y-2">
                  {topClients.map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/50 rounded-lg p-1.5 -mx-1.5 transition-colors" onClick={() => navigate("/clients")}>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate">{c.name}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{fmt(c.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { title: "Neuer Kunde", path: "/clients", icon: Users, color: "text-blue-500" },
          { title: "Neues Projekt", path: "/projects", icon: FolderKanban, color: "text-violet-500" },
          { title: "Aufgaben", path: "/tasks", icon: ListTodo, color: "text-amber-500" },
          { title: "Zeiterfassung", path: "/time", icon: Clock, color: "text-emerald-500" },
        ].map((item) => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="rounded-xl border p-3 text-left hover:bg-accent/50 hover:shadow-sm transition-all group flex items-center gap-2.5">
            <item.icon className={`h-4 w-4 ${item.color}`} />
            <span className="text-xs font-medium group-hover:text-primary transition-colors">{item.title}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-primary ml-auto transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClients } from "@/store/clients";
import { useProjects } from "@/store/projects";
import { FolderKanban, Users, DollarSign, TrendingUp, Clock, ArrowRight, Sparkles, BarChart3, ArrowUpRight, Flag, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isPast, addDays } from "date-fns";
import { de } from "date-fns/locale";

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients] = useClients();
  const [projects] = useProjects();

  const activeClients = clients.filter((c) => c.status === "Active").length;
  const pausedClients = clients.length - activeClients;
  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
  const avgRevenue = clients.length > 0 ? totalRevenue / clients.length : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

  const topClients = useMemo(() =>
    [...clients].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
  [clients]);

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Nachmittag" : "Guten Abend";

  // Donut segments for active/paused
  const donutActive = clients.length > 0 ? (activeClients / clients.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-primary/3 rounded-full translate-y-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wider">adslift</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}, Alex</h1>
          <p className="text-sm text-muted-foreground mt-1">Hier ist dein Überblick für heute.</p>

          {/* Mini stats inline */}
          <div className="flex flex-wrap items-center gap-6 mt-6">
            <div>
              <div className="text-2xl font-bold">{clients.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Kunden</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold">{fmt(totalRevenue)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Umsatz</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeClients}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Aktive Kunden</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <div className="text-2xl font-bold">{fmt(avgRevenue)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Ø pro Kunde</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Projekte", desc: `${activeClients} aktiv`, path: "/projects", icon: FolderKanban, gradient: "from-violet-500/20 to-violet-500/5", iconBg: "bg-violet-500/15 text-violet-500" },
          { title: "Finanzen", desc: "Cash-In & Out", path: "/finances", icon: DollarSign, gradient: "from-emerald-500/20 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-500" },
          { title: "Sales", desc: "Pipeline tracken", path: "/sales", icon: BarChart3, gradient: "from-blue-500/20 to-blue-500/5", iconBg: "bg-blue-500/15 text-blue-500" },
          { title: "Zeiterfassung", desc: "Woche tracken", path: "/time", icon: Clock, gradient: "from-amber-500/20 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-500" },
        ].map((item) => (
          <Card
            key={item.path}
            className="relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group border-0"
            onClick={() => navigate(item.path)}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-50`} />
            <CardContent className="relative p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <div className="text-base font-semibold">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Project Deadlines */}
      {(() => {
        const today = new Date();
        const deadlineProjects = projects
          .filter((p) => p.deadline)
          .map((p) => {
            const d = new Date(p.deadline + "T00:00:00");
            const isOverdue = isPast(new Date(p.deadline + "T23:59:59")) && !isSameDay(d, today);
            const isToday2 = isSameDay(d, today);
            const isSoon = !isOverdue && !isToday2 && d <= addDays(today, 7);
            return { ...p, deadlineDate: d, isOverdue, isToday: isToday2, isSoon };
          })
          .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());

        const overdueProjects = deadlineProjects.filter((p) => p.isOverdue);
        const upcomingDeadlines = deadlineProjects.filter((p) => !p.isOverdue).slice(0, 5);

        if (deadlineProjects.length === 0) return null;

        return (
          <Card className="relative overflow-hidden">
            {overdueProjects.length > 0 && <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />}
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" />
                Projekt-Deadlines
                {overdueProjects.length > 0 && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{overdueProjects.length} überfällig</Badge>
                )}
              </CardTitle>
              <button onClick={() => navigate("/calendar")} className="text-xs text-primary hover:underline flex items-center gap-1">
                Kalender <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...overdueProjects, ...upcomingDeadlines].map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-lg p-2.5 cursor-pointer transition-colors hover:bg-accent/50 ${
                      p.isOverdue ? "bg-red-500/5" : p.isToday ? "bg-amber-500/5" : ""
                    }`}
                    onClick={() => navigate("/projects")}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      p.isOverdue ? "bg-red-500/10" : p.isToday ? "bg-amber-500/10" : "bg-muted"
                    }`}>
                      {p.isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Flag className={`h-4 w-4 ${p.isToday ? "text-amber-500" : "text-muted-foreground"}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">{p.client}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-semibold ${p.isOverdue ? "text-red-500" : p.isToday ? "text-amber-500" : "text-muted-foreground"}`}>
                        {p.isToday ? "Heute" : format(p.deadlineDate, "d. MMM yyyy", { locale: de })}
                      </div>
                      {p.isOverdue && <div className="text-[9px] text-red-500">Überfällig</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Top Clients — 3 cols */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Top Kunden nach Umsatz</CardTitle>
            <button onClick={() => navigate("/clients")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Alle <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Noch keine Kunden vorhanden.</p>
                <button onClick={() => navigate("/clients")} className="text-xs text-primary hover:underline mt-2">Kunden anlegen</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topClients.map((c, idx) => {
                  const maxRev = topClients[0]?.revenue || 1;
                  const pct = (c.revenue / maxRev) * 100;
                  const colors = ["bg-primary", "bg-violet-500", "bg-blue-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500"];
                  return (
                    <div key={c.id} className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate("/clients")}>
                      {/* Rank */}
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        idx === 0 ? "bg-primary/10 text-primary" :
                        idx === 1 ? "bg-violet-500/10 text-violet-500" :
                        idx === 2 ? "bg-blue-500/10 text-blue-500" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </div>
                      {/* Avatar */}
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                        idx < 3 ? "bg-primary/10 ring-2 ring-primary/20" : "bg-muted"
                      }`}>
                        <span className={`text-[11px] font-bold ${idx < 3 ? "text-primary" : "text-muted-foreground"}`}>{c.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                      {/* Info + Bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{c.name}</span>
                          <span className="text-sm font-bold tabular-nums ml-2">{fmt(c.revenue)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
                          <div className={`h-full rounded-full ${colors[idx % colors.length]} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kunden Donut + Status — 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Kunden-Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Keine Kunden.</p>
              </div>
            ) : (
              <>
                {/* Donut Chart */}
                <div className="flex justify-center mb-5">
                  <div className="relative h-28 w-28">
                    <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                      {/* Background */}
                      <circle cx="60" cy="60" r="48" fill="none" className="stroke-muted" strokeWidth="12" />
                      {/* Active */}
                      <circle
                        cx="60" cy="60" r="48" fill="none"
                        className="stroke-emerald-500"
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 48}`}
                        strokeDashoffset={`${2 * Math.PI * 48 * (1 - donutActive / 100)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">{clients.length}</span>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Kunden</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <div>
                      <div className="text-sm font-bold">{activeClients}</div>
                      <div className="text-[10px] text-muted-foreground">Aktiv</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                    <div>
                      <div className="text-sm font-bold">{pausedClients}</div>
                      <div className="text-[10px] text-muted-foreground">Pausiert</div>
                    </div>
                  </div>
                </div>

                {/* Client list compact */}
                <div className="space-y-1 border-t pt-3">
                  {clients.slice(0, 6).map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.status === "Active" ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                        <span className="text-xs font-medium truncate">{c.name}</span>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground ml-2">{fmt(c.revenue)}</span>
                    </div>
                  ))}
                  {clients.length > 6 && (
                    <button onClick={() => navigate("/clients")} className="text-[10px] text-primary hover:underline w-full text-center pt-1">
                      +{clients.length - 6} weitere
                    </button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row — Quick Links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Neuen Kunden anlegen",
            desc: "Kunde hinzufügen und Projekt starten",
            path: "/clients",
            icon: Users,
            color: "text-primary",
            bg: "bg-primary/5 hover:bg-primary/10",
          },
          {
            title: "Neues Projekt erstellen",
            desc: "Kampagne aufsetzen und tracken",
            path: "/projects",
            icon: FolderKanban,
            color: "text-violet-500",
            bg: "bg-violet-500/5 hover:bg-violet-500/10",
          },
          {
            title: "Deal erfassen",
            desc: "Neuen Deal in Cash-In anlegen",
            path: "/finances",
            icon: DollarSign,
            color: "text-emerald-500",
            bg: "bg-emerald-500/5 hover:bg-emerald-500/10",
          },
        ].map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm group ${item.bg}`}
          >
            <div className="flex items-center gap-3">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-[10px] text-muted-foreground">{item.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-all group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

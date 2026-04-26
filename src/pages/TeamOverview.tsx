import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronRight, ListTodo } from "lucide-react";
import { isPast, isToday } from "date-fns";
import { useTeamMembers, isLeadershipRole } from "@/store/teamMembers";
import { useAllEmployeeTodos } from "@/store/employeeTodos";
import MyArea from "./MyArea";
import { cn } from "@/lib/utils";

export default function TeamOverview() {
  const team = useTeamMembers();
  const allTodos = useAllEmployeeTodos();
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const staff = useMemo(
    () => team.filter((m) => m.status === "active" && !isLeadershipRole(m.role)),
    [team],
  );

  const todosByEmail = useMemo(() => {
    const map: Record<string, typeof allTodos> = {};
    for (const t of allTodos) {
      const k = t.userEmail.toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(t);
    }
    return map;
  }, [allTodos]);

  // View-as mode — render the selected member's full MyArea
  if (selectedEmail) {
    return (
      <MyArea
        viewMember={{ email: selectedEmail }}
        onExitViewAs={() => setSelectedEmail(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team-Übersicht</h1>
        <p className="text-sm text-muted-foreground">
          Klick auf einen Mitarbeiter um seinen kompletten Bereich zu sehen — KPIs, ToDos & Provision.
        </p>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
            <p className="font-medium">Noch keine Setter oder Closer angelegt</p>
            <p className="text-sm text-muted-foreground">
              Lege unter <strong>Einstellungen → Team</strong> Mitarbeiter mit Rolle "Setter" oder "Closer" an.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((m) => {
            const myTodos = todosByEmail[m.email.toLowerCase()] || [];
            const open = myTodos.filter((t) => !t.done);
            const done = myTodos.filter((t) => t.done);
            const overdue = open.filter(
              (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)),
            ).length;
            const today = open.filter((t) => t.dueDate && isToday(new Date(t.dueDate))).length;

            return (
              <button
                key={m.id}
                onClick={() => setSelectedEmail(m.email)}
                className="group text-left rounded-xl border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#4D96FF] to-[#0650C7] flex items-center justify-center text-base font-bold text-white shrink-0 shadow-md">
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{m.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="secondary" className="text-[9px] py-0">
                            {m.role}
                          </Badge>
                          {m.closeUserId ? (
                            <Badge className="text-[9px] py-0 bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15">
                              Close ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 text-amber-500 border-amber-500/30">
                              Close ✗
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Offen" value={open.length} tone="primary" />
                    <Stat label="Heute" value={today} tone="warn" />
                    <Stat label="Überfällig" value={overdue} tone="danger" />
                  </div>

                  <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ListTodo className="h-3 w-3" />
                      {myTodos.length} ToDos gesamt
                    </span>
                    <span>{m.commissionRate}% Provision</span>
                  </div>
                </div>

                <div className="px-5 py-2 bg-muted/30 text-[10px] text-muted-foreground border-t group-hover:bg-primary/[0.04] transition-colors">
                  Klick → kompletter Bereich
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warn" | "danger";
}) {
  const colors = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    danger: "border-rose-500/30 bg-rose-500/5 text-rose-500",
  };
  return (
    <div className={cn("rounded-lg border px-2 py-1.5 text-center", colors[tone])}>
      <div className="text-[9px] font-mono uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

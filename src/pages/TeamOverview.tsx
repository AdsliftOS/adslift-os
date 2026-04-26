import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus,
  Phone,
  RefreshCw,
  CreditCard,
  ListTodo,
  Trash2,
  Check,
  AlertCircle,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useTeamMembers, isLeadershipRole } from "@/store/teamMembers";
import {
  useAllEmployeeTodos,
  addEmployeeTodo,
  updateEmployeeTodo,
  deleteEmployeeTodo,
  type EmployeeTodoType,
} from "@/store/employeeTodos";
import { cn } from "@/lib/utils";

const todoTypes: { value: EmployeeTodoType; label: string; icon: typeof Phone; color: string }[] = [
  { value: "call", label: "Anruf", icon: Phone, color: "text-blue-500" },
  { value: "followup", label: "Follow-Up", icon: RefreshCw, color: "text-amber-500" },
  { value: "payment_reminder", label: "Zahlungserinnerung", icon: CreditCard, color: "text-rose-500" },
  { value: "other", label: "Sonstiges", icon: ListTodo, color: "text-muted-foreground" },
];

const todoTypeMap = Object.fromEntries(todoTypes.map((t) => [t.value, t]));

export default function TeamOverview() {
  const team = useTeamMembers();
  const allTodos = useAllEmployeeTodos();

  // Only show non-leadership members on this page (closers/setters/admins-as-staff)
  const staff = useMemo(
    () => team.filter((m) => m.status === "active" && !isLeadershipRole(m.role)),
    [team],
  );

  const [assignTo, setAssignTo] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "call" as EmployeeTodoType,
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueTime: "",
    leadName: "",
    phone: "",
  });

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      type: "call",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      dueTime: "",
      leadName: "",
      phone: "",
    });
  };

  const handleAssign = async () => {
    if (!assignTo || !form.title.trim()) {
      toast.error("Titel ist erforderlich");
      return;
    }
    await addEmployeeTodo({
      userEmail: assignTo,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      dueDate: form.dueDate || null,
      dueTime: form.dueTime || null,
      leadName: form.leadName.trim() || null,
      leadCloseId: null,
      phone: form.phone.trim() || null,
      done: false,
    });
    toast.success("ToDo zugewiesen");
    setAssignTo(null);
    resetForm();
  };

  const todosByEmail = useMemo(() => {
    const map: Record<string, typeof allTodos> = {};
    for (const t of allTodos) {
      const k = t.userEmail.toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(t);
    }
    return map;
  }, [allTodos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team-Übersicht</h1>
        <p className="text-sm text-muted-foreground">
          ToDos für deine Setter & Closer zuweisen und verfolgen.
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
        <div className="grid gap-4 lg:grid-cols-2">
          {staff.map((m) => {
            const myTodos = todosByEmail[m.email.toLowerCase()] || [];
            const open = myTodos.filter((t) => !t.done);
            const done = myTodos.filter((t) => t.done);
            const overdue = open.filter(
              (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)),
            ).length;
            const today = open.filter((t) => t.dueDate && isToday(new Date(t.dueDate))).length;

            return (
              <Card key={m.id} className="overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#4D96FF] to-[#0650C7] flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{m.name}</CardTitle>
                      <CardDescription className="text-xs truncate">
                        {m.role} · {m.email}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      resetForm();
                      setAssignTo(m.email);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> ToDo
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Offen" value={open.length} tone="primary" />
                    <Stat label="Heute" value={today} tone="warn" />
                    <Stat label="Überfällig" value={overdue} tone="danger" />
                  </div>

                  {/* Open ToDos list */}
                  {open.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">
                      Keine offenen ToDos
                    </p>
                  ) : (
                    <ul className="divide-y border rounded-lg overflow-hidden">
                      {open.slice(0, 6).map((t) => {
                        const type = todoTypeMap[t.type];
                        const Icon = type?.icon || ListTodo;
                        const isOverdue =
                          t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate));
                        const isTodayDue = t.dueDate && isToday(new Date(t.dueDate));
                        return (
                          <li key={t.id} className="px-3 py-2 flex items-start gap-2 group hover:bg-muted/30">
                            <button
                              onClick={() => updateEmployeeTodo(t.id, { done: true })}
                              className="mt-0.5 h-4 w-4 rounded border border-muted-foreground/40 hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0"
                              title="Als erledigt markieren"
                            >
                              <Check className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50" />
                            </button>
                            <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", type?.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{t.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                {t.leadName && <span className="truncate">{t.leadName}</span>}
                                {t.dueDate && (
                                  <span
                                    className={cn(
                                      isOverdue && "text-rose-500 font-semibold",
                                      isTodayDue && "text-amber-500 font-semibold",
                                    )}
                                  >
                                    {isTodayDue
                                      ? `Heute${t.dueTime ? ` ${t.dueTime}` : ""}`
                                      : format(new Date(t.dueDate), "dd.MM.", { locale: de })}
                                    {isOverdue && " ⚠"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => deleteEmployeeTodo(t.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </li>
                        );
                      })}
                      {open.length > 6 && (
                        <li className="px-3 py-1.5 text-[10px] text-muted-foreground text-center">
                          + {open.length - 6} weitere
                        </li>
                      )}
                    </ul>
                  )}

                  {done.length > 0 && (
                    <div className="text-[10px] text-muted-foreground text-right">
                      {done.length} erledigt
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign ToDo dialog */}
      <Dialog open={!!assignTo} onOpenChange={(o) => !o && setAssignTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ToDo zuweisen
              {assignTo && (
                <span className="block text-xs font-normal text-muted-foreground mt-1">
                  für {team.find((m) => m.email === assignTo)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Typ</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as EmployeeTodoType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {todoTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Titel *</Label>
              <Input
                placeholder="z.B. Max Müller anrufen"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Notizen</Label>
              <Textarea
                placeholder="Optional"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Lead Name</Label>
                <Input
                  placeholder="z.B. Max Müller"
                  value={form.leadName}
                  onChange={(e) => setForm((f) => ({ ...f, leadName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Telefon</Label>
                <Input
                  placeholder="+49..."
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Fällig am</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Uhrzeit</Label>
                <Input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTo(null)}>Abbrechen</Button>
            <Button onClick={handleAssign}>Zuweisen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

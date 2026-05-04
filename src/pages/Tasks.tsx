import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Repeat, Flame, ArrowUp, Minus, GripVertical, CheckCircle2, Clock, AlertTriangle, Sparkles, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isPast, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useTasks, addTask as addTaskDB, updateTask as updateTaskDB, deleteTask as deleteTaskDB, moveTask as moveTaskDB, loadTasks } from "@/store/tasks";
import type { Task, Category, Priority, Recurrence, Column } from "@/store/tasks";

const teamMembers = [
  { key: "alex", label: "Alex", email: "info@consulting-og.de" },
  { key: "daniel", label: "Daniel", email: "office@consulting-og.de" },
];

const categories: { value: Category; label: string; color: string; dot: string }[] = [
  { value: "admin", label: "Admin", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  { value: "growth", label: "Growth", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  { value: "marketing", label: "Marketing", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  { value: "sales", label: "Sales", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { value: "customer-success", label: "Customer Success", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400", dot: "bg-pink-500" },
];

const categoryMap = Object.fromEntries(categories.map((c) => [c.value, c]));

const priorities: { value: Priority; label: string; icon: typeof Flame; color: string }[] = [
  { value: "high", label: "Hoch", icon: Flame, color: "text-red-500" },
  { value: "medium", label: "Mittel", icon: ArrowUp, color: "text-amber-500" },
  { value: "low", label: "Niedrig", icon: Minus, color: "text-muted-foreground" },
];

const recurrenceLabels: Record<Recurrence, string> = { none: "Einmalig", daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich" };

const columns: { key: Column; title: string; color: string; dotColor: string; emptyIcon: typeof Clock }[] = [
  { key: "todo", title: "To Do", color: "text-muted-foreground", dotColor: "bg-muted-foreground", emptyIcon: Sparkles },
  { key: "in-progress", title: "In Arbeit", color: "text-primary", dotColor: "bg-primary", emptyIcon: Clock },
  { key: "done", title: "Erledigt", color: "text-emerald-500", dotColor: "bg-emerald-500", emptyIcon: CheckCircle2 },
];

const todayStr = format(new Date(), "yyyy-MM-dd");

export default function Tasks() {
  const [tasks] = useTasks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [quickAdd, setQuickAdd] = useState("");
  const [viewUser, setViewUser] = useState<string>("alex");
  const [viewMode, setViewMode] = useState<"status" | "category">(() => {
    return (localStorage.getItem("tasks-view-mode-v2") as "status" | "category") || "category";
  });
  useEffect(() => { localStorage.setItem("tasks-view-mode-v2", viewMode); }, [viewMode]);

  // Detect current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      const found = teamMembers.find((m) => m.email === email);
      if (found) setViewUser(found.key);
    });
  }, []);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Column | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<Category | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", category: "admin" as Category, priority: "medium" as Priority,
    dueDate: todayStr, recurrence: "none" as Recurrence, clientId: "" as string,
  });

  const handleMoveTask = async (id: string, column: Column) => {
    await moveTaskDB(id, column);
  };

  const handleDeleteTask = async (id: string) => {
    await deleteTaskDB(id);
    toast.success("Aufgabe gelöscht");
  };

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return;
    await addTaskDB({ title: quickAdd.trim(), category: "admin" as Category, priority: "medium" as Priority, dueDate: todayStr, column: "todo" as Column, recurrence: "none" as Recurrence, assignee: viewUser });
    setQuickAdd("");
  };

  const openEdit = (task: Task) => {
    setForm({ title: task.title, description: task.description || "", category: task.category, priority: task.priority, dueDate: task.dueDate || "", recurrence: task.recurrence, clientId: task.clientId ?? "" });
    setEditingTask(task);
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm({ title: "", description: "", category: "admin", priority: "medium", dueDate: todayStr, recurrence: "none", clientId: "" });
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Bitte Titel eingeben"); return; }
    if (editingTask) {
      await updateTaskDB(editingTask.id, {
        title: form.title,
        description: form.description,
        category: form.category as Category,
        priority: form.priority as Priority,
        recurrence: form.recurrence as Recurrence,
        dueDate: form.dueDate || "",
        clientId: form.clientId || null,
      });
      toast.success("Aufgabe aktualisiert");
    } else {
      await addTaskDB({ title: form.title.trim(), description: form.description, category: form.category, priority: form.priority, dueDate: form.dueDate || undefined, column: "todo" as Column, recurrence: form.recurrence, assignee: viewUser, clientId: form.clientId || null });
      toast.success("Aufgabe erstellt");
    }
    setDialogOpen(false);
    setEditingTask(null);
  };

  // Filter by user + category
  const filtered = useMemo(() => {
    let result = tasks.filter((t) => !t.assignee || t.assignee === viewUser);
    if (filterCategory !== "all") result = result.filter((t) => t.category === filterCategory);
    return result;
  }, [tasks, filterCategory, viewUser]);

  // Stats
  const todoCount = tasks.filter((t) => t.column === "todo").length;
  const inProgressCount = tasks.filter((t) => t.column === "in-progress").length;
  const doneCount = tasks.filter((t) => t.column === "done").length;
  const overdueCount = tasks.filter((t) => t.column !== "done" && t.dueDate && isPast(new Date(t.dueDate + "T23:59:59")) && !isToday(new Date(t.dueDate + "T00:00:00"))).length;

  // Drag handlers
  const wasDragged = useRef(false);
  const handleDragStart = (taskId: string) => { setDragTaskId(taskId); wasDragged.current = true; };
  const handleDragOver = (e: React.DragEvent, col: Column) => { e.preventDefault(); setDragOverCol(col); };
  const handleDragLeave = () => { setDragOverCol(null); setDragOverUser(null); };
  const handleDrop = (col: Column) => {
    if (dragTaskId) { handleMoveTask(dragTaskId, col); }
    setDragTaskId(null);
    setDragOverCol(null);
    setDragOverUser(null);
  };

  // Drag to reassign user
  const [dragOverUser, setDragOverUser] = useState<string | null>(null);
  const handleUserDragOver = (e: React.DragEvent, userKey: string) => { e.preventDefault(); setDragOverUser(userKey); };
  const handleUserDrop = async (userKey: string) => {
    if (dragTaskId) {
      await updateTaskDB(dragTaskId, { assignee: userKey });
      toast.success(`Aufgabe an ${teamMembers.find((m) => m.key === userKey)?.label} übergeben`);
    }
    setDragTaskId(null);
    setDragOverCol(null);
    setDragOverUser(null);
  };

  // Sort: by category group, then deadline (overdue first), then priority
  const catOrder: Record<Category, number> = { admin: 0, growth: 1, marketing: 2, sales: 3, "customer-success": 4 };
  const priOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  const sortTasks = (arr: Task[]) => [...arr].sort((a, b) => {
    // 1. Category
    if (catOrder[a.category] !== catOrder[b.category]) return catOrder[a.category] - catOrder[b.category];
    // 2. Overdue first
    const aOverdue = a.dueDate && isPast(new Date(a.dueDate + "T23:59:59")) && !isToday(new Date(a.dueDate + "T00:00:00"));
    const bOverdue = b.dueDate && isPast(new Date(b.dueDate + "T23:59:59")) && !isToday(new Date(b.dueDate + "T00:00:00"));
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    // 3. Deadline
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    // 4. Priority
    return priOrder[a.priority] - priOrder[b.priority];
  });

  // Progress
  const totalTasks = tasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aufgaben</h1>
          <p className="text-sm text-muted-foreground">Tägliche & wiederkehrende To-Dos im Kanban-Board.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Neue Aufgabe</Button>
      </div>

      {/* User Switch + View Mode */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1 border rounded-lg p-0.5">
            {teamMembers.map((m) => (
              <button
                key={m.key}
                onClick={() => setViewUser(m.key)}
                onDragOver={(e) => handleUserDragOver(e, m.key)}
                onDragLeave={() => setDragOverUser(null)}
                onDrop={() => handleUserDrop(m.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  dragOverUser === m.key ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-110" :
                  viewUser === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {dragOverUser === m.key ? `→ ${m.label}` : m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 border rounded-lg p-1 ml-auto bg-muted/30">
          <button
            onClick={() => setViewMode("category")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "category" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Nach Kategorie</button>
          <button
            onClick={() => setViewMode("status")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "status" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >Nach Status</button>
        </div>
      </div>

      {/* Hero Stats Bar */}
      <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-8">
            {/* Progress ring */}
            <div className="relative h-16 w-16 shrink-0">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5" className="stroke-muted/40" />
                <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5" strokeLinecap="round"
                  className="stroke-emerald-500"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - progressPct / 100)}`}
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{progressPct}%</span>
            </div>

            <div className="flex items-center gap-6 flex-1">
              {columns.map((col) => {
                const count = col.key === "todo" ? todoCount : col.key === "in-progress" ? inProgressCount : doneCount;
                return (
                  <div key={col.key} className="flex items-center gap-2.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${col.dotColor}/10`}>
                      <span className={`text-base font-bold ${col.color}`}>{count}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{col.title}</span>
                  </div>
                );
              })}

              {overdueCount > 0 && (
                <div className="flex items-center gap-2 ml-auto bg-red-500/10 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500 font-semibold">{overdueCount} überfällig</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Add */}
      <div className="relative">
        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Neue Aufgabe hinzufügen... (Enter drücken)"
          className="pl-10 h-11 bg-card border-dashed text-sm"
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(); }}
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setFilterCategory("all")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${filterCategory === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          Alle
        </button>
        {categories.map((c) => (
          <button key={c.value} onClick={() => setFilterCategory(c.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${filterCategory === c.value ? `${c.color} ring-1 ring-current/20 shadow-sm` : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}
          </button>
        ))}
      </div>

      {/* Kanban Board — Status-Mode */}
      {viewMode === "status" && (
      <div className="grid gap-5 lg:grid-cols-3">
        {columns.map((col) => {
          const colTasks = sortTasks(filtered.filter((t) => t.column === col.key));
          const isDragOver = dragOverCol === col.key;
          const EmptyIcon = col.emptyIcon;

          return (
            <div
              key={col.key}
              className="space-y-3"
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2.5">
                <div className={`h-6 w-1 rounded-full ${col.dotColor}`} />
                <span className="text-sm font-bold">{col.title}</span>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                {col.key === "todo" && (
                  <button onClick={openNew} className="ml-auto h-6 w-6 rounded-md bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                {col.key === "done" && colTasks.length > 0 && (
                  <button onClick={async () => {
                    for (const t of colTasks) { await deleteTaskDB(t.id); }
                    toast.success(`${colTasks.length} erledigte Aufgaben gelöscht`);
                  }} className="ml-auto text-[10px] text-muted-foreground hover:text-red-500 transition-colors">
                    Alle löschen
                  </button>
                )}
              </div>

              {/* Drop zone */}
              <div className={`rounded-xl min-h-[200px] p-1.5 space-y-2 transition-all ${
                isDragOver ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : "bg-muted/20"
              }`}>
                {colTasks.map((task, taskIdx) => {
                  const cat = categoryMap[task.category] || categories[0];
                  const pri = priorities.find((p) => p.value === task.priority) || priorities[1];
                  const PriIcon = pri.icon;
                  const dueDate = task.dueDate ? new Date(task.dueDate + "T00:00:00") : null;
                  const isOverdue = task.column !== "done" && dueDate && isPast(new Date(task.dueDate + "T23:59:59")) && !isToday(dueDate);
                  const isDragging = dragTaskId === task.id;
                  const prevTask = taskIdx > 0 ? colTasks[taskIdx - 1] : null;
                  const showCategoryHeader = !prevTask || prevTask.category !== task.category;

                  return (
                    <div key={task.id} className="space-y-2">
                    {showCategoryHeader && (
                      <div className={`flex items-center gap-1.5 ${taskIdx > 0 ? "mt-2 pt-2 border-t border-border/50" : ""}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${cat.color.split(" ")[1] || "text-muted-foreground"}`}>{cat.label}</span>
                      </div>
                    )}
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); setTimeout(() => { wasDragged.current = false; }, 100); }}
                      onClick={() => { if (!wasDragged.current) openEdit(task); }}
                      className={`relative rounded-xl border cursor-grab active:cursor-grabbing transition-all group overflow-hidden ${
                        task.priority === "high" && col.key !== "done" ? "bg-red-500/[0.06] border-red-500/20" : "bg-card"
                      } ${isDragging ? "opacity-30 scale-95 ring-2 ring-primary" : "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20"
                      } ${col.key === "done" ? "opacity-60 hover:opacity-80" : ""}`}
                    >
                      {/* Color stripe */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cat.dot}`} />

                      <div className="p-3 pl-4">
                        {/* Priority + Title */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className={`text-[13px] font-medium leading-snug ${col.key === "done" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </span>
                            {task.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                          </div>
                          <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${
                            task.priority === "high" ? "bg-red-500/10" : task.priority === "medium" ? "bg-amber-500/10" : "bg-muted"
                          }`}>
                            <PriIcon className={`h-3 w-3 ${pri.color}`} />
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cat.color}`}>
                            {cat.label}
                          </span>

                          {task.recurrence !== "none" && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              <Repeat className="h-2.5 w-2.5" />{recurrenceLabels[task.recurrence]}
                            </span>
                          )}

                          {dueDate && (
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                              isOverdue ? "bg-red-500/10 text-red-500" : isToday(dueDate) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {isOverdue && <AlertTriangle className="h-2.5 w-2.5" />}
                              {!isOverdue && <Clock className="h-2.5 w-2.5" />}
                              {isToday(dueDate) ? "Heute" : format(dueDate, "d. MMM", { locale: de })}
                            </span>
                          )}

                          {/* Move + Delete buttons */}
                          <div className="flex items-center gap-1 ml-auto">
                            {col.key !== "todo" && (
                              <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, "todo"); }} className="rounded p-0.5 hover:bg-muted" title="Zurück zu To-Do">
                                <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                            {col.key === "todo" && (
                              <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, "in-progress"); }} className="rounded p-0.5 hover:bg-muted" title="In Arbeit">
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                            {col.key === "in-progress" && (
                              <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, "done"); }} className="rounded p-0.5 hover:bg-muted" title="Erledigt">
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="rounded p-0.5 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Löschen">
                                <Trash2 className="h-3 w-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="text-center py-12">
                    <EmptyIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/15" />
                    <p className="text-[11px] text-muted-foreground/40">
                      {col.key === "todo" ? "Keine offenen Aufgaben" : col.key === "in-progress" ? "Nichts in Arbeit" : "Noch nichts erledigt"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Kanban Board — Category-Mode */}
      {viewMode === "category" && (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {categories.map((cat) => {
          const catFiltered = filtered.filter((t) => t.category === cat.value);
          const statusOrder: Record<Column, number> = { todo: 0, "in-progress": 1, done: 2 };
          const catTasks = [...catFiltered].sort((a, b) => {
            if (statusOrder[a.column] !== statusOrder[b.column]) return statusOrder[a.column] - statusOrder[b.column];
            const aOver = a.dueDate && isPast(new Date(a.dueDate + "T23:59:59")) && !isToday(new Date(a.dueDate + "T00:00:00"));
            const bOver = b.dueDate && isPast(new Date(b.dueDate + "T23:59:59")) && !isToday(new Date(b.dueDate + "T00:00:00"));
            if (aOver && !bOver) return -1;
            if (!aOver && bOver) return 1;
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            return priOrder[a.priority] - priOrder[b.priority];
          });
          const isDragOverCat = dragOverCategory === cat.value;
          const openCount = catTasks.filter((t) => t.column !== "done").length;
          const doneInCat = catTasks.length - openCount;

          return (
            <div
              key={cat.value}
              className="space-y-3"
              onDragOver={(e) => { e.preventDefault(); setDragOverCategory(cat.value); }}
              onDragLeave={() => setDragOverCategory(null)}
              onDrop={async () => {
                if (dragTaskId) {
                  await updateTaskDB(dragTaskId, { category: cat.value });
                  toast.success(`In ${cat.label} verschoben`);
                }
                setDragTaskId(null);
                setDragOverCategory(null);
              }}
            >
              <div className="flex items-center gap-2">
                <span className={`h-6 w-1 rounded-full ${cat.dot}`} />
                <span className="text-sm font-bold">{cat.label}</span>
                <span className="text-xs text-muted-foreground">{openCount}{doneInCat > 0 ? ` · ${doneInCat} ✓` : ""}</span>
                <button
                  onClick={() => { setForm({ ...form, category: cat.value }); setEditingTask(null); setDialogOpen(true); }}
                  className="ml-auto h-6 w-6 rounded-md bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors"
                  title="Aufgabe hinzufügen"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              <div className={`rounded-xl min-h-[200px] p-1.5 space-y-2 transition-all ${
                isDragOverCat ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : "bg-muted/20"
              }`}>
                {catTasks.map((task) => {
                  const pri = priorities.find((p) => p.value === task.priority) || priorities[1];
                  const PriIcon = pri.icon;
                  const dueDate = task.dueDate ? new Date(task.dueDate + "T00:00:00") : null;
                  const isOverdue = task.column !== "done" && dueDate && isPast(new Date(task.dueDate + "T23:59:59")) && !isToday(dueDate);
                  const isDragging = dragTaskId === task.id;
                  const isDone = task.column === "done";
                  const isInProgress = task.column === "in-progress";

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCategory(null); setTimeout(() => { wasDragged.current = false; }, 100); }}
                      onClick={() => { if (!wasDragged.current) openEdit(task); }}
                      className={`relative rounded-xl border cursor-grab active:cursor-grabbing transition-all group overflow-hidden ${
                        task.priority === "high" && !isDone ? "bg-red-500/[0.06] border-red-500/20" : "bg-card"
                      } ${isDragging ? "opacity-30 scale-95 ring-2 ring-primary" : "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20"
                      } ${isDone ? "opacity-60" : ""}`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cat.dot}`} />
                      <div className="p-3 pl-4">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const next: Column = isDone ? "todo" : isInProgress ? "done" : "in-progress";
                              handleMoveTask(task.id, next);
                            }}
                            className={`shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              isDone ? "bg-emerald-500 border-emerald-500" :
                              isInProgress ? "border-primary bg-primary/20" : "border-muted-foreground/40 hover:border-primary"
                            }`}
                            title={isDone ? "Erledigt — klick für Reset" : isInProgress ? "In Arbeit — klick für Erledigt" : "klick für In Arbeit"}
                          >
                            {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                            {isInProgress && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-[13px] font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </span>
                            {task.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                          </div>
                          <PriIcon className={`h-3 w-3 shrink-0 mt-0.5 ${pri.color}`} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {task.recurrence !== "none" && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              <Repeat className="h-2.5 w-2.5" />{recurrenceLabels[task.recurrence]}
                            </span>
                          )}
                          {dueDate && (
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                              isOverdue ? "bg-red-500/10 text-red-500" : isToday(dueDate) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {isOverdue && <AlertTriangle className="h-2.5 w-2.5" />}
                              {!isOverdue && <Clock className="h-2.5 w-2.5" />}
                              {isToday(dueDate) ? "Heute" : format(dueDate, "d. MMM", { locale: de })}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                            className="ml-auto rounded p-0.5 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Löschen"
                          >
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {catTasks.length === 0 && (
                  <div className="text-center py-10">
                    <span className={`inline-block h-3 w-3 rounded-full ${cat.dot} opacity-30 mb-2`} />
                    <p className="text-[11px] text-muted-foreground/40">Keine {cat.label}-Aufgaben</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Aufgabe *</Label>
              <Input placeholder="Was muss erledigt werden?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Beschreibung</Label>
              <Textarea placeholder="Details, Notizen..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid gap-2">
              <Label>Kategorie</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button key={c.value} onClick={() => setForm({ ...form, category: c.value })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      form.category === c.value ? `${c.color} ring-1 ring-current/20` : "border-border hover:border-primary/30"
                    }`}>
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />{c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={p.value}><div className="flex items-center gap-1.5"><p.icon className={`h-3.5 w-3.5 ${p.color}`} />{p.label}</div></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fällig am</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Wiederholung</Label>
              <div className="flex gap-2">
                {(["none", "daily", "weekly", "monthly"] as Recurrence[]).map((r) => (
                  <button key={r} onClick={() => setForm({ ...form, recurrence: r })}
                    className={`flex-1 rounded-lg border p-2 text-center text-xs font-medium transition-all ${
                      form.recurrence === r ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"
                    }`}>{recurrenceLabels[r]}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingTask && (
              <Button variant="destructive" size="sm" onClick={() => { handleDeleteTask(editingTask.id); setDialogOpen(false); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>{editingTask ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, Plus, Pencil, Trash2, BookOpen, Users, BarChart3, Video,
  Eye, Download, Clock, TrendingUp, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// --- Types ---
type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  published: boolean;
  created_at: string;
};

type Lesson = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  vimeo_id: string;
  duration_minutes: number;
  download_url: string;
  download_name: string;
  published: boolean;
  sort_order: number;
  created_at: string;
};

type AcademyCustomer = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  company: string;
  status: "active" | "expired";
  subscription_end: string | null;
  created_at: string;
};

type LessonProgress = {
  id: string;
  customer_id: string;
  lesson_id: string;
  completed: boolean;
  watched_seconds: number;
  updated_at: string;
};

type DownloadLog = {
  id: string;
  customer_id: string;
  lesson_id: string;
  downloaded_at: string;
};

// --- Component ---
export default function Academy() {
  const [activeTab, setActiveTab] = useState("courses");
  // Courses
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseDialog, setCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", thumbnail_url: "", published: true });

  // Lessons
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "", description: "", vimeo_id: "", duration_minutes: 0,
    download_url: "", download_name: "", published: true, sort_order: 0,
  });

  // Customers
  const [customers, setCustomers] = useState<AcademyCustomer[]>([]);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AcademyCustomer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: "", email: "", password_hash: "", company: "", status: "active" as "active" | "expired",
    subscription_end: "",
  });

  // Analytics
  const [progressData, setProgressData] = useState<LessonProgress[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);

  // --- Load data ---
  const loadCourses = async () => {
    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (data) setCourses(data);
  };

  const loadLessons = async () => {
    const { data } = await supabase.from("lessons").select("*").order("sort_order", { ascending: true });
    if (data) setLessons(data);
  };

  const loadCustomers = async () => {
    const { data } = await supabase.from("academy_customers").select("*").order("created_at", { ascending: false });
    if (data) setCustomers(data);
  };

  const loadAnalytics = async () => {
    const { data: progress } = await supabase.from("lesson_progress").select("*");
    const { data: downloads } = await supabase.from("download_logs").select("*");
    if (progress) setProgressData(progress);
    if (downloads) setDownloadLogs(downloads);
  };

  useEffect(() => {
    loadCourses();
    loadLessons();
    loadCustomers();
    loadAnalytics();
  }, []);

  // Auto-select first course when courses load
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // --- Course CRUD ---
  const openCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({ title: course.title, description: course.description || "", thumbnail_url: course.thumbnail_url || "", published: course.published });
    } else {
      setEditingCourse(null);
      setCourseForm({ title: "", description: "", thumbnail_url: "", published: true });
    }
    setCourseDialog(true);
  };

  const saveCourse = async () => {
    if (!courseForm.title) { toast.error("Titel ist erforderlich"); return; }
    if (editingCourse) {
      const { error } = await supabase.from("courses").update(courseForm).eq("id", editingCourse.id);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kurs aktualisiert");
    } else {
      const { error } = await supabase.from("courses").insert(courseForm);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kurs erstellt");
    }
    setCourseDialog(false);
    loadCourses();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Kurs wirklich löschen?")) return;
    await supabase.from("lessons").delete().eq("course_id", id);
    await supabase.from("courses").delete().eq("id", id);
    toast.success("Kurs gelöscht");
    loadCourses();
    loadLessons();
  };

  // --- Lesson CRUD ---
  const filteredLessons = lessons.filter((l) => l.course_id === selectedCourseId);

  const openLessonDialog = (lesson?: Lesson) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        title: lesson.title, description: lesson.description || "", vimeo_id: lesson.vimeo_id || "",
        duration_minutes: lesson.duration_minutes || 0, download_url: lesson.download_url || "",
        download_name: lesson.download_name || "", published: lesson.published, sort_order: lesson.sort_order || 0,
      });
    } else {
      setEditingLesson(null);
      setLessonForm({ title: "", description: "", vimeo_id: "", duration_minutes: 0, download_url: "", download_name: "", published: true, sort_order: filteredLessons.length + 1 });
    }
    setLessonDialog(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title) { toast.error("Titel ist erforderlich"); return; }
    if (!selectedCourseId) { toast.error("Bitte einen Kurs auswählen"); return; }
    const payload = { ...lessonForm, course_id: selectedCourseId };
    if (editingLesson) {
      const { error } = await supabase.from("lessons").update(payload).eq("id", editingLesson.id);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Lektion aktualisiert");
    } else {
      const { error } = await supabase.from("lessons").insert(payload);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Lektion erstellt");
    }
    setLessonDialog(false);
    loadLessons();
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Lektion wirklich löschen?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    toast.success("Lektion gelöscht");
    loadLessons();
  };

  // --- Customer CRUD ---
  const openCustomerDialog = (customer?: AcademyCustomer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        name: customer.name, email: customer.email, password_hash: customer.password_hash || "",
        company: customer.company || "", status: customer.status, subscription_end: customer.subscription_end || "",
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({ name: "", email: "", password_hash: "", company: "", status: "active", subscription_end: "" });
    }
    setCustomerDialog(true);
  };

  const saveCustomer = async () => {
    if (!customerForm.name || !customerForm.email || !customerForm.password_hash) {
      toast.error("Name, E-Mail und Passwort sind erforderlich"); return;
    }
    const payload = {
      ...customerForm,
      subscription_end: customerForm.subscription_end || null,
    };
    if (editingCustomer) {
      const { error } = await supabase.from("academy_customers").update(payload).eq("id", editingCustomer.id);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kunde aktualisiert");
    } else {
      const { error } = await supabase.from("academy_customers").insert(payload);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kunde erstellt");
    }
    setCustomerDialog(false);
    loadCustomers();
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Kunde wirklich löschen?")) return;
    await supabase.from("academy_customers").delete().eq("id", id);
    toast.success("Kunde gelöscht");
    loadCustomers();
  };

  // --- Analytics computations ---
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const totalCourses = courses.length;
  const totalLessons = lessons.length;
  const completedLessons = progressData.filter((p) => p.completed).length;
  const completionRate = progressData.length > 0 ? Math.round((completedLessons / progressData.length) * 100) : 0;

  // Most watched: count progress entries per lesson
  const lessonWatchCounts: Record<string, number> = {};
  progressData.forEach((p) => {
    lessonWatchCounts[p.lesson_id] = (lessonWatchCounts[p.lesson_id] || 0) + 1;
  });
  const topLessons = Object.entries(lessonWatchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lessonId, count]) => {
      const lesson = lessons.find((l) => l.id === lessonId);
      return { title: lesson?.title || "Unbekannt", count };
    });

  // Recent activity
  const recentProgress = [...progressData]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Academy</h1>
          <p className="text-sm text-muted-foreground">Kurse, Lektionen & Kunden verwalten</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="courses" className="gap-1.5"><BookOpen className="h-4 w-4" />Kurse</TabsTrigger>
          <TabsTrigger value="lessons" className="gap-1.5"><Video className="h-4 w-4" />Lektionen</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5"><Users className="h-4 w-4" />Kunden</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>

        {/* ==================== COURSES TAB ==================== */}
        <TabsContent value="courses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Kurse ({courses.length})</h2>
            <Button onClick={() => openCourseDialog()} size="sm"><Plus className="h-4 w-4 mr-1" />Neuer Kurs</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="overflow-hidden">
                {course.thumbnail_url && (
                  <div className="h-36 bg-muted overflow-hidden">
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">{course.title}</h3>
                    <Badge variant={course.published ? "default" : "secondary"} className={course.published ? "bg-emerald-500 hover:bg-emerald-600 shrink-0" : "shrink-0"}>
                      {course.published ? "Live" : "Entwurf"}
                    </Badge>
                  </div>
                  {course.description && <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>}
                  <div className="text-xs text-muted-foreground">
                    {lessons.filter((l) => l.course_id === course.id).length} Lektionen
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Button variant="outline" size="sm" onClick={() => openCourseDialog(course)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => deleteCourse(course.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedCourseId(course.id); setActiveTab("lessons"); }}>
                      <Eye className="h-3.5 w-3.5 mr-1" />Lektionen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {courses.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Noch keine Kurse vorhanden</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ==================== LESSONS TAB ==================== */}
        <TabsContent value="lessons" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Lektionen</h2>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Kurs wählen" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => openLessonDialog()} size="sm" disabled={!selectedCourseId}><Plus className="h-4 w-4 mr-1" />Neue Lektion</Button>
          </div>

          {selectedCourseId ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Vimeo ID</TableHead>
                  <TableHead>Dauer</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="text-muted-foreground">{lesson.sort_order}</TableCell>
                    <TableCell className="font-medium">{lesson.title}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{lesson.vimeo_id || "-"}</TableCell>
                    <TableCell>{lesson.duration_minutes ? `${lesson.duration_minutes} min` : "-"}</TableCell>
                    <TableCell>
                      {lesson.download_url ? (
                        <Badge variant="outline" className="text-xs"><Download className="h-3 w-3 mr-1" />{lesson.download_name || "PDF"}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={lesson.published ? "default" : "secondary"} className={lesson.published ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                        {lesson.published ? "Live" : "Entwurf"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openLessonDialog(lesson)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteLesson(lesson.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLessons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Lektionen in diesem Kurs</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Bitte einen Kurs auswählen</CardContent></Card>
          )}
        </TabsContent>

        {/* ==================== CUSTOMERS TAB ==================== */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Academy-Kunden ({customers.length})</h2>
            <Button onClick={() => openCustomerDialog()} size="sm"><Plus className="h-4 w-4 mr-1" />Neuer Kunde</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Unternehmen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Abo-Ende</TableHead>
                <TableHead className="w-24">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                  <TableCell>{customer.company || "-"}</TableCell>
                  <TableCell>
                    <Badge className={customer.status === "active" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}>
                      {customer.status === "active" ? "Aktiv" : "Abgelaufen"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.subscription_end ? new Date(customer.subscription_end).toLocaleDateString("de-DE") : "Unbegrenzt"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openCustomerDialog(customer)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCustomer(customer.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Kunden vorhanden</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* ==================== ANALYTICS TAB ==================== */}
        <TabsContent value="analytics" className="space-y-6">
          <h2 className="text-lg font-semibold">Analytics Dashboard</h2>

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-blue-500" /></div>
                  <div>
                    <p className="text-2xl font-bold">{totalCustomers}</p>
                    <p className="text-xs text-muted-foreground">Kunden gesamt</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
                  <div>
                    <p className="text-2xl font-bold">{activeCustomers}</p>
                    <p className="text-xs text-muted-foreground">Aktive Kunden</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><BookOpen className="h-5 w-5 text-violet-500" /></div>
                  <div>
                    <p className="text-2xl font-bold">{totalCourses}</p>
                    <p className="text-xs text-muted-foreground">Kurse / {totalLessons} Lektionen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-amber-500" /></div>
                  <div>
                    <p className="text-2xl font-bold">{completionRate}%</p>
                    <p className="text-xs text-muted-foreground">Abschlussrate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Most Watched */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Video className="h-4 w-4" />Meistgesehene Videos</CardTitle>
              </CardHeader>
              <CardContent>
                {topLessons.length > 0 ? (
                  <div className="space-y-2">
                    {topLessons.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm">{i + 1}. {item.title}</span>
                        <Badge variant="secondary">{item.count} Views</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Daten</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4" />Letzte Aktivitäten</CardTitle>
              </CardHeader>
              <CardContent>
                {recentProgress.length > 0 ? (
                  <div className="space-y-2">
                    {recentProgress.map((p) => {
                      const lesson = lessons.find((l) => l.id === p.lesson_id);
                      const customer = customers.find((c) => c.id === p.customer_id);
                      return (
                        <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div className="text-sm">
                            <span className="font-medium">{customer?.name || "Unbekannt"}</span>
                            <span className="text-muted-foreground"> - {lesson?.title || "Unbekannt"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.completed && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-xs">Fertig</Badge>}
                            <span className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString("de-DE")}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Aktivitäten</p>
                )}
              </CardContent>
            </Card>

            {/* Download Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Download className="h-4 w-4" />Downloads ({downloadLogs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {downloadLogs.length > 0 ? (
                  <div className="space-y-2">
                    {downloadLogs.slice(0, 8).map((dl) => {
                      const lesson = lessons.find((l) => l.id === dl.lesson_id);
                      const customer = customers.find((c) => c.id === dl.customer_id);
                      return (
                        <div key={dl.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <span className="text-sm">{customer?.name || "?"} - {lesson?.download_name || lesson?.title || "?"}</span>
                          <span className="text-xs text-muted-foreground">{new Date(dl.downloaded_at).toLocaleDateString("de-DE")}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine Downloads</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== COURSE DIALOG ==================== */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Kurs bearbeiten" : "Neuer Kurs"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} /></div>
            <div><Label>Thumbnail URL</Label><Input value={courseForm.thumbnail_url} onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })} placeholder="https://..." /></div>
            <div className="flex items-center gap-3">
              <Switch checked={courseForm.published} onCheckedChange={(v) => setCourseForm({ ...courseForm, published: v })} />
              <Label>Veröffentlicht</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog(false)}>Abbrechen</Button>
            <Button onClick={saveCourse}>{editingCourse ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== LESSON DIALOG ==================== */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Lektion bearbeiten" : "Neue Lektion"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vimeo ID</Label><Input value={lessonForm.vimeo_id} onChange={(e) => setLessonForm({ ...lessonForm, vimeo_id: e.target.value })} placeholder="123456789" /></div>
              <div><Label>Dauer (min)</Label><Input type="number" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Download URL</Label><Input value={lessonForm.download_url} onChange={(e) => setLessonForm({ ...lessonForm, download_url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Download Name</Label><Input value={lessonForm.download_name} onChange={(e) => setLessonForm({ ...lessonForm, download_name: e.target.value })} placeholder="Playbook.pdf" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Reihenfolge</Label><Input type="number" value={lessonForm.sort_order} onChange={(e) => setLessonForm({ ...lessonForm, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={lessonForm.published} onCheckedChange={(v) => setLessonForm({ ...lessonForm, published: v })} />
                <Label>Veröffentlicht</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog(false)}>Abbrechen</Button>
            <Button onClick={saveLesson}>{editingLesson ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== CUSTOMER DIALOG ==================== */}
      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Kunde bearbeiten" : "Neuer Kunde"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} /></div>
            <div><Label>E-Mail</Label><Input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
            <div><Label>Passwort</Label><Input type="text" value={customerForm.password_hash} onChange={(e) => setCustomerForm({ ...customerForm, password_hash: e.target.value })} /></div>
            <div><Label>Unternehmen</Label><Input value={customerForm.company} onChange={(e) => setCustomerForm({ ...customerForm, company: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={customerForm.status} onValueChange={(v: "active" | "expired") => setCustomerForm({ ...customerForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="expired">Abgelaufen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Abo-Ende (optional)</Label><Input type="date" value={customerForm.subscription_end} onChange={(e) => setCustomerForm({ ...customerForm, subscription_end: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)}>Abbrechen</Button>
            <Button onClick={saveCustomer}>{editingCustomer ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

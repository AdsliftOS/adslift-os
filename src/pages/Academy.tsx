import { useState, useEffect, useCallback, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GraduationCap, Plus, Pencil, Trash2, BookOpen, Users, BarChart3, Video,
  Eye, Download, Clock, TrendingUp, Activity, Award, FileQuestion, ChevronRight,
  ChevronDown, CheckCircle2, XCircle, Play, ArrowUp, ArrowDown, Shield, Ban,
  RotateCcw, CalendarPlus, Search, Filter, LayoutDashboard, ListChecks,
  Timer, Target, Brain, Flame, MessageSquare, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  category: string;
  is_published: boolean;
  is_sequential: boolean;
  drip_enabled: boolean;
  drip_interval_days: number;
  created_at: string;
};

type Chapter = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
};

type Lesson = {
  id: string;
  course_id: string;
  chapter_id: string | null;
  title: string;
  description: string;
  vimeo_id: string;
  duration_minutes: number;
  download_url: string;
  download_name: string;
  is_published: boolean;
  sort_order: number;
  has_quiz: boolean;
  is_mandatory: boolean;
  created_at: string;
};

type AcademyCustomer = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  company: string;
  status: "active" | "expired" | "suspended";
  subscription_end: string | null;
  last_login: string | null;
  streak: number;
  created_at: string;
};

type LessonProgress = {
  id: string;
  customer_id: string;
  lesson_id: string;
  completed: boolean;
  watched_seconds: number;
  notes: string | null;
  bookmarked: boolean;
  updated_at: string;
};

type DownloadLog = {
  id: string;
  customer_id: string;
  lesson_id: string;
  downloaded_at: string;
};

type Quiz = {
  id: string;
  lesson_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_index: number;
  sort_order: number;
};

type QuizResult = {
  id: string;
  customer_id: string;
  quiz_id: string;
  lesson_id: string;
  selected_index: number;
  correct: boolean;
  created_at: string;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function Academy() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [customers, setCustomers] = useState<AcademyCustomer[]>([]);
  const [progressData, setProgressData] = useState<LessonProgress[]>([]);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);

  // Course form
  const [courseDialog, setCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "", description: "", thumbnail_url: "", category: "Allgemein",
    is_published: true, is_sequential: false, drip_enabled: false, drip_interval_days: 7,
  });

  // Chapter form
  const [chapterDialog, setChapterDialog] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterForm, setChapterForm] = useState({ title: "", sort_order: 0 });

  // Lesson form
  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "", description: "", vimeo_id: "", duration_minutes: 0,
    download_url: "", download_name: "", is_published: true, sort_order: 0,
    has_quiz: false, is_mandatory: false, chapter_id: "" as string,
  });

  // Customer
  const [customerDialog, setCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AcademyCustomer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: "", email: "", password_hash: "", company: "",
    status: "active" as "active" | "expired" | "suspended",
    subscription_end: "",
  });
  const [customerDetail, setCustomerDetail] = useState<AcademyCustomer | null>(null);

  // Quiz
  const [quizDialog, setQuizDialog] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState("");
  const [quizForm, setQuizForm] = useState({
    question: "", option_a: "", option_b: "", option_c: "", option_d: "",
    correct_index: 0, sort_order: 0,
  });
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizPreviewLessonId, setQuizPreviewLessonId] = useState("");

  // Course detail (chapters & lessons)
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseDetailMode, setCourseDetailMode] = useState(false);

  // Lessons tab
  const [lessonFilter, setLessonFilter] = useState("");
  const [lessonCourseFilter, setLessonCourseFilter] = useState("all");

  // Analytics
  const [analyticsRange, setAnalyticsRange] = useState<"week" | "month" | "all">("month");

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (data) setCourses(data);
  }, []);

  const loadChapters = useCallback(async () => {
    const { data } = await supabase.from("chapters").select("*").order("sort_order", { ascending: true });
    if (data) setChapters(data);
  }, []);

  const loadLessons = useCallback(async () => {
    const { data } = await supabase.from("lessons").select("*").order("sort_order", { ascending: true });
    if (data) setLessons(data);
  }, []);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from("academy_customers").select("*").order("created_at", { ascending: false });
    if (data) setCustomers(data);
  }, []);

  const loadAnalytics = useCallback(async () => {
    const { data: progress } = await supabase.from("lesson_progress").select("*");
    const { data: downloads } = await supabase.from("download_logs").select("*");
    const { data: qz } = await supabase.from("quizzes").select("*").order("sort_order", { ascending: true });
    const { data: qr } = await supabase.from("quiz_results").select("*");
    if (progress) setProgressData(progress);
    if (downloads) setDownloadLogs(downloads);
    if (qz) setQuizzes(qz);
    if (qr) setQuizResults(qr);
  }, []);

  useEffect(() => {
    loadCourses();
    loadChapters();
    loadLessons();
    loadCustomers();
    loadAnalytics();
  }, [loadCourses, loadChapters, loadLessons, loadCustomers, loadAnalytics]);

  // ─── KPI Calculations ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.status === "active").length;
    const totalCourses = courses.length;
    const totalLessons = lessons.length;
    const completedEntries = progressData.filter((p) => p.completed).length;
    const totalEntries = progressData.length;
    const completionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;
    const totalWatchMinutes = Math.round(progressData.reduce((s, p) => s + (p.watched_seconds || 0), 0) / 60);
    const avgWatchMinutes = customers.length > 0 ? Math.round(totalWatchMinutes / customers.length) : 0;
    const totalQuizAttempts = quizResults.length;
    const passedQuizzes = quizResults.filter((r) => r.passed).length;
    const quizPassRate = totalQuizAttempts > 0 ? Math.round((passedQuizzes / totalQuizAttempts) * 100) : 0;
    return { activeCustomers, totalCourses, totalLessons, completionRate, avgWatchMinutes, quizPassRate, totalWatchMinutes };
  }, [customers, courses, lessons, progressData, quizResults]);

  // Activity feed
  const activityFeed = useMemo(() => {
    const entries: { type: string; text: string; date: string }[] = [];
    progressData.forEach((p) => {
      if (p.completed) {
        const c = customers.find((cu) => cu.id === p.customer_id);
        const l = lessons.find((le) => le.id === p.lesson_id);
        entries.push({
          type: "completion",
          text: `${c?.name || "Unbekannt"} hat "${l?.title || "?"}" abgeschlossen`,
          date: p.updated_at,
        });
      }
    });
    quizResults.forEach((r) => {
      const c = customers.find((cu) => cu.id === r.customer_id);
      const q = quizzes.find((qz) => qz.lesson_id === r.lesson_id);
      entries.push({
        type: r.passed ? "quiz_pass" : "quiz_fail",
        text: `${c?.name || "Unbekannt"} — Quiz ${r.passed ? "bestanden" : "nicht bestanden"}${q ? ` (${q.question.substring(0, 40)}...)` : ""}`,
        date: r.created_at,
      });
    });
    customers.forEach((cu) => {
      if (cu.last_login) {
        entries.push({ type: "login", text: `${cu.name} hat sich eingeloggt`, date: cu.last_login });
      }
    });
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);
  }, [progressData, quizResults, customers, lessons, quizzes]);

  // Weekly activity data (last 8 weeks)
  const weeklyActivity = useMemo(() => {
    const weeks: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = progressData.filter((p) => {
        const d = new Date(p.updated_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        label: `KW${Math.ceil((weekStart.getDate() + new Date(weekStart.getFullYear(), weekStart.getMonth(), 1).getDay()) / 7)}`,
        count,
      });
    }
    return weeks;
  }, [progressData]);

  const maxWeeklyCount = Math.max(...weeklyActivity.map((w) => w.count), 1);

  // Top customers leaderboard
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    progressData.filter((p) => p.completed).forEach((p) => {
      map[p.customer_id] = (map[p.customer_id] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const c = customers.find((cu) => cu.id === id);
        return { name: c?.name || "Unbekannt", company: c?.company || "", count };
      });
  }, [progressData, customers]);

  // Courses with lowest completion
  const lowCompletionCourses = useMemo(() => {
    return courses
      .map((course) => {
        const cls = lessons.filter((l) => l.course_id === course.id);
        if (cls.length === 0) return { title: course.title, rate: 0, lessonCount: 0 };
        const totalPossible = cls.length * customers.length;
        if (totalPossible === 0) return { title: course.title, rate: 0, lessonCount: cls.length };
        const completed = cls.reduce((s, l) => s + progressData.filter((p) => p.lesson_id === l.id && p.completed).length, 0);
        return { title: course.title, rate: Math.round((completed / totalPossible) * 100), lessonCount: cls.length };
      })
      .filter((c) => c.lessonCount > 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);
  }, [courses, lessons, progressData, customers]);

  // ─── Course CRUD ───────────────────────────────────────────────────────────
  const openCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        title: course.title, description: course.description || "",
        thumbnail_url: course.thumbnail_url || "", category: course.category || "Allgemein",
        is_published: course.is_published, is_sequential: course.is_sequential || false,
        drip_enabled: course.drip_enabled || false, drip_interval_days: course.drip_interval_days || 7,
      });
    } else {
      setEditingCourse(null);
      setCourseForm({
        title: "", description: "", thumbnail_url: "", category: "Allgemein",
        is_published: true, is_sequential: false, drip_enabled: false, drip_interval_days: 7,
      });
    }
    setCourseDialog(true);
  };

  const saveCourse = async () => {
    if (!courseForm.title) { toast.error("Titel ist erforderlich"); return; }
    const payload = { ...courseForm };
    if (editingCourse) {
      const { error } = await supabase.from("courses").update(payload).eq("id", editingCourse.id);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kurs aktualisiert");
    } else {
      const { error } = await supabase.from("courses").insert(payload);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kurs erstellt");
    }
    setCourseDialog(false);
    loadCourses();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Kurs wirklich loschen? Alle Kapitel und Lektionen werden ebenfalls geloscht.")) return;
    await supabase.from("lessons").delete().eq("course_id", id);
    await supabase.from("chapters").delete().eq("course_id", id);
    await supabase.from("courses").delete().eq("id", id);
    toast.success("Kurs geloscht");
    loadCourses();
    loadChapters();
    loadLessons();
  };

  const toggleCoursePublished = async (course: Course) => {
    await supabase.from("courses").update({ is_published: !course.is_published }).eq("id", course.id);
    toast.success(course.is_published ? "Kurs als Entwurf markiert" : "Kurs veroffentlicht");
    loadCourses();
  };

  // ─── Chapter CRUD ──────────────────────────────────────────────────────────
  const courseChapters = useMemo(() => chapters.filter((c) => c.course_id === selectedCourseId), [chapters, selectedCourseId]);

  const openChapterDialog = (chapter?: Chapter) => {
    if (chapter) {
      setEditingChapter(chapter);
      setChapterForm({ title: chapter.title, sort_order: chapter.sort_order });
    } else {
      setEditingChapter(null);
      setChapterForm({ title: "", sort_order: courseChapters.length + 1 });
    }
    setChapterDialog(true);
  };

  const saveChapter = async () => {
    if (!chapterForm.title) { toast.error("Titel ist erforderlich"); return; }
    const payload = { ...chapterForm, course_id: selectedCourseId };
    if (editingChapter) {
      const { error } = await supabase.from("chapters").update(payload).eq("id", editingChapter.id);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kapitel aktualisiert");
    } else {
      const { error } = await supabase.from("chapters").insert(payload);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Kapitel erstellt");
    }
    setChapterDialog(false);
    loadChapters();
  };

  const deleteChapter = async (id: string) => {
    if (!confirm("Kapitel loschen?")) return;
    await supabase.from("lessons").update({ chapter_id: null }).eq("chapter_id", id);
    await supabase.from("chapters").delete().eq("id", id);
    toast.success("Kapitel geloscht");
    loadChapters();
    loadLessons();
  };

  const moveChapter = async (chapterId: string, direction: "up" | "down") => {
    const idx = courseChapters.findIndex((c) => c.id === chapterId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= courseChapters.length) return;
    const a = courseChapters[idx];
    const b = courseChapters[swapIdx];
    await supabase.from("chapters").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("chapters").update({ sort_order: a.sort_order }).eq("id", b.id);
    loadChapters();
  };

  // ─── Lesson CRUD ───────────────────────────────────────────────────────────
  const openLessonDialog = (lesson?: Lesson, chapterId?: string) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        title: lesson.title, description: lesson.description || "", vimeo_id: lesson.vimeo_id || "",
        duration_minutes: lesson.duration_minutes || 0, download_url: lesson.download_url || "",
        download_name: lesson.download_name || "", is_published: lesson.is_published,
        sort_order: lesson.sort_order || 0, has_quiz: lesson.has_quiz || false,
        is_mandatory: lesson.is_mandatory || false, chapter_id: lesson.chapter_id || "",
      });
    } else {
      const chLessons = chapterId ? lessons.filter((l) => l.chapter_id === chapterId) : lessons.filter((l) => l.course_id === selectedCourseId);
      setEditingLesson(null);
      setLessonForm({
        title: "", description: "", vimeo_id: "", duration_minutes: 0,
        download_url: "", download_name: "", is_published: true, sort_order: chLessons.length + 1,
        has_quiz: false, is_mandatory: false, chapter_id: chapterId || "",
      });
    }
    setLessonDialog(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title) { toast.error("Titel ist erforderlich"); return; }
    if (!selectedCourseId) { toast.error("Kein Kurs ausgewahlt"); return; }
    const payload = {
      ...lessonForm,
      course_id: selectedCourseId,
      chapter_id: lessonForm.chapter_id || null,
    };
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
    if (!confirm("Lektion loschen?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    toast.success("Lektion geloscht");
    loadLessons();
  };

  const bulkToggleLessons = async (lessonIds: string[], is_published: boolean) => {
    for (const id of lessonIds) {
      await supabase.from("lessons").update({ published }).eq("id", id);
    }
    toast.success(`${lessonIds.length} Lektionen ${published ? "veroffentlicht" : "als Entwurf markiert"}`);
    loadLessons();
  };

  // ─── Customer CRUD ─────────────────────────────────────────────────────────
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
    const payload = { ...customerForm, subscription_end: customerForm.subscription_end || null };
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
    if (!confirm("Kunde und alle zugehorigen Daten loschen?")) return;
    await supabase.from("lesson_progress").delete().eq("customer_id", id);
    await supabase.from("download_logs").delete().eq("customer_id", id);
    await supabase.from("quiz_results").delete().eq("customer_id", id);
    await supabase.from("academy_customers").delete().eq("id", id);
    toast.success("Kunde geloscht");
    setCustomerDetail(null);
    loadCustomers();
    loadAnalytics();
  };

  const setCustomerStatus = async (id: string, status: "active" | "expired" | "suspended") => {
    await supabase.from("academy_customers").update({ status }).eq("id", id);
    toast.success("Status aktualisiert");
    loadCustomers();
    if (customerDetail?.id === id) {
      setCustomerDetail({ ...customerDetail, status });
    }
  };

  const resetCustomerProgress = async (id: string) => {
    if (!confirm("Fortschritt komplett zurucksetzen?")) return;
    await supabase.from("lesson_progress").delete().eq("customer_id", id);
    await supabase.from("quiz_results").delete().eq("customer_id", id);
    toast.success("Fortschritt zuruckgesetzt");
    loadAnalytics();
  };

  const extendSubscription = async (id: string, days: number) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    const current = customer.subscription_end ? new Date(customer.subscription_end) : new Date();
    current.setDate(current.getDate() + days);
    await supabase.from("academy_customers").update({ subscription_end: current.toISOString().split("T")[0] }).eq("id", id);
    toast.success(`Abo um ${days} Tage verlangert`);
    loadCustomers();
  };

  // Customer detail data
  const customerProgressData = useMemo(() => {
    if (!customerDetail) return { courseProgress: [] as { course: Course; progress: number; completed: number; total: number }[], completedLessons: [] as (Lesson & { completedAt: string })[], quizResultsList: [] as (QuizResult & { question: string })[], downloads: [] as DownloadLog[], watchMinutes: 0 };
    const cp = courses.map((course) => {
      const cls = lessons.filter((l) => l.course_id === course.id);
      const completed = cls.filter((l) => progressData.some((p) => p.customer_id === customerDetail.id && p.lesson_id === l.id && p.completed)).length;
      return { course, progress: cls.length > 0 ? Math.round((completed / cls.length) * 100) : 0, completed, total: cls.length };
    }).filter((c) => c.total > 0);
    const cl = progressData.filter((p) => p.customer_id === customerDetail.id && p.completed).map((p) => {
      const lesson = lessons.find((l) => l.id === p.lesson_id);
      return lesson ? { ...lesson, completedAt: p.updated_at } : null;
    }).filter(Boolean) as (Lesson & { completedAt: string })[];
    const qr = quizResults.filter((r) => r.customer_id === customerDetail.id).map((r) => {
      const quiz = quizzes.find((q) => q.lesson_id === r.lesson_id);
      return { ...r, question: quiz?.question || "Unbekannt" };
    });
    const dl = downloadLogs.filter((d) => d.customer_id === customerDetail.id);
    const wm = Math.round(progressData.filter((p) => p.customer_id === customerDetail.id).reduce((s, p) => s + (p.watched_seconds || 0), 0) / 60);
    return { courseProgress: cp, completedLessons: cl, quizResultsList: qr, downloads: dl, watchMinutes: wm };
  }, [customerDetail, courses, lessons, progressData, quizResults, downloadLogs, quizzes, customers]);

  // ─── Quiz CRUD ─────────────────────────────────────────────────────────────
  const openQuizDialog = (lessonId: string, quiz?: Quiz) => {
    setQuizLessonId(lessonId);
    if (quiz) {
      setEditingQuiz(quiz);
      setQuizForm({
        question: quiz.question, option_a: quiz.option_a, option_b: quiz.option_b,
        option_c: quiz.option_c, option_d: quiz.option_d,
        correct_index: quiz.correct_index, sort_order: quiz.sort_order,
      });
    } else {
      setEditingQuiz(null);
      const existing = quizzes.filter((q) => q.lesson_id === lessonId);
      setQuizForm({
        question: "", option_a: "", option_b: "", option_c: "", option_d: "",
        correct_index: 0, sort_order: existing.length + 1,
      });
    }
    setQuizDialog(true);
  };

  const saveQuiz = async () => {
    if (!quizForm.question || !quizForm.option_a || !quizForm.option_b) {
      toast.error("Frage und mindestens 2 Optionen sind erforderlich"); return;
    }
    const payload = { ...quizForm, lesson_id: quizLessonId };
    if (editingQuiz) {
      const { error } = await supabase.from("quizzes").update(payload).eq("id", editingQuiz.id);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Quiz-Frage aktualisiert");
    } else {
      const { error } = await supabase.from("quizzes").insert(payload);
      if (error) { toast.error("Fehler: " + error.message); return; }
      toast.success("Quiz-Frage erstellt");
    }
    setQuizDialog(false);
    loadAnalytics();
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("Quiz-Frage loschen?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    toast.success("Quiz-Frage geloscht");
    loadAnalytics();
  };

  // ─── Analytics Data ────────────────────────────────────────────────────────
  const analyticsData = useMemo(() => {
    // Completion rate per course
    const courseCompletionRates = courses.map((course) => {
      const cls = lessons.filter((l) => l.course_id === course.id);
      if (cls.length === 0) return { title: course.title, rate: 0 };
      const totalPossible = cls.length * Math.max(customers.length, 1);
      const completed = cls.reduce((s, l) => s + progressData.filter((p) => p.lesson_id === l.id && p.completed).length, 0);
      return { title: course.title, rate: Math.round((completed / totalPossible) * 100) };
    }).filter((c) => c.rate >= 0);

    // Most watched
    const lessonWatchCounts: Record<string, number> = {};
    progressData.forEach((p) => { lessonWatchCounts[p.lesson_id] = (lessonWatchCounts[p.lesson_id] || 0) + 1; });
    const topVideos = Object.entries(lessonWatchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ title: lessons.find((l) => l.id === id)?.title || "Unbekannt", count }));

    // Avg quiz scores per lesson
    const lessonQuizScores: Record<string, { correct: number; total: number }> = {};
    quizResults.forEach((r) => {
      if (!lessonQuizScores[r.lesson_id]) lessonQuizScores[r.lesson_id] = { correct: 0, total: 0 };
      lessonQuizScores[r.lesson_id].total++;
      if (r.passed) lessonQuizScores[r.lesson_id].correct++;
    });
    const avgQuizScores = Object.entries(lessonQuizScores).map(([id, v]) => ({
      title: lessons.find((l) => l.id === id)?.title || "Unbekannt",
      score: Math.round((v.correct / v.total) * 100),
    })).sort((a, b) => b.score - a.score).slice(0, 8);

    // Download stats
    const downloadCounts: Record<string, number> = {};
    downloadLogs.forEach((d) => { downloadCounts[d.lesson_id] = (downloadCounts[d.lesson_id] || 0) + 1; });
    const topDownloads = Object.entries(downloadCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => {
        const l = lessons.find((le) => le.id === id);
        return { title: l?.download_name || l?.title || "Unbekannt", count };
      });

    // Active vs churned
    const active = customers.filter((c) => c.status === "active").length;
    const churned = customers.filter((c) => c.status !== "active").length;

    return { courseCompletionRates, topVideos, avgQuizScores, topDownloads, active, churned };
  }, [courses, lessons, progressData, quizResults, downloadLogs, customers]);

  // Lessons tab — filtered
  const filteredAllLessons = useMemo(() => {
    let filtered = [...lessons];
    if (lessonCourseFilter !== "all") {
      filtered = filtered.filter((l) => l.course_id === lessonCourseFilter);
    }
    if (lessonFilter) {
      const q = lessonFilter.toLowerCase();
      filtered = filtered.filter((l) => l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q));
    }
    return filtered;
  }, [lessons, lessonCourseFilter, lessonFilter]);

  // ─── Status badge helper ───────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10">Aktiv</Badge>;
      case "expired": return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/10">Abgelaufen</Badge>;
      case "suspended": return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10">Gesperrt</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const categoryColors: Record<string, string> = {
    "Meta Ads": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Sales": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "LinkedIn": "bg-sky-500/10 text-sky-400 border-sky-500/20",
    "Mindset": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Allgemein": "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Academy</h1>
          <p className="text-sm text-muted-foreground">Kurse, Lektionen, Kunden & Quizzes verwalten</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCourseDetailMode(false); setCustomerDetail(null); }}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="h-4 w-4" />Ubersicht</TabsTrigger>
          <TabsTrigger value="courses" className="gap-1.5"><BookOpen className="h-4 w-4" />Kurse</TabsTrigger>
          <TabsTrigger value="lessons" className="gap-1.5"><Video className="h-4 w-4" />Lektionen</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5"><Users className="h-4 w-4" />Kunden</TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-1.5"><FileQuestion className="h-4 w-4" />Quizzes</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-4 w-4" />Analytics</TabsTrigger>
        </TabsList>

        {/* ══════════════════ DASHBOARD TAB ══════════════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { icon: Users, label: "Aktive Kunden", value: kpis.activeCustomers, color: "bg-blue-500/10", iconColor: "text-blue-500" },
              { icon: BookOpen, label: "Kurse", value: kpis.totalCourses, color: "bg-violet-500/10", iconColor: "text-violet-500" },
              { icon: Video, label: "Lektionen", value: kpis.totalLessons, color: "bg-indigo-500/10", iconColor: "text-indigo-500" },
              { icon: Target, label: "Abschlussrate", value: `${kpis.completionRate}%`, color: "bg-emerald-500/10", iconColor: "text-emerald-500" },
              { icon: Timer, label: "Ø Watch-Time", value: `${kpis.avgWatchMinutes}m`, color: "bg-amber-500/10", iconColor: "text-amber-500" },
              { icon: Brain, label: "Quiz-Bestehensrate", value: `${kpis.quizPassRate}%`, color: "bg-pink-500/10", iconColor: "text-pink-500" },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${kpi.color} flex items-center justify-center shrink-0`}>
                      <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold truncate">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Activity Feed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" />Letzte Aktivitaten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {activityFeed.length > 0 ? (
                    <div className="space-y-2">
                      {activityFeed.map((entry, i) => (
                        <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0 border-border/50">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            entry.type === "completion" ? "bg-emerald-500/10" :
                            entry.type === "quiz_pass" ? "bg-blue-500/10" :
                            entry.type === "quiz_fail" ? "bg-red-500/10" : "bg-slate-500/10"
                          }`}>
                            {entry.type === "completion" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> :
                             entry.type === "quiz_pass" ? <Award className="h-3 w-3 text-blue-500" /> :
                             entry.type === "quiz_fail" ? <XCircle className="h-3 w-3 text-red-500" /> :
                             <Eye className="h-3 w-3 text-slate-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{entry.text}</p>
                            <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Noch keine Aktivitaten</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Weekly Activity Chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />Kunden-Aktivitat pro Woche
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-[260px] pt-4">
                  {weeklyActivity.map((week, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{week.count}</span>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-violet-600 to-indigo-500 transition-all duration-500 min-h-[4px]"
                        style={{ height: `${Math.max((week.count / maxWeeklyCount) * 200, 4)}px` }}
                      />
                      <span className="text-xs text-muted-foreground">{week.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers Leaderboard */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4" />Top-Kunden Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topCustomers.length > 0 ? (
                  <div className="space-y-3">
                    {topCustomers.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? "bg-amber-500/10 text-amber-500" : i === 1 ? "bg-slate-300/10 text-slate-400" : i === 2 ? "bg-orange-500/10 text-orange-500" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                        </div>
                        <Badge variant="secondary" className="shrink-0">{c.count} abgeschlossen</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Daten</p>
                )}
              </CardContent>
            </Card>

            {/* Low Completion Courses */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-500" />Kurse mit niedrigster Completion-Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowCompletionCourses.length > 0 ? (
                  <div className="space-y-3">
                    {lowCompletionCourses.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.lessonCount} Lektionen</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${c.rate < 20 ? "bg-red-500" : c.rate < 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${c.rate}%` }} />
                          </div>
                          <span className="text-sm font-medium w-10 text-right">{c.rate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Daten</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════ COURSES TAB ══════════════════ */}
        <TabsContent value="courses" className="space-y-4">
          {!courseDetailMode ? (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Kurse ({courses.length})</h2>
                <Button onClick={() => openCourseDialog()} size="sm"><Plus className="h-4 w-4 mr-1" />Neuer Kurs</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => {
                  const courseLessonCount = lessons.filter((l) => l.course_id === course.id).length;
                  const courseChapterCount = chapters.filter((c) => c.course_id === course.id).length;
                  return (
                    <Card key={course.id} className="overflow-hidden group hover:shadow-lg transition-all duration-200">
                      <div className="h-36 relative overflow-hidden">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${
                            course.category === "Meta Ads" ? "from-blue-600/30 to-blue-800/30" :
                            course.category === "Sales" ? "from-emerald-600/30 to-emerald-800/30" :
                            course.category === "LinkedIn" ? "from-sky-600/30 to-sky-800/30" :
                            course.category === "Mindset" ? "from-purple-600/30 to-purple-800/30" :
                            "from-violet-600/30 to-indigo-800/30"
                          } flex items-center justify-center`}>
                            <BookOpen className="h-10 w-10 opacity-30" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Badge variant={course.is_published ? "default" : "secondary"} className={course.is_published ? "bg-emerald-500 hover:bg-emerald-600 text-xs" : "text-xs"}>
                            {course.is_published ? "Live" : "Entwurf"}
                          </Badge>
                        </div>
                        {course.category && (
                          <Badge className={`absolute top-2 left-2 text-xs ${categoryColors[course.category] || categoryColors["Allgemein"]}`}>
                            {course.category}
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-semibold text-sm leading-tight">{course.title}</h3>
                        {course.description && <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{courseChapterCount} Kapitel</span>
                          <span className="flex items-center gap-1"><Video className="h-3 w-3" />{courseLessonCount} Lektionen</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {course.is_sequential && <Badge variant="outline" className="text-xs">Sequenziell</Badge>}
                          {course.drip_enabled && <Badge variant="outline" className="text-xs">Drip ({course.drip_interval_days}d)</Badge>}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedCourseId(course.id); setCourseDetailMode(true); }}>
                            <Eye className="h-3.5 w-3.5 mr-1" />Verwalten
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openCourseDialog(course)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="outline" size="sm" onClick={() => toggleCoursePublished(course)}>
                            {course.is_published ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteCourse(course.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {courses.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>Noch keine Kurse vorhanden</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            /* ── Course Detail: Chapters & Lessons ── */
            <>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setCourseDetailMode(false)}>
                  <ChevronRight className="h-4 w-4 rotate-180 mr-1" />Zuruck
                </Button>
                <h2 className="text-lg font-semibold">{courses.find((c) => c.id === selectedCourseId)?.title || "Kurs"}</h2>
              </div>

              {/* Chapters */}
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kapitel & Lektionen</h3>
                <div className="flex gap-2">
                  <Button onClick={() => openChapterDialog()} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Kapitel</Button>
                  <Button onClick={() => openLessonDialog(undefined, undefined)} size="sm"><Plus className="h-4 w-4 mr-1" />Lektion</Button>
                </div>
              </div>

              <div className="space-y-4">
                {courseChapters.map((chapter, chIdx) => {
                  const chapterLessons = lessons.filter((l) => l.chapter_id === chapter.id).sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <Card key={chapter.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => moveChapter(chapter.id, "up")} disabled={chIdx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-20">
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button onClick={() => moveChapter(chapter.id, "down")} disabled={chIdx === courseChapters.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-20">
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                            <div>
                              <CardTitle className="text-sm">{chIdx + 1}. {chapter.title}</CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5">{chapterLessons.length} Lektionen</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openLessonDialog(undefined, chapter.id)}><Plus className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => openChapterDialog(chapter)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteChapter(chapter.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {chapterLessons.length > 0 ? (
                          <div className="space-y-1">
                            {chapterLessons.map((lesson) => (
                              <div key={lesson.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group">
                                <span className="text-xs text-muted-foreground font-mono w-6">{lesson.sort_order}</span>
                                <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm flex-1 truncate">{lesson.title}</span>
                                <div className="flex items-center gap-1.5">
                                  {lesson.has_quiz && <Badge variant="outline" className="text-xs px-1.5">Quiz</Badge>}
                                  {lesson.is_mandatory && <Badge variant="outline" className="text-xs px-1.5">Pflicht</Badge>}
                                  {lesson.download_url && <Download className="h-3 w-3 text-muted-foreground" />}
                                  {lesson.duration_minutes > 0 && <span className="text-xs text-muted-foreground">{lesson.duration_minutes}m</span>}
                                  <Badge variant={lesson.is_published ? "default" : "secondary"} className={`text-xs ${lesson.is_published ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}>
                                    {lesson.is_published ? "Live" : "Entwurf"}
                                  </Badge>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => openLessonDialog(lesson)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteLesson(lesson.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-3">Noch keine Lektionen in diesem Kapitel</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Lessons without chapter */}
                {(() => {
                  const unassigned = lessons.filter((l) => l.course_id === selectedCourseId && !l.chapter_id);
                  if (unassigned.length === 0 && courseChapters.length > 0) return null;
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Ohne Kapitel</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {unassigned.length > 0 ? (
                          <div className="space-y-1">
                            {unassigned.map((lesson) => (
                              <div key={lesson.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group">
                                <span className="text-xs text-muted-foreground font-mono w-6">{lesson.sort_order}</span>
                                <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm flex-1 truncate">{lesson.title}</span>
                                <div className="flex items-center gap-1.5">
                                  {lesson.has_quiz && <Badge variant="outline" className="text-xs px-1.5">Quiz</Badge>}
                                  {lesson.download_url && <Download className="h-3 w-3 text-muted-foreground" />}
                                  <Badge variant={lesson.is_published ? "default" : "secondary"} className={`text-xs ${lesson.is_published ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}>
                                    {lesson.is_published ? "Live" : "Entwurf"}
                                  </Badge>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => openLessonDialog(lesson)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteLesson(lesson.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-3">Keine Lektionen ohne Kapitel</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </>
          )}
        </TabsContent>

        {/* ══════════════════ LESSONS TAB ══════════════════ */}
        <TabsContent value="lessons" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-semibold">Alle Lektionen ({filteredAllLessons.length})</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={lessonFilter}
                  onChange={(e) => setLessonFilter(e.target.value)}
                  className="pl-8 w-[180px] h-8 text-sm"
                />
              </div>
              <Select value={lessonCourseFilter} onValueChange={setLessonCourseFilter}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Alle Kurse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kurse</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const unpublished = filteredAllLessons.filter((l) => !l.is_published).map((l) => l.id);
                  if (unpublished.length > 0) bulkToggleLessons(unpublished, true);
                  else toast.info("Alle Lektionen sind bereits veroffentlicht");
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Alle veroffentlichen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const published = filteredAllLessons.filter((l) => l.is_published).map((l) => l.id);
                  if (published.length > 0) bulkToggleLessons(published, false);
                  else toast.info("Alle Lektionen sind bereits Entwurfe");
                }}
              >
                <Ban className="h-3.5 w-3.5 mr-1" />Alle als Entwurf
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Kurs</TableHead>
                <TableHead>Kapitel</TableHead>
                <TableHead>Vimeo ID</TableHead>
                <TableHead>Dauer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAllLessons.map((lesson) => {
                const course = courses.find((c) => c.id === lesson.course_id);
                const chapter = chapters.find((c) => c.id === lesson.chapter_id);
                return (
                  <TableRow key={lesson.id}>
                    <TableCell className="text-muted-foreground text-xs">{lesson.sort_order}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{lesson.title}</span>
                        <div className="flex gap-1 mt-0.5">
                          {lesson.has_quiz && <Badge variant="outline" className="text-xs px-1">Quiz</Badge>}
                          {lesson.is_mandatory && <Badge variant="outline" className="text-xs px-1">Pflicht</Badge>}
                          {lesson.download_url && <Badge variant="outline" className="text-xs px-1"><Download className="h-2.5 w-2.5 mr-0.5" />{lesson.download_name || "PDF"}</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{course?.title || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{chapter?.title || "-"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{lesson.vimeo_id || "-"}</TableCell>
                    <TableCell className="text-sm">{lesson.duration_minutes ? `${lesson.duration_minutes}m` : "-"}</TableCell>
                    <TableCell>
                      <button onClick={async () => {
                        await supabase.from("lessons").update({ is_published: !lesson.is_published }).eq("id", lesson.id);
                        loadLessons();
                      }}>
                        <Badge variant={lesson.is_published ? "default" : "secondary"} className={`cursor-pointer text-xs ${lesson.is_published ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}>
                          {lesson.is_published ? "Live" : "Entwurf"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedCourseId(lesson.course_id); openLessonDialog(lesson); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteLesson(lesson.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredAllLessons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Keine Lektionen gefunden</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* ══════════════════ CUSTOMERS TAB ══════════════════ */}
        <TabsContent value="customers" className="space-y-4">
          {!customerDetail ? (
            <>
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
                    <TableHead>Letzter Login</TableHead>
                    <TableHead>Watch-Min</TableHead>
                    <TableHead>Streak</TableHead>
                    <TableHead className="w-28">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => {
                    const watchMin = Math.round(progressData.filter((p) => p.customer_id === customer.id).reduce((s, p) => s + (p.watched_seconds || 0), 0) / 60);
                    return (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setCustomerDetail(customer)}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{customer.email}</TableCell>
                        <TableCell className="text-sm">{customer.company || "-"}</TableCell>
                        <TableCell>{statusBadge(customer.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {customer.subscription_end ? new Date(customer.subscription_end).toLocaleDateString("de-DE") : "Unbegrenzt"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {customer.last_login ? new Date(customer.last_login).toLocaleDateString("de-DE") : "Nie"}
                        </TableCell>
                        <TableCell className="text-sm">{watchMin}m</TableCell>
                        <TableCell>
                          {customer.streak > 0 ? (
                            <span className="flex items-center gap-1 text-sm"><Flame className="h-3.5 w-3.5 text-orange-500" />{customer.streak}</span>
                          ) : <span className="text-sm text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openCustomerDialog(customer)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCustomer(customer.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {customers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Keine Kunden vorhanden</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          ) : (
            /* ── Customer Detail View ── */
            <>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setCustomerDetail(null)}>
                  <ChevronRight className="h-4 w-4 rotate-180 mr-1" />Zuruck
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">{customerDetail.name}</h2>
                  <p className="text-sm text-muted-foreground">{customerDetail.email} {customerDetail.company ? `- ${customerDetail.company}` : ""}</p>
                </div>
                <div className="ml-auto">{statusBadge(customerDetail.status)}</div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {customerDetail.status !== "active" && (
                  <Button size="sm" variant="outline" onClick={() => setCustomerStatus(customerDetail.id, "active")}>
                    <Shield className="h-3.5 w-3.5 mr-1" />Aktivieren
                  </Button>
                )}
                {customerDetail.status !== "suspended" && (
                  <Button size="sm" variant="outline" onClick={() => setCustomerStatus(customerDetail.id, "suspended")}>
                    <Ban className="h-3.5 w-3.5 mr-1" />Sperren
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => resetCustomerProgress(customerDetail.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Fortschritt zurucksetzen
                </Button>
                <Button size="sm" variant="outline" onClick={() => extendSubscription(customerDetail.id, 30)}>
                  <CalendarPlus className="h-3.5 w-3.5 mr-1" />+30 Tage
                </Button>
                <Button size="sm" variant="outline" onClick={() => extendSubscription(customerDetail.id, 90)}>
                  <CalendarPlus className="h-3.5 w-3.5 mr-1" />+90 Tage
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteCustomer(customerDetail.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Loschen
                </Button>
              </div>

              {/* Stats */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{customerProgressData.watchMinutes}m</p>
                    <p className="text-xs text-muted-foreground">Watch-Time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{customerProgressData.completedLessons.length}</p>
                    <p className="text-xs text-muted-foreground">Lektionen abgeschlossen</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{customerProgressData.quizResultsList.filter((r) => r.passed).length}/{customerProgressData.quizResultsList.length}</p>
                    <p className="text-xs text-muted-foreground">Quiz bestanden</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{customerProgressData.downloads.length}</p>
                    <p className="text-xs text-muted-foreground">Downloads</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Course Progress */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Kurs-Fortschritt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {customerProgressData.courseProgress.map((cp) => (
                        <div key={cp.course.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{cp.course.title}</span>
                            <span className="text-sm text-muted-foreground">{cp.completed}/{cp.total}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all" style={{ width: `${cp.progress}%` }} />
                          </div>
                        </div>
                      ))}
                      {customerProgressData.courseProgress.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Noch kein Fortschritt</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Completed Lessons */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Abgeschlossene Lektionen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {customerProgressData.completedLessons.length > 0 ? (
                        <div className="space-y-1.5">
                          {customerProgressData.completedLessons.map((l) => (
                            <div key={l.id} className="flex items-center gap-2 py-1 text-sm">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{l.title}</span>
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">{new Date(l.completedAt).toLocaleDateString("de-DE")}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Keine abgeschlossenen Lektionen</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Quiz Results */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quiz-Ergebnisse</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {customerProgressData.quizResultsList.length > 0 ? (
                        <div className="space-y-1.5">
                          {customerProgressData.quizResultsList.map((r) => (
                            <div key={r.id} className="flex items-center gap-2 py-1 text-sm">
                              {r.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              <span className="truncate">{r.question}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Keine Quiz-Ergebnisse</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Download History */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Download-Verlauf</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {customerProgressData.downloads.length > 0 ? (
                        <div className="space-y-1.5">
                          {customerProgressData.downloads.map((d) => {
                            const lesson = lessons.find((l) => l.id === d.lesson_id);
                            return (
                              <div key={d.id} className="flex items-center gap-2 py-1 text-sm">
                                <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{lesson?.download_name || lesson?.title || "?"}</span>
                                <span className="text-xs text-muted-foreground ml-auto shrink-0">{new Date(d.downloaded_at).toLocaleDateString("de-DE")}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Keine Downloads</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ══════════════════ QUIZZES TAB ══════════════════ */}
        <TabsContent value="quizzes" className="space-y-4">
          <h2 className="text-lg font-semibold">Quizzes verwalten</h2>
          <p className="text-sm text-muted-foreground">Quiz-Fragen pro Lektion erstellen und verwalten. Nur Lektionen mit aktiviertem Quiz werden angezeigt.</p>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left: Lessons with quizzes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lektionen mit Quiz</h3>
              {lessons.filter((l) => l.has_quiz).length > 0 ? (
                lessons.filter((l) => l.has_quiz).map((lesson) => {
                  const course = courses.find((c) => c.id === lesson.course_id);
                  const lessonQuizzes = quizzes.filter((q) => q.lesson_id === lesson.id);
                  const lessonResults = quizResults.filter((r) => r.lesson_id === lesson.id);
                  const isSelected = quizPreviewLessonId === lesson.id;
                  return (
                    <Card key={lesson.id} className={isSelected ? "ring-1 ring-primary" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground">{course?.title || ""} - {lessonQuizzes.length} Fragen - {lessonResults.length} Versuche</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => setQuizPreviewLessonId(isSelected ? "" : lesson.id)}>
                              <Eye className="h-3.5 w-3.5 mr-1" />{isSelected ? "Schliessen" : "Vorschau"}
                            </Button>
                            <Button size="sm" onClick={() => openQuizDialog(lesson.id)}>
                              <Plus className="h-3.5 w-3.5 mr-1" />Frage
                            </Button>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 space-y-3 border-t pt-3">
                            {lessonQuizzes.map((quiz, qi) => (
                              <div key={quiz.id} className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-start justify-between mb-2">
                                  <p className="text-sm font-medium">Frage {qi + 1}: {quiz.question}</p>
                                  <div className="flex gap-1 shrink-0 ml-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openQuizDialog(lesson.id, quiz)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteQuiz(quiz.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {[quiz.option_a, quiz.option_b, quiz.option_c, quiz.option_d].map((opt, oi) => opt && (
                                    <div key={oi} className={`text-xs px-2 py-1 rounded ${oi === quiz.correct_index ? "bg-emerald-500/10 text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                                      {String.fromCharCode(65 + oi)}) {opt}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {lessonQuizzes.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-3">Noch keine Fragen. Klicke auf "+ Frage" um zu starten.</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <FileQuestion className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>Keine Lektionen mit Quiz gefunden</p>
                    <p className="text-xs mt-1">Aktiviere "Quiz" in den Lektionseinstellungen</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Quiz results per customer */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ergebnisse nach Kunden</h3>
              {customers.map((customer) => {
                const customerResults = quizResults.filter((r) => r.customer_id === customer.id);
                if (customerResults.length === 0) return null;
                const passed = customerResults.filter((r) => r.passed).length;
                return (
                  <Card key={customer.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{passed}/{customerResults.length}</p>
                          <p className="text-xs text-muted-foreground">{Math.round((passed / customerResults.length) * 100)}% richtig</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }).filter(Boolean)}
              {quizResults.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p>Noch keine Quiz-Ergebnisse</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════ ANALYTICS TAB ══════════════════ */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Analytics</h2>
            <Select value={analyticsRange} onValueChange={(v: "week" | "month" | "all") => setAnalyticsRange(v)}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Letzte Woche</SelectItem>
                <SelectItem value="month">Letzter Monat</SelectItem>
                <SelectItem value="all">Gesamt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Completion Rate per Course */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />Abschlussrate pro Kurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.courseCompletionRates.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm truncate">{c.title}</span>
                        <span className="text-sm font-medium">{c.rate}%</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${c.rate}%` }} />
                      </div>
                    </div>
                  ))}
                  {analyticsData.courseCompletionRates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Noch keine Daten</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Most Watched Videos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Video className="h-4 w-4" />Meistgesehene Videos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.topVideos.length > 0 ? (
                  <div className="space-y-2">
                    {analyticsData.topVideos.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                          <span className="text-sm truncate">{item.title}</span>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{item.count} Views</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Daten</p>
                )}
              </CardContent>
            </Card>

            {/* Average Quiz Scores */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4" />Durchschnittliche Quiz-Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.avgQuizScores.length > 0 ? (
                  <div className="space-y-2">
                    {analyticsData.avgQuizScores.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm truncate">{item.title}</span>
                        <Badge className={item.score >= 70 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10" : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10"}>
                          {item.score}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Daten</p>
                )}
              </CardContent>
            </Card>

            {/* Download Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Download className="h-4 w-4" />Download-Statistiken ({downloadLogs.length} gesamt)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.topDownloads.length > 0 ? (
                  <div className="space-y-2">
                    {analyticsData.topDownloads.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <span className="text-sm truncate">{item.title}</span>
                        <Badge variant="secondary">{item.count}x</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine Downloads</p>
                )}
              </CardContent>
            </Card>

            {/* Customer Retention */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />Kunden-Retention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8 py-4">
                  <div className="flex-1 text-center">
                    <div className="relative w-24 h-24 mx-auto">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                          strokeDasharray={`${(analyticsData.active / Math.max(customers.length, 1)) * 251.2} 251.2`}
                          className="text-emerald-500" strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                        {customers.length > 0 ? Math.round((analyticsData.active / customers.length) * 100) : 0}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Aktiv</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm">Aktiv: {analyticsData.active}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">Inaktiv: {analyticsData.churned}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted" />
                      <span className="text-sm">Gesamt: {customers.length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily/Weekly Active Trend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />Aktivitatstrend (letzte 8 Wochen)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-[200px] pt-4">
                  {weeklyActivity.map((week, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">{week.count}</span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500 min-h-[2px]"
                        style={{ height: `${Math.max((week.count / maxWeeklyCount) * 150, 2)}px` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{week.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════ COURSE DIALOG ══════════════════ */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? "Kurs bearbeiten" : "Neuer Kurs"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={courseForm.category} onValueChange={(v) => setCourseForm({ ...courseForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Meta Ads", "Sales", "LinkedIn", "Mindset", "Allgemein"].map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Thumbnail URL</Label>
                <Input value={courseForm.thumbnail_url} onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })} placeholder="https://..." />
                {courseForm.thumbnail_url && courseForm.thumbnail_url.startsWith("http") && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-border h-32 w-full">
                    <img src={courseForm.thumbnail_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={courseForm.is_sequential} onCheckedChange={(v) => setCourseForm({ ...courseForm, is_sequential: v })} />
                <Label>Sequenzieller Modus</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={courseForm.is_published} onCheckedChange={(v) => setCourseForm({ ...courseForm, is_published: v })} />
                <Label>Veroffentlicht</Label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={courseForm.drip_enabled} onCheckedChange={(v) => setCourseForm({ ...courseForm, drip_enabled: v })} />
              <Label>Drip Content</Label>
              {courseForm.drip_enabled && (
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs shrink-0">Intervall (Tage):</Label>
                  <Input
                    type="number"
                    value={courseForm.drip_interval_days}
                    onChange={(e) => setCourseForm({ ...courseForm, drip_interval_days: parseInt(e.target.value) || 7 })}
                    className="w-20 h-8"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialog(false)}>Abbrechen</Button>
            <Button onClick={saveCourse}>{editingCourse ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ CHAPTER DIALOG ══════════════════ */}
      <Dialog open={chapterDialog} onOpenChange={setChapterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChapter ? "Kapitel bearbeiten" : "Neues Kapitel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} /></div>
            <div><Label>Reihenfolge</Label><Input type="number" value={chapterForm.sort_order} onChange={(e) => setChapterForm({ ...chapterForm, sort_order: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialog(false)}>Abbrechen</Button>
            <Button onClick={saveChapter}>{editingChapter ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ LESSON DIALOG ══════════════════ */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Lektion bearbeiten" : "Neue Lektion"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} rows={2} /></div>
            <div>
              <Label>Kapitel</Label>
              <Select value={lessonForm.chapter_id || "none"} onValueChange={(v) => setLessonForm({ ...lessonForm, chapter_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Kein Kapitel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Kapitel</SelectItem>
                  {courseChapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Video URL</Label><Input value={lessonForm.vimeo_id} onChange={(e) => setLessonForm({ ...lessonForm, vimeo_id: e.target.value })} placeholder="https://vimeo.com/123456789 oder https://fast.wistia.com/..." /></div>
              <div><Label>Dauer (min)</Label><Input type="number" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Download URL (Google Drive)</Label><Input value={lessonForm.download_url} onChange={(e) => setLessonForm({ ...lessonForm, download_url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Download Name</Label><Input value={lessonForm.download_name} onChange={(e) => setLessonForm({ ...lessonForm, download_name: e.target.value })} placeholder="Playbook.pdf" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Reihenfolge</Label><Input type="number" value={lessonForm.sort_order} onChange={(e) => setLessonForm({ ...lessonForm, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={lessonForm.is_published} onCheckedChange={(v) => setLessonForm({ ...lessonForm, is_published: v })} />
                <Label>Veroffentlicht</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={lessonForm.has_quiz} onCheckedChange={(v) => setLessonForm({ ...lessonForm, has_quiz: v })} />
                <Label>Quiz aktivieren</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={lessonForm.is_mandatory} onCheckedChange={(v) => setLessonForm({ ...lessonForm, is_mandatory: v })} />
                <Label>Pflicht-Lektion</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog(false)}>Abbrechen</Button>
            <Button onClick={saveLesson}>{editingLesson ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ CUSTOMER DIALOG ══════════════════ */}
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
                <Select value={customerForm.status} onValueChange={(v: "active" | "expired" | "suspended") => setCustomerForm({ ...customerForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="expired">Abgelaufen</SelectItem>
                    <SelectItem value="suspended">Gesperrt</SelectItem>
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

      {/* ══════════════════ QUIZ DIALOG ══════════════════ */}
      <Dialog open={quizDialog} onOpenChange={setQuizDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? "Quiz-Frage bearbeiten" : "Neue Quiz-Frage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Frage</Label><Textarea value={quizForm.question} onChange={(e) => setQuizForm({ ...quizForm, question: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>A)</Label><Input value={quizForm.option_a} onChange={(e) => setQuizForm({ ...quizForm, option_a: e.target.value })} /></div>
              <div><Label>B)</Label><Input value={quizForm.option_b} onChange={(e) => setQuizForm({ ...quizForm, option_b: e.target.value })} /></div>
              <div><Label>C)</Label><Input value={quizForm.option_c} onChange={(e) => setQuizForm({ ...quizForm, option_c: e.target.value })} /></div>
              <div><Label>D)</Label><Input value={quizForm.option_d} onChange={(e) => setQuizForm({ ...quizForm, option_d: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Richtige Antwort</Label>
                <Select value={String(quizForm.correct_index)} onValueChange={(v) => setQuizForm({ ...quizForm, correct_index: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">A</SelectItem>
                    <SelectItem value="1">B</SelectItem>
                    <SelectItem value="2">C</SelectItem>
                    <SelectItem value="3">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Reihenfolge</Label><Input type="number" value={quizForm.sort_order} onChange={(e) => setQuizForm({ ...quizForm, sort_order: parseInt(e.target.value) || 0 })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuizDialog(false)}>Abbrechen</Button>
            <Button onClick={saveQuiz}>{editingQuiz ? "Speichern" : "Erstellen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

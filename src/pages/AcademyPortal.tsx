import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// Parse video URL into embed URL (supports Vimeo, Wistia, YouTube, Loom)
function getEmbedUrl(input: string): string | null {
  if (!input) return null;
  const s = input.trim();

  // Vimeo: https://vimeo.com/123456789 or https://player.vimeo.com/video/123456789 or just 123456789
  const vimeoMatch = s.match(/vimeo\.com\/(?:video\/)?(\d+)/) || s.match(/^(\d{6,})$/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?badge=0&autopause=0&player_id=0&app_id=58479`;

  // Wistia: https://fast.wistia.com/medias/abc123 or https://company.wistia.com/medias/abc123
  const wistiaMatch = s.match(/wistia\.(?:com|net)\/(?:medias|embed\/iframe)\/([a-zA-Z0-9]+)/);
  if (wistiaMatch) return `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}?seo=true&videoFoam=false`;

  // YouTube: https://www.youtube.com/watch?v=xxx or https://youtu.be/xxx
  const ytMatch = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Loom: https://www.loom.com/share/xxx
  const loomMatch = s.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  // Already an embed URL or iframe src
  if (s.startsWith("https://") && (s.includes("embed") || s.includes("player"))) return s;

  return null;
}
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  GraduationCap, PlayCircle, CheckCircle2, Circle, Download, ArrowLeft,
  LogOut, BookOpen, Clock, Lock, ChevronRight, ChevronDown, Search,
  Star, Award, Eye, Timer, Play, SkipForward, X, Printer,
  StickyNote, TrendingUp, Flame, Bell, MessageSquare, Send,
  FileText, Trophy, Target, Zap, Bookmark, Heart, Sparkles,
  User, Settings, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_published: boolean;
  category?: string;
  is_sequential?: boolean;
};

type Chapter = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
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
  has_quiz?: boolean;
};

type LessonProgress = {
  id: string;
  customer_id: string;
  lesson_id: string;
  completed: boolean;
  watched_seconds: number;
  notes: string | null;
  bookmarked: boolean;
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

type LessonComment = {
  id: string;
  lesson_id: string;
  customer_id: string;
  customer_name: string;
  content: string;
  created_at: string;
};

type Achievement = {
  id: string;
  customer_id: string;
  type: string;
  earned_at: string;
};

type CustomerSession = {
  customer_id: string;
  email: string;
  name: string;
};

// ─── Views ───────────────────────────────────────────────────────────────────
type PortalView = "login" | "dashboard" | "courses" | "course-detail" | "player" | "downloads" | "achievements" | "profile" | "search";

// ─── Achievement Definitions ─────────────────────────────────────────────────
const ACHIEVEMENT_DEFS: { type: string; label: string; description: string; icon: string; color: string }[] = [
  { type: "first_lesson", label: "Erster Schritt", description: "Erste Lektion abgeschlossen", icon: "target", color: "from-blue-500 to-cyan-500" },
  { type: "streak_7", label: "Streak Master", description: "7 Tage Streak", icon: "flame", color: "from-orange-500 to-red-500" },
  { type: "first_course", label: "Bucherwurm", description: "Ersten Kurs abgeschlossen", icon: "book", color: "from-emerald-500 to-teal-500" },
  { type: "all_courses", label: "Champion", description: "Alle Kurse abgeschlossen", icon: "trophy", color: "from-amber-500 to-yellow-500" },
  { type: "perfect_quiz", label: "Quiz-Profi", description: "Perfektes Quiz-Ergebnis", icon: "zap", color: "from-purple-500 to-pink-500" },
  { type: "bookmarks_10", label: "Sammler", description: "10 Lesezeichen gesetzt", icon: "star", color: "from-indigo-500 to-violet-500" },
  { type: "first_comment", label: "Aktiv", description: "Ersten Kommentar geschrieben", icon: "message", color: "from-pink-500 to-rose-500" },
];

function getAchievementIcon(type: string) {
  switch (type) {
    case "target": return <Target className="h-5 w-5" />;
    case "flame": return <Flame className="h-5 w-5" />;
    case "book": return <BookOpen className="h-5 w-5" />;
    case "trophy": return <Trophy className="h-5 w-5" />;
    case "zap": return <Zap className="h-5 w-5" />;
    case "star": return <Star className="h-5 w-5" />;
    case "message": return <MessageSquare className="h-5 w-5" />;
    default: return <Award className="h-5 w-5" />;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m} Min`;
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// ─── Circular Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ percent, size = 64, strokeWidth = 5, className = "", textClass = "" }: { percent: number; size?: number; strokeWidth?: number; className?: string; textClass?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const gradientId = `pg_${size}_${percent}`;
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-white/[0.06]" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`absolute font-bold text-white ${textClass || (size > 80 ? "text-xl" : size > 50 ? "text-sm" : "text-xs")}`}>{percent}%</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademyPortal() {
  const [view, setView] = useState<PortalView>("login");
  const [session, setSession] = useState<CustomerSession | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Navigation
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Notes & Comments
  const [currentNote, setCurrentNote] = useState("");
  const [newComment, setNewComment] = useState("");

  // Quiz state in player
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Auto-advance
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // User dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Description expand
  const [descExpanded, setDescExpanded] = useState(false);

  // Certificate
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateCourseId, setCertificateCourseId] = useState("");

  // ─── Session restore ───────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("academy_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CustomerSession;
        setSession(parsed);
        setView("dashboard");
      } catch {
        localStorage.removeItem("academy_session");
      }
    }
  }, []);

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!session) return;
    const [coursesRes, chaptersRes, lessonsRes, progressRes, quizzesRes, quizResultsRes, commentsRes, achievementsRes] = await Promise.all([
      supabase.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: false }),
      supabase.from("chapters").select("*").order("sort_order", { ascending: true }),
      supabase.from("lessons").select("*").eq("is_published", true).order("sort_order", { ascending: true }),
      supabase.from("lesson_progress").select("*").eq("customer_id", session.customer_id),
      supabase.from("quizzes").select("*").order("sort_order", { ascending: true }),
      supabase.from("quiz_results").select("*").eq("customer_id", session.customer_id),
      supabase.from("lesson_comments").select("*").order("created_at", { ascending: true }),
      supabase.from("achievements").select("*").eq("customer_id", session.customer_id),
    ]);
    if (coursesRes.data) setCourses(coursesRes.data);
    if (chaptersRes.data) setChapters(chaptersRes.data);
    if (lessonsRes.data) setLessons(lessonsRes.data);
    if (progressRes.data) setProgress(progressRes.data);
    if (quizzesRes.data) setQuizzes(quizzesRes.data);
    if (quizResultsRes.data) setQuizResults(quizResultsRes.data);
    if (commentsRes.data) setComments(commentsRes.data);
    if (achievementsRes.data) setAchievements(achievementsRes.data);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load note when lesson changes
  useEffect(() => {
    if (selectedLessonId && session) {
      const existing = progress.find((p) => p.lesson_id === selectedLessonId);
      setCurrentNote(existing?.notes || "");
      setQuizAnswers({});
      setQuizSubmitted(false);
      setDescExpanded(false);
    }
  }, [selectedLessonId, session, progress]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    };
  }, []);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast.error("Bitte E-Mail und Passwort eingeben");
      return;
    }
    setLoginLoading(true);
    try {
      const { data, error } = await supabase
        .from("academy_customers")
        .select("*")
        .eq("email", loginEmail.trim().toLowerCase())
        .eq("password_hash", loginPassword)
        .single();

      if (error || !data) {
        toast.error("Ungultige Anmeldedaten");
        setLoginLoading(false);
        return;
      }
      if (data.status !== "active") {
        toast.error("Dein Konto ist nicht aktiv. Kontaktiere uns unter support@adslift.de");
        setLoginLoading(false);
        return;
      }
      if (data.subscription_end) {
        const endDate = new Date(data.subscription_end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate < today) {
          toast.error("Dein Abonnement ist abgelaufen.");
          setLoginLoading(false);
          return;
        }
      }

      // Update last_login
      await supabase.from("academy_customers").update({ last_login: new Date().toISOString() }).eq("id", data.id);

      const customerSession: CustomerSession = { customer_id: data.id, email: data.email, name: data.name };
      localStorage.setItem("academy_session", JSON.stringify(customerSession));
      setSession(customerSession);
      setView("dashboard");
      toast.success(`Willkommen, ${data.name}!`);
    } catch {
      toast.error("Ein Fehler ist aufgetreten");
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("academy_session");
    setSession(null);
    setView("login");
    setLoginEmail("");
    setLoginPassword("");
    setSearchQuery("");
    setAutoAdvanceCountdown(null);
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
  };

  // ─── Achievement checker ───────────────────────────────────────────────────
  const checkAndAwardAchievement = useCallback(async (type: string) => {
    if (!session) return;
    if (achievements.some((a) => a.type === type)) return;
    const { data } = await supabase.from("achievements").insert({
      customer_id: session.customer_id,
      type,
      earned_at: new Date().toISOString(),
    }).select().single();
    if (data) {
      setAchievements((prev) => [...prev, data]);
      const def = ACHIEVEMENT_DEFS.find((d) => d.type === type);
      toast.success(`Achievement freigeschaltet: ${def?.label || type}!`);
    }
  }, [session, achievements]);

  // ─── Progress helpers ──────────────────────────────────────────────────────
  const getCourseProgress = useCallback((courseId: string) => {
    const cls = lessons.filter((l) => l.course_id === courseId);
    if (cls.length === 0) return 0;
    const completed = cls.filter((l) => progress.some((p) => p.lesson_id === l.id && p.completed)).length;
    return Math.round((completed / cls.length) * 100);
  }, [lessons, progress]);

  const isLessonCompleted = useCallback((lessonId: string) => {
    return progress.some((p) => p.lesson_id === lessonId && p.completed);
  }, [progress]);

  const isCourseCompleted = useCallback((courseId: string) => {
    return getCourseProgress(courseId) === 100;
  }, [getCourseProgress]);

  const isLessonLocked = useCallback((lesson: Lesson) => {
    const course = courses.find((c) => c.id === lesson.course_id);
    if (!course?.is_sequential) return false;
    const courseLessons = lessons.filter((l) => l.course_id === lesson.course_id);
    const idx = courseLessons.findIndex((l) => l.id === lesson.id);
    if (idx <= 0) return false;
    return !isLessonCompleted(courseLessons[idx - 1].id);
  }, [courses, lessons, isLessonCompleted]);

  const isLessonBookmarked = useCallback((lessonId: string) => {
    return progress.some((p) => p.lesson_id === lessonId && p.bookmarked);
  }, [progress]);

  const toggleBookmark = async (lessonId: string) => {
    if (!session) return;
    const existing = progress.find((p) => p.lesson_id === lessonId);
    const newVal = existing ? !existing.bookmarked : true;
    if (existing) {
      await supabase.from("lesson_progress").update({ bookmarked: newVal }).eq("id", existing.id);
      setProgress((prev) => prev.map((p) => p.id === existing.id ? { ...p, bookmarked: newVal } : p));
    } else {
      const { data } = await supabase.from("lesson_progress").insert({
        customer_id: session.customer_id, lesson_id: lessonId,
        completed: false, watched_seconds: 0, notes: null, bookmarked: true,
      }).select().single();
      if (data) setProgress((prev) => [...prev, data]);
    }
    // Check bookmark achievement
    const totalBookmarks = progress.filter((p) => p.bookmarked).length + (newVal ? 1 : 0);
    if (totalBookmarks >= 10) checkAndAwardAchievement("bookmarks_10");
  };

  const saveNote = async (lessonId: string, note: string) => {
    if (!session) return;
    const existing = progress.find((p) => p.lesson_id === lessonId);
    if (existing) {
      await supabase.from("lesson_progress").update({ notes: note }).eq("id", existing.id);
      setProgress((prev) => prev.map((p) => p.id === existing.id ? { ...p, notes: note } : p));
    } else {
      const { data } = await supabase.from("lesson_progress").insert({
        customer_id: session.customer_id, lesson_id: lessonId,
        completed: false, watched_seconds: 0, notes: note, bookmarked: false,
      }).select().single();
      if (data) setProgress((prev) => [...prev, data]);
    }
  };

  const toggleLessonComplete = async (lessonId: string) => {
    if (!session) return;
    const existing = progress.find((p) => p.lesson_id === lessonId);
    if (existing) {
      const newCompleted = !existing.completed;
      await supabase.from("lesson_progress").update({ completed: newCompleted }).eq("id", existing.id);
      setProgress((prev) => prev.map((p) => p.id === existing.id ? { ...p, completed: newCompleted } : p));
      if (newCompleted) {
        startAutoAdvance(lessonId);
        await checkCompletionAchievements(lessonId);
      }
    } else {
      const { data } = await supabase.from("lesson_progress").insert({
        customer_id: session.customer_id, lesson_id: lessonId,
        completed: true, watched_seconds: 0, notes: null, bookmarked: false,
      }).select().single();
      if (data) {
        setProgress((prev) => [...prev, data]);
        startAutoAdvance(lessonId);
        await checkCompletionAchievements(lessonId);
      }
    }
  };

  const checkCompletionAchievements = async (lessonId: string) => {
    // First lesson
    const completedCount = progress.filter((p) => p.completed).length + 1;
    if (completedCount === 1) await checkAndAwardAchievement("first_lesson");

    // First course completed
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      const courseLessons = lessons.filter((l) => l.course_id === lesson.course_id);
      const allDone = courseLessons.every((l) => l.id === lessonId || progress.some((p) => p.lesson_id === l.id && p.completed));
      if (allDone) await checkAndAwardAchievement("first_course");

      // All courses completed
      const allCoursesDone = courses.every((c) => {
        const cls = lessons.filter((l) => l.course_id === c.id);
        return cls.length > 0 && cls.every((l) => l.id === lessonId || progress.some((p) => p.lesson_id === l.id && p.completed));
      });
      if (allCoursesDone && courses.length > 0) await checkAndAwardAchievement("all_courses");
    }
  };

  const startAutoAdvance = (lessonId: string) => {
    const currentCourse = lessons.find((l) => l.id === lessonId)?.course_id;
    if (!currentCourse) return;
    const cLessons = lessons.filter((l) => l.course_id === currentCourse);
    const idx = cLessons.findIndex((l) => l.id === lessonId);
    if (idx < 0 || idx >= cLessons.length - 1) return;
    const next = cLessons[idx + 1];
    setAutoAdvanceCountdown(5);
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    autoAdvanceRef.current = setInterval(() => {
      setAutoAdvanceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
          autoAdvanceRef.current = null;
          setSelectedLessonId(next.id);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelAutoAdvance = () => {
    setAutoAdvanceCountdown(null);
    if (autoAdvanceRef.current) {
      clearInterval(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  };

  const logDownload = async (lessonId: string) => {
    if (!session) return;
    await supabase.from("download_logs").insert({ customer_id: session.customer_id, lesson_id: lessonId });
  };

  // Comments
  const submitComment = async (lessonId: string) => {
    if (!session || !newComment.trim()) return;
    const { data } = await supabase.from("lesson_comments").insert({
      lesson_id: lessonId,
      customer_id: session.customer_id,
      customer_name: session.name,
      content: newComment.trim(),
    }).select().single();
    if (data) {
      setComments((prev) => [...prev, data]);
      setNewComment("");
      // First comment achievement
      if (comments.filter((c) => c.customer_id === session.customer_id).length === 0) {
        await checkAndAwardAchievement("first_comment");
      }
    }
  };

  // Quiz submit
  const submitQuiz = async (lessonId: string) => {
    if (!session) return;
    const lessonQuizzes = quizzes.filter((q) => q.lesson_id === lessonId);
    let allCorrect = true;
    for (const quiz of lessonQuizzes) {
      const selectedIdx = quizAnswers[quiz.id];
      if (selectedIdx === undefined) { toast.error("Bitte beantworte alle Fragen"); return; }
      const correct = selectedIdx === quiz.correct_index;
      if (!correct) allCorrect = false;
      const { data } = await supabase.from("quiz_results").insert({
        customer_id: session.customer_id,
        quiz_id: quiz.id,
        lesson_id: lessonId,
        selected_index: selectedIdx,
        correct,
      }).select().single();
      if (data) setQuizResults((prev) => [...prev, data]);
    }
    setQuizSubmitted(true);
    if (allCorrect) {
      toast.success("Perfekt! Alle Fragen richtig!");
      await checkAndAwardAchievement("perfect_quiz");
    } else {
      toast.info("Quiz abgeschlossen. Einige Antworten waren falsch.");
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────────────
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseLessons = useMemo(() => lessons.filter((l) => l.course_id === selectedCourseId), [lessons, selectedCourseId]);
  const selectedLesson = lessons.find((l) => l.id === selectedLessonId);

  // Group by chapter
  const chapteredLessons = useMemo(() => {
    const courseChaps = chapters.filter((c) => c.course_id === selectedCourseId);
    const groups: { chapter: Chapter | null; lessons: Lesson[] }[] = [];
    for (const chap of courseChaps) {
      groups.push({ chapter: chap, lessons: courseLessons.filter((l) => l.chapter_id === chap.id) });
    }
    const unassigned = courseLessons.filter((l) => !l.chapter_id);
    if (unassigned.length > 0 || groups.length === 0) {
      groups.push({ chapter: null, lessons: unassigned.length > 0 ? unassigned : (groups.length === 0 ? courseLessons : []) });
    }
    return groups.filter((g) => g.lessons.length > 0);
  }, [chapters, selectedCourseId, courseLessons]);

  // Stats
  const stats = useMemo(() => {
    const coursesStarted = courses.filter((c) => {
      const cls = lessons.filter((l) => l.course_id === c.id);
      return cls.some((l) => progress.some((p) => p.lesson_id === l.id));
    }).length;
    const videosWatched = progress.filter((p) => p.completed).length;
    const totalMinutes = progress.filter((p) => p.completed).reduce((sum, p) => {
      const lesson = lessons.find((l) => l.id === p.lesson_id);
      return sum + (lesson?.duration_minutes || 0);
    }, 0);
    const hoursLearned = Math.round((totalMinutes / 60) * 10) / 10;
    // Simple streak: count from customer data or from recent daily activity
    const streak = 0; // Will be loaded from customer data
    return { coursesStarted, videosWatched, hoursLearned, streak };
  }, [courses, lessons, progress]);

  // Last watched
  const lastWatched = useMemo(() => {
    const watchedLessons = progress.filter((p) => !p.completed && p.watched_seconds > 0);
    if (watchedLessons.length === 0) {
      for (const course of courses) {
        const cls = lessons.filter((l) => l.course_id === course.id);
        const firstIncomplete = cls.find((l) => !isLessonCompleted(l.id));
        if (firstIncomplete && cls.some((l) => progress.some((p) => p.lesson_id === l.id))) {
          return { lesson: firstIncomplete, course };
        }
      }
      return null;
    }
    const lastProg = watchedLessons[watchedLessons.length - 1];
    const lesson = lessons.find((l) => l.id === lastProg.lesson_id);
    const course = lesson ? courses.find((c) => c.id === lesson.course_id) : undefined;
    return lesson && course ? { lesson, course } : null;
  }, [progress, lessons, courses, isLessonCompleted]);

  // Overall progress
  const overallProgress = useMemo(() => {
    if (lessons.length === 0) return 0;
    const completed = lessons.filter((l) => isLessonCompleted(l.id)).length;
    return Math.round((completed / lessons.length) * 100);
  }, [lessons, isLessonCompleted]);

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { courses: [] as Course[], lessons: [] as Lesson[] };
    const q = searchQuery.toLowerCase();
    return {
      courses: courses.filter((c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)),
      lessons: lessons.filter((l) => l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q)),
    };
  }, [searchQuery, courses, lessons]);

  // Navigation
  const goToPlayer = (courseId: string, lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson && isLessonLocked(lesson)) {
      toast.error("Diese Lektion ist noch gesperrt. Schliesse zuerst die vorherige ab.");
      return;
    }
    setSelectedCourseId(courseId);
    setSelectedLessonId(lessonId);
    cancelAutoAdvance();
    setView("player");
    // Track watched
    if (session) {
      const existing = progress.find((p) => p.lesson_id === lessonId);
      if (!existing) {
        supabase.from("lesson_progress").insert({
          customer_id: session.customer_id, lesson_id: lessonId,
          completed: false, watched_seconds: 1, notes: null, bookmarked: false,
        }).select().single().then(({ data }) => {
          if (data) setProgress((prev) => [...prev, data]);
        });
      }
    }
  };

  const goToCourseDetail = (courseId: string) => {
    setSelectedCourseId(courseId);
    setView("course-detail");
  };

  // Player navigation
  const currentLessonIndex = courseLessons.findIndex((l) => l.id === selectedLessonId);
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < courseLessons.length - 1 ? courseLessons[currentLessonIndex + 1] : null;
  const prevLesson = currentLessonIndex > 0 ? courseLessons[currentLessonIndex - 1] : null;

  // Bookmarked lessons
  const bookmarkedLessons = useMemo(() => {
    return progress.filter((p) => p.bookmarked).map((p) => {
      const lesson = lessons.find((l) => l.id === p.lesson_id);
      const course = lesson ? courses.find((c) => c.id === lesson.course_id) : undefined;
      return lesson && course ? { lesson, course } : null;
    }).filter(Boolean) as { lesson: Lesson; course: Course }[];
  }, [progress, lessons, courses]);

  // Downloads
  const allDownloads = useMemo(() => {
    return lessons.filter((l) => l.download_url).map((lesson) => {
      const course = courses.find((c) => c.id === lesson.course_id);
      return { lesson, course };
    }).filter((d) => d.course) as { lesson: Lesson; course: Course }[];
  }, [lessons, courses]);

  // Lesson comments
  const lessonComments = useMemo(() => {
    return comments.filter((c) => c.lesson_id === selectedLessonId);
  }, [comments, selectedLessonId]);

  // Lesson quizzes
  const lessonQuizzes = useMemo(() => {
    return quizzes.filter((q) => q.lesson_id === selectedLessonId);
  }, [quizzes, selectedLessonId]);

  // Check if quiz already submitted for this lesson
  const quizAlreadyDone = useMemo(() => {
    return lessonQuizzes.length > 0 && lessonQuizzes.every((q) => quizResults.some((r) => r.quiz_id === q.id));
  }, [lessonQuizzes, quizResults]);

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "#0a0a0f" }}>
        <Sonner />
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-2/3 left-1/3 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "3s" }} />

        <div className="w-full max-w-md relative z-10">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-6 shadow-2xl shadow-violet-500/30 ring-1 ring-white/10">
              <img src="/favicon.png" alt="Adslift" className="h-10 w-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Adslift Academy</h1>
            <p className="text-white/40 mt-3 text-lg">Willkommen zuruck</p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl shadow-2xl shadow-black/40 p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-white/60 text-sm font-medium">E-Mail</Label>
              <Input
                type="email"
                placeholder="deine@email.de"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-violet-500/50 focus:ring-violet-500/20 h-12 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/60 text-sm font-medium">Passwort</Label>
              <Input
                type="password"
                placeholder="Dein Passwort"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-violet-500/50 focus:ring-violet-500/20 h-12 rounded-xl text-base"
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-500/25 rounded-xl text-base font-semibold transition-all duration-300 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loginLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Wird gepruft...
                </span>
              ) : "Anmelden"}
            </Button>
          </div>

          <p className="text-center text-sm text-white/20 mt-8">
            Probleme beim Login? Schreib uns an{" "}
            <a href="mailto:support@adslift.de" className="text-violet-400 hover:text-violet-300 transition-colors">support@adslift.de</a>
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PORTAL LAYOUT
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0a0f" }}>
      <Sonner />

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-violet-600/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/[0.03] rounded-full blur-[150px]" />
      </div>

      {/* ── Fixed Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.04] backdrop-blur-2xl" style={{ background: "rgba(10,10,15,0.8)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 shrink-0">
            {view !== "dashboard" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  cancelAutoAdvance();
                  if (view === "player") setView("course-detail");
                  else if (view === "course-detail") setView("courses");
                  else setView("dashboard");
                }}
                className="text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Zuruck</span>
              </Button>
            )}
            <button
              onClick={() => { cancelAutoAdvance(); setView("dashboard"); }}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-base text-white hidden sm:block">Academy</span>
            </button>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <Input
                placeholder="Kurse & Lektionen durchsuchen..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim() && view !== "search") setView("search");
                  if (!e.target.value.trim() && view === "search") setView("dashboard");
                }}
                className="pl-10 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-violet-500/40 focus:ring-violet-500/10 h-10 rounded-xl"
              />
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile search */}
            <Button
              variant="ghost" size="sm"
              onClick={() => { if (view === "search") { setSearchQuery(""); setView("dashboard"); } else { setView("search"); } }}
              className="md:hidden text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Bookmarks */}
            <Button
              variant="ghost" size="sm"
              onClick={() => setView("downloads")}
              className="text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl"
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* User avatar + dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 pl-2 ml-1 border-l border-white/[0.06] hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-white/[0.08] flex items-center justify-center text-sm font-bold text-violet-300">
                  {session?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <span className="text-sm text-white/60 hidden lg:block max-w-[100px] truncate">{session?.name?.split(" ")[0]}</span>
                <ChevronDown className="h-3 w-3 text-white/30 hidden lg:block" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/[0.06] bg-[#12121a]/95 backdrop-blur-2xl shadow-2xl z-50 py-2 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <p className="text-sm font-medium text-white">{session?.name}</p>
                      <p className="text-xs text-white/40">{session?.email}</p>
                    </div>
                    {[
                      { label: "Profil", icon: User, view: "profile" as PortalView },
                      { label: "Achievements", icon: Award, view: "achievements" as PortalView },
                      { label: "Downloads", icon: Download, view: "downloads" as PortalView },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => { setView(item.view); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    ))}
                    <div className="border-t border-white/[0.04] mt-1 pt-1">
                      <button
                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/[0.05] transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Abmelden
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════ DASHBOARD ══════════════════ */}
      {view === "dashboard" && (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
          {/* Greeting */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {getGreeting()},{" "}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                {session?.name?.split(" ")[0]}
              </span>
            </h1>
            <p className="text-white/30 mt-2 text-lg">Dein nachster Erfolg wartet auf dich.</p>
          </div>

          {/* Continue Learning */}
          {lastWatched && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden group hover:border-violet-500/20 transition-all duration-300">
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-72 h-44 sm:h-auto bg-gradient-to-br from-violet-600/20 to-indigo-600/20 relative shrink-0 overflow-hidden">
                  {lastWatched.course.thumbnail_url ? (
                    <img src={lastWatched.course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayCircle className="h-14 w-14 text-violet-400/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0a0a0f]/80 hidden sm:block" />
                </div>
                <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 mb-3 text-xs">
                      Weiter lernen
                    </Badge>
                    <h3 className="text-xl font-bold text-white mb-1">{lastWatched.lesson.title}</h3>
                    <p className="text-sm text-white/40">{lastWatched.course.title}</p>
                  </div>
                  <div className="mt-5">
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-5">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${getCourseProgress(lastWatched.course.id)}%` }} />
                    </div>
                    <Button
                      onClick={() => goToPlayer(lastWatched.course.id, lastWatched.lesson.id)}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] h-11 px-6"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Weiter lernen
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: BookOpen, label: "Kurse gestartet", value: String(stats.coursesStarted), color: "from-violet-500/20 to-violet-600/20", iconColor: "text-violet-400" },
              { icon: Eye, label: "Videos geschaut", value: String(stats.videosWatched), color: "from-blue-500/20 to-blue-600/20", iconColor: "text-blue-400" },
              { icon: Timer, label: "Stunden gelernt", value: String(stats.hoursLearned), color: "from-emerald-500/20 to-emerald-600/20", iconColor: "text-emerald-400" },
              { icon: Flame, label: "Streak", value: `${stats.streak} Tage`, color: "from-orange-500/20 to-red-500/20", iconColor: "text-orange-400" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 hover:bg-white/[0.05] transition-all duration-300 group"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-white/30 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Overall Progress + Achievements */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Overall Progress */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-8 flex flex-col items-center justify-center text-center">
              <ProgressRing percent={overallProgress} size={140} strokeWidth={10} textClass="text-2xl" />
              <h3 className="text-lg font-bold text-white mt-5">Gesamtfortschritt</h3>
              <p className="text-sm text-white/30 mt-1">
                {lessons.filter((l) => isLessonCompleted(l.id)).length} von {lessons.length} Lektionen
              </p>
            </div>

            {/* Achievements preview */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Achievements</h3>
                <button onClick={() => setView("achievements")} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                  Alle anzeigen <ChevronRight className="h-3.5 w-3.5 inline" />
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {ACHIEVEMENT_DEFS.map((def) => {
                  const earned = achievements.some((a) => a.type === def.type);
                  return (
                    <div key={def.type} className="shrink-0 flex flex-col items-center gap-2 w-20">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        earned
                          ? `bg-gradient-to-br ${def.color} shadow-lg ring-2 ring-white/10`
                          : "bg-white/[0.04] border border-white/[0.06]"
                      }`}>
                        <span className={earned ? "text-white" : "text-white/20"}>
                          {getAchievementIcon(def.icon)}
                        </span>
                      </div>
                      <span className={`text-xs text-center leading-tight ${earned ? "text-white/60" : "text-white/20"}`}>{def.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* My Courses */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Meine Kurse</h2>
              <button onClick={() => setView("courses")} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                Alle anzeigen <ChevronRight className="h-3.5 w-3.5 inline" />
              </button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((course) => {
                const pct = getCourseProgress(course.id);
                const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
                const totalMin = lessons.filter((l) => l.course_id === course.id).reduce((s, l) => s + (l.duration_minutes || 0), 0);
                return (
                  <div
                    key={course.id}
                    className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl cursor-pointer transition-all duration-300 overflow-hidden hover:border-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/[0.06] hover:scale-[1.02]"
                    onClick={() => goToCourseDetail(course.id)}
                  >
                    <div className="relative h-44 overflow-hidden">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                          <BookOpen className="h-14 w-14 text-violet-400/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                      {course.category && (
                        <Badge className="absolute top-3 left-3 bg-white/10 backdrop-blur-md text-white border-white/20 text-xs">
                          {course.category}
                        </Badge>
                      )}
                    </div>
                    <div className="p-5 space-y-3">
                      <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors text-base line-clamp-1">{course.title}</h3>
                      {course.description && <p className="text-sm text-white/30 line-clamp-2 leading-relaxed">{course.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-white/25 pt-1">
                        <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                        {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatMinutes(totalMin)}</span>}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <ProgressRing percent={pct} size={32} strokeWidth={3} textClass="text-[10px]" />
                          {pct === 100 && lessonCount > 0 && (
                            <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Fertig
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        className="w-full mt-2 rounded-xl text-sm h-9 bg-white/[0.04] hover:bg-violet-600 border border-white/[0.06] hover:border-violet-500 text-white transition-all duration-300"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); goToCourseDetail(course.id); }}
                      >
                        {pct > 0 ? "Fortsetzen" : "Starten"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* ══════════════════ COURSES ══════════════════ */}
      {view === "courses" && (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alle Kurse</h1>
            <p className="text-white/30 mt-2">Wahle einen Kurs aus, um zu starten</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const pct = getCourseProgress(course.id);
              const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
              const totalMin = lessons.filter((l) => l.course_id === course.id).reduce((s, l) => s + (l.duration_minutes || 0), 0);
              return (
                <div
                  key={course.id}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl cursor-pointer transition-all duration-300 overflow-hidden hover:border-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/[0.06] hover:scale-[1.02]"
                  onClick={() => goToCourseDetail(course.id)}
                >
                  <div className="relative h-44 overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                        <BookOpen className="h-14 w-14 text-violet-400/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                    {course.category && (
                      <Badge className="absolute top-3 left-3 bg-white/10 backdrop-blur-md text-white border-white/20 text-xs">{course.category}</Badge>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors text-base line-clamp-1">{course.title}</h3>
                    {course.description && <p className="text-sm text-white/30 line-clamp-2 leading-relaxed">{course.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-white/25 pt-1">
                      <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                      {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatMinutes(totalMin)}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <ProgressRing percent={pct} size={32} strokeWidth={3} textClass="text-[10px]" />
                        {pct === 100 && lessonCount > 0 && (
                          <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Fertig
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      className="w-full mt-2 rounded-xl text-sm h-9 bg-white/[0.04] hover:bg-violet-600 border border-white/[0.06] hover:border-violet-500 text-white transition-all duration-300"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); goToCourseDetail(course.id); }}
                    >
                      {pct > 0 ? "Fortsetzen" : "Starten"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {courses.length === 0 && (
              <div className="col-span-full text-center py-20 text-white/20">
                <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Noch keine Kurse verfugbar</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ══════════════════ COURSE DETAIL ══════════════════ */}
      {view === "course-detail" && selectedCourse && (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0">
              {selectedCourse.thumbnail_url ? (
                <img src={selectedCourse.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-indigo-800/20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/90 to-[#0a0a0f]/60" />
            </div>
            <div className="relative p-8 sm:p-12 flex flex-col sm:flex-row items-start gap-8">
              <div className="flex-1 space-y-4">
                {selectedCourse.category && (
                  <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 text-xs">{selectedCourse.category}</Badge>
                )}
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{selectedCourse.title}</h1>
                {selectedCourse.description && <p className="text-white/50 text-lg leading-relaxed max-w-2xl">{selectedCourse.description}</p>}
                <div className="flex items-center gap-6 text-sm text-white/30 pt-2">
                  <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4" />{courseLessons.length} Lektionen</span>
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4" />{formatMinutes(courseLessons.reduce((s, l) => s + (l.duration_minutes || 0), 0))}</span>
                  <span className="flex items-center gap-2"><Download className="h-4 w-4" />{courseLessons.filter((l) => l.download_url).length} Downloads</span>
                </div>
                {/* Progress bar */}
                <div className="max-w-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/30">{getCourseProgress(selectedCourse.id)}% abgeschlossen</span>
                    <span className="text-xs text-white/20">{courseLessons.filter((l) => isLessonCompleted(l.id)).length}/{courseLessons.length}</span>
                  </div>
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${getCourseProgress(selectedCourse.id)}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4">
                  {courseLessons.length > 0 && (
                    <Button
                      onClick={() => {
                        const firstIncomplete = courseLessons.find((l) => !isLessonCompleted(l.id) && !isLessonLocked(l));
                        const target = firstIncomplete || courseLessons[0];
                        goToPlayer(selectedCourse.id, target.id);
                      }}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-xl shadow-violet-500/20 hover:shadow-violet-500/30 h-11 px-6 text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {getCourseProgress(selectedCourse.id) > 0 ? "Fortsetzen" : "Kurs starten"}
                    </Button>
                  )}
                  {isCourseCompleted(selectedCourse.id) && courseLessons.length > 0 && (
                    <Button
                      onClick={() => { setCertificateCourseId(selectedCourse.id); setShowCertificate(true); }}
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 rounded-xl h-11 px-6 transition-all duration-300"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Zertifikat anzeigen
                    </Button>
                  )}
                </div>
              </div>
              <div className="shrink-0 hidden sm:flex items-center justify-center w-[120px] h-[120px] rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <ProgressRing percent={getCourseProgress(selectedCourse.id)} size={80} strokeWidth={6} textClass="text-lg" />
              </div>
            </div>
          </div>

          {/* Chapter accordion */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Kursinhalt</h2>
            {chapteredLessons.map((group, gIdx) => {
              const sectionKey = `${selectedCourseId}_${gIdx}`;
              const isOpen = openSections[sectionKey] !== false;
              const sectionCompleted = group.lessons.every((l) => isLessonCompleted(l.id));
              const sectionProgress = group.lessons.length > 0
                ? Math.round((group.lessons.filter((l) => isLessonCompleted(l.id)).length / group.lessons.length) * 100)
                : 0;

              return (
                <Collapsible key={sectionKey} open={isOpen} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, [sectionKey]: open }))}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all duration-200 group">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`h-4 w-4 text-white/30 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                        <div className="text-left">
                          <h3 className="font-semibold text-white text-sm group-hover:text-violet-300 transition-colors">
                            {group.chapter ? `${gIdx + 1}. ${group.chapter.title}` : (chapteredLessons.length > 1 ? "Weitere Lektionen" : "Lektionen")}
                          </h3>
                          <p className="text-xs text-white/25 mt-0.5">
                            {group.lessons.length} Lektionen &middot; {formatMinutes(group.lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sectionCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        <span className="text-xs text-white/25 font-medium">{sectionProgress}%</span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1 pl-2">
                      {group.lessons.map((lesson, idx) => {
                        const completed = isLessonCompleted(lesson.id);
                        const locked = isLessonLocked(lesson);
                        const bookmarked = isLessonBookmarked(lesson.id);

                        return (
                          <div
                            key={lesson.id}
                            className={`group flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${locked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/[0.03] cursor-pointer"}`}
                            onClick={() => !locked && goToPlayer(selectedCourse.id, lesson.id)}
                          >
                            <div className="shrink-0">
                              {locked ? (
                                <Lock className="h-5 w-5 text-white/20" />
                              ) : completed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <Circle className="h-5 w-5 text-white/20 group-hover:text-violet-400 transition-colors" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/15 font-mono w-6">{String(idx + 1).padStart(2, "0")}</span>
                                <h4 className={`font-medium text-sm truncate transition-colors ${completed ? "text-white/30 line-through decoration-white/10" : "text-white group-hover:text-violet-300"}`}>
                                  {lesson.title}
                                </h4>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {bookmarked && <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />}
                              {lesson.has_quiz && <Badge className="text-[10px] bg-pink-500/10 text-pink-300 border-pink-500/20 px-1.5 py-0.5">Quiz</Badge>}
                              {lesson.download_url && (
                                <Badge className="text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/20 px-1.5 py-0.5">
                                  <Download className="h-2.5 w-2.5 mr-0.5" />{lesson.download_name || "PDF"}
                                </Badge>
                              )}
                              {lesson.duration_minutes > 0 && <span className="text-xs text-white/20 tabular-nums">{lesson.duration_minutes}m</span>}
                              {!locked && <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-violet-400 transition-colors" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            {courseLessons.length === 0 && (
              <div className="text-center py-16 text-white/20">
                <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Noch keine Lektionen verfugbar</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ══════════════════ VIDEO PLAYER ══════════════════ */}
      {view === "player" && selectedLesson && selectedCourse && (
        <main className="relative z-10 max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
            {/* Main content (75%) */}
            <div className="flex-1 lg:w-[75%] overflow-auto">
              <div className="p-4 sm:p-6 space-y-6">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-white/25">
                  <button onClick={() => goToCourseDetail(selectedCourse.id)} className="hover:text-violet-400 transition-colors">{selectedCourse.title}</button>
                  <ChevronRight className="h-3 w-3" />
                  {selectedLesson.chapter_id && (() => {
                    const ch = chapters.find((c) => c.id === selectedLesson.chapter_id);
                    return ch ? <><span>{ch.title}</span><ChevronRight className="h-3 w-3" /></> : null;
                  })()}
                  <span className="text-white/40">{selectedLesson.title}</span>
                </div>

                {/* Video Player */}
                {getEmbedUrl(selectedLesson.vimeo_id) ? (
                  <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-white/[0.06]" style={{ paddingTop: "56.25%" }}>
                    <iframe
                      src={getEmbedUrl(selectedLesson.vimeo_id)!}
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="relative w-full rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.06] flex items-center justify-center" style={{ paddingTop: "56.25%" }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white/20">
                        <PlayCircle className="h-16 w-16 mx-auto mb-3 opacity-30" />
                        <p>Kein Video verfugbar</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-advance banner */}
                {autoAdvanceCountdown !== null && nextLesson && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                    <div className="flex items-center gap-3">
                      <SkipForward className="h-5 w-5 text-violet-400" />
                      <span className="text-sm text-violet-200">
                        Nachstes Video in <span className="font-bold text-white">{autoAdvanceCountdown}s</span>: {nextLesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => { cancelAutoAdvance(); setSelectedLessonId(nextLesson.id); }} className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs h-8">
                        Jetzt abspielen
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelAutoAdvance} className="text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl text-xs h-8">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lesson title + duration */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold">{selectedLesson.title}</h1>
                    {selectedLesson.duration_minutes > 0 && (
                      <Badge className="mt-2 bg-white/[0.04] text-white/40 border-white/[0.06] hover:bg-white/[0.04]">
                        <Clock className="h-3 w-3 mr-1" />{selectedLesson.duration_minutes} Min
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => toggleBookmark(selectedLesson.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 text-sm ${
                      isLessonBookmarked(selectedLesson.id)
                        ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                        : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-yellow-400 hover:border-yellow-500/20"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isLessonBookmarked(selectedLesson.id) ? "fill-yellow-400" : ""}`} />
                    Lesezeichen
                  </button>

                  {selectedLesson.download_url && (
                    <button
                      onClick={() => { logDownload(selectedLesson.id); window.open(selectedLesson.download_url, "_blank"); toast.success("Download gestartet"); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/40 hover:text-violet-400 hover:border-violet-500/20 transition-all duration-200 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      {selectedLesson.download_name || "Download"}
                    </button>
                  )}

                  <Button
                    onClick={() => toggleLessonComplete(selectedLesson.id)}
                    className={`rounded-xl transition-all duration-300 ${isLessonCompleted(selectedLesson.id)
                      ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                      : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
                    }`}
                  >
                    {isLessonCompleted(selectedLesson.id) ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" />Abgeschlossen</>
                    ) : (
                      <><Circle className="h-4 w-4 mr-2" />Als abgeschlossen markieren</>
                    )}
                  </Button>
                </div>

                {/* Description */}
                {selectedLesson.description && (
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <h3 className="text-sm font-semibold text-white/60 mb-2">Beschreibung</h3>
                    <p className={`text-sm text-white/40 leading-relaxed whitespace-pre-wrap ${!descExpanded && selectedLesson.description.length > 300 ? "line-clamp-4" : ""}`}>
                      {selectedLesson.description}
                    </p>
                    {selectedLesson.description.length > 300 && (
                      <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-violet-400 hover:text-violet-300 mt-2 transition-colors">
                        {descExpanded ? "Weniger anzeigen" : "Mehr anzeigen"}
                      </button>
                    )}
                  </div>
                )}

                {/* Quiz section */}
                {selectedLesson.has_quiz && lessonQuizzes.length > 0 && isLessonCompleted(selectedLesson.id) && (
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-4 w-4 text-pink-400" />
                      <h3 className="text-sm font-semibold text-white/60">Quiz</h3>
                      {(quizSubmitted || quizAlreadyDone) && (
                        <Badge className={`ml-auto ${
                          lessonQuizzes.every((q) => {
                            const r = quizResults.find((res) => res.quiz_id === q.id);
                            return r?.correct;
                          }) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {lessonQuizzes.every((q) => { const r = quizResults.find((res) => res.quiz_id === q.id); return r?.correct; }) ? "Bestanden" : "Nicht bestanden"}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-6">
                      {lessonQuizzes.map((quiz, qi) => {
                        const existingResult = quizResults.find((r) => r.quiz_id === quiz.id);
                        const isAnswered = quizSubmitted || !!existingResult;
                        const selectedAnswer = existingResult ? existingResult.selected_index : quizAnswers[quiz.id];
                        return (
                          <div key={quiz.id} className="space-y-3">
                            <p className="text-sm font-medium text-white">{qi + 1}. {quiz.question}</p>
                            <div className="grid gap-2">
                              {[quiz.option_a, quiz.option_b, quiz.option_c, quiz.option_d].map((opt, oi) => {
                                if (!opt) return null;
                                const isSelected = selectedAnswer === oi;
                                const isCorrect = oi === quiz.correct_index;
                                return (
                                  <button
                                    key={oi}
                                    onClick={() => { if (!isAnswered) setQuizAnswers((prev) => ({ ...prev, [quiz.id]: oi })); }}
                                    disabled={isAnswered}
                                    className={`text-left p-3 rounded-xl border text-sm transition-all duration-200 ${
                                      isAnswered
                                        ? isCorrect
                                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                          : isSelected
                                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                                            : "bg-white/[0.02] border-white/[0.04] text-white/30"
                                        : isSelected
                                          ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                                          : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04] hover:border-white/[0.1]"
                                    }`}
                                  >
                                    <span className="font-medium mr-2">{String.fromCharCode(65 + oi)})</span>
                                    {opt}
                                    {isAnswered && isCorrect && <CheckCircle2 className="h-4 w-4 inline ml-2" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!quizSubmitted && !quizAlreadyDone && (
                      <Button
                        onClick={() => submitQuiz(selectedLesson.id)}
                        className="mt-4 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white rounded-xl"
                      >
                        Quiz abschicken
                      </Button>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <StickyNote className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-white/60">Meine Notizen</h3>
                  </div>
                  <Textarea
                    placeholder="Schreibe hier deine Notizen zu dieser Lektion..."
                    value={currentNote}
                    onChange={(e) => {
                      setCurrentNote(e.target.value);
                      saveNote(selectedLesson.id, e.target.value);
                    }}
                    className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15 focus:border-violet-500/40 focus:ring-violet-500/10 rounded-xl min-h-[100px] resize-none"
                  />
                </div>

                {/* Comments */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white/60">Kommentare ({lessonComments.length})</h3>
                  </div>
                  {/* Comment list */}
                  {lessonComments.length > 0 && (
                    <div className="space-y-3 mb-4 max-h-[300px] overflow-auto">
                      {lessonComments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-white/[0.02]">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/[0.06] flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                            {comment.customer_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white/70">{comment.customer_name}</span>
                              <span className="text-xs text-white/20">{new Date(comment.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="text-sm text-white/40 mt-1">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add comment */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Schreibe einen Kommentar..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitComment(selectedLesson.id)}
                      className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15 focus:border-violet-500/40 rounded-xl"
                    />
                    <Button
                      onClick={() => submitComment(selectedLesson.id)}
                      disabled={!newComment.trim()}
                      className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4">
                  {prevLesson ? (
                    <Button
                      variant="ghost"
                      onClick={() => { cancelAutoAdvance(); setSelectedLessonId(prevLesson.id); }}
                      className="text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Vorherige Lektion
                    </Button>
                  ) : <div />}
                  {nextLesson && (
                    <Button
                      onClick={() => { cancelAutoAdvance(); setSelectedLessonId(nextLesson.id); }}
                      className="bg-white/[0.05] hover:bg-violet-600 border border-white/[0.06] hover:border-violet-500 text-white rounded-xl transition-all duration-300"
                    >
                      Nachste Lektion
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar (25%) */}
            <div className="lg:w-[25%] lg:min-w-[300px] border-l border-white/[0.04] bg-white/[0.01]">
              <div className="sticky top-16 h-[calc(100vh-4rem)] flex flex-col">
                <div className="p-4 border-b border-white/[0.04]">
                  <h3 className="font-bold text-white text-sm truncate">{selectedCourse.title}</h3>
                  <p className="text-xs text-white/25 mt-1">
                    {courseLessons.filter((l) => isLessonCompleted(l.id)).length}/{courseLessons.length} abgeschlossen
                  </p>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${getCourseProgress(selectedCourse.id)}%` }} />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-0.5">
                    {courseLessons.map((lesson, idx) => {
                      const isCurrent = lesson.id === selectedLessonId;
                      const completed = isLessonCompleted(lesson.id);
                      const locked = isLessonLocked(lesson);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            if (locked) { toast.error("Lektion gesperrt"); return; }
                            cancelAutoAdvance();
                            setSelectedLessonId(lesson.id);
                          }}
                          className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start gap-3 ${
                            isCurrent
                              ? "bg-violet-500/10 border border-violet-500/20"
                              : locked
                                ? "opacity-30 border border-transparent"
                                : "hover:bg-white/[0.03] border border-transparent"
                          }`}
                        >
                          <div className="shrink-0 mt-0.5">
                            {locked ? (
                              <Lock className="h-4 w-4 text-white/20" />
                            ) : completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : isCurrent ? (
                              <PlayCircle className="h-4 w-4 text-violet-400" />
                            ) : (
                              <Circle className="h-4 w-4 text-white/20" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate transition-colors ${
                              isCurrent ? "text-violet-300" : completed ? "text-white/30" : "text-white/60 group-hover:text-white"
                            }`}>
                              {idx + 1}. {lesson.title}
                            </p>
                            {lesson.duration_minutes > 0 && (
                              <span className="text-xs text-white/15 mt-0.5 block">{lesson.duration_minutes} Min</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                {nextLesson && (
                  <div className="p-3 border-t border-white/[0.04]">
                    <Button
                      onClick={() => { cancelAutoAdvance(); setSelectedLessonId(nextLesson.id); }}
                      className="w-full bg-white/[0.04] hover:bg-violet-600 border border-white/[0.06] hover:border-violet-500 text-white rounded-xl transition-all duration-300 text-sm"
                    >
                      Nachstes Video
                      <SkipForward className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ══════════════════ SEARCH ══════════════════ */}
      {view === "search" && (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Mobile search input */}
          <div className="md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setView("dashboard"); }}
                autoFocus
                className="pl-10 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 h-10 rounded-xl"
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Suchergebnisse</h1>
            <p className="text-white/30 mt-1">
              {searchQuery.trim() ? `${searchResults.courses.length + searchResults.lessons.length} Ergebnisse fur "${searchQuery}"` : "Gib einen Suchbegriff ein"}
            </p>
          </div>
          {searchResults.courses.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white/60">Kurse</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.courses.map((course) => (
                  <div key={course.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl cursor-pointer hover:border-violet-500/20 hover:scale-[1.02] transition-all duration-300 group p-5" onClick={() => goToCourseDetail(course.id)}>
                    <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors">{course.title}</h3>
                    {course.description && <p className="text-sm text-white/30 mt-1 line-clamp-2">{course.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {searchResults.lessons.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white/60">Lektionen</h2>
              <div className="space-y-2">
                {searchResults.lessons.map((lesson) => {
                  const course = courses.find((c) => c.id === lesson.course_id);
                  return (
                    <div key={lesson.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-violet-500/20 cursor-pointer transition-all duration-200 group" onClick={() => course && goToPlayer(course.id, lesson.id)}>
                      {isLessonCompleted(lesson.id) ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <PlayCircle className="h-5 w-5 text-white/20 group-hover:text-violet-400 shrink-0 transition-colors" />}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">{lesson.title}</h4>
                        <p className="text-xs text-white/25 mt-0.5">{course?.title}</p>
                      </div>
                      {lesson.duration_minutes > 0 && <span className="text-xs text-white/20">{lesson.duration_minutes}m</span>}
                      <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-violet-400 transition-colors shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {searchQuery.trim() && searchResults.courses.length === 0 && searchResults.lessons.length === 0 && (
            <div className="text-center py-20 text-white/20">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Keine Ergebnisse gefunden</p>
            </div>
          )}
        </main>
      )}

      {/* ══════════════════ DOWNLOADS ══════════════════ */}
      {view === "downloads" && (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Download className="h-6 w-6 text-violet-400" />
              Downloads
            </h1>
            <p className="text-white/30 mt-1">{allDownloads.length} Downloads verfugbar</p>
          </div>
          {(() => {
            const grouped: Record<string, { course: Course; downloads: { lesson: Lesson; course: Course }[] }> = {};
            allDownloads.forEach((d) => {
              if (!grouped[d.course.id]) grouped[d.course.id] = { course: d.course, downloads: [] };
              grouped[d.course.id].downloads.push(d);
            });
            return Object.values(grouped).map((group) => (
              <div key={group.course.id} className="space-y-3">
                <h2 className="text-lg font-semibold text-white/60">{group.course.title}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.downloads.map((d) => (
                    <div key={d.lesson.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all duration-200 group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{d.lesson.download_name || d.lesson.title}</p>
                          <p className="text-xs text-white/25 mt-1">{d.lesson.title}</p>
                          <Badge className="mt-2 text-xs bg-violet-500/10 text-violet-300 border-violet-500/20">
                            <FileText className="h-2.5 w-2.5 mr-1" />PDF
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => { logDownload(d.lesson.id); window.open(d.lesson.download_url, "_blank"); toast.success("Download gestartet"); }}
                          className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
          {allDownloads.length === 0 && (
            <div className="text-center py-20 text-white/20">
              <Download className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Keine Downloads verfugbar</p>
            </div>
          )}
        </main>
      )}

      {/* ══════════════════ ACHIEVEMENTS ══════════════════ */}
      {view === "achievements" && (
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Award className="h-8 w-8 text-amber-400" />
              Achievements
            </h1>
            <p className="text-white/30 mt-2">{achievements.length} von {ACHIEVEMENT_DEFS.length} freigeschaltet</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENT_DEFS.map((def) => {
              const earned = achievements.find((a) => a.type === def.type);
              return (
                <div key={def.type} className={`rounded-2xl border p-6 transition-all duration-300 ${
                  earned
                    ? "border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.06] shadow-lg"
                    : "border-white/[0.04] bg-white/[0.01] opacity-50"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      earned
                        ? `bg-gradient-to-br ${def.color} shadow-lg ring-2 ring-white/10`
                        : "bg-white/[0.04] border border-white/[0.06]"
                    }`}>
                      <span className={earned ? "text-white" : "text-white/20"}>
                        {getAchievementIcon(def.icon)}
                      </span>
                    </div>
                    <div>
                      <h3 className={`font-bold ${earned ? "text-white" : "text-white/30"}`}>{def.label}</h3>
                      <p className={`text-sm mt-0.5 ${earned ? "text-white/50" : "text-white/15"}`}>{def.description}</p>
                      {earned ? (
                        <p className="text-xs text-white/25 mt-1">Freigeschaltet am {new Date(earned.earned_at).toLocaleDateString("de-DE")}</p>
                      ) : (
                        <p className="text-xs text-white/15 mt-1">Noch nicht freigeschaltet</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* ══════════════════ PROFILE ══════════════════ */}
      {view === "profile" && (
        <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Mein Profil</h1>
          </div>

          {/* Avatar + Info */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-white/[0.08] flex items-center justify-center text-3xl font-bold text-violet-300">
                {session?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{session?.name}</h2>
                <p className="text-sm text-white/40">{session?.email}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Kurse gestartet", value: stats.coursesStarted },
              { label: "Videos geschaut", value: stats.videosWatched },
              { label: "Stunden gelernt", value: stats.hoursLearned },
              { label: "Achievements", value: achievements.length },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/30 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Achievements earned */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h3 className="text-lg font-bold mb-4">Meine Achievements</h3>
            <div className="flex flex-wrap gap-3">
              {ACHIEVEMENT_DEFS.map((def) => {
                const earned = achievements.some((a) => a.type === def.type);
                return (
                  <div key={def.type} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                    earned ? `bg-gradient-to-r ${def.color} bg-opacity-10` : "bg-white/[0.03] opacity-30"
                  }`}>
                    <span className={earned ? "text-white" : "text-white/20"}>{getAchievementIcon(def.icon)}</span>
                    <span className={`text-sm ${earned ? "text-white" : "text-white/20"}`}>{def.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logout */}
          <Button onClick={handleLogout} variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl">
            <LogOut className="h-4 w-4 mr-2" />
            Abmelden
          </Button>
        </main>
      )}

      {/* ══════════════════ CERTIFICATE DIALOG ══════════════════ */}
      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border-white/[0.06]" style={{ background: "#0a0a0f" }}>
          <div className="bg-gradient-to-br from-violet-600/10 via-transparent to-indigo-600/10 p-8 sm:p-12">
            <DialogHeader className="sr-only">
              <DialogTitle>Zertifikat</DialogTitle>
              <DialogDescription>Kursabschluss-Zertifikat</DialogDescription>
            </DialogHeader>

            <div className="text-center space-y-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/20">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-violet-400 uppercase tracking-widest font-medium">Zertifikat</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">Kursabschluss</h2>
              </div>
              <div className="w-24 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 mx-auto rounded-full" />
              <div className="space-y-4">
                <p className="text-white/40">Hiermit wird bestatigt, dass</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">{session?.name}</p>
                <p className="text-white/40">den Kurs erfolgreich abgeschlossen hat:</p>
                <p className="text-xl font-semibold text-white">{courses.find((c) => c.id === certificateCourseId)?.title}</p>
              </div>
              <div className="w-24 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 mx-auto rounded-full" />
              <div>
                <p className="text-sm text-white/25">Abgeschlossen am</p>
                <p className="text-white font-medium mt-1">{new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <p className="text-sm text-white/15">Adslift Academy</p>
            </div>

            <div className="flex justify-center mt-8">
              <Button onClick={() => window.print()} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-xl shadow-violet-500/20 h-11 px-8 transition-all duration-300">
                <Printer className="h-4 w-4 mr-2" />
                Herunterladen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

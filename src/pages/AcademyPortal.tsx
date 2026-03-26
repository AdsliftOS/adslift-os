import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Star, StarOff, FileText, Award, BarChart3, Eye, Timer, Bookmark,
  Play, Pause, SkipForward, X, Printer, StickyNote, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";

// --- Types ---
type Course = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  published: boolean;
  category?: string;
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
  section?: string;
};

type LessonProgress = {
  id: string;
  customer_id: string;
  lesson_id: string;
  completed: boolean;
  watched_seconds: number;
};

type CustomerSession = {
  customer_id: string;
  email: string;
  name: string;
};

// --- Views ---
type PortalView = "login" | "dashboard" | "courses" | "course-detail" | "player" | "certificate" | "bookmarks" | "search";

// --- Helpers ---
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

// --- Circular Progress Ring ---
function ProgressRing({ percent, size = 64, strokeWidth = 5, className = "" }: { percent: number; size?: number; strokeWidth?: number; className?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-slate-800" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#progressGradient)" strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-xs font-bold text-white">{percent}%</span>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function AcademyPortal() {
  const [view, setView] = useState<PortalView>("login");
  const [session, setSession] = useState<CustomerSession | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);

  // Navigation
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Bookmarks & Notes
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [currentNote, setCurrentNote] = useState("");
  const [showBookmarksDropdown, setShowBookmarksDropdown] = useState(false);

  // Certificate dialog
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateCourseId, setCertificateCourseId] = useState("");

  // Auto-advance
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // --- LocalStorage helpers ---
  const getBookmarkKey = useCallback(() => session ? `academy_bookmarks_${session.customer_id}` : "", [session]);
  const getNoteKey = useCallback((lessonId: string) => session ? `academy_notes_${session.customer_id}_${lessonId}` : "", [session]);

  const loadBookmarks = useCallback(() => {
    if (!session) return;
    try {
      const stored = localStorage.getItem(getBookmarkKey());
      if (stored) setBookmarks(JSON.parse(stored));
      else setBookmarks([]);
    } catch {
      setBookmarks([]);
    }
  }, [session, getBookmarkKey]);

  const toggleBookmark = useCallback((lessonId: string) => {
    setBookmarks(prev => {
      const next = prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId];
      localStorage.setItem(getBookmarkKey(), JSON.stringify(next));
      return next;
    });
  }, [getBookmarkKey]);

  const loadNote = useCallback((lessonId: string) => {
    if (!session) return "";
    return localStorage.getItem(getNoteKey(lessonId)) || "";
  }, [session, getNoteKey]);

  const saveNote = useCallback((lessonId: string, note: string) => {
    if (!session) return;
    localStorage.setItem(getNoteKey(lessonId), note);
  }, [session, getNoteKey]);

  // Check localStorage on mount
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

  // Load bookmarks when session changes
  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  // Load note when selected lesson changes
  useEffect(() => {
    if (selectedLessonId && session) {
      setCurrentNote(loadNote(selectedLessonId));
    }
  }, [selectedLessonId, session, loadNote]);

  // Load data when session available
  const loadData = useCallback(async () => {
    if (!session) return;
    const [coursesRes, lessonsRes, progressRes] = await Promise.all([
      supabase.from("courses").select("*").eq("published", true).order("created_at", { ascending: false }),
      supabase.from("lessons").select("*").eq("published", true).order("sort_order", { ascending: true }),
      supabase.from("lesson_progress").select("*").eq("customer_id", session.customer_id),
    ]);
    if (coursesRes.data) setCourses(coursesRes.data);
    if (lessonsRes.data) setLessons(lessonsRes.data);
    if (progressRes.data) setProgress(progressRes.data);
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cleanup auto-advance timer
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    };
  }, []);

  // --- Login ---
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
        toast.error("Ungültige Anmeldedaten");
        setLoginLoading(false);
        return;
      }

      if (data.status !== "active") {
        toast.error("Ihr Konto ist abgelaufen. Bitte kontaktieren Sie uns.");
        setLoginLoading(false);
        return;
      }

      if (data.subscription_end) {
        const endDate = new Date(data.subscription_end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate < today) {
          toast.error("Ihr Abonnement ist abgelaufen. Bitte kontaktieren Sie uns.");
          setLoginLoading(false);
          return;
        }
      }

      const customerSession: CustomerSession = {
        customer_id: data.id,
        email: data.email,
        name: data.name,
      };
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
    setShowSearchBar(false);
    setAutoAdvanceCountdown(null);
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
  };

  // --- Progress helpers ---
  const getCourseProgress = useCallback((courseId: string) => {
    const courseLessons = lessons.filter((l) => l.course_id === courseId);
    if (courseLessons.length === 0) return 0;
    const completed = courseLessons.filter((l) => progress.some((p) => p.lesson_id === l.id && p.completed)).length;
    return Math.round((completed / courseLessons.length) * 100);
  }, [lessons, progress]);

  const isLessonCompleted = useCallback((lessonId: string) => {
    return progress.some((p) => p.lesson_id === lessonId && p.completed);
  }, [progress]);

  const isCourseCompleted = useCallback((courseId: string) => {
    return getCourseProgress(courseId) === 100;
  }, [getCourseProgress]);

  const toggleLessonComplete = async (lessonId: string) => {
    if (!session) return;
    const existing = progress.find((p) => p.lesson_id === lessonId);
    if (existing) {
      const newCompleted = !existing.completed;
      await supabase.from("lesson_progress").update({ completed: newCompleted, updated_at: new Date().toISOString() }).eq("id", existing.id);
      setProgress((prev) => prev.map((p) => p.id === existing.id ? { ...p, completed: newCompleted } : p));

      if (newCompleted) {
        startAutoAdvance(lessonId);
      }
    } else {
      const { data } = await supabase.from("lesson_progress").insert({
        customer_id: session.customer_id,
        lesson_id: lessonId,
        completed: true,
        watched_seconds: 0,
      }).select().single();
      if (data) {
        setProgress((prev) => [...prev, data]);
        startAutoAdvance(lessonId);
      }
    }
  };

  const startAutoAdvance = (lessonId: string) => {
    const currentCourse = lessons.find(l => l.id === lessonId)?.course_id;
    if (!currentCourse) return;
    const cLessons = lessons.filter(l => l.course_id === currentCourse);
    const idx = cLessons.findIndex(l => l.id === lessonId);
    if (idx < 0 || idx >= cLessons.length - 1) return;

    const nextLesson = cLessons[idx + 1];
    setAutoAdvanceCountdown(5);

    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    autoAdvanceRef.current = setInterval(() => {
      setAutoAdvanceCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
          autoAdvanceRef.current = null;
          setSelectedLessonId(nextLesson.id);
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

  const updateWatchedSeconds = async (lessonId: string, seconds: number) => {
    if (!session) return;
    const existing = progress.find((p) => p.lesson_id === lessonId);
    if (existing) {
      await supabase.from("lesson_progress").update({ watched_seconds: seconds, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("lesson_progress").insert({
        customer_id: session.customer_id,
        lesson_id: lessonId,
        completed: false,
        watched_seconds: seconds,
      }).select().single();
      if (data) setProgress((prev) => [...prev, data]);
    }
  };

  const logDownload = async (lessonId: string) => {
    if (!session) return;
    await supabase.from("download_logs").insert({
      customer_id: session.customer_id,
      lesson_id: lessonId,
    });
  };

  // --- Derived data ---
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseLessons = useMemo(() => lessons.filter((l) => l.course_id === selectedCourseId), [lessons, selectedCourseId]);
  const selectedLesson = lessons.find((l) => l.id === selectedLessonId);

  // Group lessons into sections
  const sectionedLessons = useMemo(() => {
    const sections: { name: string; lessons: typeof courseLessons }[] = [];
    const sectionMap = new Map<string, typeof courseLessons>();
    for (const lesson of courseLessons) {
      const sectionName = lesson.section || "Lektionen";
      if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, []);
      sectionMap.get(sectionName)!.push(lesson);
    }
    for (const [name, lsns] of sectionMap) {
      sections.push({ name, lessons: lsns });
    }
    return sections;
  }, [courseLessons]);

  // Stats
  const stats = useMemo(() => {
    const coursesStarted = courses.filter(c => {
      const cls = lessons.filter(l => l.course_id === c.id);
      return cls.some(l => progress.some(p => p.lesson_id === l.id));
    }).length;
    const videosWatched = progress.filter(p => p.completed).length;
    const totalMinutes = progress.filter(p => p.completed).reduce((sum, p) => {
      const lesson = lessons.find(l => l.id === p.lesson_id);
      return sum + (lesson?.duration_minutes || 0);
    }, 0);
    const hoursLearned = Math.round((totalMinutes / 60) * 10) / 10;
    const certificates = courses.filter(c => isCourseCompleted(c.id) && lessons.filter(l => l.course_id === c.id).length > 0).length;
    return { coursesStarted, videosWatched, hoursLearned, certificates };
  }, [courses, lessons, progress, isCourseCompleted]);

  // Last watched lesson
  const lastWatched = useMemo(() => {
    const watchedLessons = progress.filter(p => !p.completed && p.watched_seconds > 0);
    if (watchedLessons.length === 0) {
      // Find first incomplete lesson of first course with progress
      for (const course of courses) {
        const cls = lessons.filter(l => l.course_id === course.id);
        const firstIncomplete = cls.find(l => !isLessonCompleted(l.id));
        if (firstIncomplete && cls.some(l => progress.some(p => p.lesson_id === l.id))) {
          return { lesson: firstIncomplete, course };
        }
      }
      return null;
    }
    // most recent watched
    const lastProg = watchedLessons[watchedLessons.length - 1];
    const lesson = lessons.find(l => l.id === lastProg.lesson_id);
    const course = lesson ? courses.find(c => c.id === lesson.course_id) : undefined;
    return lesson && course ? { lesson, course } : null;
  }, [progress, lessons, courses, isLessonCompleted]);

  // Recommended next
  const recommended = useMemo(() => {
    for (const course of courses) {
      const cls = lessons.filter(l => l.course_id === course.id);
      const started = cls.some(l => progress.some(p => p.lesson_id === l.id));
      if (!started && cls.length > 0) return { course, lesson: cls[0] };
    }
    return null;
  }, [courses, lessons, progress]);

  // Overall progress
  const overallProgress = useMemo(() => {
    if (lessons.length === 0) return 0;
    const completed = lessons.filter(l => isLessonCompleted(l.id)).length;
    return Math.round((completed / lessons.length) * 100);
  }, [lessons, isLessonCompleted]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { courses: [] as Course[], lessons: [] as (typeof lessons) };
    const q = searchQuery.toLowerCase();
    const matchedCourses = courses.filter(c =>
      c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
    const matchedLessons = lessons.filter(l =>
      l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q)
    );
    return { courses: matchedCourses, lessons: matchedLessons };
  }, [searchQuery, courses, lessons]);

  // Navigate helper
  const goToPlayer = (courseId: string, lessonId: string) => {
    setSelectedCourseId(courseId);
    setSelectedLessonId(lessonId);
    cancelAutoAdvance();
    setView("player");
  };

  const goToCourseDetail = (courseId: string) => {
    setSelectedCourseId(courseId);
    setView("course-detail");
  };

  // Next lesson in course for player
  const currentLessonIndex = courseLessons.findIndex(l => l.id === selectedLessonId);
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < courseLessons.length - 1 ? courseLessons[currentLessonIndex + 1] : null;
  const prevLesson = currentLessonIndex > 0 ? courseLessons[currentLessonIndex - 1] : null;

  // Bookmarked lessons with course info
  const bookmarkedLessons = useMemo(() => {
    return bookmarks.map(id => {
      const lesson = lessons.find(l => l.id === id);
      const course = lesson ? courses.find(c => c.id === lesson.course_id) : undefined;
      return lesson && course ? { lesson, course } : null;
    }).filter(Boolean) as { lesson: typeof lessons[0]; course: Course }[];
  }, [bookmarks, lessons, courses]);

  // ==================== LOGIN VIEW ====================
  if (view === "login") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <Sonner />
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md relative z-10">
          {/* Logo / Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-6 shadow-2xl shadow-violet-500/30 ring-1 ring-white/10">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Adslift Academy</h1>
            <p className="text-slate-400 mt-3 text-lg">Willkommen zuruck</p>
          </div>

          <Card className="border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 rounded-2xl">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">E-Mail</Label>
                <Input
                  type="email"
                  placeholder="deine@email.de"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-12 rounded-xl text-base"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">Passwort</Label>
                <Input
                  type="password"
                  placeholder="Dein Passwort"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-12 rounded-xl text-base"
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
            </CardContent>
          </Card>

          <p className="text-center text-sm text-slate-600 mt-8">
            Probleme beim Login? Kontaktiere uns unter{" "}
            <a href="mailto:support@adslift.de" className="text-violet-400 hover:text-violet-300 transition-colors">support@adslift.de</a>
          </p>
        </div>
      </div>
    );
  }

  // ==================== PORTAL LAYOUT WRAPPER ====================
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Sonner />

      {/* Fixed Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Logo + Back */}
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
                className="text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Zuruck</span>
              </Button>
            )}
            <button
              onClick={() => { cancelAutoAdvance(); setView("dashboard"); }}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <GraduationCap className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="font-bold text-base text-white hidden sm:block">Adslift Academy</span>
            </button>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Kurse & Lektionen durchsuchen..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim() && view !== "search") setView("search");
                  if (!e.target.value.trim() && view === "search") setView("dashboard");
                }}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 h-10 rounded-xl"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowSearchBar(!showSearchBar);
                if (!showSearchBar) {
                  setSearchQuery("");
                }
              }}
              className="md:hidden text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Bookmarks */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowBookmarksDropdown(!showBookmarksDropdown); }}
                className="text-slate-400 hover:text-yellow-400 hover:bg-white/5 rounded-xl transition-all duration-200 relative"
              >
                <Star className={`h-4 w-4 ${bookmarks.length > 0 ? "text-yellow-400 fill-yellow-400" : ""}`} />
                {bookmarks.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-violet-600 rounded-full text-[10px] font-bold flex items-center justify-center">
                    {bookmarks.length}
                  </span>
                )}
              </Button>

              {showBookmarksDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBookmarksDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-50 p-3">
                    <h3 className="text-sm font-semibold text-white px-2 pb-2 border-b border-white/5 mb-2">Lesezeichen</h3>
                    {bookmarkedLessons.length === 0 ? (
                      <p className="text-sm text-slate-500 px-2 py-4 text-center">Keine Lesezeichen</p>
                    ) : (
                      bookmarkedLessons.map(({ lesson, course }) => (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            goToPlayer(course.id, lesson.id);
                            setShowBookmarksDropdown(false);
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">{lesson.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{course.title}</p>
                        </button>
                      ))
                    )}
                    {bookmarkedLessons.length > 0 && (
                      <button
                        onClick={() => { setView("bookmarks"); setShowBookmarksDropdown(false); }}
                        className="w-full text-center text-xs text-violet-400 hover:text-violet-300 mt-2 py-2 border-t border-white/5 transition-colors"
                      >
                        Alle anzeigen
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-sm font-bold text-violet-300">
                {session?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <span className="text-sm text-slate-300 hidden lg:block max-w-[120px] truncate">{session?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {showSearchBar && (
          <div className="md:hidden px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim() && view !== "search") setView("search");
                  if (!e.target.value.trim() && view === "search") setView("dashboard");
                }}
                autoFocus
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500 h-10 rounded-xl"
              />
            </div>
          </div>
        )}
      </header>

      {/* ==================== DASHBOARD ==================== */}
      {view === "dashboard" && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Greeting */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {getGreeting()},{" "}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                {session?.name?.split(" ")[0]}
              </span>
            </h1>
            <p className="text-slate-400 mt-2 text-lg">Bereit fur die nachste Lektion?</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: BookOpen, label: "Kurse gestartet", value: stats.coursesStarted, color: "from-violet-500/20 to-violet-600/20", iconColor: "text-violet-400" },
              { icon: Eye, label: "Videos geschaut", value: stats.videosWatched, color: "from-blue-500/20 to-blue-600/20", iconColor: "text-blue-400" },
              { icon: Timer, label: "Stunden gelernt", value: stats.hoursLearned, color: "from-emerald-500/20 to-emerald-600/20", iconColor: "text-emerald-400" },
              { icon: Award, label: "Zertifikate", value: stats.certificates, color: "from-amber-500/20 to-amber-600/20", iconColor: "text-amber-400" },
            ].map((stat) => (
              <Card key={stat.label} className="border-white/5 bg-white/[0.03] backdrop-blur-xl rounded-2xl hover:bg-white/[0.05] transition-all duration-300 group">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Continue + Progress Row */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Continue Learning */}
            {lastWatched && (
              <Card className="lg:col-span-2 border-white/5 bg-white/[0.03] backdrop-blur-xl rounded-2xl overflow-hidden group hover:border-violet-500/20 transition-all duration-300">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className="sm:w-64 h-40 sm:h-auto bg-gradient-to-br from-violet-600/30 to-indigo-600/30 relative shrink-0 overflow-hidden">
                      {lastWatched.course.thumbnail_url ? (
                        <img src={lastWatched.course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PlayCircle className="h-12 w-12 text-violet-400/40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/80 hidden sm:block" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 p-6 flex flex-col justify-between">
                      <div>
                        <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 mb-3 text-xs">
                          Zuletzt geschaut
                        </Badge>
                        <h3 className="text-lg font-bold text-white mb-1">{lastWatched.lesson.title}</h3>
                        <p className="text-sm text-slate-400">{lastWatched.course.title}</p>
                      </div>
                      <div className="mt-4">
                        {/* Rough progress bar */}
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style={{ width: `${getCourseProgress(lastWatched.course.id)}%` }} />
                        </div>
                        <Button
                          onClick={() => goToPlayer(lastWatched.course.id, lastWatched.lesson.id)}
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Weiter lernen
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overall Progress Ring */}
            <Card className={`border-white/5 bg-white/[0.03] backdrop-blur-xl rounded-2xl ${!lastWatched ? "lg:col-span-3" : ""}`}>
              <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                <ProgressRing percent={overallProgress} size={120} strokeWidth={8} />
                <h3 className="text-lg font-bold text-white mt-4">Gesamtfortschritt</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {lessons.filter(l => isLessonCompleted(l.id)).length} von {lessons.length} Lektionen
                </p>
                {recommended && (
                  <div className="mt-4 pt-4 border-t border-white/5 w-full">
                    <p className="text-xs text-slate-500 mb-2">Empfohlen</p>
                    <button
                      onClick={() => goToCourseDetail(recommended.course.id)}
                      className="text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium"
                    >
                      {recommended.course.title} &rarr;
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Course Grid */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Deine Kurse</h2>
              <Button
                variant="ghost"
                onClick={() => setView("courses")}
                className="text-violet-400 hover:text-violet-300 hover:bg-white/5 rounded-xl text-sm"
              >
                Alle anzeigen <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((course) => {
                const pct = getCourseProgress(course.id);
                const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
                const totalMin = lessons.filter(l => l.course_id === course.id).reduce((s, l) => s + (l.duration_minutes || 0), 0);
                const completed = isCourseCompleted(course.id) && lessonCount > 0;
                return (
                  <Card
                    key={course.id}
                    className="group border-white/5 bg-white/[0.03] backdrop-blur-xl cursor-pointer transition-all duration-300 overflow-hidden rounded-2xl hover:border-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/5 hover:scale-[1.02]"
                    onClick={() => goToCourseDetail(course.id)}
                  >
                    <div className="relative h-44 overflow-hidden">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                          <BookOpen className="h-14 w-14 text-violet-400/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                      {/* Progress ring overlay */}
                      <div className="absolute bottom-3 right-3">
                        <ProgressRing percent={pct} size={44} strokeWidth={3} />
                      </div>
                      {completed && (
                        <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white border-0 shadow-lg text-xs">
                          <Award className="h-3 w-3 mr-1" />
                          Abgeschlossen
                        </Badge>
                      )}
                      {course.category && (
                        <Badge className="absolute top-3 left-3 bg-white/10 backdrop-blur-md text-white border-white/20 text-xs">
                          {course.category}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors text-base line-clamp-1">{course.title}</h3>
                      {course.description && <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{course.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                        {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatMinutes(totalMin)}</span>}
                      </div>
                      <Button
                        className="w-full mt-2 rounded-xl text-sm h-9 bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 text-white transition-all duration-300"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); goToCourseDetail(course.id); }}
                      >
                        {pct > 0 ? "Fortsetzen" : "Starten"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* ==================== COURSES OVERVIEW ==================== */}
      {view === "courses" && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alle Kurse</h1>
            <p className="text-slate-400 mt-2">Wahle einen Kurs aus, um zu starten</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const pct = getCourseProgress(course.id);
              const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
              const totalMin = lessons.filter(l => l.course_id === course.id).reduce((s, l) => s + (l.duration_minutes || 0), 0);
              const completed = isCourseCompleted(course.id) && lessonCount > 0;
              return (
                <Card
                  key={course.id}
                  className="group border-white/5 bg-white/[0.03] backdrop-blur-xl cursor-pointer transition-all duration-300 overflow-hidden rounded-2xl hover:border-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/5 hover:scale-[1.02]"
                  onClick={() => goToCourseDetail(course.id)}
                >
                  <div className="relative h-44 overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                        <BookOpen className="h-14 w-14 text-violet-400/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    <div className="absolute bottom-3 right-3">
                      <ProgressRing percent={pct} size={44} strokeWidth={3} />
                    </div>
                    {completed && (
                      <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white border-0 shadow-lg text-xs">
                        <Award className="h-3 w-3 mr-1" />
                        Abgeschlossen
                      </Badge>
                    )}
                    {course.category && (
                      <Badge className="absolute top-3 left-3 bg-white/10 backdrop-blur-md text-white border-white/20 text-xs">
                        {course.category}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors text-base line-clamp-1">{course.title}</h3>
                    {course.description && <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{course.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                      {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatMinutes(totalMin)}</span>}
                    </div>
                    <Button
                      className="w-full mt-2 rounded-xl text-sm h-9 bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 text-white transition-all duration-300"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); goToCourseDetail(course.id); }}
                    >
                      {pct > 0 ? "Fortsetzen" : "Starten"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {courses.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-500">
                <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Noch keine Kurse verfugbar</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ==================== COURSE DETAIL ==================== */}
      {view === "course-detail" && selectedCourse && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Hero */}
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0">
              {selectedCourse.thumbnail_url ? (
                <img src={selectedCourse.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-indigo-800/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/60" />
            </div>
            <div className="relative p-8 sm:p-12 flex flex-col sm:flex-row items-start gap-8">
              <div className="flex-1 space-y-4">
                {selectedCourse.category && (
                  <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 text-xs">
                    {selectedCourse.category}
                  </Badge>
                )}
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{selectedCourse.title}</h1>
                {selectedCourse.description && <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">{selectedCourse.description}</p>}
                <div className="flex items-center gap-6 text-sm text-slate-400 pt-2">
                  <span className="flex items-center gap-2"><PlayCircle className="h-4.5 w-4.5" />{courseLessons.length} Lektionen</span>
                  <span className="flex items-center gap-2"><Clock className="h-4.5 w-4.5" />{formatMinutes(courseLessons.reduce((s, l) => s + (l.duration_minutes || 0), 0))}</span>
                  <span className="flex items-center gap-2"><Download className="h-4.5 w-4.5" />{courseLessons.filter(l => l.download_url).length} Downloads</span>
                </div>
                <div className="flex items-center gap-4 pt-4">
                  {courseLessons.length > 0 && (
                    <Button
                      onClick={() => {
                        const firstIncomplete = courseLessons.find(l => !isLessonCompleted(l.id));
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
                      Zertifikat
                    </Button>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <ProgressRing percent={getCourseProgress(selectedCourse.id)} size={140} strokeWidth={10} />
              </div>
            </div>
          </div>

          {/* Sections / Lessons */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Kursinhalt</h2>
            {sectionedLessons.map((section, sIdx) => {
              const sectionKey = `${selectedCourseId}_${section.name}`;
              const isOpen = openSections[sectionKey] !== false; // default open
              const sectionCompleted = section.lessons.every(l => isLessonCompleted(l.id));
              const sectionProgress = section.lessons.length > 0
                ? Math.round((section.lessons.filter(l => isLessonCompleted(l.id)).length / section.lessons.length) * 100)
                : 0;

              return (
                <Collapsible
                  key={sectionKey}
                  open={isOpen}
                  onOpenChange={(open) => setOpenSections(prev => ({ ...prev, [sectionKey]: open }))}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all duration-200 group">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                        <div className="text-left">
                          <h3 className="font-semibold text-white text-sm group-hover:text-violet-300 transition-colors">
                            {sectionedLessons.length > 1 ? `${sIdx + 1}. ${section.name}` : section.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {section.lessons.length} Lektionen &middot; {formatMinutes(section.lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sectionCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        <span className="text-xs text-slate-500 font-medium">{sectionProgress}%</span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1 pl-2">
                      {section.lessons.map((lesson, idx) => {
                        const completed = isLessonCompleted(lesson.id);
                        const isBookmarked = bookmarks.includes(lesson.id);
                        // Calculate a global lesson index for display
                        let globalIdx = 0;
                        for (let si = 0; si < sIdx; si++) globalIdx += sectionedLessons[si].lessons.length;
                        globalIdx += idx + 1;

                        return (
                          <div
                            key={lesson.id}
                            className="group flex items-center gap-4 p-4 rounded-xl hover:bg-white/[0.03] cursor-pointer transition-all duration-200"
                            onClick={() => goToPlayer(selectedCourse.id, lesson.id)}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLessonComplete(lesson.id); }}
                              className="shrink-0 transition-transform duration-200 hover:scale-110"
                            >
                              {completed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <Circle className="h-5 w-5 text-slate-600 group-hover:text-violet-400 transition-colors" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 font-mono w-6">{String(globalIdx).padStart(2, "0")}</span>
                                <h4 className={`font-medium text-sm ${completed ? "text-slate-500 line-through decoration-slate-700" : "text-white"} group-hover:text-violet-300 transition-colors truncate`}>
                                  {lesson.title}
                                </h4>
                              </div>
                              {lesson.description && <p className="text-xs text-slate-500 mt-0.5 truncate pl-8">{lesson.description}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isBookmarked && <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />}
                              {lesson.download_url && (
                                <Badge className="text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 px-1.5 py-0.5">
                                  <Download className="h-2.5 w-2.5 mr-0.5" />{lesson.download_name || "PDF"}
                                </Badge>
                              )}
                              {lesson.duration_minutes > 0 && (
                                <span className="text-xs text-slate-500 tabular-nums">{lesson.duration_minutes}m</span>
                              )}
                              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
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
              <div className="text-center py-16 text-slate-500">
                <Lock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-lg">Noch keine Lektionen verfugbar</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ==================== VIDEO PLAYER ==================== */}
      {view === "player" && selectedLesson && selectedCourse && (
        <main className="max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
            {/* Main Content - Video + Info */}
            <div className="flex-1 lg:w-[70%] overflow-auto">
              <div className="p-4 sm:p-6 space-y-6">
                {/* Video title */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold">{selectedLesson.title}</h1>
                    <p className="text-sm text-slate-400 mt-1">{selectedCourse.title}</p>
                  </div>
                  <button
                    onClick={() => toggleBookmark(selectedLesson.id)}
                    className="p-2 rounded-xl hover:bg-white/5 transition-all duration-200 hover:scale-110 active:scale-95"
                    title={bookmarks.includes(selectedLesson.id) ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
                  >
                    {bookmarks.includes(selectedLesson.id) ? (
                      <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <Star className="h-5 w-5 text-slate-500 hover:text-yellow-400" />
                    )}
                  </button>
                </div>

                {/* Video Player */}
                {selectedLesson.vimeo_id ? (
                  <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ring-white/5" style={{ paddingTop: "56.25%" }}>
                    <iframe
                      src={`https://player.vimeo.com/video/${selectedLesson.vimeo_id}?badge=0&autopause=0&player_id=0&app_id=58479`}
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                      allowFullScreen
                      className="w-full h-full absolute inset-0"
                      onLoad={() => { updateWatchedSeconds(selectedLesson.id, 1); }}
                    />
                  </div>
                ) : (
                  <div className="relative w-full rounded-2xl bg-slate-900 ring-1 ring-white/5 flex items-center justify-center" style={{ paddingTop: "56.25%" }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-slate-500">
                        <PlayCircle className="h-16 w-16 mx-auto mb-3 opacity-20" />
                        <p>Kein Video verfugbar</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-advance banner */}
                {autoAdvanceCountdown !== null && nextLesson && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 animate-pulse">
                    <div className="flex items-center gap-3">
                      <SkipForward className="h-5 w-5 text-violet-400" />
                      <span className="text-sm text-violet-200">
                        Nachstes Video in <span className="font-bold text-white">{autoAdvanceCountdown}s</span>: {nextLesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          cancelAutoAdvance();
                          setSelectedLessonId(nextLesson.id);
                        }}
                        className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs h-8"
                      >
                        Jetzt abspielen
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelAutoAdvance}
                        className="text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs h-8"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions row */}
                <div className="flex flex-wrap items-center gap-3">
                  {selectedLesson.download_url && (
                    <Button
                      onClick={() => {
                        logDownload(selectedLesson.id);
                        window.open(selectedLesson.download_url, "_blank");
                        toast.success("Download gestartet");
                      }}
                      className="bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 text-white rounded-xl transition-all duration-300"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {selectedLesson.download_name || "Download"}
                    </Button>
                  )}
                  <Button
                    onClick={() => toggleLessonComplete(selectedLesson.id)}
                    className={`rounded-xl transition-all duration-300 ${isLessonCompleted(selectedLesson.id)
                      ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/20"
                      : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
                    }`}
                  >
                    {isLessonCompleted(selectedLesson.id) ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" />Abgeschlossen</>
                    ) : (
                      <><Circle className="h-4 w-4 mr-2" />Als abgeschlossen markieren</>
                    )}
                  </Button>
                  {selectedLesson.duration_minutes > 0 && (
                    <span className="text-sm text-slate-500 flex items-center gap-1.5 ml-auto">
                      <Clock className="h-4 w-4" />{selectedLesson.duration_minutes} Min
                    </span>
                  )}
                </div>

                {/* Description */}
                {selectedLesson.description && (
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Beschreibung</h3>
                    <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{selectedLesson.description}</p>
                  </div>
                )}

                {/* Notes */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <StickyNote className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-slate-300">Meine Notizen</h3>
                  </div>
                  <Textarea
                    placeholder="Schreibe hier deine Notizen zu dieser Lektion..."
                    value={currentNote}
                    onChange={(e) => {
                      setCurrentNote(e.target.value);
                      saveNote(selectedLesson.id, e.target.value);
                    }}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl min-h-[100px] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Sidebar - Lesson List */}
            <div className="lg:w-[30%] lg:min-w-[320px] border-l border-white/5 bg-white/[0.01]">
              <div className="sticky top-16 h-[calc(100vh-4rem)] flex flex-col">
                <div className="p-4 border-b border-white/5">
                  <h3 className="font-bold text-white text-sm truncate">{selectedCourse.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {courseLessons.filter(l => isLessonCompleted(l.id)).length}/{courseLessons.length} abgeschlossen
                  </p>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${getCourseProgress(selectedCourse.id)}%` }} />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-0.5">
                    {courseLessons.map((lesson, idx) => {
                      const isCurrent = lesson.id === selectedLessonId;
                      const completed = isLessonCompleted(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            cancelAutoAdvance();
                            setSelectedLessonId(lesson.id);
                          }}
                          className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-start gap-3 ${
                            isCurrent
                              ? "bg-violet-500/10 border border-violet-500/20"
                              : "hover:bg-white/[0.03] border border-transparent"
                          }`}
                        >
                          <div className="shrink-0 mt-0.5">
                            {completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : isCurrent ? (
                              <PlayCircle className="h-4 w-4 text-violet-400" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              isCurrent ? "text-violet-300" : completed ? "text-slate-500" : "text-slate-300 group-hover:text-white"
                            } transition-colors`}>
                              {idx + 1}. {lesson.title}
                            </p>
                            {lesson.duration_minutes > 0 && (
                              <span className="text-xs text-slate-600 mt-0.5 block">{lesson.duration_minutes} Min</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                {nextLesson && (
                  <div className="p-3 border-t border-white/5">
                    <Button
                      onClick={() => {
                        cancelAutoAdvance();
                        setSelectedLessonId(nextLesson.id);
                      }}
                      className="w-full bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 text-white rounded-xl transition-all duration-300 text-sm"
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

      {/* ==================== SEARCH VIEW ==================== */}
      {view === "search" && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Suchergebnisse</h1>
            <p className="text-slate-400 mt-1">
              {searchQuery.trim()
                ? `${searchResults.courses.length + searchResults.lessons.length} Ergebnisse fur "${searchQuery}"`
                : "Gib einen Suchbegriff ein"}
            </p>
          </div>

          {searchResults.courses.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-300">Kurse</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.courses.map(course => (
                  <Card
                    key={course.id}
                    className="border-white/5 bg-white/[0.03] backdrop-blur-xl cursor-pointer rounded-2xl hover:border-violet-500/20 hover:scale-[1.02] transition-all duration-300 group"
                    onClick={() => goToCourseDetail(course.id)}
                  >
                    <CardContent className="p-5">
                      <h3 className="font-bold text-white group-hover:text-violet-300 transition-colors">{course.title}</h3>
                      {course.description && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{course.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {searchResults.lessons.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-300">Lektionen</h2>
              <div className="space-y-2">
                {searchResults.lessons.map(lesson => {
                  const course = courses.find(c => c.id === lesson.course_id);
                  const completed = isLessonCompleted(lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-violet-500/20 cursor-pointer transition-all duration-200 group"
                      onClick={() => course && goToPlayer(course.id, lesson.id)}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                      ) : (
                        <PlayCircle className="h-5 w-5 text-slate-500 group-hover:text-violet-400 shrink-0 transition-colors" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">{lesson.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{course?.title}</p>
                      </div>
                      {lesson.duration_minutes > 0 && (
                        <span className="text-xs text-slate-500">{lesson.duration_minutes}m</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-violet-400 transition-colors shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {searchQuery.trim() && searchResults.courses.length === 0 && searchResults.lessons.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg">Keine Ergebnisse gefunden</p>
              <p className="text-sm mt-1">Versuche einen anderen Suchbegriff</p>
            </div>
          )}
        </main>
      )}

      {/* ==================== BOOKMARKS VIEW ==================== */}
      {view === "bookmarks" && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              Meine Lesezeichen
            </h1>
            <p className="text-slate-400 mt-1">{bookmarkedLessons.length} gespeicherte Lektionen</p>
          </div>

          {bookmarkedLessons.length > 0 ? (
            <div className="space-y-2">
              {bookmarkedLessons.map(({ lesson, course }) => {
                const completed = isLessonCompleted(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-violet-500/20 cursor-pointer transition-all duration-200 group"
                    onClick={() => goToPlayer(course.id, lesson.id)}
                  >
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />
                    {completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : (
                      <PlayCircle className="h-5 w-5 text-slate-500 group-hover:text-violet-400 shrink-0 transition-colors" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">{lesson.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{course.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(lesson.id); }}
                      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">
              <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg">Keine Lesezeichen</p>
              <p className="text-sm mt-1">Markiere Lektionen mit dem Stern-Icon</p>
            </div>
          )}
        </main>
      )}

      {/* ==================== CERTIFICATE DIALOG ==================== */}
      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className="bg-slate-950 border-white/10 sm:max-w-2xl rounded-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-violet-600/10 via-transparent to-indigo-600/10 p-8 sm:p-12">
            <DialogHeader className="sr-only">
              <DialogTitle>Zertifikat</DialogTitle>
              <DialogDescription>Kursabschluss-Zertifikat</DialogDescription>
            </DialogHeader>

            {/* Certificate content */}
            <div id="certificate-content" className="text-center space-y-8">
              {/* Logo */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/20">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>

              {/* Title */}
              <div>
                <p className="text-sm text-violet-400 uppercase tracking-widest font-medium">Zertifikat</p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 tracking-tight">Kursabschluss</h2>
              </div>

              {/* Divider */}
              <div className="w-24 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 mx-auto rounded-full" />

              {/* Body */}
              <div className="space-y-4">
                <p className="text-slate-400">Hiermit wird bestatigt, dass</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  {session?.name}
                </p>
                <p className="text-slate-400">den Kurs erfolgreich abgeschlossen hat:</p>
                <p className="text-xl font-semibold text-white">
                  {courses.find(c => c.id === certificateCourseId)?.title}
                </p>
              </div>

              {/* Divider */}
              <div className="w-24 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 mx-auto rounded-full" />

              {/* Date */}
              <div>
                <p className="text-sm text-slate-500">Abgeschlossen am</p>
                <p className="text-white font-medium mt-1">
                  {new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              {/* Brand */}
              <div className="pt-4">
                <p className="text-sm text-slate-600">Adslift Academy</p>
              </div>
            </div>

            {/* Action */}
            <div className="flex justify-center mt-8">
              <Button
                onClick={() => window.print()}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-xl shadow-violet-500/20 h-11 px-8 transition-all duration-300"
              >
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

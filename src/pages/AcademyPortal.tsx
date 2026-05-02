import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

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
  User, Settings, ChevronLeft, Sun, Moon, Mail, KeyRound, HelpCircle, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import { LessonSubmissionPanel } from "@/components/LessonSubmissionPanel";

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
  requires_submission?: boolean;
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
  onboarding_completed?: boolean;
};

// ─── Views ───────────────────────────────────────────────────────────────────
type PortalView = "login" | "dashboard" | "courses" | "course-detail" | "player" | "downloads" | "achievements" | "profile" | "search" | "forgot-password";

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

function formatWatchedTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Circular Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ percent, size = 64, strokeWidth = 5, className = "", textClass = "", isDark = true }: { percent: number; size?: number; strokeWidth?: number; className?: string; textClass?: string; isDark?: boolean }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const gradientId = `pg_${size}_${percent}`;
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className={isDark ? "text-white/[0.06]" : "text-gray-200"} />
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
      <span className={`absolute font-bold ${isDark ? "text-white" : "text-gray-900"} ${textClass || (size > 80 ? "text-xl" : size > 50 ? "text-sm" : "text-xs")}`}>{percent}%</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AcademyPortal() {
  const navigate = useNavigate();
  const [view, setView] = useState<PortalView>("login");
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [showKickoffModal, setShowKickoffModal] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("academy_theme") as "dark" | "light") || "dark";
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("academy_theme", next);
  };
  const isDark = theme === "dark";

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCourseId, setPreviewCourseId] = useState("");

  // Mobile search expanded
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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

  // Password change
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Category filter for "Alle Kurse"
  const [courseCategory, setCourseCategory] = useState("Alle");

  // Streak
  const [streakDays, setStreakDays] = useState(0);

  // Video position save ref
  const videoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentVideoSecondsRef = useRef(0);

  // Lesson description collapsed state in player
  const [lessonDescOpen, setLessonDescOpen] = useState(false);

  // ─── Session restore + Preview mode detection ────────────────────────────
  useEffect(() => {
    // Check for preview mode
    const params = new URLSearchParams(window.location.search);
    const previewId = params.get("preview");
    if (previewId) {
      setPreviewMode(true);
      setPreviewCourseId(previewId);
      setSession({ customer_id: "preview", email: "preview@preview.com", name: "Vorschau" });
      setView("course-detail");
      setSelectedCourseId(previewId);
      return;
    }

    const stored = localStorage.getItem("academy_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CustomerSession;
        setSession(parsed);
        if (parsed.onboarding_completed === false) {
          navigate("/onboarding?from=academy", { replace: true });
          return;
        }
        setView("dashboard");
      } catch {
        localStorage.removeItem("academy_session");
      }
    }
  }, [navigate]);

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!session) return;
    if (previewMode) {
      // Preview mode: load courses/chapters/lessons only (no customer data)
      const [coursesRes, chaptersRes, lessonsRes, quizzesRes] = await Promise.all([
        supabase.from("courses").select("*").order("created_at", { ascending: false }),
        supabase.from("chapters").select("*").order("sort_order", { ascending: true }),
        supabase.from("lessons").select("*").order("sort_order", { ascending: true }),
        supabase.from("quizzes").select("*").order("sort_order", { ascending: true }),
      ]);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (chaptersRes.data) setChapters(chaptersRes.data);
      if (lessonsRes.data) setLessons(lessonsRes.data);
      if (quizzesRes.data) setQuizzes(quizzesRes.data);
      return;
    }
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
  }, [session, previewMode]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Streak loader ────────────────────────────────────────────────────────
  const updateStreak = useCallback(async () => {
    if (!session || previewMode) return;
    const { data } = await supabase
      .from("academy_customers")
      .select("last_active_date, streak_days")
      .eq("id", session.customer_id)
      .single();
    if (!data) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastActive = data.last_active_date as string | null;
    let newStreak = data.streak_days ?? 0;
    if (lastActive === today) {
      // Same day - keep
      setStreakDays(newStreak || 1);
      return;
    }
    if (lastActive) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (lastActive === yesterdayStr) {
        newStreak = (newStreak || 0) + 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }
    await supabase.from("academy_customers").update({
      last_active_date: today,
      streak_days: newStreak,
    }).eq("id", session.customer_id);
    setStreakDays(newStreak);
  }, [session, previewMode]);

  useEffect(() => { updateStreak(); }, [updateStreak]);

  // ─── Kickoff-Call Modal: auto-open nach abgeschlossenem Onboarding ────────
  useEffect(() => {
    if (!session || previewMode) return;
    if (!session.onboarding_completed) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("academy_customers")
        .select("kickoff_call_booked")
        .eq("id", session.customer_id)
        .single();
      if (cancelled) return;
      if (data && data.kickoff_call_booked === false) setShowKickoffModal(true);
    })();
    return () => { cancelled = true; };
  }, [session, previewMode]);

  // Calendly-Script laden wenn Modal offen
  useEffect(() => {
    if (!showKickoffModal) return;
    if (document.getElementById("calendly-widget-js")) return;
    const s = document.createElement("script");
    s.id = "calendly-widget-js";
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.head.appendChild(s);
  }, [showKickoffModal]);

  // Booking-Event listener: Calendly postet "calendly.event_scheduled" wenn Kunde gebucht hat
  useEffect(() => {
    if (!showKickoffModal || !session || previewMode) return;
    const handler = async (e: MessageEvent) => {
      const evt = (e.data && typeof e.data === "object") ? (e.data as any).event : null;
      if (evt === "calendly.event_scheduled") {
        await supabase
          .from("academy_customers")
          .update({ kickoff_call_booked: true })
          .eq("id", session.customer_id);
        setTimeout(() => setShowKickoffModal(false), 2500);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [showKickoffModal, session, previewMode]);

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

  // ─── Video position tracking (Vimeo postMessage) ──────────────────────────
  useEffect(() => {
    if (view !== "player" || !selectedLessonId || !session || previewMode) return;

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "playProgress" && typeof msg.data?.seconds === "number") {
            currentVideoSecondsRef.current = Math.floor(msg.data.seconds);
          }
        } catch {
          // ignore non-JSON
        }
      }
    };
    window.addEventListener("message", handleMessage);

    // Save position every 30 seconds
    videoSaveIntervalRef.current = setInterval(async () => {
      const sec = currentVideoSecondsRef.current;
      if (sec <= 0 || !session) return;
      const existing = progress.find((p) => p.lesson_id === selectedLessonId);
      if (existing) {
        await supabase.from("lesson_progress").update({ watched_seconds: sec }).eq("id", existing.id);
        setProgress((prev) => prev.map((p) => p.id === existing.id ? { ...p, watched_seconds: sec } : p));
      }
    }, 30000);

    return () => {
      window.removeEventListener("message", handleMessage);
      if (videoSaveIntervalRef.current) {
        clearInterval(videoSaveIntervalRef.current);
        videoSaveIntervalRef.current = null;
      }
    };
  }, [view, selectedLessonId, session, previewMode, progress]);

  // Reset lesson desc state on lesson change
  useEffect(() => {
    if (selectedLessonId) {
      const lesson = lessons.find((l) => l.id === selectedLessonId);
      setLessonDescOpen(!lesson?.description || lesson.description.length <= 100);
    }
  }, [selectedLessonId, lessons]);

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

      // Update last_login & streak
      const today = new Date().toISOString().slice(0, 10);
      const lastActive = data.last_active_date as string | null;
      let newStreak = data.streak_days ?? 0;
      if (lastActive !== today) {
        if (lastActive) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          if (lastActive === yesterday.toISOString().slice(0, 10)) {
            newStreak = (newStreak || 0) + 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = newStreak || 1;
      }
      await supabase.from("academy_customers").update({
        last_login: new Date().toISOString(),
        last_active_date: today,
        streak_days: newStreak,
      }).eq("id", data.id);
      setStreakDays(newStreak);

      const customerSession: CustomerSession = {
        customer_id: data.id,
        email: data.email,
        name: data.name,
        onboarding_completed: !!data.onboarding_completed,
      };
      localStorage.setItem("academy_session", JSON.stringify(customerSession));
      setSession(customerSession);
      if (!customerSession.onboarding_completed) {
        navigate("/onboarding?from=academy", { replace: true });
        return;
      }
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

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.error("Bitte gib deine E-Mail-Adresse ein");
      return;
    }
    setForgotLoading(true);
    try {
      const { data } = await supabase
        .from("academy_customers")
        .select("id")
        .eq("email", forgotEmail.trim().toLowerCase())
        .single();
      if (data) {
        setForgotMessage("Bitte kontaktiere uns unter info@consulting-og.de um dein Passwort zuruckzusetzen.");
      } else {
        setForgotMessage("Es wurde kein Konto mit dieser E-Mail-Adresse gefunden.");
      }
    } catch {
      setForgotMessage("Es wurde kein Konto mit dieser E-Mail-Adresse gefunden.");
    }
    setForgotLoading(false);
  };

  // ─── Password change ───────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    if (!session) return;
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("Neue Passwörter stimmen nicht überein");
      return;
    }
    if (pwNew.length < 4) {
      toast.error("Neues Passwort muss mindestens 4 Zeichen lang sein");
      return;
    }
    setPwLoading(true);
    try {
      // Check current password
      const { data } = await supabase
        .from("academy_customers")
        .select("id")
        .eq("id", session.customer_id)
        .eq("password_hash", pwCurrent)
        .single();
      if (!data) {
        toast.error("Aktuelles Passwort ist falsch");
        setPwLoading(false);
        return;
      }
      // Update password
      const { error } = await supabase
        .from("academy_customers")
        .update({ password_hash: pwNew })
        .eq("id", session.customer_id);
      if (error) {
        toast.error("Fehler beim Ändern des Passworts");
      } else {
        toast.success("Passwort erfolgreich geändert");
        setPwCurrent("");
        setPwNew("");
        setPwConfirm("");
      }
    } catch {
      toast.error("Ein Fehler ist aufgetreten");
    }
    setPwLoading(false);
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
    // Update streak on lesson completion
    updateStreak();

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
    return { coursesStarted, videosWatched, hoursLearned, streak: streakDays };
  }, [courses, lessons, progress, streakDays]);

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
  if (view === "login" || view === "forgot-password") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: isDark ? "#0a0a0f" : "#f5f5f7" }}>
        <Sonner />
        {/* Animated gradient orbs */}
        {isDark && (
          <>
            <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1.5s" }} />
            <div className="absolute top-2/3 left-1/3 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "3s" }} />
          </>
        )}
        {!isDark && (
          <>
            <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-violet-300/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-300/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1.5s" }} />
          </>
        )}

        <div className="w-full max-w-md relative z-10">
          {/* Logo */}
          <div className="text-center mb-10">
            <img src="/adslift-icon.png" alt="Adslift" className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-3xl" />
            <h1 className={`text-3xl sm:text-4xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>Adslift Academy</h1>
            <p className={`mt-3 text-base sm:text-lg ${isDark ? "text-white/40" : "text-gray-400"}`}>
              {view === "forgot-password" ? "Passwort zurucksetzen" : "Willkommen zuruck"}
            </p>
          </div>

          {view === "forgot-password" ? (
            <div className={`rounded-2xl border backdrop-blur-2xl shadow-2xl p-6 sm:p-8 space-y-6 ${isDark ? "border-white/[0.06] bg-white/[0.03] shadow-black/40" : "border-gray-200 bg-white shadow-gray-200/50"}`}>
              {forgotMessage ? (
                <div className="space-y-4 text-center">
                  <p className={`text-sm leading-relaxed ${isDark ? "text-white/60" : "text-gray-600"}`}>{forgotMessage}</p>
                  <Button
                    onClick={() => { setView("login"); setForgotMessage(""); setForgotEmail(""); }}
                    variant="outline"
                    className={`rounded-xl h-10 ${isDark ? "border-white/10 text-white hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-100"}`}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />Zuruck zum Login
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className={`text-sm font-medium ${isDark ? "text-white/60" : "text-gray-600"}`}>E-Mail</Label>
                    <Input
                      type="email"
                      placeholder="deine@email.de"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                      className={`focus:border-violet-500/50 focus:ring-violet-500/20 h-12 rounded-xl text-base ${isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                    />
                  </div>
                  <Button
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-500/25 rounded-xl text-base font-semibold transition-all duration-300 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {forgotLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Wird gepruft...
                      </span>
                    ) : "Passwort zurucksetzen"}
                  </Button>
                  <button
                    onClick={() => { setView("login"); setForgotEmail(""); setForgotMessage(""); }}
                    className={`w-full text-sm text-center ${isDark ? "text-white/40 hover:text-white/60" : "text-gray-400 hover:text-gray-600"} transition-colors`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 inline mr-1" />Zuruck zum Login
                  </button>
                </>
              )}
            </div>
          ) : (
          <div className={`rounded-2xl border backdrop-blur-2xl shadow-2xl p-6 sm:p-8 space-y-6 ${isDark ? "border-white/[0.06] bg-white/[0.03] shadow-black/40" : "border-gray-200 bg-white shadow-gray-200/50"}`}>
            <div className="space-y-2">
              <Label className={`text-sm font-medium ${isDark ? "text-white/60" : "text-gray-600"}`}>E-Mail</Label>
              <Input
                type="email"
                placeholder="deine@email.de"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className={`focus:border-violet-500/50 focus:ring-violet-500/20 h-12 rounded-xl text-base ${isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className={`text-sm font-medium ${isDark ? "text-white/60" : "text-gray-600"}`}>Passwort</Label>
                <button
                  onClick={() => setView("forgot-password")}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Passwort vergessen?
                </button>
              </div>
              <Input
                type="password"
                placeholder="Dein Passwort"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className={`focus:border-violet-500/50 focus:ring-violet-500/20 h-12 rounded-xl text-base ${isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
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
          )}

          <p className={`text-center text-xs sm:text-sm mt-8 ${isDark ? "text-white/20" : "text-gray-300"}`}>
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
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "text-white" : "text-gray-900"}`} style={{ background: isDark ? "#0a0a0f" : "#f5f5f7" }}>
      <Sonner />

      {/* Background orbs */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-violet-600/[0.04] rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/[0.03] rounded-full blur-[150px]" />
        </div>
      )}

      {/* ── Fixed Header ── */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-2xl ${isDark ? "border-white/[0.04]" : "border-gray-200"}`} style={{ background: isDark ? "rgba(10,10,15,0.8)" : "rgba(255,255,255,0.85)" }}>
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
                className={`rounded-xl transition-all duration-200 ${isDark ? "text-white/40 hover:text-white hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Zuruck</span>
              </Button>
            )}
            <button
              onClick={() => { cancelAutoAdvance(); setView("dashboard"); }}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <img src="/adslift-icon.png" alt="Adslift" className="w-8 h-8 rounded-xl" />
              <span className={`font-bold text-base hidden sm:block ${isDark ? "text-white" : "text-gray-900"}`}>Academy</span>
            </button>
          </div>

          {/* Center: Search (desktop or mobile expanded) */}
          {mobileSearchOpen ? (
            <div className="flex-1 mx-2 md:mx-4 md:max-w-md">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                <Input
                  placeholder="Suchen..."
                  value={searchQuery}
                  autoFocus
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim() && view !== "search") setView("search");
                    if (!e.target.value.trim() && view === "search") setView("dashboard");
                  }}
                  className={`pl-10 pr-8 focus:border-violet-500/40 focus:ring-violet-500/10 h-9 rounded-xl text-sm ${isDark ? "bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                />
                <button onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); if (view === "search") setView("dashboard"); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className={`h-4 w-4 ${isDark ? "text-white/30" : "text-gray-400"}`} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                <Input
                  placeholder="Kurse & Lektionen durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim() && view !== "search") setView("search");
                    if (!e.target.value.trim() && view === "search") setView("dashboard");
                  }}
                  className={`pl-10 focus:border-violet-500/40 focus:ring-violet-500/10 h-10 rounded-xl ${isDark ? "bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                />
              </div>
            </div>
          )}

          {/* Right */}
          <div className={`flex items-center gap-1.5 shrink-0 ${mobileSearchOpen ? "hidden sm:flex" : ""}`}>
            {/* Mobile search toggle */}
            <Button
              variant="ghost" size="sm"
              onClick={() => setMobileSearchOpen(true)}
              className={`md:hidden rounded-xl ${isDark ? "text-white/40 hover:text-white hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Bookmarks */}
            <Button
              variant="ghost" size="sm"
              onClick={() => setView("downloads")}
              className={`rounded-xl gap-1.5 ${isDark ? "text-white/40 hover:text-white hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Skripte & Assets</span>
            </Button>

            {/* User avatar + dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-2 pl-2 ml-1 border-l hover:opacity-80 transition-opacity ${isDark ? "border-white/[0.06]" : "border-gray-200"}`}
              >
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border flex items-center justify-center text-sm font-bold text-violet-300 ${isDark ? "border-white/[0.08]" : "border-gray-200"}`}>
                  {session?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <span className={`text-sm hidden lg:block max-w-[100px] truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>{session?.name?.split(" ")[0]}</span>
                <ChevronDown className={`h-3 w-3 hidden lg:block ${isDark ? "text-white/30" : "text-gray-400"}`} />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border backdrop-blur-2xl shadow-2xl z-50 py-2 overflow-hidden ${isDark ? "border-white/[0.06] bg-[#12121a]/95" : "border-gray-200 bg-white/98"}`} style={{ background: isDark ? "rgba(10,10,15,0.95)" : "rgba(255,255,255,0.98)" }}>
                    <div className={`px-4 py-3 border-b ${isDark ? "border-white/[0.04]" : "border-gray-100"}`}>
                      <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{session?.name}</p>
                      <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{session?.email}</p>
                    </div>
                    {[
                      { label: "Profil", icon: User, view: "profile" as PortalView },
                      { label: "Achievements", icon: Award, view: "achievements" as PortalView },
                      { label: "Downloads", icon: Download, view: "downloads" as PortalView },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => { setView(item.view); setShowUserMenu(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? "text-white/60 hover:text-white hover:bg-white/[0.04]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    ))}
                    <div className={`border-t mt-1 pt-1 ${isDark ? "border-white/[0.04]" : "border-gray-100"}`}>
                      <button
                        onClick={() => { toggleTheme(); setShowUserMenu(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? "text-white/60 hover:text-white hover:bg-white/[0.04]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                      >
                        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        {isDark ? "Light Mode" : "Dark Mode"}
                      </button>
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

      {/* Preview mode banner */}
      {previewMode && (
        <div className="sticky top-16 z-40 bg-amber-500/90 text-white text-center py-2 px-4 text-sm font-medium">
          <Eye className="h-4 w-4 inline mr-2" />
          Vorschau-Modus — Nur zur Ansicht. Keine Daten werden gespeichert.
          <button onClick={() => window.close()} className="ml-4 underline hover:no-underline text-xs">Schliessen</button>
        </div>
      )}

      {/* ══════════════════ DASHBOARD ══════════════════ */}
      {view === "dashboard" && (
        <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
          {/* Greeting */}
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              {getGreeting()},{" "}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                {session?.name?.split(" ")[0]}
              </span>
            </h1>
            <p className={`mt-2 text-lg ${isDark ? "text-white/30" : "text-gray-400"}`}>Dein nachster Erfolg wartet auf dich.</p>
          </div>

          {/* Continue Learning */}
          {lastWatched && (
            <div className={`rounded-2xl border backdrop-blur-xl overflow-hidden group hover:border-violet-500/20 transition-all duration-300 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-72 h-44 sm:h-auto bg-gradient-to-br from-violet-600/20 to-indigo-600/20 relative shrink-0 overflow-hidden">
                  {lastWatched.course.thumbnail_url ? (
                    <img src={lastWatched.course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayCircle className="h-14 w-14 text-violet-400/30" />
                    </div>
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent hidden sm:block ${isDark ? "to-[#0a0a0f]/80" : "to-white/80"}`} />
                </div>
                <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 mb-3 text-xs">
                      Weiter lernen
                    </Badge>
                    <h3 className={`text-xl font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>{lastWatched.lesson.title}</h3>
                    <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>{lastWatched.course.title}</p>
                  </div>
                  <div className="mt-5">
                    <div className={`h-1.5 rounded-full overflow-hidden mb-5 ${isDark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
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
                className={`rounded-2xl border backdrop-blur-xl p-5 transition-all duration-300 group ${isDark ? "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]" : "border-gray-200 bg-white hover:bg-gray-100"}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{stat.value}</p>
                <p className={`text-sm mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Overall Progress + Achievements */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Overall Progress */}
            <div className={`rounded-2xl border backdrop-blur-xl p-8 flex flex-col items-center justify-center text-center ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
              <ProgressRing percent={overallProgress} size={140} strokeWidth={10} textClass="text-2xl" isDark={isDark} />
              <h3 className={`text-lg font-bold mt-5 ${isDark ? "text-white" : "text-gray-900"}`}>Gesamtfortschritt</h3>
              <p className={`text-sm mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                {lessons.filter((l) => isLessonCompleted(l.id)).length} von {lessons.length} Lektionen
              </p>
            </div>

            {/* Achievements preview */}
            <div className={`lg:col-span-2 rounded-2xl border backdrop-blur-xl p-6 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Achievements</h3>
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
                          : isDark ? "bg-white/[0.04] border border-white/[0.06]" : "bg-gray-100 border border-gray-200"
                      }`}>
                        <span className={earned ? "text-white" : isDark ? "text-white/20" : "text-gray-300"}>
                          {getAchievementIcon(def.icon)}
                        </span>
                      </div>
                      <span className={`text-xs text-center leading-tight ${earned ? (isDark ? "text-white/60" : "text-gray-600") : (isDark ? "text-white/20" : "text-gray-300")}`}>{def.label}</span>
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
            <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((course) => {
                const pct = getCourseProgress(course.id);
                const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
                const totalMin = lessons.filter((l) => l.course_id === course.id).reduce((s, l) => s + (l.duration_minutes || 0), 0);
                return (
                  <div
                    key={course.id}
                    className={`group rounded-2xl border backdrop-blur-xl cursor-pointer transition-all duration-300 overflow-hidden hover:border-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/[0.06] hover:scale-[1.02] ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}
                    onClick={() => goToCourseDetail(course.id)}
                  >
                    <div className="relative h-44 overflow-hidden bg-gradient-to-br from-violet-600/20 to-indigo-600/20">
                      {!course.thumbnail_url && (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-14 w-14 text-violet-400/20" />
                        </div>
                      )}
                      {course.thumbnail_url && course.thumbnail_url.startsWith("http") && (
                        <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${isDark ? "from-[#0a0a0f]" : "from-white"}`} />
                      {course.category && (
                        <Badge className={`absolute top-3 left-3 backdrop-blur-md text-xs z-10 ${isDark ? "bg-white/10 text-white border-white/20" : "bg-black/10 text-white border-white/30"}`}>
                          {course.category}
                        </Badge>
                      )}
                    </div>
                    <div className="p-5 space-y-3">
                      <h3 className={`font-bold group-hover:text-violet-300 transition-colors text-base line-clamp-1 ${isDark ? "text-white" : "text-gray-900"}`}>{course.title}</h3>
                      {course.description && <p className={`text-sm line-clamp-2 leading-relaxed ${isDark ? "text-white/30" : "text-gray-400"}`}>{course.description}</p>}
                      <div className={`flex items-center gap-4 text-xs pt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>
                        <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                        {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatMinutes(totalMin)}</span>}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <ProgressRing percent={pct} size={44} strokeWidth={3} textClass="text-[9px]" isDark={isDark} />
                          {pct === 100 && lessonCount > 0 && (
                            <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Fertig
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        className={`w-full mt-2 rounded-xl text-sm h-9 hover:bg-violet-600 border hover:border-violet-500 transition-all duration-300 ${isDark ? "bg-white/[0.04] border-white/[0.06] text-white" : "bg-gray-100 border-gray-200 text-gray-900 hover:text-white"}`}
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
        <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alle Kurse</h1>
            <p className={`mt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Wahle einen Kurs aus, um zu starten</p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {["Alle", "Meta Ads", "Sales", "LinkedIn", "Mindset", "Allgemein"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCourseCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                  courseCategory === cat
                    ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                    : isDark
                      ? "bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white"
                      : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {cat === "Alle" && <Filter className="h-3.5 w-3.5 inline mr-1.5" />}
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.filter((c) => courseCategory === "Alle" || (c.category || "").toLowerCase() === courseCategory.toLowerCase()).map((course) => {
              const pct = getCourseProgress(course.id);
              const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
              const totalMin = lessons.filter((l) => l.course_id === course.id).reduce((s, l) => s + (l.duration_minutes || 0), 0);
              return (
                <div
                  key={course.id}
                  className={`group rounded-2xl border backdrop-blur-xl cursor-pointer transition-all duration-300 overflow-hidden hover:border-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/[0.06] hover:scale-[1.02] ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}
                  onClick={() => goToCourseDetail(course.id)}
                >
                  <div className="relative h-44 overflow-hidden">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                        <BookOpen className="h-14 w-14 text-violet-400/20" />
                      </div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${isDark ? "from-[#0a0a0f]" : "from-white"}`} />
                    {course.category && (
                      <Badge className={`absolute top-3 left-3 backdrop-blur-md text-xs ${isDark ? "bg-white/10 text-white border-white/20" : "bg-black/10 text-white border-white/30"}`}>{course.category}</Badge>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <h3 className={`font-bold group-hover:text-violet-300 transition-colors text-base line-clamp-1 ${isDark ? "text-white" : "text-gray-900"}`}>{course.title}</h3>
                    {course.description && <p className={`text-sm line-clamp-2 leading-relaxed ${isDark ? "text-white/30" : "text-gray-400"}`}>{course.description}</p>}
                    <div className={`flex items-center gap-4 text-xs pt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>
                      <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                      {totalMin > 0 && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatMinutes(totalMin)}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <ProgressRing percent={pct} size={44} strokeWidth={3} textClass="text-[9px]" isDark={isDark} />
                        {pct === 100 && lessonCount > 0 && (
                          <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Fertig
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      className={`w-full mt-2 rounded-xl text-sm h-9 hover:bg-violet-600 border hover:border-violet-500 transition-all duration-300 ${isDark ? "bg-white/[0.04] border-white/[0.06] text-white" : "bg-gray-100 border-gray-200 text-gray-900 hover:text-white"}`}
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
              <div className={`col-span-full text-center py-20 ${isDark ? "text-white/20" : "text-gray-300"}`}>
                <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Noch keine Kurse verfugbar</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ══════════════════ COURSE DETAIL ══════════════════ */}
      {view === "course-detail" && selectedCourse && (
        <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Hero */}
          <div className={`relative rounded-2xl overflow-hidden border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white border-gray-200"}`}>
            <div className="p-5 sm:p-10 flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              <div className="flex-1 space-y-3 sm:space-y-4">
                {selectedCourse.category && (
                  <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10 text-xs">{selectedCourse.category}</Badge>
                )}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{selectedCourse.title}</h1>
                {selectedCourse.description && <p className={`text-lg leading-relaxed max-w-2xl ${isDark ? "text-white/50" : "text-gray-500"}`}>{selectedCourse.description}</p>}
                <div className={`flex items-center gap-6 text-sm pt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4" />{courseLessons.length} Lektionen</span>
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4" />{formatMinutes(courseLessons.reduce((s, l) => s + (l.duration_minutes || 0), 0))}</span>
                  <span className="flex items-center gap-2"><Download className="h-4 w-4" />{courseLessons.filter((l) => l.download_url).length} Downloads</span>
                </div>
                {/* Progress bar */}
                <div className="max-w-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>{getCourseProgress(selectedCourse.id)}% abgeschlossen</span>
                    <span className={`text-xs ${isDark ? "text-white/20" : "text-gray-300"}`}>{courseLessons.filter((l) => isLessonCompleted(l.id)).length}/{courseLessons.length}</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
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
              <div className={`shrink-0 hidden sm:flex items-center justify-center w-[120px] h-[120px] rounded-2xl border ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-gray-100 border-gray-200"}`}>
                <ProgressRing percent={getCourseProgress(selectedCourse.id)} size={80} strokeWidth={6} textClass="text-lg" isDark={isDark} />
              </div>
            </div>
          </div>

          {/* Course description card */}
          {selectedCourse.description && (
            <div className={`rounded-2xl border p-6 space-y-3 ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-gray-200 bg-gray-50"}`}>
              <h2 className="text-lg font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-violet-400" />Was dich erwartet</h2>
              <p className={`leading-relaxed ${isDark ? "text-white/50" : "text-gray-500"}`}>{selectedCourse.description}</p>
            </div>
          )}

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
                    <button className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group ${isDark ? "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]" : "bg-white border-gray-200 hover:bg-gray-100"}`}>
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDark ? "text-white/30" : "text-gray-400"} ${isOpen ? "" : "-rotate-90"}`} />
                        <div className="text-left">
                          <h3 className={`font-semibold text-sm group-hover:text-violet-300 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>
                            {group.chapter ? `${gIdx + 1}. ${group.chapter.title}` : (chapteredLessons.length > 1 ? "Weitere Lektionen" : "Lektionen")}
                          </h3>
                          <p className={`text-xs mt-0.5 ${isDark ? "text-white/25" : "text-gray-400"}`}>
                            {group.lessons.length} Lektionen &middot; {formatMinutes(group.lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sectionCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        <span className={`text-xs font-medium ${isDark ? "text-white/25" : "text-gray-400"}`}>{sectionProgress}%</span>
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
                            className={`group flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${locked ? "opacity-40 cursor-not-allowed" : (isDark ? "hover:bg-white/[0.03]" : "hover:bg-gray-50") + " cursor-pointer"}`}
                            onClick={() => !locked && goToPlayer(selectedCourse.id, lesson.id)}
                          >
                            <div className="shrink-0">
                              {locked ? (
                                <Lock className={`h-5 w-5 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                              ) : completed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <Circle className={`h-5 w-5 group-hover:text-violet-400 transition-colors ${isDark ? "text-white/20" : "text-gray-300"}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono w-6 ${isDark ? "text-white/15" : "text-gray-300"}`}>{String(idx + 1).padStart(2, "0")}</span>
                                <h4 className={`font-medium text-sm truncate transition-colors ${completed ? (isDark ? "text-white/30 line-through decoration-white/10" : "text-gray-300 line-through decoration-gray-200") : (isDark ? "text-white group-hover:text-violet-300" : "text-gray-900 group-hover:text-violet-600")}`}>
                                  {lesson.title}
                                </h4>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(() => {
                                const prog = progress.find((p) => p.lesson_id === lesson.id);
                                return prog && prog.watched_seconds > 0 && !isLessonCompleted(lesson.id) ? (
                                  <Badge className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/20 px-1.5 py-0.5">
                                    <Play className="h-2.5 w-2.5 mr-0.5" />Fortsetzen ab {formatWatchedTime(prog.watched_seconds)}
                                  </Badge>
                                ) : null;
                              })()}
                              {bookmarked && <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />}
                              {lesson.has_quiz && <Badge className="text-[10px] bg-pink-500/10 text-pink-300 border-pink-500/20 px-1.5 py-0.5">Quiz</Badge>}
                              {lesson.download_url && (
                                <Badge className="text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/20 px-1.5 py-0.5">
                                  <Download className="h-2.5 w-2.5 mr-0.5" />{lesson.download_name || "PDF"}
                                </Badge>
                              )}
                              {lesson.duration_minutes > 0 && <span className={`text-xs tabular-nums ${isDark ? "text-white/20" : "text-gray-300"}`}>{lesson.duration_minutes}m</span>}
                              {!locked && <ChevronRight className={`h-4 w-4 group-hover:text-violet-400 transition-colors ${isDark ? "text-white/15" : "text-gray-300"}`} />}
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
              <div className={`text-center py-16 ${isDark ? "text-white/20" : "text-gray-300"}`}>
                <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Noch keine Lektionen verfugbar</p>
              </div>
            )}
          </div>

          {/* Hast du Fragen? Card */}
          <div className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-center gap-4 ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-gray-200 bg-gray-50"}`}>
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0`}>
              <HelpCircle className="h-6 w-6 text-violet-400" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>Hast du Fragen?</h3>
              <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                Wir helfen dir gerne weiter. Schreib uns jederzeit eine E-Mail.
              </p>
            </div>
            <a
              href="mailto:info@consulting-og.de"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium shadow-lg shadow-violet-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <Mail className="h-4 w-4" />
              info@consulting-og.de
            </a>
          </div>
        </main>
      )}

      {/* ══════════════════ VIDEO PLAYER ══════════════════ */}
      {view === "player" && selectedLesson && selectedCourse && (
        <main className="relative z-10 max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
            {/* Main content (75%) */}
            <div className="flex-1 lg:w-[75%] overflow-auto order-1">
              <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                {/* Breadcrumb */}
                <div className={`flex items-center gap-2 text-xs ${isDark ? "text-white/25" : "text-gray-400"}`}>
                  <button onClick={() => goToCourseDetail(selectedCourse.id)} className="hover:text-violet-400 transition-colors">{selectedCourse.title}</button>
                  <ChevronRight className="h-3 w-3" />
                  {selectedLesson.chapter_id && (() => {
                    const ch = chapters.find((c) => c.id === selectedLesson.chapter_id);
                    return ch ? <><span>{ch.title}</span><ChevronRight className="h-3 w-3" /></> : null;
                  })()}
                  <span className={isDark ? "text-white/40" : "text-gray-500"}>{selectedLesson.title}</span>
                </div>

                {/* Video Player */}
                {getEmbedUrl(selectedLesson.vimeo_id) ? (
                  <div className={`relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/50 ring-1 ${isDark ? "ring-white/[0.06]" : "ring-gray-200"}`} style={{ paddingTop: "56.25%" }}>
                    <iframe
                      src={(() => {
                        const base = getEmbedUrl(selectedLesson.vimeo_id)!;
                        const prog = progress.find((p) => p.lesson_id === selectedLesson.id);
                        const sec = prog?.watched_seconds || 0;
                        const timeHash = sec > 0 ? `#t=${sec}s` : "";
                        return base + timeHash;
                      })()}
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                ) : (
                  <div className={`relative w-full rounded-2xl ring-1 flex items-center justify-center ${isDark ? "bg-white/[0.02] ring-white/[0.06]" : "bg-gray-50 ring-gray-200"}`} style={{ paddingTop: "56.25%" }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`text-center ${isDark ? "text-white/20" : "text-gray-300"}`}>
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
                      <span className={`text-sm ${isDark ? "text-violet-200" : "text-violet-700"}`}>
                        Nachstes Video in <span className={`font-bold ${isDark ? "text-white" : "text-violet-900"}`}>{autoAdvanceCountdown}s</span>: {nextLesson.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => { cancelAutoAdvance(); setSelectedLessonId(nextLesson.id); }} className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs h-8">
                        Jetzt abspielen
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelAutoAdvance} className={`rounded-xl text-xs h-8 ${isDark ? "text-white/40 hover:text-white hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lesson title + duration */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{selectedLesson.title}</h1>
                    {selectedLesson.duration_minutes > 0 && (
                      <Badge className={`mt-2 ${isDark ? "bg-white/[0.04] text-white/40 border-white/[0.06] hover:bg-white/[0.04]" : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-100"}`}>
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
                        : isDark ? "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-yellow-400 hover:border-yellow-500/20" : "bg-white border-gray-200 text-gray-400 hover:text-yellow-400 hover:border-yellow-500/20"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isLessonBookmarked(selectedLesson.id) ? "fill-yellow-400" : ""}`} />
                    Lesezeichen
                  </button>

                  {selectedLesson.download_url && (
                    <button
                      onClick={() => { logDownload(selectedLesson.id); window.open(selectedLesson.download_url, "_blank"); toast.success("Download gestartet"); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 text-sm ${isDark ? "border-white/[0.06] bg-white/[0.03] text-white/40 hover:text-violet-400 hover:border-violet-500/20" : "border-gray-200 bg-white text-gray-400 hover:text-violet-600 hover:border-violet-500/20"}`}
                    >
                      <Download className="h-4 w-4" />
                      {selectedLesson.download_name || "Download"}
                    </button>
                  )}

                  {!selectedLesson.requires_submission && (
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
                  )}
                </div>

                {/* Submission-Panel (wenn Lesson Workbook-Upload erfordert) */}
                {selectedLesson.requires_submission && session && (
                  <LessonSubmissionPanel
                    lessonId={selectedLesson.id}
                    customerId={session.customer_id}
                    isDark={isDark}
                  />
                )}

                {/* Description (Collapsible) */}
                {selectedLesson.description && (
                  <Collapsible open={lessonDescOpen} onOpenChange={setLessonDescOpen}>
                    <div className={`rounded-2xl border ${isDark ? "bg-white/[0.02] border-white/[0.04]" : "bg-gray-50 border-gray-100"}`}>
                      <CollapsibleTrigger asChild>
                        <button className={`w-full flex items-center justify-between p-5 text-left transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-gray-100"} rounded-2xl`}>
                          <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? "text-white/60" : "text-gray-600"}`}>
                            <FileText className="h-4 w-4 text-violet-400" />
                            Beschreibung
                          </h3>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDark ? "text-white/30" : "text-gray-400"} ${lessonDescOpen ? "" : "-rotate-90"}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-5 pb-5">
                          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? "text-white/40" : "text-gray-400"}`}>
                            {selectedLesson.description}
                          </p>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Quiz section */}
                {selectedLesson.has_quiz && lessonQuizzes.length > 0 && isLessonCompleted(selectedLesson.id) && (
                  <div className={`p-5 rounded-2xl border ${isDark ? "bg-white/[0.02] border-white/[0.04]" : "bg-gray-50 border-gray-100"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-4 w-4 text-pink-400" />
                      <h3 className={`text-sm font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Quiz</h3>
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
                            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{qi + 1}. {quiz.question}</p>
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
                                            : isDark ? "bg-white/[0.02] border-white/[0.04] text-white/30" : "bg-gray-50 border-gray-100 text-gray-400"
                                        : isSelected
                                          ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
                                          : isDark ? "bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.04] hover:border-white/[0.1]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300"
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
                <div className={`p-5 rounded-2xl border ${isDark ? "bg-white/[0.02] border-white/[0.04]" : "bg-gray-50 border-gray-100"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <StickyNote className="h-4 w-4 text-violet-400" />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Meine Notizen</h3>
                  </div>
                  <Textarea
                    placeholder="Schreibe hier deine Notizen zu dieser Lektion..."
                    value={currentNote}
                    onChange={(e) => {
                      setCurrentNote(e.target.value);
                      saveNote(selectedLesson.id, e.target.value);
                    }}
                    className={`focus:border-violet-500/40 focus:ring-violet-500/10 rounded-xl min-h-[100px] resize-none ${isDark ? "bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                  />
                </div>

                {/* Comments */}
                <div className={`p-5 rounded-2xl border ${isDark ? "bg-white/[0.02] border-white/[0.04]" : "bg-gray-50 border-gray-100"}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-4 w-4 text-blue-400" />
                    <h3 className={`text-sm font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Kommentare ({lessonComments.length})</h3>
                  </div>
                  {/* Comment list */}
                  {lessonComments.length > 0 && (
                    <div className="space-y-3 mb-4 max-h-[300px] overflow-auto">
                      {lessonComments.map((comment) => (
                        <div key={comment.id} className={`flex gap-3 p-3 rounded-xl ${isDark ? "bg-white/[0.02]" : "bg-white"}`}>
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border flex items-center justify-center text-xs font-bold text-violet-300 shrink-0 ${isDark ? "border-white/[0.06]" : "border-gray-200"}`}>
                            {comment.customer_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isDark ? "text-white/70" : "text-gray-700"}`}>{comment.customer_name}</span>
                              <span className={`text-xs ${isDark ? "text-white/20" : "text-gray-300"}`}>{new Date(comment.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>{comment.content}</p>
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
                      className={`focus:border-violet-500/40 rounded-xl ${isDark ? "bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15" : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
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
                      className={`rounded-xl ${isDark ? "text-white/40 hover:text-white hover:bg-white/[0.05]" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Vorherige Lektion
                    </Button>
                  ) : <div />}
                  {nextLesson && (
                    <Button
                      onClick={() => { cancelAutoAdvance(); setSelectedLessonId(nextLesson.id); }}
                      className={`hover:bg-violet-600 border hover:border-violet-500 rounded-xl transition-all duration-300 ${isDark ? "bg-white/[0.05] border-white/[0.06] text-white" : "bg-gray-100 border-gray-200 text-gray-900 hover:text-white"}`}
                    >
                      Nachste Lektion
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar (25%) — stacks below on mobile */}
            <div className={`lg:w-[25%] lg:min-w-[300px] border-t lg:border-t-0 lg:border-l order-2 ${isDark ? "border-white/[0.04] bg-white/[0.01]" : "border-gray-200 bg-gray-50/50"}`}>
              <div className="lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] flex flex-col max-h-[60vh] lg:max-h-none">
                <div className={`p-4 border-b ${isDark ? "border-white/[0.04]" : "border-gray-200"}`}>
                  <h3 className={`font-bold text-sm truncate ${isDark ? "text-white" : "text-gray-900"}`}>{selectedCourse.title}</h3>
                  <p className={`text-xs mt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>
                    {courseLessons.filter((l) => isLessonCompleted(l.id)).length}/{courseLessons.length} abgeschlossen
                  </p>
                  <div className={`h-1 rounded-full overflow-hidden mt-3 ${isDark ? "bg-white/[0.06]" : "bg-gray-200"}`}>
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
                                : isDark ? "hover:bg-white/[0.03] border border-transparent" : "hover:bg-gray-100 border border-transparent"
                          }`}
                        >
                          <div className="shrink-0 mt-0.5">
                            {locked ? (
                              <Lock className={`h-4 w-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                            ) : completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : isCurrent ? (
                              <PlayCircle className="h-4 w-4 text-violet-400" />
                            ) : (
                              <Circle className={`h-4 w-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate transition-colors ${
                              isCurrent ? "text-violet-300" : completed ? (isDark ? "text-white/30" : "text-gray-300") : (isDark ? "text-white/60 group-hover:text-white" : "text-gray-600 group-hover:text-gray-900")
                            }`}>
                              {idx + 1}. {lesson.title}
                            </p>
                            {lesson.duration_minutes > 0 && (
                              <span className={`text-xs mt-0.5 block ${isDark ? "text-white/15" : "text-gray-300"}`}>{lesson.duration_minutes} Min</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                {nextLesson && (
                  <div className={`p-3 border-t ${isDark ? "border-white/[0.04]" : "border-gray-200"}`}>
                    <Button
                      onClick={() => { cancelAutoAdvance(); setSelectedLessonId(nextLesson.id); }}
                      className={`w-full hover:bg-violet-600 border hover:border-violet-500 rounded-xl transition-all duration-300 text-sm ${isDark ? "bg-white/[0.04] border-white/[0.06] text-white" : "bg-gray-100 border-gray-200 text-gray-900 hover:text-white"}`}
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
        <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Mobile search input */}
          <div className="md:hidden">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-white/20" : "text-gray-300"}`} />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setView("dashboard"); }}
                autoFocus
                className={`pl-10 h-10 rounded-xl ${isDark ? "bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
              />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Suchergebnisse</h1>
            <p className={`mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
              {searchQuery.trim() ? `${searchResults.courses.length + searchResults.lessons.length} Ergebnisse fur "${searchQuery}"` : "Gib einen Suchbegriff ein"}
            </p>
          </div>
          {searchResults.courses.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-lg font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Kurse</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.courses.map((course) => (
                  <div key={course.id} className={`rounded-2xl border backdrop-blur-xl cursor-pointer hover:border-violet-500/20 hover:scale-[1.02] transition-all duration-300 group p-5 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`} onClick={() => goToCourseDetail(course.id)}>
                    <h3 className={`font-bold group-hover:text-violet-300 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>{course.title}</h3>
                    {course.description && <p className={`text-sm mt-1 line-clamp-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>{course.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {searchResults.lessons.length > 0 && (
            <div className="space-y-4">
              <h2 className={`text-lg font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>Lektionen</h2>
              <div className="space-y-2">
                {searchResults.lessons.map((lesson) => {
                  const course = courses.find((c) => c.id === lesson.course_id);
                  return (
                    <div key={lesson.id} className={`flex items-center gap-4 p-4 rounded-xl border hover:border-violet-500/20 cursor-pointer transition-all duration-200 group ${isDark ? "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]" : "bg-gray-50 border-gray-100 hover:bg-gray-100"}`} onClick={() => course && goToPlayer(course.id, lesson.id)}>
                      {isLessonCompleted(lesson.id) ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <PlayCircle className={`h-5 w-5 group-hover:text-violet-400 shrink-0 transition-colors ${isDark ? "text-white/20" : "text-gray-300"}`} />}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium group-hover:text-violet-300 transition-colors truncate ${isDark ? "text-white" : "text-gray-900"}`}>{lesson.title}</h4>
                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/25" : "text-gray-400"}`}>{course?.title}</p>
                      </div>
                      {lesson.duration_minutes > 0 && <span className={`text-xs ${isDark ? "text-white/20" : "text-gray-300"}`}>{lesson.duration_minutes}m</span>}
                      <ChevronRight className={`h-4 w-4 group-hover:text-violet-400 transition-colors shrink-0 ${isDark ? "text-white/15" : "text-gray-300"}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {searchQuery.trim() && searchResults.courses.length === 0 && searchResults.lessons.length === 0 && (
            <div className={`text-center py-20 ${isDark ? "text-white/20" : "text-gray-300"}`}>
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Keine Ergebnisse gefunden</p>
            </div>
          )}
        </main>
      )}

      {/* ══════════════════ DOWNLOADS ══════════════════ */}
      {view === "downloads" && (
        <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Download className="h-6 w-6 text-violet-400" />
              Downloads
            </h1>
            <p className={`mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>{allDownloads.length} Downloads verfugbar</p>
          </div>
          {(() => {
            const grouped: Record<string, { course: Course; downloads: { lesson: Lesson; course: Course }[] }> = {};
            allDownloads.forEach((d) => {
              if (!grouped[d.course.id]) grouped[d.course.id] = { course: d.course, downloads: [] };
              grouped[d.course.id].downloads.push(d);
            });
            return Object.values(grouped).map((group) => (
              <div key={group.course.id} className="space-y-3">
                <h2 className={`text-lg font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>{group.course.title}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.downloads.map((d) => (
                    <div key={d.lesson.id} className={`rounded-xl border p-4 transition-all duration-200 group ${isDark ? "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]" : "border-gray-200 bg-white hover:bg-gray-100"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-gray-900"}`}>{d.lesson.download_name || d.lesson.title}</p>
                          <p className={`text-xs mt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>{d.lesson.title}</p>
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
            <div className={`text-center py-20 ${isDark ? "text-white/20" : "text-gray-300"}`}>
              <Download className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Keine Downloads verfugbar</p>
            </div>
          )}
        </main>
      )}

      {/* ══════════════════ ACHIEVEMENTS ══════════════════ */}
      {view === "achievements" && (
        <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Award className="h-8 w-8 text-amber-400" />
              Achievements
            </h1>
            <p className={`mt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>{achievements.length} von {ACHIEVEMENT_DEFS.length} freigeschaltet</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENT_DEFS.map((def) => {
              const earned = achievements.find((a) => a.type === def.type);
              return (
                <div key={def.type} className={`rounded-2xl border p-6 transition-all duration-300 ${
                  earned
                    ? isDark ? "border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.06] shadow-lg" : "border-gray-200 bg-white hover:bg-gray-50 shadow-lg"
                    : isDark ? "border-white/[0.04] bg-white/[0.01] opacity-50" : "border-gray-100 bg-gray-50 opacity-50"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      earned
                        ? `bg-gradient-to-br ${def.color} shadow-lg ring-2 ring-white/10`
                        : isDark ? "bg-white/[0.04] border border-white/[0.06]" : "bg-gray-100 border border-gray-200"
                    }`}>
                      <span className={earned ? "text-white" : isDark ? "text-white/20" : "text-gray-300"}>
                        {getAchievementIcon(def.icon)}
                      </span>
                    </div>
                    <div>
                      <h3 className={`font-bold ${earned ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-white/30" : "text-gray-400")}`}>{def.label}</h3>
                      <p className={`text-sm mt-0.5 ${earned ? (isDark ? "text-white/50" : "text-gray-500") : (isDark ? "text-white/15" : "text-gray-300")}`}>{def.description}</p>
                      {earned ? (
                        <p className={`text-xs mt-1 ${isDark ? "text-white/25" : "text-gray-400"}`}>Freigeschaltet am {new Date(earned.earned_at).toLocaleDateString("de-DE")}</p>
                      ) : (
                        <p className={`text-xs mt-1 ${isDark ? "text-white/15" : "text-gray-300"}`}>Noch nicht freigeschaltet</p>
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
        <main className="relative z-10 max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Mein Profil</h1>
          </div>

          {/* Avatar + Info */}
          <div className={`rounded-2xl border p-8 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border flex items-center justify-center text-3xl font-bold text-violet-300 ${isDark ? "border-white/[0.08]" : "border-gray-200"}`}>
                {session?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{session?.name}</h2>
                <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-400"}`}>{session?.email}</p>
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
              <div key={s.label} className={`rounded-xl border p-4 text-center ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
                <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{s.value}</p>
                <p className={`text-xs mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Achievements earned */}
          <div className={`rounded-2xl border p-6 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
            <h3 className="text-lg font-bold mb-4">Meine Achievements</h3>
            <div className="flex flex-wrap gap-3">
              {ACHIEVEMENT_DEFS.map((def) => {
                const earned = achievements.some((a) => a.type === def.type);
                return (
                  <div key={def.type} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                    earned ? `bg-gradient-to-r ${def.color} bg-opacity-10` : isDark ? "bg-white/[0.03] opacity-30" : "bg-gray-100 opacity-30"
                  }`}>
                    <span className={earned ? "text-white" : isDark ? "text-white/20" : "text-gray-300"}>{getAchievementIcon(def.icon)}</span>
                    <span className={`text-sm ${earned ? "text-white" : isDark ? "text-white/20" : "text-gray-300"}`}>{def.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Password Change */}
          <div className={`rounded-2xl border p-6 space-y-4 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-violet-400" />
              <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Passwort ändern</h3>
            </div>
            <div className="space-y-3 max-w-md">
              <div className="space-y-1.5">
                <Label className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Aktuelles Passwort</Label>
                <Input
                  type="password"
                  placeholder="Aktuelles Passwort"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className={`h-10 rounded-xl ${isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Neues Passwort</Label>
                <Input
                  type="password"
                  placeholder="Neues Passwort"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className={`h-10 rounded-xl ${isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>Neues Passwort bestätigen</Label>
                <Input
                  type="password"
                  placeholder="Passwort wiederholen"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
                  className={`h-10 rounded-xl ${isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300"}`}
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={pwLoading}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-violet-500/20 h-10 px-6 transition-all duration-300"
              >
                {pwLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Wird gespeichert...
                  </span>
                ) : "Passwort ändern"}
              </Button>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className={`rounded-2xl border p-6 flex items-center justify-between ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-gray-200 bg-white"}`}>
            <div>
              <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Erscheinungsbild</h3>
              <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>{isDark ? "Dark Mode aktiv" : "Light Mode aktiv"}</p>
            </div>
            <Button onClick={toggleTheme} variant="outline" className={`rounded-xl gap-2 ${isDark ? "border-white/10 text-white hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-100"}`}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </Button>
          </div>

          {/* Logout */}
          <Button onClick={handleLogout} variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl">
            <LogOut className="h-4 w-4 mr-2" />
            Abmelden
          </Button>
        </main>
      )}

      {/* ══════════════════ KICKOFF-CALL DIALOG ══════════════════ */}
      <Dialog open={showKickoffModal} onOpenChange={setShowKickoffModal}>
        <DialogContent
          className="sm:max-w-5xl rounded-2xl p-0 overflow-hidden border-0"
          style={{ background: "#ffffff", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
        >
          <div className="p-6 sm:p-8" style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb" }}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                Letzter Schritt
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-gray-900">
                Buch dir deinen Kickoff-Call mit Alex
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                Wir gehen gemeinsam dein Onboarding durch und planen die nächsten Schritte. Dauer: 45–60 Min.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ background: "#ffffff", padding: 0, margin: 0 }}>
            <div
              className="calendly-inline-widget"
              data-url="https://calendly.com/consulting-og-info/kickoff-call-alex-adslift?primary_color=6366f1&hide_gdpr_banner=1"
              style={{ minWidth: 320, height: 720, background: "#ffffff" }}
            />
          </div>
          <div className="p-4 flex justify-end" style={{ background: "#ffffff", borderTop: "1px solid #e5e7eb" }}>
            <Button variant="ghost" onClick={() => setShowKickoffModal(false)} className="text-gray-600 hover:text-gray-900">
              Später buchen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ CERTIFICATE DIALOG ══════════════════ */}
      <Dialog open={showCertificate} onOpenChange={setShowCertificate}>
        <DialogContent className={`sm:max-w-2xl rounded-2xl p-0 overflow-hidden ${isDark ? "border-white/[0.06]" : "border-gray-200"}`} style={{ background: isDark ? "#0a0a0f" : "#ffffff" }}>
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
                <h2 className={`text-3xl sm:text-4xl font-bold mt-2 tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>Kursabschluss</h2>
              </div>
              <div className="w-24 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 mx-auto rounded-full" />
              <div className="space-y-4">
                <p className={isDark ? "text-white/40" : "text-gray-400"}>Hiermit wird bestatigt, dass</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">{session?.name}</p>
                <p className={isDark ? "text-white/40" : "text-gray-400"}>den Kurs erfolgreich abgeschlossen hat:</p>
                <p className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{courses.find((c) => c.id === certificateCourseId)?.title}</p>
              </div>
              <div className="w-24 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 mx-auto rounded-full" />
              <div>
                <p className={`text-sm ${isDark ? "text-white/25" : "text-gray-400"}`}>Abgeschlossen am</p>
                <p className={`font-medium mt-1 ${isDark ? "text-white" : "text-gray-900"}`}>{new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <p className={`text-sm ${isDark ? "text-white/15" : "text-gray-300"}`}>Adslift Academy</p>
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

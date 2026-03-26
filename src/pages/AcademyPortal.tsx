import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap, PlayCircle, CheckCircle2, Circle, Download, ArrowLeft,
  LogOut, BookOpen, Clock, Lock, ChevronRight,
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
type PortalView = "login" | "courses" | "course-detail" | "lesson";

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

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("academy_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CustomerSession;
        setSession(parsed);
        setView("courses");
      } catch {
        localStorage.removeItem("academy_session");
      }
    }
  }, []);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      setView("courses");
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
  };

  // --- Progress helpers ---
  const getCourseProgress = (courseId: string) => {
    const courseLessons = lessons.filter((l) => l.course_id === courseId);
    if (courseLessons.length === 0) return 0;
    const completed = courseLessons.filter((l) => progress.some((p) => p.lesson_id === l.id && p.completed)).length;
    return Math.round((completed / courseLessons.length) * 100);
  };

  const isLessonCompleted = (lessonId: string) => {
    return progress.some((p) => p.lesson_id === lessonId && p.completed);
  };

  const toggleLessonComplete = async (lessonId: string) => {
    if (!session) return;
    const existing = progress.find((p) => p.lesson_id === lessonId);
    if (existing) {
      const newCompleted = !existing.completed;
      await supabase.from("lesson_progress").update({ completed: newCompleted, updated_at: new Date().toISOString() }).eq("id", existing.id);
      setProgress((prev) => prev.map((p) => p.id === existing.id ? { ...p, completed: newCompleted } : p));
    } else {
      const { data } = await supabase.from("lesson_progress").insert({
        customer_id: session.customer_id,
        lesson_id: lessonId,
        completed: true,
        watched_seconds: 0,
      }).select().single();
      if (data) setProgress((prev) => [...prev, data]);
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

  // --- Current selections ---
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseLessons = lessons.filter((l) => l.course_id === selectedCourseId);
  const selectedLesson = lessons.find((l) => l.id === selectedLessonId);

  // ==================== LOGIN VIEW ====================
  if (view === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Sonner />
        <div className="w-full max-w-md">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-4 shadow-lg shadow-violet-500/25">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Adslift Academy</h1>
            <p className="text-slate-400 mt-2">Zugang zu deinen Kursen & Playbooks</p>
          </div>

          <Card className="border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300">E-Mail</Label>
                <Input
                  type="email"
                  placeholder="deine@email.de"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Passwort</Label>
                <Input
                  type="password"
                  placeholder="Dein Passwort"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>
              <Button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25"
              >
                {loginLoading ? "Wird geprüft..." : "Anmelden"}
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-slate-600 mt-6">
            Probleme beim Login? Kontaktiere uns unter support@adslift.de
          </p>
        </div>
      </div>
    );
  }

  // ==================== PORTAL LAYOUT WRAPPER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Sonner />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== "courses" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (view === "lesson") setView("course-detail");
                  else setView("courses");
                }}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />Zurück
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-sm text-white hidden sm:block">Adslift Academy</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">Hallo, {session?.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* ==================== COURSES OVERVIEW ==================== */}
        {view === "courses" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold">Deine Kurse</h1>
              <p className="text-slate-400 mt-1">Wähle einen Kurs aus, um zu starten</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const pct = getCourseProgress(course.id);
                const lessonCount = lessons.filter((l) => l.course_id === course.id).length;
                return (
                  <Card
                    key={course.id}
                    className="group border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer transition-all duration-200 overflow-hidden hover:border-slate-700 hover:shadow-xl hover:shadow-violet-500/5"
                    onClick={() => { setSelectedCourseId(course.id); setView("course-detail"); }}
                  >
                    {course.thumbnail_url ? (
                      <div className="h-40 overflow-hidden bg-slate-800">
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="h-40 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-violet-400/40" />
                      </div>
                    )}
                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">{course.title}</h3>
                      {course.description && <p className="text-sm text-slate-400 line-clamp-2">{course.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{lessonCount} Lektionen</span>
                      </div>
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400">Fortschritt</span>
                          <span className="text-violet-400 font-medium">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {courses.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Noch keine Kurse verfügbar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== COURSE DETAIL ==================== */}
        {view === "course-detail" && selectedCourse && (
          <div className="space-y-6">
            {/* Course header */}
            <div className="flex flex-col sm:flex-row gap-6">
              {selectedCourse.thumbnail_url && (
                <div className="w-full sm:w-72 h-44 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                  <img src={selectedCourse.thumbnail_url} alt={selectedCourse.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 space-y-3">
                <h1 className="text-2xl font-bold">{selectedCourse.title}</h1>
                {selectedCourse.description && <p className="text-slate-400">{selectedCourse.description}</p>}
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><PlayCircle className="h-4 w-4" />{courseLessons.length} Lektionen</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{courseLessons.reduce((s, l) => s + (l.duration_minutes || 0), 0)} min</span>
                </div>
                <div className="pt-2">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-400">Kursfortschritt</span>
                    <span className="text-violet-400 font-semibold">{getCourseProgress(selectedCourse.id)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${getCourseProgress(selectedCourse.id)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Lessons list */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold mb-4">Lektionen</h2>
              {courseLessons.map((lesson, idx) => {
                const completed = isLessonCompleted(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 cursor-pointer transition-all"
                    onClick={() => { setSelectedLessonId(lesson.id); setView("lesson"); }}
                  >
                    {/* Completion indicator */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLessonComplete(lesson.id); }}
                      className="shrink-0"
                    >
                      {completed ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <Circle className="h-6 w-6 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      )}
                    </button>

                    {/* Lesson info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 font-mono">{String(idx + 1).padStart(2, "0")}</span>
                        <h3 className={`font-medium text-sm ${completed ? "text-slate-400" : "text-white"} group-hover:text-violet-300 transition-colors`}>
                          {lesson.title}
                        </h3>
                      </div>
                      {lesson.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{lesson.description}</p>}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 shrink-0">
                      {lesson.download_url && (
                        <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                          <Download className="h-3 w-3 mr-1" />{lesson.download_name || "PDF"}
                        </Badge>
                      )}
                      {lesson.duration_minutes > 0 && (
                        <span className="text-xs text-slate-500">{lesson.duration_minutes} min</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
              {courseLessons.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Lock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Noch keine Lektionen verfügbar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== LESSON / VIDEO VIEW ==================== */}
        {view === "lesson" && selectedLesson && (
          <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <button onClick={() => setView("courses")} className="hover:text-slate-300 transition-colors">Kurse</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <button onClick={() => setView("course-detail")} className="hover:text-slate-300 transition-colors">{selectedCourse?.title}</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-white">{selectedLesson.title}</span>
            </div>

            {/* Video Player */}
            {selectedLesson.vimeo_id ? (
              <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/50" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={`https://player.vimeo.com/video/${selectedLesson.vimeo_id}?badge=0&autopause=0&player_id=0`}
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  onLoad={() => {
                    // Track that user opened the video
                    updateWatchedSeconds(selectedLesson.id, 1);
                  }}
                />
              </div>
            ) : (
              <div className="w-full rounded-xl bg-slate-800 flex items-center justify-center" style={{ paddingTop: "56.25%", position: "relative" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <PlayCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Kein Video verfügbar</p>
                  </div>
                </div>
              </div>
            )}

            {/* Lesson info & actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-xl font-bold">{selectedLesson.title}</h1>
                {selectedLesson.description && <p className="text-slate-400">{selectedLesson.description}</p>}
                {selectedLesson.duration_minutes > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Clock className="h-4 w-4" />
                    {selectedLesson.duration_minutes} Minuten
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {selectedLesson.download_url && (
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                    onClick={() => {
                      logDownload(selectedLesson.id);
                      window.open(selectedLesson.download_url, "_blank");
                      toast.success("Download gestartet");
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {selectedLesson.download_name || "Download"}
                  </Button>
                )}
                <Button
                  onClick={() => toggleLessonComplete(selectedLesson.id)}
                  className={isLessonCompleted(selectedLesson.id)
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                  }
                >
                  {isLessonCompleted(selectedLesson.id) ? (
                    <><CheckCircle2 className="h-4 w-4 mr-2" />Abgeschlossen</>
                  ) : (
                    <><Circle className="h-4 w-4 mr-2" />Als erledigt markieren</>
                  )}
                </Button>
              </div>
            </div>

            {/* Next/Prev lesson navigation */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              {(() => {
                const currentIdx = courseLessons.findIndex((l) => l.id === selectedLessonId);
                const prevLesson = currentIdx > 0 ? courseLessons[currentIdx - 1] : null;
                const nextLesson = currentIdx < courseLessons.length - 1 ? courseLessons[currentIdx + 1] : null;
                return (
                  <>
                    {prevLesson ? (
                      <Button
                        variant="ghost"
                        className="text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={() => setSelectedLessonId(prevLesson.id)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {prevLesson.title}
                      </Button>
                    ) : <div />}
                    {nextLesson ? (
                      <Button
                        variant="ghost"
                        className="text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={() => setSelectedLessonId(nextLesson.id)}
                      >
                        {nextLesson.title}
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : <div />}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

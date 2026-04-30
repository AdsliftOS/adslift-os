import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, FileCheck2, Clock, Rocket, ExternalLink, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";

type AcademyCustomer = { id: string; name: string; email: string; status: string; password_hash: string | null };
type Course = { id: string; title: string; is_published: boolean };
type Lesson = { id: string; course_id: string; title: string; is_published: boolean; requires_submission: boolean | null };
type Progress = { lesson_id: string; completed: boolean };
type Submission = { id: string; lesson_id: string; status: string; submitted_at: string | null };

export function CustomerAcademyOverview({ clientId, clientEmail, clientName }: { clientId: string; clientEmail: string; clientName: string }) {
  const [academyCustomer, setAcademyCustomer] = useState<AcademyCustomer | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data: ac } = await supabase
      .from("academy_customers")
      .select("id, name, email, status, password_hash")
      .eq("client_id", clientId)
      .maybeSingle();
    setAcademyCustomer(ac ?? null);

    if (ac) {
      const [c, l, p, s] = await Promise.all([
        supabase.from("courses").select("id, title, is_published"),
        supabase.from("lessons").select("id, course_id, title, is_published, requires_submission"),
        supabase.from("lesson_progress").select("lesson_id, completed").eq("customer_id", ac.id),
        supabase.from("lesson_submissions").select("id, lesson_id, status, submitted_at").eq("customer_id", ac.id).order("submitted_at", { ascending: false }),
      ]);
      setCourses(c.data ?? []);
      setLessons(l.data ?? []);
      setProgress(p.data ?? []);
      setSubmissions(s.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [clientId]);

  const handleStartOnboarding = async () => {
    if (!clientEmail) { toast.error("Kunde hat keine Email"); return; }
    setStarting(true);
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from("academy_customers").insert({
      name: clientName,
      email: clientEmail.toLowerCase(),
      password_hash: tempPassword,
      company: clientName,
      status: "active",
      client_id: clientId,
    });
    if (error) {
      toast.error("Fehler: " + error.message);
      setStarting(false);
      return;
    }

    // Set client status to Active so it shows up in onboarding flow
    await supabase.from("clients").update({ status: "Active" }).eq("id", clientId);

    // Copy login info to clipboard
    const academyUrl = `${window.location.origin}/academy`;
    const loginInfo = `🚀 Adslift Academy — dein Onboarding ist bereit\n\nLogin: ${academyUrl}\nEmail: ${clientEmail}\nPasswort: ${tempPassword}`;
    await navigator.clipboard.writeText(loginInfo).catch(() => {});

    toast.success("Onboarding gestartet 🚀", {
      description: `Login-Daten in Zwischenablage. Passwort: ${tempPassword}`,
      duration: 8000,
    });
    setStarting(false);
    await reload();
  };

  const copyLogin = () => {
    if (!academyCustomer) return;
    const academyUrl = `${window.location.origin}/academy`;
    const loginInfo = `Login: ${academyUrl}\nEmail: ${academyCustomer.email}${academyCustomer.password_hash ? `\nPasswort: ${academyCustomer.password_hash}` : ""}`;
    navigator.clipboard.writeText(loginInfo);
    toast.success("Login-Daten kopiert");
  };

  if (loading) {
    return <Card><CardContent className="p-5 text-sm text-muted-foreground">Lade Onboarding-Daten ...</CardContent></Card>;
  }

  // ── State 1: Onboarding noch nicht gestartet ──────────────────────────────
  if (!academyCustomer) {
    return (
      <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardContent className="p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold">Onboarding noch nicht gestartet</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Klick = Academy-Login erstellt, Login-Daten in Zwischenablage. Kunde bekommt Zugang zum Onboarding-Programm.
              </div>
            </div>
          </div>
          <Button onClick={handleStartOnboarding} disabled={starting || !clientEmail} className="gap-1.5 shrink-0 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-700">
            <Rocket className="h-4 w-4" />
            {starting ? "Starte ..." : "Onboarding starten"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── State 2: Onboarding läuft ────────────────────────────────────────────
  const coursesWithProgress = courses
    .map((c) => {
      const cl = lessons.filter((l) => l.course_id === c.id && l.is_published);
      if (cl.length === 0) return null;
      const completed = cl.filter((l) => progress.some((p) => p.lesson_id === l.id && p.completed)).length;
      const pendingSubmissions = cl.filter((l) => l.requires_submission).filter((l) => {
        const sub = submissions.find((s) => s.lesson_id === l.id);
        return sub && (sub.status === "submitted" || sub.status === "feedback_given");
      }).length;
      return { course: c, total: cl.length, completed, pendingSubmissions, pct: Math.round((completed / cl.length) * 100) };
    })
    .filter(Boolean) as { course: Course; total: number; completed: number; pendingSubmissions: number; pct: number }[];

  const submittedCount = submissions.filter((s) => s.status === "submitted").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const totalLessons = lessons.filter((l) => l.is_published).length;
  const totalCompleted = progress.filter((p) => p.completed).length;
  const overallPct = totalLessons ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Check className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Onboarding läuft</h3>
              <p className="text-[11px] text-muted-foreground">{totalCompleted} von {totalLessons} Lektionen · {overallPct}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {submittedCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
                <Clock className="h-3 w-3" /> {submittedCount} Review nötig
              </Badge>
            )}
            <Button onClick={copyLogin} size="sm" variant="outline" className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Login
            </Button>
          </div>
        </div>

        {coursesWithProgress.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine Kurse verfügbar. Leg einen Onboarding-Kurs in Academy an.</p>
        ) : (
          <div className="space-y-2">
            {coursesWithProgress.map(({ course, total, completed, pendingSubmissions, pct }) => (
              <div key={course.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 text-violet-500" />
                    {course.title}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">{completed}/{total}</div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                {pendingSubmissions > 0 && (
                  <div className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <FileCheck2 className="h-3 w-3" /> {pendingSubmissions} Workbook(s) warten auf Review
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
          <span className="truncate">Login: {academyCustomer.email}</span>
          {approvedCount > 0 && <span className="ml-auto text-emerald-600">{approvedCount} approved</span>}
          <a href="/academy" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            Academy <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

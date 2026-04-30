import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, CheckCircle2, Circle, FileCheck2, Clock, MessageSquare, Plus, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type AcademyCustomer = { id: string; name: string; email: string; status: string };
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

  const reload = async () => {
    setLoading(true);
    const { data: ac } = await supabase
      .from("academy_customers")
      .select("id, name, email, status")
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

  const handleCreateAcademy = async () => {
    if (!clientEmail) { toast.error("Client hat keine Email"); return; }
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from("academy_customers").insert({
      name: clientName,
      email: clientEmail.toLowerCase(),
      password_hash: tempPassword, // TODO: hash properly when login is implemented
      company: clientName,
      status: "active",
      client_id: clientId,
    });
    if (error) { toast.error("Fehler: " + error.message); return; }
    toast.success("Academy-Login erstellt", { description: `Passwort: ${tempPassword}` });
    await reload();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">Lade Academy-Daten ...</CardContent>
      </Card>
    );
  }

  if (!academyCustomer) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium">Kein Academy-Login</div>
              <div className="text-xs text-muted-foreground">Erstelle einen damit der Kunde Zugang zum Onboarding-Programm hat.</div>
            </div>
          </div>
          <Button onClick={handleCreateAcademy} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Academy-Login erstellen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Build per-course stats
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

  const totalSubmissions = submissions.length;
  const submittedCount = submissions.filter((s) => s.status === "submitted").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold">Academy</h3>
            <Badge variant="secondary" className="text-[10px]">{academyCustomer.status}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {submittedCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
                <Clock className="h-3 w-3" /> {submittedCount} pending
              </Badge>
            )}
            {approvedCount > 0 && (
              <span className="text-muted-foreground">{approvedCount} approved</span>
            )}
          </div>
        </div>

        {coursesWithProgress.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine Kurse zugewiesen.</p>
        ) : (
          <div className="space-y-2">
            {coursesWithProgress.map(({ course, total, completed, pendingSubmissions, pct }) => (
              <div key={course.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-medium truncate">{course.title}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{completed}/{total}</div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                {pendingSubmissions > 0 && (
                  <div className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <FileCheck2 className="h-3 w-3" /> {pendingSubmissions} Workbook(s) zur Review
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
          <span>Login: {academyCustomer.email}</span>
          <a href="/academy" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            Academy öffnen <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

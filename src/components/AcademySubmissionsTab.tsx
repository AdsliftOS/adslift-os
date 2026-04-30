import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2, Clock, MessageSquare, FileCheck2, Download, Sparkles, Send, FileText, Search,
} from "lucide-react";
import { toast } from "sonner";

type Submission = {
  id: string;
  lesson_id: string;
  customer_id: string;
  file_url: string;
  file_name: string;
  status: "submitted" | "feedback_given" | "approved";
  feedback_loom_url: string | null;
  feedback_text: string | null;
  submitted_at: string | null;
  feedback_at: string | null;
  approved_at: string | null;
};

type LessonLite = { id: string; title: string; course_id: string };
type CustomerLite = { id: string; name: string; email: string; company?: string };
type CourseLite = { id: string; title: string };

const STATUS_META = {
  submitted: { label: "Eingereicht", icon: Clock, tone: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  feedback_given: { label: "Feedback gegeben", icon: MessageSquare, tone: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
} as const;

export default function AcademySubmissionsTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [lessons, setLessons] = useState<LessonLite[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "submitted" | "feedback_given" | "approved">("submitted");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const [fbLoom, setFbLoom] = useState("");
  const [fbText, setFbText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [s, l, c, co] = await Promise.all([
      supabase.from("lesson_submissions").select("*").order("submitted_at", { ascending: false }),
      supabase.from("lessons").select("id, title, course_id"),
      supabase.from("academy_customers").select("id, name, email, company"),
      supabase.from("courses").select("id, title"),
    ]);
    setSubmissions(s.data ?? []);
    setLessons(l.data ?? []);
    setCustomers(c.data ?? []);
    setCourses(co.data ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const lessonById = useMemo(() => {
    const m: Record<string, LessonLite> = {};
    lessons.forEach((l) => { m[l.id] = l; });
    return m;
  }, [lessons]);

  const customerById = useMemo(() => {
    const m: Record<string, CustomerLite> = {};
    customers.forEach((c) => { m[c.id] = c; });
    return m;
  }, [customers]);

  const courseById = useMemo(() => {
    const m: Record<string, CourseLite> = {};
    courses.forEach((c) => { m[c.id] = c; });
    return m;
  }, [courses]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const lesson = lessonById[s.lesson_id]?.title?.toLowerCase() ?? "";
        const customer = customerById[s.customer_id];
        const cName = customer?.name?.toLowerCase() ?? "";
        const cEmail = customer?.email?.toLowerCase() ?? "";
        if (!lesson.includes(q) && !cName.includes(q) && !cEmail.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, filter, search, lessonById, customerById]);

  const counts = useMemo(() => {
    const c = { all: submissions.length, submitted: 0, feedback_given: 0, approved: 0 };
    submissions.forEach((s) => { c[s.status] = (c[s.status] ?? 0) + 1; });
    return c;
  }, [submissions]);

  const openSub = openId ? submissions.find((s) => s.id === openId) ?? null : null;
  const openLesson = openSub ? lessonById[openSub.lesson_id] : null;
  const openCustomer = openSub ? customerById[openSub.customer_id] : null;
  const openCourse = openLesson ? courseById[openLesson.course_id] : null;

  const handleOpen = (s: Submission) => {
    setOpenId(s.id);
    setFbLoom(s.feedback_loom_url ?? "");
    setFbText(s.feedback_text ?? "");
  };

  const sendFeedback = async () => {
    if (!openSub) return;
    if (!fbLoom.trim() && !fbText.trim()) { toast.error("Loom-URL oder Text mindestens"); return; }
    setSubmitting(true);
    await supabase.from("lesson_submissions").update({
      feedback_loom_url: fbLoom.trim() || null,
      feedback_text: fbText.trim() || null,
      status: "feedback_given",
      feedback_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", openSub.id);
    await reload();
    setSubmitting(false);
    toast.success("Feedback an Kunde geschickt");
  };

  const approve = async () => {
    if (!openSub) return;
    setSubmitting(true);
    // 1. Approve submission
    await supabase.from("lesson_submissions").update({
      feedback_loom_url: fbLoom.trim() || null,
      feedback_text: fbText.trim() || null,
      status: "approved",
      approved_at: new Date().toISOString(),
      feedback_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", openSub.id);

    // 2. Set lesson_progress.completed = true (so sequential unlock works)
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("id")
      .eq("lesson_id", openSub.lesson_id)
      .eq("customer_id", openSub.customer_id)
      .maybeSingle();
    if (existing) {
      await supabase.from("lesson_progress").update({
        completed: true,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("lesson_progress").insert({
        lesson_id: openSub.lesson_id,
        customer_id: openSub.customer_id,
        completed: true,
        watched_seconds: 0,
        notes: null,
        bookmarked: false,
      });
    }

    await reload();
    setSubmitting(false);
    setOpenId(null);
    toast.success("Approved — nächste Lektion ist freigeschaltet");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {(["submitted", "feedback_given", "approved", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="gap-1.5"
            >
              {f === "all" ? "Alle" : STATUS_META[f].label}
              <Badge variant="secondary" className="text-[10px] ml-1">
                {f === "all" ? counts.all : counts[f] ?? 0}
              </Badge>
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche Lesson, Kunde, Email ..."
            className="pl-8 w-64"
          />
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Lädt ...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Keine Submissions in diesem Filter.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const lesson = lessonById[s.lesson_id];
            const customer = customerById[s.customer_id];
            const course = lesson ? courseById[lesson.course_id] : null;
            const meta = STATUS_META[s.status];
            const Icon = meta.icon;
            return (
              <button
                key={s.id}
                onClick={() => handleOpen(s)}
                className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                    {course?.title ?? "Course"}
                  </div>
                  <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 border ${meta.tone}`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </div>
                </div>
                <div className="font-semibold text-sm truncate">{lesson?.title ?? "—"}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {customer ? `${customer.name} · ${customer.email}` : s.customer_id}
                </div>
                {s.submitted_at && (
                  <div className="text-[10px] text-muted-foreground mt-2">
                    Eingereicht: {new Date(s.submitted_at).toLocaleString("de-DE")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!openId} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {openSub && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{openLesson?.title ?? "Submission"}</span>
                  <Badge variant="outline" className={STATUS_META[openSub.status].tone}>
                    {STATUS_META[openSub.status].label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-3">
                <div className="text-xs text-muted-foreground">
                  {openCourse?.title} · {openCustomer?.name ?? openSub.customer_id} · {openCustomer?.email}
                </div>

                {/* File */}
                <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <FileCheck2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{openSub.file_name}</div>
                      {openSub.submitted_at && (
                        <div className="text-xs text-muted-foreground">
                          Eingereicht: {new Date(openSub.submitted_at).toLocaleString("de-DE")}
                        </div>
                      )}
                    </div>
                  </div>
                  <a href={openSub.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Öffnen
                    </Button>
                  </a>
                </div>

                {/* Feedback-Form */}
                {openSub.status !== "approved" && (
                  <div className="border-t pt-5 space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider">Dein Feedback</h3>
                    <div className="grid gap-2">
                      <Label className="text-xs">Loom-URL (optional)</Label>
                      <Input
                        value={fbLoom}
                        onChange={(e) => setFbLoom(e.target.value)}
                        placeholder="https://www.loom.com/share/..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Text-Feedback (optional)</Label>
                      <Textarea
                        rows={4}
                        value={fbText}
                        onChange={(e) => setFbText(e.target.value)}
                        placeholder="Notizen, Punkte zum Verbessern, Lob, Hinweise ..."
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button onClick={sendFeedback} disabled={submitting} variant="outline" className="gap-1.5">
                        <Send className="h-4 w-4" /> Feedback senden
                      </Button>
                      <Button onClick={approve} disabled={submitting} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600">
                        <Sparkles className="h-4 w-4" /> Approven & nächste Lektion freischalten
                      </Button>
                    </div>
                  </div>
                )}

                {openSub.status === "approved" && (openSub.feedback_loom_url || openSub.feedback_text) && (
                  <div className="border-t pt-5 space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider">Gegebenes Feedback</h3>
                    {openSub.feedback_loom_url && (
                      <div className="text-sm">
                        Loom: <a href={openSub.feedback_loom_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          {openSub.feedback_loom_url}
                        </a>
                      </div>
                    )}
                    {openSub.feedback_text && (
                      <p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/40 p-3">{openSub.feedback_text}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileCheck2, Clock, MessageSquare, CheckCircle2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export type LessonSubmission = {
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
  updated_at: string;
};

function getLoomEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  if (input.startsWith("https://") && input.includes("embed")) return input;
  return null;
}

const STATUS_BADGE = {
  submitted: { label: "Eingereicht — wartet auf Review", icon: Clock, tone: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  feedback_given: { label: "Feedback erhalten", icon: MessageSquare, tone: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  approved: { label: "Abgeschlossen", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
} as const;

export function LessonSubmissionPanel({
  lessonId,
  customerId,
  isDark,
}: {
  lessonId: string;
  customerId: string;
  isDark?: boolean;
}) {
  const [submission, setSubmission] = useState<LessonSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!lessonId || !customerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("lesson_submissions")
      .select("*")
      .eq("lesson_id", lessonId)
      .eq("customer_id", customerId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubmission(data ?? null);
    setLoading(false);
  }, [lessonId, customerId]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${customerId}/${lessonId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("lesson-submissions")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { toast.error("Upload fehlgeschlagen"); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("lesson-submissions").getPublicUrl(path);

    if (submission && submission.status !== "approved") {
      // Replace existing submission (re-submit after feedback)
      await supabase.from("lesson_submissions").update({
        file_url: pub.publicUrl,
        file_name: file.name,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", submission.id);
    } else {
      await supabase.from("lesson_submissions").insert({
        lesson_id: lessonId,
        customer_id: customerId,
        file_url: pub.publicUrl,
        file_name: file.name,
        status: "submitted",
      });
    }
    await load();
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Eingereicht! Du bekommst Feedback per Loom.");
  };

  const status = submission?.status ?? null;
  const meta = status ? STATUS_BADGE[status] : null;
  const Icon = meta?.icon;

  return (
    <Card className={isDark ? "bg-white/[0.02] border-white/[0.04]" : ""}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white/80" : ""}`}>
              Workbook hochladen
            </h3>
            <p className={`text-xs mt-1 ${isDark ? "text-white/40" : "text-muted-foreground"}`}>
              Lade deine ausgefüllte PDF hoch — der Coach reviewt + schickt Loom-Feedback.
            </p>
          </div>
          {meta && Icon && (
            <Badge variant="outline" className={`gap-1.5 ${meta.tone}`}>
              <Icon className="h-3 w-3" />
              {meta.label}
            </Badge>
          )}
        </div>

        {submission && (
          <div className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-muted/30"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="text-sm truncate">{submission.file_name}</div>
            </div>
            <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button size="sm" variant="outline">Ansehen</Button>
            </a>
          </div>
        )}

        {/* Coach-Feedback */}
        {(submission?.feedback_loom_url || submission?.feedback_text) && (
          <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-purple-500/5 border-purple-500/30" : "bg-purple-500/5 border-purple-500/40"}`}>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span className={`text-sm font-semibold ${isDark ? "text-white/80" : ""}`}>Coach-Feedback</span>
            </div>
            {submission.feedback_loom_url && (() => {
              const url = getLoomEmbedUrl(submission.feedback_loom_url);
              return url ? (
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe src={url} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
                </div>
              ) : (
                <a href={submission.feedback_loom_url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-500 underline">
                  Feedback-Loom öffnen →
                </a>
              );
            })()}
            {submission.feedback_text && (
              <p className={`text-sm whitespace-pre-wrap ${isDark ? "text-white/70" : ""}`}>
                {submission.feedback_text}
              </p>
            )}
          </div>
        )}

        {/* Upload-Button */}
        {(!submission || submission.status !== "approved") && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || loading}
              className="gap-1.5 w-full"
              variant={submission ? "outline" : "default"}
            >
              {submission ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Lade hoch ..." : submission ? "Neue Version hochladen" : "PDF hochladen"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

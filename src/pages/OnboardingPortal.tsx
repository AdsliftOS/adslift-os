import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  loadModules,
  loadProgressForToken,
  getToken,
  submitWorkbook,
  type OnboardingModule,
  type OnboardingProgress,
  type OnboardingToken,
  type WorkbookField,
} from "@/store/onboardingModules";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, Lock, Play, Clock, MessageSquare, FileText, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

function getLoomEmbedUrl(input: string | null): string | null {
  if (!input) return null;
  const m = input.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  if (input.startsWith("https://") && input.includes("embed")) return input;
  return null;
}

const STATUS_META = {
  locked: { label: "Gesperrt", icon: Lock, color: "text-muted-foreground", bg: "bg-muted" },
  active: { label: "Bereit für dich", icon: Play, color: "text-blue-500", bg: "bg-blue-500/10" },
  submitted: { label: "Eingereicht — wartet auf Review", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  feedback_given: { label: "Feedback erhalten", icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500/10" },
  approved: { label: "Abgeschlossen", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
} as const;

export default function OnboardingPortal() {
  const { token } = useParams<{ token: string }>();
  const [tokenData, setTokenData] = useState<OnboardingToken | null>(null);
  const [modules, setModules] = useState<OnboardingModule[]>([]);
  const [progress, setProgress] = useState<OnboardingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const [t, mods, prog] = await Promise.all([
        getToken(token),
        loadModules(),
        loadProgressForToken(token),
      ]);
      setTokenData(t);
      setModules(mods);
      setProgress(prog);
      // Auto-select active or first non-locked module
      const active = prog.find((p) => p.status === "active") ?? prog.find((p) => p.status !== "locked");
      if (active) setActiveModuleId(active.moduleId);
      setLoading(false);
    })();
  }, [token]);

  // Hydrate form when active module changes
  useEffect(() => {
    if (!activeModuleId) return;
    const p = progress.find((p) => p.moduleId === activeModuleId);
    setFormValues(p?.submission ?? {});
  }, [activeModuleId, progress]);

  const orderedModules = useMemo(
    () => [...modules].sort((a, b) => a.sortOrder - b.sortOrder),
    [modules]
  );

  const progressByModule = useMemo(() => {
    const m: Record<string, OnboardingProgress> = {};
    progress.forEach((p) => { m[p.moduleId] = p; });
    return m;
  }, [progress]);

  const stats = useMemo(() => {
    const total = orderedModules.length;
    const done = progress.filter((p) => p.status === "approved").length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [orderedModules, progress]);

  const activeModule = orderedModules.find((m) => m.id === activeModuleId) ?? null;
  const activeProgress = activeModuleId ? progressByModule[activeModuleId] : null;
  const canEdit = activeProgress?.status === "active" || activeProgress?.status === "feedback_given";

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const isFormValid = (mod: OnboardingModule, vals: Record<string, string>) => {
    return mod.workbookSchema.every((f) => !f.required || (vals[f.key] ?? "").trim().length > 0);
  };

  const handleSubmit = async () => {
    if (!activeProgress || !activeModule) return;
    if (!isFormValid(activeModule, formValues)) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    setSubmitting(true);
    await submitWorkbook(activeProgress.id, formValues);
    // Reload progress
    if (token) {
      const fresh = await loadProgressForToken(token);
      setProgress(fresh);
    }
    setSubmitting(false);
    toast.success("Eingereicht! Alex meldet sich mit Feedback-Loom.");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-3 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Lade dein Onboarding ...</p>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <div className="text-2xl mb-2">🔒</div>
            <h1 className="text-lg font-bold mb-2">Link ungültig</h1>
            <p className="text-sm text-muted-foreground">
              Der Onboarding-Link ist nicht gültig oder abgelaufen. Bitte melde dich bei deinem
              Adslift-Ansprechpartner.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sonner />

      {/* Top Bar */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold tracking-tight">Adslift</span>
            <Badge variant="secondary" className="text-[10px]">Onboarding</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {tokenData.clientName}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-muted overflow-hidden hidden sm:block">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${stats.pct}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums">{stats.done}/{stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar: Module-Liste */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-1">
            Deine Module
          </div>
          {orderedModules.map((mod, idx) => {
            const p = progressByModule[mod.id];
            const status = p?.status ?? "locked";
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            const isActive = activeModuleId === mod.id;
            const clickable = status !== "locked";
            return (
              <button
                key={mod.id}
                onClick={() => clickable && setActiveModuleId(mod.id)}
                disabled={!clickable}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  isActive
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : clickable
                    ? "border-border hover:border-primary/30"
                    : "border-border opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Modul {idx + 1}
                    </div>
                    <div className="text-sm font-medium truncate">{mod.title}</div>
                    <div className={`text-[10px] mt-1 ${meta.color}`}>{meta.label}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main: Active Module */}
        {activeModule && activeProgress ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs uppercase tracking-wider text-primary font-medium">
                  Modul {activeModule.sortOrder} — {STATUS_META[activeProgress.status].label}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{activeModule.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{activeModule.description}</p>
            </div>

            {/* Loom */}
            {activeModule.loomUrl && (
              <Card>
                <CardContent className="p-0">
                  <div className="aspect-video">
                    {(() => {
                      const url = getLoomEmbedUrl(activeModule.loomUrl);
                      return url ? (
                        <iframe
                          src={url}
                          className="w-full h-full rounded-t-xl"
                          allow="autoplay; fullscreen"
                          allowFullScreen
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted rounded-t-xl">
                          <a href={activeModule.loomUrl} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-primary underline">
                            Loom öffnen →
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="p-4 border-t">
                    <p className="text-sm font-medium">Schau dir das Loom an, bevor du den Workbook ausfüllst.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Doc-Link */}
            {activeModule.docUrl && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Anleitung & Frameworks</div>
                      <div className="text-xs text-muted-foreground">Detaillierte Doc zum Modul</div>
                    </div>
                  </div>
                  <a href={activeModule.docUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">Doc öffnen</Button>
                  </a>
                </CardContent>
              </Card>
            )}

            {/* Feedback (wenn vorhanden) */}
            {activeProgress.feedbackLoomUrl || activeProgress.feedbackText ? (
              <Card className="border-purple-500/40 bg-purple-500/5">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold">Feedback von Alex</span>
                  </div>
                  {activeProgress.feedbackLoomUrl && (() => {
                    const url = getLoomEmbedUrl(activeProgress.feedbackLoomUrl);
                    return url ? (
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <iframe src={url} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
                      </div>
                    ) : (
                      <a href={activeProgress.feedbackLoomUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary underline">Feedback-Loom öffnen →</a>
                    );
                  })()}
                  {activeProgress.feedbackText && (
                    <p className="text-sm whitespace-pre-wrap">{activeProgress.feedbackText}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Du kannst dein Workbook unten anpassen und nochmal einreichen.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* Workbook */}
            <Card>
              <CardContent className="p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-1">Workbook</h3>
                  <p className="text-xs text-muted-foreground">
                    {canEdit
                      ? "Fülle die Felder aus und reiche ein. Alex schickt dir innerhalb von 1-2 Werktagen einen Feedback-Loom."
                      : activeProgress.status === "submitted"
                      ? "Eingereicht — Alex meldet sich gleich mit Feedback."
                      : "Modul abgeschlossen ✓"}
                  </p>
                </div>

                {activeModule.workbookSchema.map((field) => (
                  <FieldRenderer
                    key={field.key}
                    field={field}
                    value={formValues[field.key] ?? ""}
                    onChange={(v) => handleFieldChange(field.key, v)}
                    disabled={!canEdit}
                  />
                ))}

                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !isFormValid(activeModule, formValues)}
                      className="gap-1.5"
                    >
                      <Sparkles className="h-4 w-4" />
                      {submitting ? "Reiche ein ..." : "Einreichen"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Wähle ein Modul aus der Liste links.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FieldRenderer({
  field, value, onChange, disabled,
}: {
  field: WorkbookField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.type === "textarea" && (
        <Textarea
          rows={4}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
      {field.type === "input" && (
        <Input
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
      {field.type === "select" && (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Auswählen ..."} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  loadModules,
  loadProgressForToken,
  listTokens,
  createToken,
  giveFeedback,
  approveModule,
  updateModule,
  uploadModuleWorkbookPdf,
  type OnboardingModule,
  type OnboardingProgress,
  type OnboardingToken,
} from "@/store/onboardingModules";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2, Lock, Play, Clock, MessageSquare, Plus, Copy, Sparkles, Send,
  FileCheck2, Download, Settings, Upload, FileText,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_META = {
  locked: { label: "Locked", icon: Lock, tone: "text-muted-foreground bg-muted" },
  active: { label: "Aktiv", icon: Play, tone: "text-blue-500 bg-blue-500/10" },
  submitted: { label: "Eingereicht", icon: Clock, tone: "text-amber-500 bg-amber-500/10" },
  feedback_given: { label: "Feedback gegeben", icon: MessageSquare, tone: "text-purple-500 bg-purple-500/10" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10" },
} as const;

export default function OnboardingAdmin() {
  const [tokens, setTokens] = useState<OnboardingToken[]>([]);
  const [modules, setModules] = useState<OnboardingModule[]>([]);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [progress, setProgress] = useState<OnboardingProgress[]>([]);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);

  // Feedback form state
  const [fbLoomUrl, setFbLoomUrl] = useState("");
  const [fbText, setFbText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Create-token form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newVariant, setNewVariant] = useState<"done4you" | "donewithyou">("donewithyou");

  useEffect(() => {
    (async () => {
      const [t, m] = await Promise.all([listTokens(), loadModules()]);
      setTokens(t);
      setModules(m);
      if (t.length && !activeToken) setActiveToken(t[0].token);
    })();
  }, []);

  useEffect(() => {
    if (!activeToken) { setProgress([]); return; }
    loadProgressForToken(activeToken).then(setProgress);
  }, [activeToken]);

  const selectedToken = useMemo(() => tokens.find((t) => t.token === activeToken) ?? null, [tokens, activeToken]);
  const orderedModules = useMemo(() => [...modules].sort((a, b) => a.sortOrder - b.sortOrder), [modules]);
  const progressByModule = useMemo(() => {
    const m: Record<string, OnboardingProgress> = {};
    progress.forEach((p) => { m[p.moduleId] = p; });
    return m;
  }, [progress]);

  const openModule = orderedModules.find((m) => m.id === openModuleId) ?? null;
  const openProgress = openModuleId ? progressByModule[openModuleId] : null;

  const handleCreateToken = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Name und Email pflicht");
      return;
    }
    try {
      const token = await createToken({
        clientName: newName.trim(),
        clientEmail: newEmail.trim().toLowerCase(),
        variant: newVariant,
      });
      const fresh = await listTokens();
      setTokens(fresh);
      setActiveToken(token);
      setCreateOpen(false);
      setNewName(""); setNewEmail("");
      const url = `${window.location.origin}/onboarding-portal/${token}`;
      navigator.clipboard.writeText(url);
      toast.success("Token erstellt — Portal-URL in Zwischenablage kopiert");
    } catch (e) {
      toast.error("Fehler beim Erstellen");
    }
  };

  const copyUrl = () => {
    if (!activeToken) return;
    const url = `${window.location.origin}/onboarding/${activeToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Portal-URL kopiert");
  };

  const handleOpenModule = (moduleId: string) => {
    setOpenModuleId(moduleId);
    const p = progressByModule[moduleId];
    setFbLoomUrl(p?.feedbackLoomUrl ?? "");
    setFbText(p?.feedbackText ?? "");
  };

  const handleGiveFeedback = async () => {
    if (!openProgress) return;
    if (!fbLoomUrl.trim() && !fbText.trim()) {
      toast.error("Mindestens Loom-URL oder Text");
      return;
    }
    setSubmitting(true);
    await giveFeedback(openProgress.id, fbLoomUrl.trim(), fbText.trim());
    if (activeToken) {
      const fresh = await loadProgressForToken(activeToken);
      setProgress(fresh);
    }
    setSubmitting(false);
    toast.success("Feedback geschickt — Kunde sieht es im Portal");
  };

  const handleApprove = async () => {
    if (!openProgress) return;
    setSubmitting(true);
    await approveModule(openProgress.id);
    if (activeToken) {
      const fresh = await loadProgressForToken(activeToken);
      setProgress(fresh);
    }
    setSubmitting(false);
    toast.success("Modul approved — nächstes ist freigeschaltet");
    setOpenModuleId(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Onboarding — Admin</h1>
          <p className="text-sm text-muted-foreground">
            Reviewe Workbook-Submissions und gib Loom-Feedback.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setModulesOpen(true)} variant="outline" className="gap-1.5">
            <Settings className="h-4 w-4" /> Module bearbeiten
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neuer Onboarding-Link
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Token-Liste */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
            Kunden ({tokens.length})
          </div>
          {tokens.length === 0 && (
            <Card><CardContent className="p-4 text-sm text-muted-foreground">
              Noch keine Onboarding-Links. Erstelle einen mit „Neuer Onboarding-Link".
            </CardContent></Card>
          )}
          {tokens.map((t) => {
            const isActive = activeToken === t.token;
            return (
              <button
                key={t.token}
                onClick={() => setActiveToken(t.token)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  isActive ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="font-medium text-sm truncate">{t.clientName}</div>
                <div className="text-xs text-muted-foreground truncate">{t.clientEmail}</div>
                <div className="mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {t.variant === "done4you" ? "DFY" : "DWY"}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Module-Übersicht für selected Token */}
        <div className="space-y-4">
          {!selectedToken ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              Wähle einen Kunden aus der Liste.
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Portal-URL</div>
                    <div className="font-mono text-xs break-all mt-1">
                      {window.location.origin}/onboarding/{selectedToken.token}
                    </div>
                  </div>
                  <Button onClick={copyUrl} size="sm" variant="outline" className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" /> Kopieren
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {orderedModules.map((mod) => {
                  const p = progressByModule[mod.id];
                  const status = p?.status ?? "locked";
                  const meta = STATUS_META[status];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={mod.id}
                      onClick={() => p && handleOpenModule(mod.id)}
                      disabled={!p}
                      className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                          Modul {mod.sortOrder}
                        </div>
                        <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 ${meta.tone}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </div>
                      </div>
                      <div className="font-semibold text-sm">{mod.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</div>
                      {p?.submittedAt && (
                        <div className="text-[10px] text-muted-foreground mt-2">
                          Eingereicht: {new Date(p.submittedAt).toLocaleString("de-DE")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Module-Detail Dialog */}
      <Dialog open={!!openModuleId} onOpenChange={(open) => { if (!open) setOpenModuleId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {openModule && openProgress && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>Modul {openModule.sortOrder}: {openModule.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {STATUS_META[openProgress.status].label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-3">
                {/* Submission-File */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Eingereichte Datei</h3>
                  {openProgress.submissionFileUrl ? (
                    <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <FileCheck2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {openProgress.submissionFileName ?? "Workbook-Submission"}
                          </div>
                          {openProgress.submittedAt && (
                            <div className="text-xs text-muted-foreground">
                              Eingereicht: {new Date(openProgress.submittedAt).toLocaleString("de-DE")}
                            </div>
                          )}
                        </div>
                      </div>
                      <a href={openProgress.submissionFileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Download className="h-3.5 w-3.5" /> Öffnen
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch nichts eingereicht.</p>
                  )}
                </div>

                {/* Feedback-Form */}
                {openProgress.status !== "approved" && (
                  <div className="border-t pt-5 space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider">Dein Feedback</h3>
                    <div className="grid gap-2">
                      <Label className="text-xs">Loom-URL (optional)</Label>
                      <Input
                        value={fbLoomUrl}
                        onChange={(e) => setFbLoomUrl(e.target.value)}
                        placeholder="https://www.loom.com/share/..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Text-Feedback (optional)</Label>
                      <Textarea
                        rows={4}
                        value={fbText}
                        onChange={(e) => setFbText(e.target.value)}
                        placeholder="Kurze Notizen, Punkte zum Verbessern, Lob, Hinweise ..."
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button onClick={handleGiveFeedback} disabled={submitting} variant="outline" className="gap-1.5">
                        <Send className="h-4 w-4" /> Feedback senden
                      </Button>
                      <Button onClick={handleApprove} disabled={submitting} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600">
                        <Sparkles className="h-4 w-4" /> Approven & nächstes Modul freischalten
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Module-Editor Dialog */}
      <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Module bearbeiten — Loom, Doc, Workbook-PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {orderedModules.map((mod) => (
              <ModuleEditor
                key={mod.id}
                module={mod}
                onUpdated={async () => { setModules(await loadModules()); }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create-Token Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Onboarding-Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              <Label>Kunden-Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z.B. Max Mustermann" />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="kunde@firma.de" />
            </div>
            <div className="grid gap-2">
              <Label>Variante</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["donewithyou", "done4you"] as const).map((v) => (
                  <button key={v} onClick={() => setNewVariant(v)}
                    className={`rounded-lg border p-3 text-sm transition-all ${
                      newVariant === v ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"
                    }`}>
                    {v === "done4you" ? "Done 4 You" : "Done With You"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreateToken} className="gap-1.5">
                <Plus className="h-4 w-4" /> Erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModuleEditor({ module: mod, onUpdated }: { module: OnboardingModule; onUpdated: () => Promise<void> }) {
  const [loomUrl, setLoomUrl] = useState(mod.loomUrl ?? "");
  const [docUrl, setDocUrl] = useState(mod.docUrl ?? "");
  const [pdfUrl, setPdfUrl] = useState(mod.workbookPdfUrl ?? "");
  const [pdfName, setPdfName] = useState(mod.workbookPdfFilename ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadModuleWorkbookPdf(mod.slug, file);
    if (!result) {
      toast.error("Upload fehlgeschlagen");
      setUploading(false);
      return;
    }
    setPdfUrl(result.url);
    setPdfName(file.name);
    setUploading(false);
    toast.success("PDF hochgeladen — vergiss nicht zu speichern");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    await updateModule(mod.id, {
      loomUrl: loomUrl.trim() || null,
      docUrl: docUrl.trim() || null,
      workbookPdfUrl: pdfUrl.trim() || null,
      workbookPdfFilename: pdfName.trim() || null,
    });
    await onUpdated();
    setSaving(false);
    toast.success(`${mod.title} gespeichert`);
  };

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Modul {mod.sortOrder}
          </div>
          <div className="font-bold text-sm">{mod.title}</div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> {saving ? "..." : "Speichern"}
        </Button>
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Loom-URL</Label>
        <Input value={loomUrl} onChange={(e) => setLoomUrl(e.target.value)} placeholder="https://www.loom.com/share/..." />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Doc-URL (Notion / Google Doc)</Label>
        <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://www.notion.so/..." />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Workbook-PDF</Label>
        {pdfUrl && (
          <div className="rounded-lg border bg-muted/30 p-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-xs truncate">{pdfName || pdfUrl}</span>
            </div>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-7 gap-1.5">
                <Download className="h-3 w-3" /> Öffnen
              </Button>
            </a>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleUploadPdf}
          disabled={uploading}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Lädt hoch ..." : pdfUrl ? "Neue PDF hochladen" : "PDF hochladen"}
        </Button>
      </div>
    </div>
  );
}

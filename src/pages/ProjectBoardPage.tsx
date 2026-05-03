import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Excalidraw = lazy(() => import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw })));

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<null | "team" | "customer">(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [synced, setSynced] = useState(true);
  const lastSavedRef = useRef<string>("null");
  const remoteVersionRef = useRef<string>("");

  // Auth + Project laden
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: pp } = await supabase
        .from("pipeline_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (!pp) {
        toast.error("Projekt nicht gefunden");
        navigate("/");
        return;
      }

      // 1. Team-Login (Adslift-OS)
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession?.user?.email) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("status")
          .eq("email", authSession.user.email)
          .maybeSingle();
        if (tm?.status === "active") {
          setAuthorized("team");
          setProject(pp);
          lastSavedRef.current = JSON.stringify(pp.excalidraw_data ?? null);
          remoteVersionRef.current = pp.updated_at || "";
          setLoading(false);
          return;
        }
      }

      // 2. Academy-Customer-Session (matching client_id)
      const stored = localStorage.getItem("academy_session");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.customer_id) {
            const { data: ac } = await supabase
              .from("academy_customers")
              .select("client_id")
              .eq("id", parsed.customer_id)
              .maybeSingle();
            if (ac?.client_id && ac.client_id === pp.client_id) {
              setAuthorized("customer");
              setProject(pp);
              lastSavedRef.current = JSON.stringify(pp.excalidraw_data ?? null);
              remoteVersionRef.current = pp.updated_at || "";
              setLoading(false);
              return;
            }
          }
        } catch {}
      }

      // 3. Nicht autorisiert
      toast.error("Kein Zugriff auf dieses Board");
      navigate("/");
    })();
  }, [projectId, navigate]);

  // Auto-Save 3s Debounce
  useEffect(() => {
    if (!dirty || !api || !projectId) return;
    const t = setTimeout(() => save(), 3000);
    return () => clearTimeout(t);
  }, [dirty, api, projectId]);

  // Realtime-Polling: alle 5s prüfen ob Server-Daten neuer sind
  useEffect(() => {
    if (!projectId || !api) return;
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("pipeline_projects")
        .select("excalidraw_data, updated_at")
        .eq("id", projectId)
        .maybeSingle();
      if (!data) return;
      // Wenn Server neuer + Local nicht dirty → Remote-Update einspielen
      if (data.updated_at && data.updated_at !== remoteVersionRef.current && !dirty) {
        const remote = JSON.stringify(data.excalidraw_data ?? null);
        if (remote !== lastSavedRef.current) {
          api.updateScene({
            elements: data.excalidraw_data?.elements || [],
            appState: data.excalidraw_data?.appState || {},
          });
          if (data.excalidraw_data?.files) api.addFiles(Object.values(data.excalidraw_data.files));
          lastSavedRef.current = remote;
          remoteVersionRef.current = data.updated_at;
          setLastSyncAt(new Date());
          setSynced(true);
        }
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [projectId, api, dirty]);

  const save = async () => {
    if (!api || !projectId) return;
    setSaving(true);
    setSynced(false);
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    const data = {
      elements,
      appState: { viewBackgroundColor: appState.viewBackgroundColor },
      files,
    };
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) {
      setSaving(false);
      setDirty(false);
      setSynced(true);
      return;
    }
    const { data: updated } = await supabase
      .from("pipeline_projects")
      .update({ excalidraw_data: data, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("updated_at")
      .single();
    lastSavedRef.current = serialized;
    if (updated?.updated_at) remoteVersionRef.current = updated.updated_at;
    setLastSyncAt(new Date());
    setSaving(false);
    setDirty(false);
    setSynced(true);
  };

  const handleChange = () => {
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    const serialized = JSON.stringify({ elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files });
    if (serialized !== lastSavedRef.current) {
      setDirty(true);
      setSynced(false);
    }
  };

  if (loading || !authorized || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Lade Board...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="border-b px-4 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (authorized === "customer") navigate("/portal");
              else window.history.length > 1 ? window.history.back() : navigate("/pipeline");
            }}
            className="-ml-2 h-8 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Zurück
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">{project.name} — Strategie-Board</h1>
            <p className="text-[10px] text-muted-foreground">
              {authorized === "team" ? "Team-Modus" : "Kunden-Modus"} · Auto-Sync alle 5s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md",
            synced ? "text-emerald-600 bg-emerald-500/10" : "text-amber-600 bg-amber-500/10",
          )}>
            {synced ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {saving ? "Speichert..." : synced ? "Synchronisiert" : "Ungespeichert"}
            {lastSyncAt && synced && <span className="text-[10px] opacity-60">· {lastSyncAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          {dirty && (
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs">
              <Save className="h-3.5 w-3.5 mr-1" /> Speichern
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Lade Excalidraw...</div>}>
          <Excalidraw
            excalidrawAPI={(a: any) => setApi(a)}
            initialData={project.excalidraw_data ?? undefined}
            onChange={handleChange}
          />
        </Suspense>
      </div>
    </div>
  );
}

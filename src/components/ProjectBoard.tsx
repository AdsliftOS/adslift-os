import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Save, Maximize2, Minimize2 } from "lucide-react";
import { updatePipelineProject } from "@/store/pipeline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Excalidraw = lazy(() => import("@excalidraw/excalidraw").then((m) => ({ default: m.Excalidraw })));

type Props = {
  projectId: string;
  initialData: any | null;
  isDark?: boolean;
};

export function ProjectBoard({ projectId, initialData, isDark = false }: Props) {
  const [api, setApi] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastSavedRef = useRef<string>(JSON.stringify(initialData ?? null));

  // Auto-save Debounce nach 3s ohne Changes
  useEffect(() => {
    if (!dirty || !api) return;
    const t = setTimeout(() => save(), 3000);
    return () => clearTimeout(t);
  }, [dirty, api]);

  const save = async () => {
    if (!api) return;
    setSaving(true);
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    const data = {
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      },
      files,
    };
    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) {
      setSaving(false);
      setDirty(false);
      return;
    }
    await updatePipelineProject(projectId, { excalidrawData: data });
    lastSavedRef.current = serialized;
    setSaving(false);
    setDirty(false);
  };

  const handleChange = () => {
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    const serialized = JSON.stringify({ elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files });
    if (serialized !== lastSavedRef.current) setDirty(true);
  };

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden flex flex-col",
      fullscreen ? "fixed inset-2 z-50 shadow-2xl" : "min-h-[500px]",
    )}>
      <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11H4l3-7 5 11 5-11 3 7h-5"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold">Strategie-Board</h3>
            <p className="text-[11px] text-muted-foreground">
              {dirty ? "Ungespeicherte Änderungen — auto-save in 3s" : saving ? "Speichert..." : "Whiteboard für Funnels, Mindmaps, Strategien"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button size="sm" variant="outline" onClick={save} disabled={saving} className="h-8 text-xs">
              <Save className="h-3.5 w-3.5 mr-1" /> Speichern
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFullscreen((f) => !f)}
            className="h-8 w-8 p-0"
            title={fullscreen ? "Minimieren" : "Vollbild"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className={cn("flex-1", fullscreen ? "min-h-0" : "h-[480px]")}>
        <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-muted-foreground">Lade Board...</div>}>
          <Excalidraw
            excalidrawAPI={(a: any) => setApi(a)}
            initialData={initialData ?? undefined}
            onChange={handleChange}
            theme={isDark ? "dark" : "light"}
          />
        </Suspense>
      </div>
    </div>
  );
}

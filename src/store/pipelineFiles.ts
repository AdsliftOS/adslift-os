import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type StepFileType = "html" | "image" | "pdf" | "other";

export type StepFile = {
  id: string;
  stepId: string;
  filename: string;
  type: StepFileType;
  content: string | null;
  url: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
};

let files: StepFile[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => files;

function rowToFile(r: any): StepFile {
  return {
    id: r.id,
    stepId: r.step_id,
    filename: r.filename,
    type: r.type || "other",
    content: r.content || null,
    url: r.url || null,
    uploadedByEmail: r.uploaded_by_email || null,
    createdAt: r.created_at,
  };
}

export async function loadStepFiles() {
  const { data, error } = await supabase
    .from("pipeline_step_files")
    .select("*")
    .order("created_at", { ascending: false });
  if (!error && data) {
    files = data.map(rowToFile);
    emit();
  }
}
loadStepFiles();

export async function addStepFile(f: Omit<StepFile, "id" | "createdAt">) {
  const { data, error } = await supabase
    .from("pipeline_step_files")
    .insert({
      step_id: f.stepId,
      filename: f.filename,
      type: f.type,
      content: f.content,
      url: f.url,
      uploaded_by_email: f.uploadedByEmail,
    })
    .select()
    .single();
  if (!error && data) {
    files = [rowToFile(data), ...files];
    emit();
    return data.id;
  }
  toast.error("Datei konnte nicht hochgeladen werden");
  return null;
}

export async function deleteStepFile(id: string) {
  files = files.filter((f) => f.id !== id);
  emit();
  await supabase.from("pipeline_step_files").delete().eq("id", id);
}

export function useStepFiles(stepId: string | null): StepFile[] {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  if (!stepId) return [];
  return all.filter((f) => f.stepId === stepId);
}

export function useFileCountByStep(): Map<string, number> {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  const map = new Map<string, number>();
  for (const f of all) map.set(f.stepId, (map.get(f.stepId) || 0) + 1);
  return map;
}

export function useStepFilesByProject(stepIds: string[]): StepFile[] {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  if (stepIds.length === 0) return [];
  const set = new Set(stepIds);
  return all.filter((f) => set.has(f.stepId));
}

/** Trigger a browser download for an uploaded file. HTML/text → blob from
 * inline content; image/pdf → fetched from URL. */
export function downloadFile(file: StepFile) {
  const filename = file.filename || "download";
  if (file.content && (file.type === "html" || file.type === "other")) {
    const mime = file.type === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([file.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (file.url) {
    // Image (data URL or remote URL) or PDF
    const a = document.createElement("a");
    a.href = file.url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  } else if (file.content && file.type === "image") {
    // Image stored inline as data URL
    const a = document.createElement("a");
    a.href = file.content;
    a.download = filename;
    a.click();
  }
}

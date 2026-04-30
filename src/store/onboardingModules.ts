import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type OnboardingModule = {
  id: string;
  slug: string;
  title: string;
  description: string;
  loomUrl: string | null;
  docUrl: string | null;
  workbookPdfUrl: string | null;
  workbookPdfFilename: string | null;
  sortOrder: number;
  isPublished: boolean;
};

export type ProgressStatus = "locked" | "active" | "submitted" | "feedback_given" | "approved";

export type OnboardingProgress = {
  id: string;
  token: string;
  moduleId: string;
  status: ProgressStatus;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  feedbackLoomUrl: string | null;
  feedbackText: string | null;
  submittedAt: string | null;
  feedbackAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type OnboardingToken = {
  token: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  variant: "done4you" | "donewithyou";
  createdAt: string;
};

// ─── Modules (master) ────────────────────────────────────────────────────────
let modules: OnboardingModule[] = [];
const moduleListeners = new Set<() => void>();
function emitModules() { moduleListeners.forEach((l) => l()); }
function subscribeModules(l: () => void) { moduleListeners.add(l); return () => moduleListeners.delete(l); }

function rowToModule(row: any): OnboardingModule {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    loomUrl: row.loom_url,
    docUrl: row.doc_url,
    workbookPdfUrl: row.workbook_pdf_url,
    workbookPdfFilename: row.workbook_pdf_filename,
    sortOrder: row.sort_order ?? 0,
    isPublished: row.is_published ?? true,
  };
}

export async function loadModules() {
  const { data, error } = await supabase
    .from("onboarding_modules")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (!error && data) {
    modules = data.map(rowToModule);
    emitModules();
  }
  return modules;
}

export function useOnboardingModules(): OnboardingModule[] {
  return useSyncExternalStore(subscribeModules, () => modules);
}

export async function updateModule(id: string, updates: Partial<OnboardingModule>) {
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.loomUrl !== undefined) dbUpdates.loom_url = updates.loomUrl;
  if (updates.docUrl !== undefined) dbUpdates.doc_url = updates.docUrl;
  if (updates.workbookPdfUrl !== undefined) dbUpdates.workbook_pdf_url = updates.workbookPdfUrl;
  if (updates.workbookPdfFilename !== undefined) dbUpdates.workbook_pdf_filename = updates.workbookPdfFilename;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
  const { error } = await supabase.from("onboarding_modules").update(dbUpdates).eq("id", id);
  if (error) console.error("updateModule failed", error);
  await loadModules();
}

// ─── Token (per Kunde) ───────────────────────────────────────────────────────
export async function getToken(token: string): Promise<OnboardingToken | null> {
  const { data, error } = await supabase
    .from("onboarding_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    token: data.token,
    clientId: data.client_id,
    clientName: data.client_name,
    clientEmail: data.client_email,
    variant: data.variant ?? "donewithyou",
    createdAt: data.created_at,
  };
}

export async function createToken(args: {
  clientName: string;
  clientEmail: string;
  variant?: "done4you" | "donewithyou";
  clientId?: string | null;
}): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const { error } = await supabase.from("onboarding_tokens").insert({
    token,
    client_name: args.clientName,
    client_email: args.clientEmail,
    variant: args.variant ?? "donewithyou",
    client_id: args.clientId ?? null,
  });
  if (error) {
    console.error("createToken failed", error);
    throw error;
  }
  // Initialize progress rows: first module active, rest locked
  await initializeProgress(token);
  return token;
}

async function initializeProgress(token: string) {
  const mods = await loadModules();
  if (mods.length === 0) return;
  const rows = mods.map((m, idx) => ({
    token,
    module_id: m.id,
    status: idx === 0 ? "active" : "locked",
  }));
  const { error } = await supabase.from("onboarding_progress").insert(rows);
  if (error) console.error("initializeProgress failed", error);
}

export async function listTokens(): Promise<OnboardingToken[]> {
  const { data, error } = await supabase
    .from("onboarding_tokens")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((d) => ({
    token: d.token,
    clientId: d.client_id,
    clientName: d.client_name,
    clientEmail: d.client_email,
    variant: d.variant ?? "donewithyou",
    createdAt: d.created_at,
  }));
}

// ─── Progress (per Kunde + Modul) ────────────────────────────────────────────
function rowToProgress(row: any): OnboardingProgress {
  return {
    id: row.id,
    token: row.token,
    moduleId: row.module_id,
    status: row.status,
    submissionFileUrl: row.submission_file_url,
    submissionFileName: row.submission_file_name,
    feedbackLoomUrl: row.feedback_loom_url,
    feedbackText: row.feedback_text,
    submittedAt: row.submitted_at,
    feedbackAt: row.feedback_at,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
  };
}

export async function loadProgressForToken(token: string): Promise<OnboardingProgress[]> {
  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("*")
    .eq("token", token);
  if (error || !data) return [];
  return data.map(rowToProgress);
}

export async function loadAllSubmittedProgress(): Promise<OnboardingProgress[]> {
  const { data, error } = await supabase
    .from("onboarding_progress")
    .select("*")
    .in("status", ["submitted", "feedback_given"])
    .order("submitted_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToProgress);
}

export async function uploadModuleWorkbookPdf(moduleSlug: string, file: File): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `modules/${moduleSlug}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("onboarding-submissions")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("uploadModuleWorkbookPdf failed", upErr);
    return null;
  }
  const { data } = supabase.storage.from("onboarding-submissions").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function uploadSubmissionFile(token: string, moduleSlug: string, file: File): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${token}/${moduleSlug}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("onboarding-submissions")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("uploadSubmissionFile failed", upErr);
    return null;
  }
  const { data } = supabase.storage.from("onboarding-submissions").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function submitWorkbook(progressId: string, fileUrl: string, fileName: string) {
  const { error } = await supabase
    .from("onboarding_progress")
    .update({
      submission_file_url: fileUrl,
      submission_file_name: fileName,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", progressId);
  if (error) console.error("submitWorkbook failed", error);
}

export async function giveFeedback(progressId: string, loomUrl: string, text: string) {
  const { error } = await supabase
    .from("onboarding_progress")
    .update({
      feedback_loom_url: loomUrl,
      feedback_text: text,
      status: "feedback_given",
      feedback_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", progressId);
  if (error) console.error("giveFeedback failed", error);
}

export async function approveModule(progressId: string) {
  // Approve current module
  const { data: progress, error: pErr } = await supabase
    .from("onboarding_progress")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", progressId)
    .select()
    .single();
  if (pErr || !progress) {
    console.error("approveModule failed", pErr);
    return;
  }

  // Unlock next module (find by sort_order)
  const mods = await loadModules();
  const currentMod = mods.find((m) => m.id === progress.module_id);
  if (!currentMod) return;
  const nextMod = mods.find((m) => m.sortOrder === currentMod.sortOrder + 1);
  if (!nextMod) return;

  await supabase
    .from("onboarding_progress")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("token", progress.token)
    .eq("module_id", nextMod.id)
    .eq("status", "locked");
}

// Initial load on import
loadModules();

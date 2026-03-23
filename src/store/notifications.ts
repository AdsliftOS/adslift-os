import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type NotificationType =
  | "contract_expiry"
  | "onboarding_complete"
  | "campaign_underperform"
  | "task_due"
  | "no_show";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  user_email: string;
  created_at: string;
};

// --- Store ---
let notifications: Notification[] = [];
let listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return notifications; }

export async function loadNotifications() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", session.user.email)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      notifications = data.map((row: any) => ({
        id: row.id,
        type: row.type as NotificationType,
        title: row.title || "",
        message: row.message || "",
        read: row.read ?? false,
        user_email: row.user_email || "",
        created_at: row.created_at || "",
      }));
      emit();
    }
  } catch (e) {
    console.error("[notifications] Failed to load:", e);
  }
}

export async function markAsRead(id: string) {
  notifications = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
  emit();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllAsRead() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) return;

  notifications = notifications.map((n) => ({ ...n, read: true }));
  emit();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_email", session.user.email)
    .eq("read", false);
}

export async function deleteNotification(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  emit();
  await supabase.from("notifications").delete().eq("id", id);
}

export function useNotifications() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

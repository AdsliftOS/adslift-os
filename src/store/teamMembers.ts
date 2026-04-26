import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export type TeamRole = "Geschäftsführer" | "Partner" | "Closer" | "Setter" | "Admin";

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: TeamRole | string;
  closeUserId: string | null;
  commissionRate: number; // % vom Deal-Volumen
  status: "active" | "inactive";
};

let members: TeamMember[] = [];
let listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return members; }

function rowToMember(r: any): TeamMember {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    closeUserId: r.close_user_id || null,
    commissionRate: Number(r.commission_rate || 0),
    status: r.status === "inactive" ? "inactive" : "active",
  };
}

export async function loadTeamMembers() {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: true });
  if (!error && data) {
    members = data.map(rowToMember);
    emit();
  }
}
loadTeamMembers();

export async function addTeamMember(m: Omit<TeamMember, "id">) {
  const { data, error } = await supabase
    .from("team_members")
    .insert({
      email: m.email,
      name: m.name,
      role: m.role,
      close_user_id: m.closeUserId,
      commission_rate: m.commissionRate,
      status: m.status,
    })
    .select()
    .single();
  if (!error && data) {
    members = [...members, rowToMember(data)];
    emit();
    return data.id;
  }
  console.error("addTeamMember failed:", error);
  toast.error("Mitarbeiter konnte nicht angelegt werden");
  return null;
}

export async function updateTeamMember(id: string, updates: Partial<TeamMember>) {
  const row: any = {};
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.closeUserId !== undefined) row.close_user_id = updates.closeUserId;
  if (updates.commissionRate !== undefined) row.commission_rate = updates.commissionRate;
  if (updates.status !== undefined) row.status = updates.status;

  members = members.map((m) => (m.id === id ? { ...m, ...updates } : m));
  emit();

  const { error } = await supabase.from("team_members").update(row).eq("id", id);
  if (error) {
    console.error("updateTeamMember failed:", error);
    toast.error("Konnte nicht gespeichert werden");
    await loadTeamMembers();
  }
}

export async function deleteTeamMember(id: string) {
  members = members.filter((m) => m.id !== id);
  emit();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) {
    console.error("deleteTeamMember failed:", error);
    toast.error("Konnte nicht gelöscht werden");
    await loadTeamMembers();
  }
}

export function useTeamMembers(): TeamMember[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function getMemberByEmail(email: string | null | undefined): TeamMember | null {
  if (!email) return null;
  return members.find((m) => m.email.toLowerCase() === email.toLowerCase()) || null;
}

// Roles that get the leadership UI (full nav, no /me).
const LEADERSHIP_ROLES = new Set(["Geschäftsführer", "Partner", "Admin"]);

export function isLeadershipRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return LEADERSHIP_ROLES.has(role);
}

// Hook: returns the team_member row for the currently logged-in Supabase user.
// `null` while loading or if the user isn't in team_members yet.
export function useCurrentMember(): TeamMember | null {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email?.toLowerCase() || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_e, session) => setEmail(session?.user?.email?.toLowerCase() || null),
    );
    return () => subscription.unsubscribe();
  }, []);

  if (!email) return null;
  return all.find((m) => m.email.toLowerCase() === email) || null;
}

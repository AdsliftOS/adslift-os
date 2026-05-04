// OAuth token store backed by Supabase (Tabelle: oauth_tokens).
// Liefert eine synchrone API über einen In-Memory-Cache. Cache wird beim
// App-Start aus der DB hydriert; Änderungen werden async zurück persistiert.
//
// Vorteil ggü. localStorage: Tokens leben pro Supabase-User, nicht pro Domain.
// → Verbindung auf einer Domain → automatisch verfügbar auf allen anderen.

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type Provider = "calendar" | "gmail";

export type StoredToken = {
  provider: Provider;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

let cache: StoredToken[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
export function subscribeOAuthTokens(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

export function getCachedTokens(provider: Provider): StoredToken[] {
  return cache.filter((t) => t.provider === provider);
}

export function findCachedToken(provider: Provider, email: string): StoredToken | null {
  return cache.find((t) => t.provider === provider && t.email === email) || null;
}

async function loadFromDb(): Promise<StoredToken[]> {
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("provider, email, access_token, refresh_token, expires_at");
  if (error || !data) return [];
  return data.map((r) => ({
    provider: r.provider as Provider,
    email: r.email,
    accessToken: r.access_token,
    refreshToken: r.refresh_token || "",
    expiresAt: Number(r.expires_at) || 0,
  }));
}

async function migrateFromLocalStorage(): Promise<StoredToken[]> {
  // Einmalige Migration: alte localStorage-Tokens in DB schreiben.
  const migrated: StoredToken[] = [];
  try {
    const cal = localStorage.getItem("google-calendar-accounts-v4");
    if (cal) {
      const parsed = JSON.parse(cal);
      for (const a of parsed) {
        if (!a?.email || !a?.accessToken) continue;
        migrated.push({
          provider: "calendar", email: a.email,
          accessToken: a.accessToken, refreshToken: a.refreshToken || "",
          expiresAt: a.expiresAt || 0,
        });
      }
    }
  } catch {}
  try {
    const gm = localStorage.getItem("gmail-accounts-v1");
    if (gm) {
      const parsed = JSON.parse(gm);
      for (const a of parsed) {
        if (!a?.email || !a?.accessToken) continue;
        migrated.push({
          provider: "gmail", email: a.email,
          accessToken: a.accessToken, refreshToken: a.refreshToken || "",
          expiresAt: a.expiresAt || 0,
        });
      }
    }
  } catch {}
  if (migrated.length === 0) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return [];
  const userId = session.user.id;

  const rows = migrated.map((t) => ({
    user_id: userId,
    provider: t.provider, email: t.email,
    access_token: t.accessToken, refresh_token: t.refreshToken,
    expires_at: t.expiresAt,
  }));
  const { error } = await supabase
    .from("oauth_tokens")
    .upsert(rows, { onConflict: "user_id,provider,email" });
  if (error) {
    console.warn("OAuth-Token-Migration fehlgeschlagen:", error.message);
    return [];
  }
  return migrated;
}

export async function hydrateOAuthTokens(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const fromDb = await loadFromDb();
    if (fromDb.length > 0) {
      cache = fromDb;
    } else {
      const migrated = await migrateFromLocalStorage();
      cache = migrated.length > 0 ? migrated : [];
    }
    hydrated = true;
    emit();
  })();
  return hydratePromise;
}

export async function upsertOAuthToken(t: StoredToken): Promise<void> {
  cache = [...cache.filter((x) => !(x.provider === t.provider && x.email === t.email)), t];
  emit();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await supabase.from("oauth_tokens").upsert({
    user_id: session.user.id,
    provider: t.provider, email: t.email,
    access_token: t.accessToken, refresh_token: t.refreshToken,
    expires_at: t.expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider,email" });
}

export async function deleteOAuthToken(provider: Provider, email: string): Promise<void> {
  cache = cache.filter((x) => !(x.provider === provider && x.email === email));
  emit();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await supabase.from("oauth_tokens")
    .delete()
    .eq("user_id", session.user.id)
    .eq("provider", provider)
    .eq("email", email);
}

export function clearOAuthCache() {
  cache = [];
  hydrated = false;
  hydratePromise = null;
  emit();
}

// React-Hook: triggert re-render bei Token-Änderungen.
export function useOAuthVersion(): number {
  return useSyncExternalStore(
    (l) => subscribeOAuthTokens(l),
    () => cache.length + (hydrated ? 0.5 : 0),
  );
}

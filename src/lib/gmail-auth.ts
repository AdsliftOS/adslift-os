const CLIENT_ID = "468650314215-le2sfqid627e1acprplf2fdg1jk0cfj3.apps.googleusercontent.com";
const SCOPES = "https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email";
const REDIRECT_URI = window.location.origin + "/auth/callback";

import { getCachedTokens, upsertOAuthToken, deleteOAuthToken } from "@/lib/oauth-tokens";

export type GmailAccount = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export function getGmailAccounts(): GmailAccount[] {
  return getCachedTokens("gmail").map((t) => ({
    email: t.email,
    accessToken: t.accessToken,
    refreshToken: t.refreshToken,
    expiresAt: t.expiresAt,
  }));
}

export function addGmailAccount(email: string, accessToken: string, refreshToken: string, expiresIn: number) {
  void upsertOAuthToken({
    provider: "gmail", email,
    accessToken, refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });
}

export function removeGmailAccount(email: string) {
  void deleteOAuthToken("gmail", email);
}

export function isGmailConnected(): boolean {
  return getGmailAccounts().length > 0;
}

// --- Token Refresh ---
async function refreshAccessToken(account: GmailAccount): Promise<string | null> {
  if (!account.refreshToken) return null;
  try {
    const res = await fetch(`/api/google-refresh?refresh_token=${encodeURIComponent(account.refreshToken)}`);
    const data = await res.json();
    if (data.error || !data.access_token) return null;

    void upsertOAuthToken({
      provider: "gmail", email: account.email,
      accessToken: data.access_token,
      refreshToken: account.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

export async function getValidGmailToken(account: GmailAccount): Promise<string> {
  if (account.refreshToken && account.expiresAt < Date.now() + 5 * 60 * 1000) {
    const newToken = await refreshAccessToken(account);
    if (newToken) return newToken;
  }
  return account.accessToken;
}

// --- OAuth Flow ---
export function connectGmail() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: "gmail",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleGmailCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (!code) return false;

  try {
    const redirectUri = REDIRECT_URI;
    const res = await fetch(`/api/google-auth?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`);
    const data = await res.json();

    if (data.error || !data.access_token) {
      console.error("Gmail auth error:", data);
      return false;
    }

    // Get user email
    let email = "Unknown";
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const userData = await userRes.json();
      email = userData.email || "Unknown";
    } catch {}

    addGmailAccount(email, data.access_token, data.refresh_token || "", data.expires_in || 3600);
    return true;
  } catch (err) {
    console.error("Gmail token exchange failed:", err);
    return false;
  }
}

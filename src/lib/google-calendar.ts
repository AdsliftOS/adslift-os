const CLIENT_ID = "468650314215-le2sfqid627e1acprplf2fdg1jk0cfj3.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";
const REDIRECT_URI = window.location.origin + "/auth/callback";

const ACCOUNT_COLORS = ["bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-pink-500", "bg-violet-500"];
const ACCOUNT_COLORS_LIGHT = ["bg-blue-500/10 text-blue-700 dark:text-blue-300", "bg-orange-500/10 text-orange-700 dark:text-orange-300", "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", "bg-pink-500/10 text-pink-700 dark:text-pink-300", "bg-violet-500/10 text-violet-700 dark:text-violet-300"];

const ACCOUNTS_KEY = "google-calendar-accounts-v4";

export type GoogleAccount = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  color: string;
  colorLight: string;
};

export function getAccounts(): GoogleAccount[] {
  try {
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    if (stored) {
      return JSON.parse(stored).map((a: any, idx: number) => ({
        email: a.email || "Unknown",
        accessToken: a.accessToken || a.token || "",
        refreshToken: a.refreshToken || "",
        expiresAt: a.expiresAt || 0,
        color: a.color || ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
        colorLight: a.colorLight || ACCOUNT_COLORS_LIGHT[idx % ACCOUNT_COLORS_LIGHT.length],
      }));
    }
  } catch {}
  return [];
}

function saveAccounts(accounts: GoogleAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function addAccount(email: string, accessToken: string, refreshToken: string, expiresIn: number) {
  const accounts = getAccounts().filter((a) => a.email !== email);
  const idx = accounts.length;
  accounts.push({
    email, accessToken, refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
    colorLight: ACCOUNT_COLORS_LIGHT[idx % ACCOUNT_COLORS_LIGHT.length],
  });
  saveAccounts(accounts);
}

export function removeAccount(email: string) {
  saveAccounts(getAccounts().filter((a) => a.email !== email));
}

export function isGoogleConnected(): boolean {
  return getAccounts().length > 0;
}

// --- Token Refresh ---
async function refreshAccessToken(account: GoogleAccount): Promise<string | null> {
  if (!account.refreshToken) return null;
  try {
    const res = await fetch(`/api/google-refresh?refresh_token=${encodeURIComponent(account.refreshToken)}`);
    const data = await res.json();
    if (data.error || !data.access_token) return null;

    // Update in storage
    const accounts = getAccounts().map((a) =>
      a.email === account.email
        ? { ...a, accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 }
        : a
    );
    saveAccounts(accounts);
    return data.access_token;
  } catch {
    return null;
  }
}

async function getValidToken(account: GoogleAccount): Promise<string> {
  // Refresh if expires in less than 5 min
  if (account.refreshToken && account.expiresAt < Date.now() + 5 * 60 * 1000) {
    const newToken = await refreshAccessToken(account);
    if (newToken) return newToken;
  }
  return account.accessToken;
}

// --- OAuth Flow (Authorization Code) ---
export function connectGoogleCalendar() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleAuthCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (!code) return false;

  try {
    const res = await fetch(`/api/google-auth?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
    const data = await res.json();

    if (data.error || !data.access_token) {
      console.error("Auth error:", data.error);
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

    addAccount(email, data.access_token, data.refresh_token || "", data.expires_in || 3600);
    return true;
  } catch (err) {
    console.error("Token exchange failed:", err);
    return false;
  }
}

// Legacy compat
export function getStoredToken(): string | null {
  const accounts = getAccounts();
  return accounts.length > 0 ? accounts[0].accessToken : null;
}

export function clearStoredToken() { saveAccounts([]); }

// --- API calls ---
const API_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri: string; entryPointType: string }[] };
  location?: string;
};

export async function listAllEvents(timeMin: string, timeMax: string): Promise<{ email: string; events: GoogleCalendarEvent[] }[]> {
  const accounts = getAccounts();
  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const token = await getValidToken(account);
      const params = new URLSearchParams({
        timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250",
      });
      const res = await fetch(`${API_BASE}/calendars/primary/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // Try refresh once more
        if (account.refreshToken) {
          const newToken = await refreshAccessToken(account);
          if (newToken) {
            const retryRes = await fetch(`${API_BASE}/calendars/primary/events?${params.toString()}`, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              return { email: account.email, events: (retryData.items || []) as GoogleCalendarEvent[] };
            }
          }
        }
        throw new Error("Token expired");
      }
      if (!res.ok) throw new Error("Calendar API error");
      const data = await res.json();
      return { email: account.email, events: (data.items || []) as GoogleCalendarEvent[] };
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ email: string; events: GoogleCalendarEvent[] }>).value);
}

export async function listEvents(timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> {
  const all = await listAllEvents(timeMin, timeMax);
  return all.flatMap((a) => a.events);
}

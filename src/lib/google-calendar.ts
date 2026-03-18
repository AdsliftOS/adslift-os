const CLIENT_ID = "468650314215-le2sfqid627e1acprplf2fdg1jk0cfj3.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";
const REDIRECT_URI = window.location.origin + "/auth/callback";

// Token storage
const TOKEN_KEY = "google-calendar-token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isGoogleConnected(): boolean {
  return !!getStoredToken();
}

// Start OAuth flow
export function connectGoogleCalendar() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: SCOPES,
    prompt: "consent",
    access_type: "online",
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Handle callback (extract token from URL hash)
export function handleAuthCallback(): boolean {
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token")) return false;

  const params = new URLSearchParams(hash.substring(1));
  const token = params.get("access_token");
  if (token) {
    setStoredToken(token);
    // Clean URL
    window.history.replaceState(null, "", window.location.pathname);
    return true;
  }
  return false;
}

// API calls
const API_BASE = "https://www.googleapis.com/calendar/v3";

async function gcalFetch(endpoint: string, options: RequestInit = {}) {
  const token = getStoredToken();
  if (!token) throw new Error("Not connected to Google Calendar");

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearStoredToken();
    throw new Error("Token expired — please reconnect");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Google Calendar API error");
  }

  return res.json();
}

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

// List events
export async function listEvents(timeMin: string, timeMax: string): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const data = await gcalFetch(`/calendars/primary/events?${params.toString()}`);
  return data.items || [];
}

// Create event
export async function createEvent(event: {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}): Promise<GoogleCalendarEvent> {
  return gcalFetch("/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

// Update event
export async function updateEvent(eventId: string, event: Partial<{
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}>): Promise<GoogleCalendarEvent> {
  return gcalFetch(`/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(event),
  });
}

// Delete event
export async function deleteEvent(eventId: string): Promise<void> {
  const token = getStoredToken();
  if (!token) throw new Error("Not connected");
  await fetch(`${API_BASE}/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

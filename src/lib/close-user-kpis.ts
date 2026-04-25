// Aggregates per-user KPIs from Close: calls, talk time, meetings, deals, revenue.
// Uses the existing /api/close-proxy edge function.

const PROXY = "/api/close-proxy";

async function closeGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const p = new URLSearchParams({ endpoint, ...params });
  const res = await fetch(`${PROXY}?${p.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Close API ${res.status}`);
  }
  return res.json();
}

export type UserKPIs = {
  callCount: number;
  callDurationSec: number;
  outboundCalls: number;
  inboundCalls: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  emailsSent: number;
  opportunitiesWon: number;
  opportunitiesActive: number;
  wonValue: number; // cents
  activeValue: number; // cents
};

const empty: UserKPIs = {
  callCount: 0,
  callDurationSec: 0,
  outboundCalls: 0,
  inboundCalls: 0,
  meetingsScheduled: 0,
  meetingsCompleted: 0,
  emailsSent: 0,
  opportunitiesWon: 0,
  opportunitiesActive: 0,
  wonValue: 0,
  activeValue: 0,
};

// Fetch all activities of a type within range, paged by skip/limit
async function fetchAllActivities(opts: {
  type: string;
  user_id: string;
  date_from: string;
  date_to: string;
}) {
  const all: any[] = [];
  let skip = 0;
  const limit = 100;
  while (skip < 1000) {
    const data = await closeGet("activity", {
      _type: opts.type,
      user_id: opts.user_id,
      date_created__gte: opts.date_from,
      date_created__lte: opts.date_to,
      _limit: String(limit),
      _skip: String(skip),
    });
    const batch = data.data || [];
    all.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
  }
  return all;
}

export async function getUserKPIs(
  closeUserId: string | null | undefined,
  dateFrom: string,
  dateTo: string,
): Promise<UserKPIs> {
  if (!closeUserId) return { ...empty };

  // Close expects ISO datetime; convert YYYY-MM-DD → start/end of day
  const from = `${dateFrom}T00:00:00Z`;
  const to = `${dateTo}T23:59:59Z`;

  try {
    const [calls, meetings, emails, oppsResp] = await Promise.all([
      fetchAllActivities({ type: "Call", user_id: closeUserId, date_from: from, date_to: to }),
      fetchAllActivities({ type: "Meeting", user_id: closeUserId, date_from: from, date_to: to }),
      fetchAllActivities({ type: "Email", user_id: closeUserId, date_from: from, date_to: to }),
      closeGet("opportunity", {
        user_id: closeUserId,
        date_created__gte: from,
        date_created__lte: to,
        _limit: "200",
      }),
    ]);

    const callCount = calls.length;
    const callDurationSec = calls.reduce((s, c) => s + (c.duration || 0), 0);
    const outboundCalls = calls.filter((c) => c.direction === "outbound").length;
    const inboundCalls = calls.filter((c) => c.direction === "inbound").length;

    const meetingsScheduled = meetings.length;
    const meetingsCompleted = meetings.filter(
      (m) => m.status === "completed" || m.status === "held",
    ).length;

    const emailsSent = emails.filter((e) => e.direction === "outgoing" || e.direction === "outbound").length;

    const opps = oppsResp.data || [];
    const won = opps.filter((o: any) => o.status_type === "won");
    const active = opps.filter((o: any) => o.status_type === "active");

    return {
      callCount,
      callDurationSec,
      outboundCalls,
      inboundCalls,
      meetingsScheduled,
      meetingsCompleted,
      emailsSent,
      opportunitiesWon: won.length,
      opportunitiesActive: active.length,
      wonValue: won.reduce((s: number, o: any) => s + (o.value || 0), 0),
      activeValue: active.reduce((s: number, o: any) => s + (o.value || 0), 0),
    };
  } catch (err) {
    console.error("getUserKPIs failed:", err);
    return { ...empty };
  }
}

export type CloseOrgUser = {
  id: string;
  email: string;
  name: string;
};

export async function getCloseOrgUsers(): Promise<CloseOrgUser[]> {
  // Use /membership not /user — /user leaks external collaborators
  // (anyone the API key has visibility to). /membership only returns
  // people who are actually members of YOUR Close organization.
  try {
    const data = await closeGet("membership", { _limit: "100" });
    return (data.data || []).map((m: any) => ({
      id: m.user_id,
      email: m.user_email || "",
      name:
        [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") ||
        m.user_email ||
        m.user_id,
    }));
  } catch (err) {
    console.error("getCloseOrgUsers failed:", err);
    return [];
  }
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

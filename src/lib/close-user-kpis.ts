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
  /** Diagnostic — first error encountered while fetching, if any */
  errorHint?: string | null;
  /** Diagnostic — raw counts before user_id filtering, to detect filter mismatches */
  rawTotals?: { calls: number; meetings: number; opportunities: number };
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

// Fetch all activities of a subtype within range. Uses Close's subtype
// endpoints (/activity/call/, /activity/meeting/, /activity/email/) which
// have richer filtering than the generic /activity?_type= variant.
// Fetch activity records + accurate total count. Close returns
// `total_results` on the first page so we don't need to paginate just
// to count. We still fetch up to ~500 records for aggregates like talk
// time / direction breakdown — using whichever pagination style the
// endpoint actually honors.
async function fetchActivities(opts: {
  subtype: "call" | "meeting" | "email";
  user_id: string;
  date_from: string;
  date_to: string;
}): Promise<{ records: any[]; total: number }> {
  const limit = 100;
  const dateField =
    opts.subtype === "call" || opts.subtype === "meeting"
      ? "date_started"
      : "date_created";

  const baseParams: Record<string, string> = {
    user_id: opts.user_id,
    [`${dateField}__gte`]: opts.date_from,
    [`${dateField}__lte`]: opts.date_to,
  };

  const seen = new Set<string>();
  const records: any[] = [];
  let total = 0;
  let cursor: string | null = null;
  let skip = 0;
  let pages = 0;
  let lastPageCount = -1;

  do {
    const params: Record<string, string> = { ...baseParams, _limit: String(limit) };
    if (cursor) params._cursor = cursor;
    else if (skip > 0) params._skip = String(skip);

    const data: any = await closeGet(`activity/${opts.subtype}/`, params);
    const batch: any[] = data?.data || [];

    // Use total_results from first response — most reliable count.
    if (pages === 0 && typeof data?.total_results === "number") {
      total = data.total_results;
    }

    let newItems = 0;
    for (const item of batch) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        records.push(item);
        newItems++;
      }
    }

    pages++;

    // Try cursor first (newer Close API), fall back to skip
    cursor =
      data?.cursor_next ||
      data?.next_cursor ||
      data?.cursor ||
      null;

    if (!cursor) {
      // Skip-based fallback. If a full page came back but yielded zero new
      // records, _skip is being ignored — bail out to avoid the 1000-dup loop.
      if (newItems === 0 && batch.length === limit) break;
      if (data?.has_more === false) break;
      if (batch.length < limit) break;
      skip += limit;
    }

    if (records.length >= 500) break;
    if (pages > 20) break;
    if (lastPageCount === records.length) break;
    lastPageCount = records.length;
  } while (true);

  // Fall back to actual fetched records if total_results missing
  if (total === 0 && records.length > 0) total = records.length;

  return { records, total };
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

  let errorHint: string | null = null;
  let rawTotals = { calls: 0, meetings: 0, opportunities: 0 };
  try {
    // First: a sanity probe without the user_id filter — tells us whether the
    // activity endpoint and the date range have ANY data in the org.
    try {
      const probe = await closeGet("activity/call/", {
        date_started__gte: from,
        date_started__lte: to,
        _limit: "1",
      });
      rawTotals.calls = probe?.total_results || (probe?.data?.length ?? 0);
    } catch (e: any) {
      errorHint = `Probe-Aufruf failed: ${e?.message || e}`;
    }

    const [callsResp, meetingsResp, emailsResp, oppsResp] = await Promise.all([
      fetchActivities({ subtype: "call", user_id: closeUserId, date_from: from, date_to: to }),
      fetchActivities({ subtype: "meeting", user_id: closeUserId, date_from: from, date_to: to }),
      fetchActivities({ subtype: "email", user_id: closeUserId, date_from: from, date_to: to }),
      closeGet("opportunity/", {
        user_id: closeUserId,
        date_created__gte: from,
        date_created__lte: to,
        _limit: "200",
      }),
    ]);

    const calls = callsResp.records;
    const meetings = meetingsResp.records;
    const emails = emailsResp.records;

    const callCount = callsResp.total;
    const callDurationSec = calls.reduce((s, c) => s + (c.duration || 0), 0);
    const outboundCalls = calls.filter((c) => c.direction === "outbound").length;
    const inboundCalls = calls.filter((c) => c.direction === "inbound").length;

    const meetingsScheduled = meetingsResp.total;
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
      errorHint,
      rawTotals,
    };
  } catch (err: any) {
    console.error("getUserKPIs failed:", err);
    return { ...empty, errorHint: err?.message || String(err), rawTotals };
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

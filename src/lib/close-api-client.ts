const PROXY = "/api/close-proxy";

async function closeGet(endpoint: string, params?: Record<string, string>): Promise<any> {
  const p = new URLSearchParams({ endpoint, ...params });
  const res = await fetch(`${PROXY}?${p.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Close API ${res.status}`);
  }
  return res.json();
}

// --- Types ---

export type CloseOpportunity = {
  id: string;
  lead_id: string;
  lead_name: string;
  contact_name: string | null;
  user_id: string;
  user_name: string;
  status_id: string;
  status_label: string;
  status_type: "active" | "won" | "lost";
  value: number; // in cents
  value_period: string;
  note: string;
  close_at: string | null;
  confidence: number;
  created_at: string;
  updated_at: string;
};

export type ClosePipeline = {
  id: string;
  name: string;
  statuses: { id: string; label: string; type: "active" | "won" | "lost" }[];
};

export type CloseActivity = {
  id: string;
  _type: string;
  lead_id: string;
  user_id: string;
  user_name: string;
  date_created: string;
  lead_name?: string;
  // Call specific
  duration?: number;
  direction?: string;
  disposition?: string;
  note?: string;
  // Email specific
  subject?: string;
  // Meeting specific
  title?: string;
  starts_at?: string;
};

export type CloseLeadStatus = {
  id: string;
  label: string;
};

// --- API calls ---

export async function getPipelines(): Promise<ClosePipeline[]> {
  const data = await closeGet("pipeline");
  return (data.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    statuses: (p.statuses || []).map((s: any) => ({ id: s.id, label: s.label, type: s.type })),
  }));
}

export async function getOpportunities(params?: {
  status_id?: string;
  status_type?: string;
  user_id?: string;
  _limit?: string;
}): Promise<{ data: CloseOpportunity[]; total_results: number }> {
  const qp: Record<string, string> = { _limit: params?._limit || "100" };
  if (params?.status_id) qp.status_id = params.status_id;
  if (params?.status_type) qp.status_type = params.status_type;
  if (params?.user_id) qp.user_id = params.user_id;
  const data = await closeGet("opportunity", qp);
  return {
    data: (data.data || []).map(mapOpportunity),
    total_results: data.total_results || 0,
  };
}

function mapOpportunity(o: any): CloseOpportunity {
  return {
    id: o.id,
    lead_id: o.lead_id,
    lead_name: o.lead_name || "",
    contact_name: o.contact_name || null,
    user_id: o.user_id,
    user_name: o.user_name || "",
    status_id: o.status_id,
    status_label: o.status_label || "",
    status_type: o.status_type || "active",
    value: o.value || 0,
    value_period: o.value_period || "one_time",
    note: o.note || "",
    close_at: o.date_won || o.close_date || null,
    confidence: o.confidence || 0,
    created_at: o.date_created || "",
    updated_at: o.date_updated || "",
  };
}

export async function getLeadStatuses(): Promise<CloseLeadStatus[]> {
  const data = await closeGet("status/lead");
  return (data.data || []).map((s: any) => ({ id: s.id, label: s.label }));
}

export async function getLeadsByStatus(statusId: string, limit = 100): Promise<{ data: any[]; total_results: number }> {
  const data = await closeGet("lead", { status_id: statusId, _limit: String(limit), _fields: "id,display_name,contacts,status_label" });
  return { data: data.data || [], total_results: data.total_results || 0 };
}

export async function getActivities(params?: {
  date_created__gte?: string;
  date_created__lte?: string;
  _type?: string;
  user_id?: string;
  _limit?: string;
}): Promise<CloseActivity[]> {
  const qp: Record<string, string> = { _limit: params?._limit || "50" };
  if (params?.date_created__gte) qp["date_created__gte"] = params.date_created__gte;
  if (params?.date_created__lte) qp["date_created__lte"] = params.date_created__lte;
  if (params?._type) qp["_type"] = params._type;
  if (params?.user_id) qp["user_id"] = params.user_id;
  const data = await closeGet("activity", qp);
  return (data.data || []).map((a: any) => ({
    id: a.id,
    _type: a._type,
    lead_id: a.lead_id,
    user_id: a.user_id,
    user_name: a.user_name || a._user_name || "",
    date_created: a.date_created,
    lead_name: a.lead_name || a._lead_name || "",
    duration: a.duration,
    direction: a.direction,
    disposition: a.disposition,
    note: a.note_plain || a.note,
    subject: a.subject,
    title: a.title,
    starts_at: a.starts_at,
  }));
}

export async function getOrgUsers(): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const data = await closeGet("me");
  // me endpoint returns current user; use memberships for all users
  const orgData = await closeGet("membership");
  return (orgData.data || []).map((m: any) => ({
    id: m.user_id,
    first_name: m.user_first_name || "",
    last_name: m.user_last_name || "",
    email: m.user_email || "",
  }));
}

// --- Aggregation helpers ---

export async function getPipelineSummary(): Promise<{
  pipeline: ClosePipeline;
  stages: { id: string; label: string; type: string; count: number; value: number }[];
  totalValue: number;
  totalCount: number;
}> {
  const pipelines = await getPipelines();
  const salesPipeline = pipelines.find((p) => p.name === "Sales") || pipelines[0];
  if (!salesPipeline) throw new Error("No pipeline found");

  // Get all active opportunities
  const { data: opps } = await getOpportunities({ _limit: "200" });
  const activeOpps = opps.filter((o) => o.status_type === "active");

  const stages = salesPipeline.statuses.map((s) => {
    const stageOpps = activeOpps.filter((o) => o.status_id === s.id);
    return {
      id: s.id,
      label: s.label,
      type: s.type,
      count: stageOpps.length,
      value: stageOpps.reduce((sum, o) => sum + o.value, 0),
    };
  });

  return {
    pipeline: salesPipeline,
    stages,
    totalValue: activeOpps.reduce((sum, o) => sum + o.value, 0),
    totalCount: activeOpps.length,
  };
}

export async function getWeightedForecast(): Promise<{
  totalWeighted: number;
  totalUnweighted: number;
  byUser: { name: string; weighted: number; unweighted: number; count: number }[];
}> {
  const { data: opps } = await getOpportunities({ status_type: "active", _limit: "200" });

  const byUser = new Map<string, { name: string; weighted: number; unweighted: number; count: number }>();

  for (const o of opps) {
    const key = o.user_name || "Unbekannt";
    const existing = byUser.get(key) || { name: key, weighted: 0, unweighted: 0, count: 0 };
    existing.weighted += Math.round(o.value * (o.confidence / 100));
    existing.unweighted += o.value;
    existing.count += 1;
    byUser.set(key, existing);
  }

  return {
    totalWeighted: opps.reduce((s, o) => s + Math.round(o.value * (o.confidence / 100)), 0),
    totalUnweighted: opps.reduce((s, o) => s + o.value, 0),
    byUser: Array.from(byUser.values()),
  };
}

export async function searchLeadByName(name: string): Promise<{ id: string; name: string; status: string; contacts: any[] } | null> {
  try {
    const data = await closeGet("lead", { query: `name:"${name}"`, _limit: "1", _fields: "id,display_name,status_label,contacts" });
    if (data.data && data.data.length > 0) {
      const l = data.data[0];
      return { id: l.id, name: l.display_name, status: l.status_label, contacts: l.contacts || [] };
    }
  } catch {}
  return null;
}

export async function searchLeads(query: string): Promise<{ id: string; name: string; status: string; contacts: any[] }[]> {
  try {
    const data = await closeGet("lead", { query, _limit: "10", _fields: "id,display_name,status_label,contacts" });
    if (data.data && data.data.length > 0) {
      return data.data.map((l: any) => ({ id: l.id, name: l.display_name, status: l.status_label, contacts: l.contacts || [] }));
    }
  } catch {}
  return [];
}

export async function getLeadActivities(leadId: string): Promise<CloseActivity[]> {
  const data = await closeGet("activity", { lead_id: leadId, _limit: "30" });
  return (data.data || []).map((a: any) => ({
    id: a.id,
    _type: a._type,
    lead_id: a.lead_id,
    user_id: a.user_id,
    user_name: a.user_name || a._user_name || "",
    date_created: a.date_created,
    lead_name: a.lead_name || a._lead_name || "",
    duration: a.duration,
    direction: a.direction,
    disposition: a.disposition,
    note: a.note_plain || a.note,
    subject: a.subject,
    title: a.title,
    starts_at: a.starts_at,
  }));
}

export async function getLeadOpportunities(leadId: string): Promise<CloseOpportunity[]> {
  const data = await closeGet("opportunity", { lead_id: leadId, _limit: "20" });
  return (data.data || []).map(mapOpportunity);
}

export async function getTodayActivities(): Promise<{
  calls: CloseActivity[];
  emails: CloseActivity[];
  meetings: CloseActivity[];
  total: number;
  byUser: { name: string; calls: number; emails: number; meetings: number }[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const activities = await getActivities({
    date_created__gte: today,
    _limit: "100",
  });

  const calls = activities.filter((a) => a._type === "Call" || a._type === "call");
  const emails = activities.filter((a) => a._type === "Email" || a._type === "email");
  const meetings = activities.filter((a) => a._type === "Meeting" || a._type === "meeting");

  const userMap = new Map<string, { name: string; calls: number; emails: number; meetings: number }>();
  for (const a of activities) {
    const name = a.user_name || "Unbekannt";
    const existing = userMap.get(name) || { name, calls: 0, emails: 0, meetings: 0 };
    if (a._type === "Call" || a._type === "call") existing.calls++;
    if (a._type === "Email" || a._type === "email") existing.emails++;
    if (a._type === "Meeting" || a._type === "meeting") existing.meetings++;
    userMap.set(name, existing);
  }

  return {
    calls,
    emails,
    meetings,
    total: activities.length,
    byUser: Array.from(userMap.values()),
  };
}

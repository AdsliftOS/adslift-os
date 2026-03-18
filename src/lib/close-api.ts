const CLOSE_API_KEY = "api_3auphoZT81H4ZbTfQ2Kjst.2M4RkVc23iDPQL4dERqjxd";

async function closeFetch(endpoint: string) {
  const res = await fetch(`https://api.close.com/api/v1${endpoint}`, {
    headers: {
      Authorization: `Basic ${btoa(CLOSE_API_KEY + ":")}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Close API error");
  return res.json();
}

// Get leads created in a specific date range
export async function getLeadsCreatedBetween(dateFrom: string, dateTo: string): Promise<number> {
  try {
    const query = encodeURIComponent(`created >= "${dateFrom}" and created <= "${dateTo}"`);
    const data = await closeFetch(`/lead/?query=${query}&_limit=0&_fields=id`);
    return data.total_results || 0;
  } catch (err) {
    console.error("Close API error:", err);
    return 0;
  }
}

// Get leads created this week (Monday to now)
export async function getLeadsThisWeek(): Promise<number> {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const dateFrom = monday.toISOString().split("T")[0];
  const dateTo = now.toISOString().split("T")[0];
  return getLeadsCreatedBetween(dateFrom, dateTo);
}

// Get leads created in a specific week (given week start date)
export async function getLeadsForWeek(weekStart: Date): Promise<number> {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const dateFrom = start.toISOString().split("T")[0];
  const dateTo = end.toISOString().split("T")[0];
  return getLeadsCreatedBetween(dateFrom, dateTo);
}

// Get total lead count
export async function getTotalLeadCount(): Promise<number> {
  try {
    const data = await closeFetch("/lead/?_limit=0&_fields=id");
    return data.total_results || 0;
  } catch {
    return 0;
  }
}

// Calls our Vercel Edge Function which proxies to Close API
export async function getLeadsCreatedBetween(dateFrom: string, dateTo: string): Promise<number> {
  try {
    const res = await fetch(`/api/close-leads?from=${dateFrom}&to=${dateTo}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function getLeadsThisWeek(): Promise<number> {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return getLeadsCreatedBetween(
    monday.toISOString().split("T")[0],
    now.toISOString().split("T")[0]
  );
}

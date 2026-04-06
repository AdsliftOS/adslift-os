import { supabase } from "@/lib/supabase";
import { getOpportunities, getLeadsByStatus, getLeadStatuses } from "@/lib/close-api-client";

const USER_MAP: Record<string, string> = {
  "user_MfUpEG0kc0tuHOHH0gvf3ttj1P2zm2R93C2BGweO3Yb": "alex",
  "user_lPRiFsx2FMtcUtiEJ0BikFvTwNVEnKrQSibG8oetnmv": "daniel",
};

const CLOSE_AUTOTASK_KEY = "close-autotask-last-run";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function alreadyRanToday(): boolean {
  return localStorage.getItem(CLOSE_AUTOTASK_KEY) === todayStr();
}

function markRanToday() {
  localStorage.setItem(CLOSE_AUTOTASK_KEY, todayStr());
}

function fmt(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export async function generateCloseAutoTasks() {
  if (alreadyRanToday()) return;

  try {
    const today = todayStr();

    // Get all active opportunities
    const { data: opps } = await getOpportunities({ status_type: "active", _limit: "200" });
    if (!opps || opps.length === 0) { markRanToday(); return; }

    // Group by user
    const byUser = new Map<string, typeof opps>();
    for (const o of opps) {
      const assignee = USER_MAP[o.user_id] || "alex";
      const list = byUser.get(assignee) || [];
      list.push(o);
      byUser.set(assignee, list);
    }

    for (const [assignee, userOpps] of byUser) {
      // Find overdue opportunities
      const overdue = userOpps.filter((o) => o.close_at && o.close_at.slice(0, 10) < today);
      // Find today's close dates
      const dueToday = userOpps.filter((o) => o.close_at && o.close_at.slice(0, 10) === today);

      if (overdue.length === 0 && dueToday.length === 0) continue;

      // Check if task already exists for today
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("assignee", assignee)
        .eq("due_date", today)
        .like("title", "%Close Follow Ups%")
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Build description
      const lines: string[] = [`Automatische Follow-Up-Liste aus Close CRM (${today})\n`];

      if (dueToday.length > 0) {
        lines.push("HEUTE FÄLLIG:");
        for (const o of dueToday) {
          lines.push(`- ${o.lead_name}: ${fmt(o.value)} | Confidence: ${o.confidence}%${o.note ? " | " + o.note : ""}`);
        }
        lines.push("");
      }

      if (overdue.length > 0) {
        lines.push(`ÜBERFÄLLIG (${overdue.length}):`);
        for (const o of overdue.sort((a, b) => (b.close_at || "").localeCompare(a.close_at || ""))) {
          lines.push(`- ${o.lead_name}: ${fmt(o.value)} | Close: ${o.close_at?.slice(0, 10)} | Confidence: ${o.confidence}%${o.note ? " | " + o.note : ""}`);
        }
        lines.push("");
      }

      const totalValue = [...dueToday, ...overdue].reduce((s, o) => s + o.value, 0);
      lines.push(`TOTAL: ${fmt(totalValue)} | ${dueToday.length} heute, ${overdue.length} überfällig`);

      await supabase.from("tasks").insert({
        title: "Close Follow Ups",
        description: lines.join("\n"),
        category: "sales",
        priority: "high",
        due_date: today,
        col: "todo",
        recurrence: "none",
        assignee,
      });
    }

    markRanToday();
  } catch (e) {
    console.error("Failed to generate Close auto-tasks:", e);
  }
}

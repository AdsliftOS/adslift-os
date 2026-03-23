import { supabase } from "@/lib/supabase";

/**
 * Auto-generate tasks:
 * 1. Contract expiry warning — 7 days before contract_end
 * 2. Weekly report tasks — every Monday for each active client
 */
export async function generateAutoTasks() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // --- 1) Contract expiry tasks (7-day warning) ---
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in7daysStr = in7days.toISOString().slice(0, 10);

    const { data: expiringClients } = await supabase
      .from("clients")
      .select("id, name, contract_end")
      .not("contract_end", "is", null)
      .lte("contract_end", in7daysStr)
      .gte("contract_end", todayStr);

    if (expiringClients && expiringClients.length > 0) {
      // Get start of this week (Monday)
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - diff);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      for (const client of expiringClients) {
        // Check if task already exists this week
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .ilike("title", `%${client.name}%läuft%`)
          .gte("created_at", weekStartStr)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("tasks").insert({
            title: `Vertrag ${client.name} läuft ab am ${new Date(client.contract_end).toLocaleDateString("de-DE")}`,
            category: "admin",
            priority: "high",
            col: "todo",
            due_date: client.contract_end,
          });
        }
      }
    }

    // --- 2) Weekly report tasks (Monday only) ---
    if (today.getDay() === 1) {
      const { data: activeClients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "Active");

      if (activeClients && activeClients.length > 0) {
        for (const client of activeClients) {
          const { data: existing } = await supabase
            .from("tasks")
            .select("id")
            .eq("title", `Report senden: ${client.name}`)
            .eq("due_date", todayStr)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("tasks").insert({
              title: `Report senden: ${client.name}`,
              category: "fulfillment",
              priority: "medium",
              col: "todo",
              due_date: todayStr,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[autoTasks] Fehler:", err);
  }
}

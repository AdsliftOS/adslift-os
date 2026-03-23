import { supabase } from "@/lib/supabase";
import type { NotificationType } from "@/store/notifications";

async function isTypeEnabled(userEmail: string, type: NotificationType): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("notification_settings")
      .select("enabled")
      .eq("user_email", userEmail)
      .eq("type", type)
      .limit(1)
      .maybeSingle();

    // If no row exists, default to enabled
    if (!data) return true;
    return data.enabled !== false;
  } catch {
    return true;
  }
}

async function hasDuplicateToday(type: NotificationType, title: string, userEmail: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_email", userEmail)
    .eq("type", type)
    .eq("title", title)
    .gte("created_at", todayStart.toISOString())
    .limit(1);

  return !!(data && data.length > 0);
}

async function createNotification(
  userEmail: string,
  type: NotificationType,
  title: string,
  message: string
) {
  // Check if type is enabled
  if (!(await isTypeEnabled(userEmail, type))) return;
  // Check for duplicate today
  if (await hasDuplicateToday(type, title, userEmail)) return;

  await supabase.from("notifications").insert({
    type,
    title,
    message,
    read: false,
    user_email: userEmail,
  });
}

export async function generateNotifications(userEmail: string) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in7daysStr = in7days.toISOString().slice(0, 10);

    // a) Contract expiry within 7 days
    const { data: expiringClients } = await supabase
      .from("clients")
      .select("id, name, contract_end")
      .not("contract_end", "is", null)
      .lte("contract_end", in7daysStr)
      .gte("contract_end", todayStr);

    if (expiringClients) {
      for (const client of expiringClients) {
        const endDate = new Date(client.contract_end).toLocaleDateString("de-DE");
        await createNotification(
          userEmail,
          "contract_expiry",
          `Vertrag ${client.name} läuft aus`,
          `Der Vertrag mit ${client.name} endet am ${endDate}. Bitte rechtzeitig verlängern.`
        );
      }
    }

    // b) Tasks due today
    const { data: dueTasks } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("due_date", todayStr)
      .neq("col", "done");

    if (dueTasks) {
      for (const task of dueTasks) {
        await createNotification(
          userEmail,
          "task_due",
          `Aufgabe fällig: ${task.title}`,
          `Die Aufgabe "${task.title}" ist heute fällig.`
        );
      }
    }

    // c) Campaign underperformance (Meta Ads)
    try {
      const res = await fetch(`/api/meta-ads?preset=yesterday`);
      if (res.ok) {
        const campaigns = await res.json();
        if (Array.isArray(campaigns)) {
          for (const campaign of campaigns) {
            const ctr = parseFloat(campaign.ctr || "0");
            const spend = parseFloat(campaign.spend || "0");
            if (ctr < 0.8 && spend > 20) {
              await createNotification(
                userEmail,
                "campaign_underperform",
                `Kampagne underperformt: ${campaign.campaign_name || campaign.name || "Unbekannt"}`,
                `CTR: ${ctr.toFixed(2)}% | Spend: ${spend.toFixed(2)}€ — Die Kampagne sollte optimiert werden.`
              );
            }
          }
        }
      }
    } catch {
      // Meta Ads API might not be available — skip silently
    }
  } catch (err) {
    console.error("[notificationGenerator] Fehler:", err);
  }
}

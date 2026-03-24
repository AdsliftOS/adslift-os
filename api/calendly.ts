import type { VercelRequest, VercelResponse } from "@vercel/node";

const TOKEN = process.env.CALENDLY_TOKEN;
const USER_URI = "https://api.calendly.com/users/9b1cf1af-1498-4315-8f9c-d969cd0c1aab";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!TOKEN) return res.status(400).json({ error: "No Calendly token" });

  const action = req.query.action as string;

  try {
    if (action === "event_types") {
      const resp = await fetch(
        `https://api.calendly.com/event_types?user=${USER_URI}&active=true`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      const data = await resp.json();
      const types = (data.collection || []).map((e: any) => ({
        name: e.name,
        slug: e.slug,
        duration: e.duration,
        url: e.scheduling_url,
        color: e.color,
      }));
      return res.json({ types });
    }

    if (action === "scheduled") {
      const minTime = req.query.from as string;
      const maxTime = req.query.to as string;
      const resp = await fetch(
        `https://api.calendly.com/scheduled_events?user=${USER_URI}&min_start_time=${minTime}&max_start_time=${maxTime}&status=active&count=100`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      const data = await resp.json();

      // For each event, get invitee details
      const events = await Promise.all(
        (data.collection || []).map(async (e: any) => {
          let inviteeName = "";
          let inviteeEmail = "";
          try {
            const invResp = await fetch(`${e.uri}/invitees`, {
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            const invData = await invResp.json();
            if (invData.collection && invData.collection.length > 0) {
              inviteeName = invData.collection[0].name || "";
              inviteeEmail = invData.collection[0].email || "";
            }
          } catch {}
          return {
            name: e.name,
            startTime: e.start_time,
            endTime: e.end_time,
            status: e.status,
            location: e.location?.join_url || "",
            inviteeName,
            inviteeEmail,
          };
        })
      );
      return res.json({ events });
    }

    if (action === "create_link") {
      const eventTypeSlug = req.query.slug as string;
      const clientName = req.query.name as string;
      const clientEmail = req.query.email as string;

      const baseUrl = `https://calendly.com/consulting-og-info/${eventTypeSlug}`;
      const params = new URLSearchParams();
      if (clientName) params.set("name", clientName);
      if (clientEmail) params.set("email", clientEmail);

      const link = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
      return res.json({ link });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

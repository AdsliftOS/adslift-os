// Tool-Definitionen + Executor für den In-App Claude-Chat.
// Tools werden Claude im /api/claude Request mitgeschickt; Aufrufe werden
// hier client-seitig gegen Supabase ausgeführt (respektiert RLS / Auth-Session).

import { supabase } from "@/lib/supabase";

export const CLAUDE_TOOLS = [
  {
    name: "list_clients",
    description:
      "Liste aller Kunden mit ID, Name, Firma, Kontakt, E-Mail, Phone, Status, Revenue, Vertragslaufzeit. Nutze das wenn du wissen willst welche Kunden es gibt oder einen Kunden anhand eines Namens suchen willst.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optionaler Such-String — filtert nach Name oder Firma (case-insensitive)." },
      },
    },
  },
  {
    name: "get_client_details",
    description:
      "Komplette Details zu einem Kunden: Profil, alle Pipeline-Projekte, offene Tasks, letzte 10 Close-Activities (Calls/Meetings/Notes), nächste Calendar-Events.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "list_pipeline_projects",
    description:
      "Alle Pipeline-Projekte mit Variante (DWY/D4Y), Status, Kunde, Onboarding-Status. Optional gefiltert.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "active", "paused", "done"] },
        variant: { type: "string", enum: ["dwy", "d4y"] },
      },
    },
  },
  {
    name: "get_project_details",
    description:
      "Details zu einem Pipeline-Projekt inkl. aller Steps mit Status (todo/active/done), Onboarding-Status, Drive-Links, Meeting-Notes-Snippet.",
    input_schema: {
      type: "object",
      properties: { project_id: { type: "string" } },
      required: ["project_id"],
    },
  },
  {
    name: "list_tasks",
    description:
      "Tasks im System. Filter: Spalte (todo/in-progress/done), Assignee (alex/daniel), nur überfällige, oder pro Kunde.",
    input_schema: {
      type: "object",
      properties: {
        column: { type: "string", enum: ["todo", "in-progress", "done"] },
        assignee: { type: "string", description: "alex oder daniel" },
        overdue_only: { type: "boolean", description: "Nur überfällige offene Tasks." },
        client_id: { type: "string" },
      },
    },
  },
  {
    name: "list_recent_activities",
    description:
      "Letzte Close-Activities (Calls/Meetings/Notes) mit Datum, Titel, Body, Dauer. Optional pro Kunde.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        limit: { type: "integer", description: "Default 20, max 50." },
      },
    },
  },
  {
    name: "list_calendar_events",
    description:
      "Kalender-Events. Default die nächsten 14 Tage. Format: title, date, start_time, type, client, description.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO-Datum YYYY-MM-DD" },
        to: { type: "string", description: "ISO-Datum YYYY-MM-DD" },
      },
    },
  },
];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function executeClaudeTool(name: string, input: any): Promise<unknown> {
  switch (name) {
    case "list_clients": {
      let q = supabase
        .from("clients")
        .select("id, name, company, contact, email, phone, status, revenue, contract_start, contract_end")
        .limit(200);
      if (input.search) {
        const s = String(input.search).replace(/[%_]/g, "");
        q = q.or(`name.ilike.%${s}%,company.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }

    case "get_client_details": {
      const id = String(input.client_id);
      const [client, projects, tasks, activities, events] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("pipeline_projects")
          .select("id, name, variant, status, start_date, onboarding_confirmed")
          .eq("client_id", id),
        supabase
          .from("tasks")
          .select("id, title, col, priority, due_date, category, assignee")
          .eq("client_id", id)
          .neq("col", "done")
          .order("due_date", { ascending: true }),
        supabase
          .from("close_activities")
          .select("type, title, body, activity_at, duration_seconds, outcome")
          .eq("client_id", id)
          .order("activity_at", { ascending: false })
          .limit(10),
        supabase
          .from("calendar_events")
          .select("title, date, start_time, type, description")
          .eq("client_id", id)
          .gte("date", today())
          .order("date", { ascending: true })
          .limit(10),
      ]);
      return {
        client: client.data,
        projects: projects.data,
        open_tasks: tasks.data,
        recent_activities: activities.data,
        upcoming_events: events.data,
      };
    }

    case "list_pipeline_projects": {
      let q = supabase
        .from("pipeline_projects")
        .select("id, name, variant, status, client_id, start_date, onboarding_confirmed, created_at");
      if (input.status) q = q.eq("status", input.status);
      if (input.variant) q = q.eq("variant", input.variant);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }

    case "get_project_details": {
      const id = String(input.project_id);
      const [project, steps] = await Promise.all([
        supabase
          .from("pipeline_projects")
          .select("id, name, variant, status, client_id, start_date, onboarding_confirmed, drive_links, meeting_notes")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("pipeline_steps")
          .select("id, name, description, position, status, started_at, completed_at")
          .eq("project_id", id)
          .order("position", { ascending: true }),
      ]);
      // Meeting-Notes auf Snippet kürzen damit's nicht den Context sprengt
      if (project.data?.meeting_notes && project.data.meeting_notes.length > 1500) {
        project.data.meeting_notes = project.data.meeting_notes.slice(0, 1500) + "... (gekürzt)";
      }
      return { project: project.data, steps: steps.data };
    }

    case "list_tasks": {
      let q = supabase
        .from("tasks")
        .select("id, title, description, col, priority, due_date, category, assignee, client_id");
      if (input.column) q = q.eq("col", input.column);
      if (input.assignee) q = q.eq("assignee", input.assignee);
      if (input.client_id) q = q.eq("client_id", input.client_id);
      if (input.overdue_only) {
        q = q.lt("due_date", today()).neq("col", "done");
      }
      const { data, error } = await q.order("due_date", { ascending: true }).limit(100);
      if (error) throw error;
      return data;
    }

    case "list_recent_activities": {
      const limit = Math.min(Number(input.limit) || 20, 50);
      let q = supabase
        .from("close_activities")
        .select("client_id, type, title, body, activity_at, duration_seconds, outcome");
      if (input.client_id) q = q.eq("client_id", input.client_id);
      const { data, error } = await q
        .order("activity_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    }

    case "list_calendar_events": {
      const from = input.from || today();
      const to = input.to || addDays(14);
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, date, start_time, end_time, type, client, description, client_id")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

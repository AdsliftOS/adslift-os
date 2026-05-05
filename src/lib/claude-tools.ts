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
  {
    name: "get_project_board",
    description:
      "Liest den Inhalt des Excalidraw-Strategie-Boards eines Pipeline-Projekts. Liefert alle Text-Elemente (Sticky Notes, Labels), Shapes (Boxes/Pfeile/Linien) mit Positionen und Bilder. Nutze das wenn der User wissen will was auf dem Board steht oder du den visuellen Plan eines Kunden interpretieren sollst (Funnel, Strategie, Mindmap etc.).",
    input_schema: {
      type: "object",
      properties: { project_id: { type: "string" } },
      required: ["project_id"],
    },
  },
  {
    name: "describe_schema",
    description:
      "Liefert die Liste aller verfügbaren Datenbank-Tabellen mit Spalten und Typen. Nutze das BEVOR du query_table aufrufst, wenn du nicht sicher bist welche Tabelle/Spalte du brauchst. Ist auch nützlich wenn der User eine Frage zu einem Datenbereich stellt für den es noch kein dediziertes Tool gibt (z.B. deals, expenses, time_entries, employee_todos, achievements, sales_weeks, lesson_progress, etc.).",
    input_schema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Optional — wenn gesetzt nur Spalten dieser einen Tabelle." },
      },
    },
  },
  {
    name: "query_table",
    description:
      "Universal-SELECT auf eine beliebige Tabelle. Nutze das für alles was die spezialisierten Tools nicht abdecken (Deals, Expenses, Achievements, Time Entries, Employee Todos, Sales Weeks, Lesson Progress, Comments, Submissions etc.). Default-Limit: 50, max: 500. Filter: einfache Equality-Filter pro Spalte.",
    input_schema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Tabellen-Name (lowercase, z.B. 'deals', 'expenses', 'time_entries')." },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Optional — Liste der Spalten. Default '*' (alle).",
        },
        filters: {
          type: "object",
          description: "Optional — { spalte: wert } für equality-Filter. Mehrere = AND-verknüpft.",
        },
        order_by: { type: "string", description: "Optional — Spalte nach der sortiert werden soll." },
        order_desc: { type: "boolean", description: "Default true (neueste zuerst)." },
        limit: { type: "integer", description: "Default 50, max 500." },
      },
      required: ["table_name"],
    },
  },
];

// Sensitive Tabellen / Spalten die Claude nicht lesen darf (Tokens, Geheimnisse)
const BLOCKED_TABLES = new Set(["oauth_tokens", "app_settings", "pandadoc_processed"]);
const HEAVY_COLUMNS_TO_STRIP: Record<string, string[]> = {
  pipeline_projects: ["excalidraw_data"], // 6MB JSON — separates Tool get_project_board
  close_activities: ["raw"], // großer Roh-JSON-Dump
};

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

    case "get_project_board": {
      const id = String(input.project_id);
      const { data, error } = await supabase
        .from("pipeline_projects")
        .select("name, excalidraw_data")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { error: "Projekt nicht gefunden" };
      return summarizeExcalidraw(data.name, data.excalidraw_data);
    }

    case "describe_schema": {
      const tableFilter = input.table_name ? String(input.table_name).toLowerCase() : null;
      const { data, error } = await supabase.rpc("public_table_columns", {
        table_name_filter: tableFilter,
      });
      if (error) {
        // Fallback: Hardcoded-Liste falls RPC nicht existiert
        return SCHEMA_FALLBACK.filter((t) => !tableFilter || t.table === tableFilter);
      }
      return data;
    }

    case "query_table": {
      const table = String(input.table_name || "").toLowerCase();
      if (!table) throw new Error("table_name fehlt");
      if (BLOCKED_TABLES.has(table)) {
        throw new Error(`Tabelle "${table}" ist gesperrt (enthält Secrets/Tokens).`);
      }
      const columns = Array.isArray(input.columns) && input.columns.length > 0
        ? input.columns.filter((c: any) => typeof c === "string").join(",")
        : "*";
      const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 500);
      const filters = input.filters && typeof input.filters === "object" ? input.filters : {};

      let q = supabase.from(table).select(columns).limit(limit);
      for (const [col, val] of Object.entries(filters)) {
        if (val === null || val === undefined) continue;
        q = q.eq(col, val as any);
      }
      if (input.order_by) {
        q = q.order(String(input.order_by), { ascending: input.order_desc === false });
      }
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);

      // Heavy-Spalten ausnullen falls nicht explizit angefragt
      const stripCols = HEAVY_COLUMNS_TO_STRIP[table] || [];
      if (stripCols.length > 0 && Array.isArray(data)) {
        for (const row of data as any[]) {
          for (const c of stripCols) {
            if (c in row) row[c] = "[stripped — too heavy, request explicitly]";
          }
        }
      }
      return data;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Fallback wenn die public_table_columns RPC noch nicht existiert
const SCHEMA_FALLBACK = [
  { table: "clients", cols: "id, name, contact, email, phone, company, projects, revenue, status, created_at, contract_start, contract_end, close_lead_id" },
  { table: "pipeline_projects", cols: "id, name, variant, status, client_id, start_date, onboarding_confirmed, drive_links, meeting_notes, creatives_html, ad_copy_html, customer_portal_token, portal_pin, portal_customer_name, created_by_email" },
  { table: "pipeline_steps", cols: "id, project_id, name, description, position, status, started_at, completed_at, data" },
  { table: "pipeline_step_templates", cols: "id, name, icon, description, color, is_default, sort_order, category, default_tasks" },
  { table: "pipeline_step_files", cols: "id, step_id, project_id, name, kind, content, created_at" },
  { table: "tasks", cols: "id, title, description, category, priority, due_date, col, recurrence, assignee, client_id, created_at" },
  { table: "calendar_events", cols: "id, title, date, start_time, end_time, type, client, description, meeting_link, project_id, assignee, google_event_id, client_id" },
  { table: "close_activities", cols: "id, client_id, type, title, body, activity_at, duration_seconds, outcome, user_id" },
  { table: "deals", cols: "id, client_id, product, value, status, stage, created_at" },
  { table: "expenses", cols: "id, name, category, amount, recurrence, date, created_at" },
  { table: "time_entries", cols: "id, employee, client_id, task, duration_seconds, date, started_at, ended_at, notes" },
  { table: "employee_todos", cols: "id, assignee, title, description, status, priority, due_date, category, created_at" },
  { table: "achievements", cols: "id, employee, type, value, date, notes" },
  { table: "sales_weeks", cols: "id, employee, week_start, leads, calls_made, deals_closed, revenue" },
  { table: "academy_customers", cols: "id, name, email, client_id, variant, onboarding_completed, kickoff_call_booked, status, created_at" },
  { table: "courses", cols: "id, title, description, sort_order, slug, status, banner_url" },
  { table: "chapters", cols: "id, course_id, title, sort_order, slug" },
  { table: "lessons", cols: "id, chapter_id, course_id, title, content, video_url, sort_order, slug, type" },
  { table: "lesson_progress", cols: "id, customer_id, lesson_id, completed, completed_at, watch_time_seconds" },
  { table: "lesson_submissions", cols: "id, customer_id, lesson_id, content, submitted_at, status, feedback" },
  { table: "lesson_comments", cols: "id, customer_id, lesson_id, content, created_at" },
  { table: "client_comments", cols: "id, client_id, content, created_at, author" },
  { table: "meeting_noshows", cols: "id, client_id, date, reason, follow_up_status" },
  { table: "notifications", cols: "id, user_email, type, title, body, link, read, created_at" },
  { table: "notification_settings", cols: "id, user_email, channel, enabled" },
  { table: "team_members", cols: "id, email, name, role, status, color, calendar_color" },
  { table: "event_category_overrides", cols: "id, event_id, category, created_at" },
  { table: "quizzes", cols: "id, lesson_id, questions, passing_score" },
  { table: "quiz_results", cols: "id, customer_id, quiz_id, score, passed, completed_at" },
  { table: "projects", cols: "id (legacy), client_id, name, onboarding (jsonb), status — Legacy-Tabelle, in der Pipeline durch pipeline_projects abgelöst" },
  { table: "download_logs", cols: "id, file_name, downloaded_by, downloaded_at" },
];

// Excalidraw-JSON in eine kompakte, für Claude lesbare Form bringen.
// Original kann ~6MB groß sein (Bilder etc.) — wir liefern nur Struktur.
function summarizeExcalidraw(projectName: string, raw: any) {
  if (!raw || !raw.elements || !Array.isArray(raw.elements)) {
    return { project: projectName, status: "Board ist leer", elements: 0 };
  }
  const live = raw.elements.filter((e: any) => !e.isDeleted);

  type TextEl = { text: string; x: number; y: number; width: number; height: number };
  const texts: TextEl[] = live
    .filter((e: any) => e.type === "text" && e.text)
    .slice(0, 200)
    .map((e: any) => ({
      text: String(e.text).slice(0, 500),
      x: Math.round(e.x || 0),
      y: Math.round(e.y || 0),
      width: Math.round(e.width || 0),
      height: Math.round(e.height || 0),
    }));

  type ShapeEl = { type: string; x: number; y: number; width: number; height: number; label?: string };
  const shapes: ShapeEl[] = live
    .filter((e: any) => ["rectangle", "ellipse", "diamond"].includes(e.type))
    .slice(0, 200)
    .map((e: any) => {
      // Versuch das Label-Text-Element auszulesen (containerId-Match)
      const labelEl = live.find(
        (x: any) => x.type === "text" && x.containerId === e.id,
      );
      return {
        type: e.type,
        x: Math.round(e.x || 0),
        y: Math.round(e.y || 0),
        width: Math.round(e.width || 0),
        height: Math.round(e.height || 0),
        label: labelEl?.text ? String(labelEl.text).slice(0, 200) : undefined,
      };
    });

  type ConnEl = { from: string; to: string };
  const connections: ConnEl[] = live
    .filter((e: any) => (e.type === "arrow" || e.type === "line") && e.startBinding && e.endBinding)
    .slice(0, 200)
    .map((e: any) => {
      const fromEl = live.find((x: any) => x.id === e.startBinding?.elementId);
      const toEl = live.find((x: any) => x.id === e.endBinding?.elementId);
      const labelOf = (el: any) => {
        if (!el) return "?";
        if (el.type === "text") return String(el.text || "").slice(0, 80);
        const lbl = live.find((x: any) => x.type === "text" && x.containerId === el.id);
        return lbl?.text ? String(lbl.text).slice(0, 80) : `${el.type}@(${Math.round(el.x)},${Math.round(el.y)})`;
      };
      return { from: labelOf(fromEl), to: labelOf(toEl) };
    });

  const freeArrows = live.filter(
    (e: any) => (e.type === "arrow" || e.type === "line") && !(e.startBinding && e.endBinding),
  ).length;

  const imageCount = live.filter((e: any) => e.type === "image").length;

  return {
    project: projectName,
    total_elements: live.length,
    summary: {
      texts: texts.length,
      shapes: shapes.length,
      connections: connections.length,
      free_arrows_lines: freeArrows,
      images: imageCount,
    },
    texts,
    shapes,
    connections,
  };
}

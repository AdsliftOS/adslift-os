#!/usr/bin/env node
// Übernimmt legacy projects.phases → pipeline_steps mit korrektem Status
// (done/active/todo basierend auf Task-Completion).
import { readFileSync } from "fs";

const PROJECT_REF = "ofrvoxupatowfatpleji";
const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()])
);
const pat = env.SUPABASE_PAT;
if (!pat) { console.error("SUPABASE_PAT fehlt"); process.exit(1); }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t}`);
  return t === "" ? [] : JSON.parse(t);
}

const escape = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

// 1. Legacy projects mit phases laden
const legacy = await sql(`
  select p.id::text as id, p.name, p.phases
  from projects p
  inner join pipeline_projects pp on pp.id = p.id
  where p.phases is not null and p.phases::text != '[]'
`);
console.log(`Legacy projects mit phases: ${legacy.length}`);

// 2. Für die wo's noch keine pipeline_steps gibt
const existing = await sql(`select project_id::text from pipeline_steps`);
const haveSteps = new Set(existing.map((r) => r.project_id));
const todo = legacy.filter((p) => !haveSteps.has(p.id));
console.log(`Brauchen Steps: ${todo.length}`);

let inserted = 0;
for (const project of todo) {
  const phases = project.phases;
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    const tasks = (ph.tasks || []).map((t, idx) => ({
      id: `t${idx + 1}`,
      title: t.title,
      done: t.status === "done",
    }));
    const doneCount = tasks.filter((t) => t.done).length;
    let status = "todo";
    if (tasks.length > 0 && doneCount === tasks.length) status = "done";
    else if (doneCount > 0) status = "active";

    const startedAt = doneCount > 0 ? "now()" : "NULL";
    const completedAt = status === "done" ? "now()" : "NULL";
    const dataJson = JSON.stringify({ tasks });

    await sql(`
      insert into pipeline_steps (project_id, name, position, status, data, started_at, completed_at)
      values (${escape(project.id)}::uuid, ${escape(ph.title || `Phase ${i + 1}`)}, ${i}, ${escape(status)}, ${escape(dataJson)}::jsonb, ${startedAt}, ${completedAt})
    `);
    inserted++;
  }
  console.log(`✓ ${project.name} → ${phases.length} steps`);
}

console.log(`\nDone. ${inserted} pipeline_steps eingefügt.`);

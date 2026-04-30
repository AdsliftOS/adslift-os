#!/usr/bin/env node
/**
 * supabase-sql — runs a SQL file against Supabase via Management API
 *
 * Usage:
 *   node scripts/supabase-sql.mjs path/to/migration.sql
 *
 * Requires SUPABASE_PAT in .env (Personal Access Token).
 * Create one at: https://supabase.com/dashboard/account/tokens
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_REF = "ofrvoxupatowfatpleji";

function loadEnv() {
  try {
    const raw = readFileSync(".env", "utf8");
    const out = {};
    raw.split("\n").forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    });
    return out;
  } catch { return {}; }
}

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error("Usage: node scripts/supabase-sql.mjs <path/to/file.sql>");
    process.exit(1);
  }
  const env = loadEnv();
  const pat = env.SUPABASE_PAT;
  if (!pat) {
    console.error("SUPABASE_PAT fehlt in .env");
    console.error("Erstelle einen Token: https://supabase.com/dashboard/account/tokens");
    console.error("Dann: SUPABASE_PAT=sbp_... in .env packen");
    process.exit(1);
  }

  const sql = readFileSync(resolve(sqlPath), "utf8");
  console.log(`Running ${sqlPath} (${sql.length} chars) ...`);

  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${pat}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });

  const text = await r.text();
  if (!r.ok) {
    console.error(`✗ ${r.status}: ${text}`);
    process.exit(1);
  }
  console.log(`✓ ${r.status} OK`);
  if (text && text !== "[]") console.log(text.slice(0, 500));
}

main().catch((e) => { console.error(e); process.exit(1); });

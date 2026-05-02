// Deploys Revolut migration + Edge Functions to Supabase via Management API.
// Reads SUPABASE_PAT from .env. Reads the private key from .revolut-keys/privatecert.pem.
//
// Usage:
//   node scripts/deploy-revolut.mjs              # full deploy (migration + secrets + functions)
//   node scripts/deploy-revolut.mjs --no-sql     # skip SQL (functions/secrets only)
//   node scripts/deploy-revolut.mjs --only-fns   # functions only
//
// Required: REVOLUT_CLIENT_ID exported (or in .env), private key at .revolut-keys/privatecert.pem.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load .env minimally
const envText = (() => {
  try { return readFileSync(join(ROOT, ".env"), "utf8"); } catch { return ""; }
})();
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PROJECT_REF = "ofrvoxupatowfatpleji";
const PAT = process.env.SUPABASE_PAT;
if (!PAT) { console.error("Missing SUPABASE_PAT in .env"); process.exit(1); }

const args = process.argv.slice(2);
const NO_SQL = args.includes("--no-sql");
const ONLY_FNS = args.includes("--only-fns");

const REVOLUT_CLIENT_ID = process.env.REVOLUT_CLIENT_ID
  || "hEjZTrZyZedvxJRFuMRPO7IS0rf-PEBUp5Y3fLqKRXY";
const REVOLUT_REDIRECT_URI = process.env.REVOLUT_REDIRECT_URI
  || `https://${PROJECT_REF}.supabase.co/functions/v1/revolut-oauth-callback`;
const REVOLUT_APP_RETURN_URL = process.env.REVOLUT_APP_RETURN_URL
  || "https://agency-core-os.lovable.app/finances";

const PRIVATE_KEY = (() => {
  try { return readFileSync(join(ROOT, ".revolut-keys/privatecert.pem"), "utf8"); }
  catch { console.error("Missing .revolut-keys/privatecert.pem"); process.exit(1); }
})();

const apiBase = "https://api.supabase.com";
const headers = {
  Authorization: `Bearer ${PAT}`,
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} -> ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ---------------- 1. Run migration SQL ----------------
async function runSql() {
  const sql = readFileSync(
    join(ROOT, "supabase/migrations/20260503_revolut_integration.sql"),
    "utf8",
  );
  console.log("[sql] Running migration…");
  await api(`/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
  console.log("[sql] OK");
}

// ---------------- 2. Set Edge Function secrets ----------------
async function setSecrets() {
  console.log("[secrets] Setting Revolut secrets…");
  const secrets = [
    { name: "REVOLUT_CLIENT_ID", value: REVOLUT_CLIENT_ID },
    { name: "REVOLUT_PRIVATE_KEY", value: PRIVATE_KEY },
    { name: "REVOLUT_REDIRECT_URI", value: REVOLUT_REDIRECT_URI },
    { name: "REVOLUT_APP_RETURN_URL", value: REVOLUT_APP_RETURN_URL },
  ];
  await api(`/v1/projects/${PROJECT_REF}/secrets`, {
    method: "POST",
    body: JSON.stringify(secrets),
  });
  console.log("[secrets] OK");
}

// ---------------- 3. Bundle + deploy Edge Functions ----------------
function inlineSharedImports(filePath) {
  const src = readFileSync(filePath, "utf8");
  const dir = dirname(filePath);
  const importRe = /^import\s+(?:\{[^}]+\}|[\w*\s,]+)\s+from\s+["'](\.\.\/_shared\/[^"']+)["'];?\s*$/gm;
  let inlined = src;
  const importedFiles = new Set();
  let match;
  const toInline = [];
  while ((match = importRe.exec(src)) !== null) {
    const relPath = match[1];
    const absPath = join(dir, relPath);
    if (!importedFiles.has(absPath)) {
      importedFiles.add(absPath);
      let modSrc = readFileSync(absPath, "utf8");
      // Strip top-level import lines from the module (assume only external imports)
      modSrc = modSrc.replace(/^export\s+(?=(const|let|function|async\s+function|type|interface|class))/gm, "");
      modSrc = modSrc.replace(/^export\s+\{[^}]+\};?\s*$/gm, "");
      toInline.push(`// --- inlined from ${relPath} ---\n${modSrc}\n// --- end inline ---\n`);
    }
    inlined = inlined.replace(match[0], "");
  }
  return toInline.join("\n") + "\n" + inlined;
}

async function deployFunction(slug, verifyJwt) {
  const indexPath = join(ROOT, `supabase/functions/${slug}/index.ts`);
  const bundled = inlineSharedImports(indexPath);

  // Try to fetch existing
  let exists = false;
  try {
    await api(`/v1/projects/${PROJECT_REF}/functions/${slug}`);
    exists = true;
  } catch {}

  console.log(`[fn] Deploying ${slug} (${exists ? "update" : "create"})…`);

  // Multipart deploy endpoint
  const url = `${apiBase}/v1/projects/${PROJECT_REF}/functions/deploy?slug=${slug}`;
  const meta = {
    name: slug,
    verify_jwt: verifyJwt,
    entrypoint_path: "index.ts",
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([bundled], { type: "application/typescript" }), "index.ts");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`deploy ${slug} -> ${res.status}: ${text}`);
  console.log(`[fn] ${slug} OK`);
}

async function main() {
  if (!ONLY_FNS && !NO_SQL) await runSql();
  if (!ONLY_FNS) await setSecrets();
  await deployFunction("revolut-auth-start", false);
  await deployFunction("revolut-oauth-callback", false);
  await deployFunction("revolut-sync", false);
  console.log("\nAll deployed.");
  console.log("Auth start URL:");
  console.log(`  https://${PROJECT_REF}.supabase.co/functions/v1/revolut-auth-start`);
  console.log("OAuth callback (Revolut redirect URI):");
  console.log(`  ${REVOLUT_REDIRECT_URI}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

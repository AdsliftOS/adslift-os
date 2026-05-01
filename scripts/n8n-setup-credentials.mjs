#!/usr/bin/env node
/**
 * Automatisiert Credential-Setup in n8n via Playwright.
 *
 * Schritt 1: Browser öffnet n8n. Falls nicht eingeloggt, manuell einloggen.
 * Schritt 2: Script wartet bis du auf der Workflow-Übersicht bist.
 * Schritt 3: Erstellt Supabase-Credential automatisch.
 *
 * Nutzung: node scripts/n8n-setup-credentials.mjs
 */
import { chromium } from "playwright";
import { readFileSync } from "fs";

const SESSION_DIR = ".n8n-session";
const N8N_URL = "https://adsliftauto.app.n8n.cloud";
const PROJECT_REF = "ofrvoxupatowfatpleji";

const env = readFileSync(".env", "utf8");
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];

// Get service role key
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: "Bearer " + pat }
});
const keys = await keysRes.json();
const serviceRole = keys.find((k) => k.name === "service_role").api_key;

console.log("Launching browser ...");
const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1400, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(N8N_URL, { waitUntil: "domcontentloaded" });

console.log("Warte bis du eingeloggt bist (max 5 min) ...");
console.log("Falls Login-Seite: einloggen, dann passiert der Rest automatisch.");

// Wait until we land on a page that's NOT signin
await page.waitForFunction(() => !location.pathname.startsWith("/signin") && !location.pathname.startsWith("/setup"), { timeout: 5 * 60 * 1000 });

console.log("Eingeloggt. Navigiere zu Credentials ...");
await page.goto(`${N8N_URL}/projects/personal/credentials/new/supabaseApi`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// The new credential dialog opens. Look for fields.
console.log("Pruefe ob Credential-Dialog offen ist ...");
console.log("URL:", page.url());

// Take a screenshot for debugging
await page.screenshot({ path: "/tmp/n8n-cred-page.png" });
console.log("Screenshot: /tmp/n8n-cred-page.png");

console.log("\n>>> Browser bleibt offen — pruefe manuell und sag mir was du siehst.");
console.log(">>> Falls Credential-Dialog nicht da ist: Workflow-Page oeffnen, einen Supabase-Node klicken, dort 'Create new credential'.");
console.log(">>> Werte zum Eingeben:");
console.log(`    Host: https://${PROJECT_REF}.supabase.co`);
console.log(`    Service Role Secret: ${serviceRole}`);

// Keep open
await new Promise(() => {});

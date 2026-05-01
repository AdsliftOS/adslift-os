#!/usr/bin/env node
/**
 * Komplettes n8n-Setup in einem Rutzug.
 */
import { chromium } from "playwright";
import { readFileSync, appendFileSync, writeFileSync } from "fs";

const SESSION_DIR = ".n8n-session";
const N8N_URL = "https://adsliftauto.app.n8n.cloud";
const PROJECT_REF = "ofrvoxupatowfatpleji";

const env = readFileSync(".env", "utf8");
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: "Bearer " + pat },
});
const supabaseKeys = await keysRes.json();
const serviceRole = supabaseKeys.find((k) => k.name === "service_role").api_key;

console.log("Launching Chromium ...");
const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1400, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(N8N_URL, { waitUntil: "domcontentloaded" });

console.log("\n>>> LOGG DICH BITTE EIN. Warte bis ich n8n-Workflow-Liste sehe ...");

// Wait for actual logged-in state — look for sidebar/main app
await page.waitForSelector(
  '#sidebar, [data-test-id="main-sidebar"], [class*="sidebar"], .el-aside, nav[aria-label]',
  { timeout: 10 * 60 * 1000, state: "visible" }
);
// Extra safety: ensure we're not on signin
await page.waitForFunction(() => !location.pathname.startsWith("/signin"), { timeout: 60000 });
await page.waitForTimeout(2000);
console.log("Eingeloggt:", page.url());

console.log("Navigiere zu Settings -> API ...");
await page.goto(`${N8N_URL}/settings/api`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/n8n-api-loaded.png", fullPage: true });
console.log("Screenshot: /tmp/n8n-api-loaded.png");
console.log("URL:", page.url());

// Also dump all visible button texts for debugging
const allButtons = await page.$$eval("button", (btns) => btns.map((b) => b.textContent?.trim()).filter(Boolean));
console.log("Buttons on page:", allButtons.slice(0, 30));

// Try to find Create button
let clickedCreate = false;
const candidates = ["Create an API key", "Create API key", "Create", "New API key", "Add API key", "+ Add new"];
for (const text of candidates) {
  const handle = await page.$(`button:has-text("${text}")`).catch(() => null);
  if (handle) {
    const visible = await handle.isVisible().catch(() => false);
    if (visible) {
      console.log("Clicking button:", text);
      await handle.click();
      clickedCreate = true;
      break;
    }
  }
}

if (!clickedCreate) {
  console.log("Kein passender Button. Halte Browser offen.");
  await new Promise(() => {});
}

await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/n8n-api-dialog.png", fullPage: true });

// If a label input exists, fill it and submit
const labelInput = await page.$('input[placeholder*="Label" i], input[name="label"], input[id*="label" i]');
if (labelInput) {
  console.log("Filling label ...");
  await labelInput.fill("Claude Code Setup");
  await page.waitForTimeout(500);
  // Find Save button
  const saveBtns = ["Save", "Create", "Generate"];
  for (const t of saveBtns) {
    const h = await page.$(`button:has-text("${t}")`).catch(() => null);
    if (h && (await h.isVisible().catch(() => false))) {
      console.log("Click submit:", t);
      await h.click();
      break;
    }
  }
}

await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/n8n-api-key-shown.png", fullPage: true });

const html = await page.content();
let key = null;
const m1 = html.match(/n8n_api_[A-Za-z0-9._\-]{40,}/);
if (m1) key = m1[0];
if (!key) {
  const m2 = html.match(/eyJ[A-Za-z0-9._\-]{60,}/);
  if (m2) key = m2[0];
}

if (!key) {
  console.log("Konnte Key nicht finden. Bitte schau /tmp/n8n-api-key-shown.png an");
  await new Promise(() => {});
}

console.log("API-Key gefunden:", key.slice(0, 30) + "...");

const currentEnv = readFileSync(".env", "utf8");
if (!/N8N_API_KEY=/.test(currentEnv)) appendFileSync(".env", `N8N_API_KEY=${key}\n`);
else writeFileSync(".env", currentEnv.replace(/N8N_API_KEY=.*/g, `N8N_API_KEY=${key}`));
console.log("Saved to .env");

console.log("Erstelle Supabase-Credential via n8n-API ...");
const credRes = await fetch(`${N8N_URL}/api/v1/credentials`, {
  method: "POST",
  headers: { "X-N8N-API-KEY": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Supabase Adslift",
    type: "supabaseApi",
    data: { host: `https://${PROJECT_REF}.supabase.co`, serviceRole },
  }),
});
console.log("Supabase-Credential:", credRes.status, (await credRes.text()).slice(0, 300));

await page.waitForTimeout(2000);
await ctx.close();
console.log("DONE — Supabase-Credential ist drin. Sag SMTP-Daten an.");

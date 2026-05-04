import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = "ofrvoxupatowfatpleji";

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: "Bearer " + pat },
});
const keys = await keysRes.json();
const serviceRole = keys.find((k) => k.name === "service_role").api_key;
const SB_URL = `https://${PROJECT_REF}.supabase.co`;

const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { Authorization: "Bearer " + serviceRole, apikey: serviceRole, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: "info@consulting-og.de" }),
});
const { action_link } = await linkRes.json();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(action_link, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const finalUrl = page.url();
const hash = finalUrl.split("#")[1] || "";
const params = new URLSearchParams(hash);
const access_token = params.get("access_token");
const refresh_token = params.get("refresh_token");
const expires_at = parseInt(params.get("expires_at") || "0", 10);
const expires_in = parseInt(params.get("expires_in") || "3600", 10);

const payload = JSON.parse(Buffer.from(access_token.split(".")[1], "base64url").toString());
const user = {
  id: payload.sub, aud: payload.aud, role: payload.role, email: payload.email,
  email_confirmed_at: new Date().toISOString(), phone: "", confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: payload.app_metadata || {}, user_metadata: payload.user_metadata || {},
  identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};
const sessionData = { access_token, refresh_token, expires_at, expires_in, token_type: "bearer", user };

await page.goto("https://adslift-os.vercel.app/", { waitUntil: "domcontentloaded" });
await page.evaluate(({ key, val }) => localStorage.setItem(key, JSON.stringify(val)), { key: `sb-${PROJECT_REF}-auth-token`, val: sessionData });

// Tasks-Page mit Cache-Bust
await page.goto("https://adslift-os.vercel.app/tasks?_=" + Date.now(), { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

// Screenshot
await page.screenshot({ path: "/tmp/tasks-current.png", fullPage: true });
console.log("✓ Screenshot saved /tmp/tasks-current.png");

// HTML Source dumpen für Debug
const html = await page.content();
writeFileSync("/tmp/tasks-current.html", html);
console.log("✓ HTML saved /tmp/tasks-current.html");

// Check welcher viewMode aktiv ist
const viewMode = await page.evaluate(() => localStorage.getItem("tasks-view-mode-v2"));
const oldViewMode = await page.evaluate(() => localStorage.getItem("tasks-view-mode"));
console.log("viewMode (v2):", viewMode);
console.log("viewMode (legacy):", oldViewMode);

// Anzahl der Kanban-Spalten zählen
const colCount = await page.locator('.lg\\:grid-cols-5 > div, .lg\\:grid-cols-3 > div').count();
console.log("Detected columns in main board:", colCount);

// Toggle-Button-Texte
const toggles = await page.locator('button:has-text("Nach Kategorie"), button:has-text("Nach Status")').allTextContents();
console.log("Toggle buttons:", toggles);

await browser.close();

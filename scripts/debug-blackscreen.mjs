import { chromium } from "playwright";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = "ofrvoxupatowfatpleji";

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: "Bearer " + pat },
});
const keys = await keysRes.json();
const serviceRole = keys.find((k) => k.name === "service_role").api_key;
const SB_URL = `https://${PROJECT_REF}.supabase.co`;

// Magic-Link für Alex
const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { Authorization: "Bearer " + serviceRole, apikey: serviceRole, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: "info@consulting-og.de" }),
});
const { action_link } = await linkRes.json();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    errors.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on("pageerror", (err) => {
  errors.push(`[pageerror] ${err.message}\n${err.stack}`);
});

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

await page.goto("https://app.ads-lift.de/", { waitUntil: "domcontentloaded" });
await page.evaluate(({ key, val }) => localStorage.setItem(key, JSON.stringify(val)), { key: `sb-${PROJECT_REF}-auth-token`, val: sessionData });

// Pipeline
console.log("→ /pipeline");
await page.goto("https://app.ads-lift.de/pipeline", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
console.log("Pipeline-Page errors so far:", errors.length);
errors.forEach((e) => console.log("  ", e.slice(0, 200)));

// Click first project
console.log("→ click first project");
const buttons = await page.locator('button.aspect-square').count();
console.log("project cards:", buttons);
if (buttons > 0) {
  await page.locator('button.aspect-square').first().click();
  await page.waitForTimeout(5000);
  console.log("After click — total errors:", errors.length);
  errors.forEach((e) => console.log("  ", e.slice(0, 400)));
  await page.screenshot({ path: "/tmp/blackscreen-debug.png" });
  console.log("Screenshot saved /tmp/blackscreen-debug.png");
}

await browser.close();

import { chromium } from "playwright";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = "ofrvoxupatowfatpleji";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: "Bearer " + pat },
});
const keys = await keysRes.json();
const serviceRole = keys.find((k) => k.name === "service_role").api_key;
const SB_URL = `https://${PROJECT_REF}.supabase.co`;

// Magic-Link generieren
const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { Authorization: "Bearer " + serviceRole, apikey: serviceRole, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: "info@consulting-og.de" }),
});
const { action_link } = await linkRes.json();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Magic-Link folgen → Token-Hash in URL
await page.goto(action_link, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const finalUrl = page.url();
console.log("→ landed on:", finalUrl.slice(0, 80) + "...");

// Tokens aus dem URL-Fragment parsen
const hash = finalUrl.split("#")[1] || "";
const params = new URLSearchParams(hash);
const access_token = params.get("access_token");
const refresh_token = params.get("refresh_token");
const expires_at = parseInt(params.get("expires_at") || "0", 10);
const expires_in = parseInt(params.get("expires_in") || "3600", 10);

if (!access_token) { console.error("No access_token in URL"); process.exit(1); }
console.log("→ tokens parsed");

// User-Info aus JWT decoden (payload)
const payload = JSON.parse(Buffer.from(access_token.split(".")[1], "base64url").toString());
const user = {
  id: payload.sub,
  aud: payload.aud,
  role: payload.role,
  email: payload.email,
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: payload.app_metadata || {},
  user_metadata: payload.user_metadata || {},
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const sessionData = { access_token, refresh_token, expires_at, expires_in, token_type: "bearer", user };
const storageKey = `sb-${PROJECT_REF}-auth-token`;

// Auf vercel.app navigieren + Session in localStorage injecten
await page.goto("https://app.ads-lift.de/", { waitUntil: "domcontentloaded" });
await page.evaluate(({ key, val }) => localStorage.setItem(key, JSON.stringify(val)), { key: storageKey, val: sessionData });
console.log("→ session injected, reloading");

// Pipeline-Listview
await page.goto("https://app.ads-lift.de/pipeline", { waitUntil: "networkidle" });
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/12-pipeline-listview.png` });
console.log("✓ 12-pipeline-listview");

// Project klicken
try {
  await page.locator('button.aspect-square').first().click({ timeout: 6000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/13-project-detail-setup.png` });
  console.log("✓ 13-project-detail-setup");

  try {
    await page.locator('button:has-text("Onboarding")').first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/14-project-onboarding-tab.png` });
    console.log("✓ 14-project-onboarding-tab");
  } catch (e) { console.warn("Onboarding-Tab:", e.message); }

  await page.locator('button:has-text("Setup")').first().click({ timeout: 3000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/15-tasks-section.png` });
  console.log("✓ 15-tasks-section");
} catch (e) {
  console.warn("Project-Detail:", e.message);
}

await browser.close();
console.log("Done.");

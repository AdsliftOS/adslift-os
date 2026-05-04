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

// Magic-Link
const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { Authorization: "Bearer " + serviceRole, apikey: serviceRole, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: "info@consulting-og.de" }),
});
const { action_link } = await linkRes.json();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
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
const storageKey = `sb-${PROJECT_REF}-auth-token`;

await page.goto("https://app.ads-lift.de/", { waitUntil: "domcontentloaded" });
await page.evaluate(({ key, val }) => localStorage.setItem(key, JSON.stringify(val)), { key: storageKey, val: sessionData });

// Pipeline-Listview
await page.goto("https://app.ads-lift.de/pipeline", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
// Click D4Y Filter
try {
  await page.locator('button:has-text("D4Y")').first().click({ timeout: 3000 });
  await page.waitForTimeout(800);
} catch {}
await page.screenshot({ path: `${OUT}/d4y-int-01-listview.png` });
console.log("✓ d4y-int-01-listview");

// D4Y Project Detail (Müller GmbH = d4y-shots customer)
try {
  await page.locator('button.aspect-square').first().click({ timeout: 5000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/d4y-int-02-setup.png` });
  console.log("✓ d4y-int-02-setup");

  // scroll for asset cards + meeting notes + tasks
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/d4y-int-03-assets.png` });
  console.log("✓ d4y-int-03-assets");

  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/d4y-int-04-bottom.png` });
  console.log("✓ d4y-int-04-bottom");

  // Onboarding-Tab
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Onboarding")').first().click({ timeout: 3000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/d4y-int-05-onboarding.png` });
  console.log("✓ d4y-int-05-onboarding");
} catch (e) {
  console.warn("Project-Detail failed:", e.message);
}

await browser.close();
console.log("Done.");

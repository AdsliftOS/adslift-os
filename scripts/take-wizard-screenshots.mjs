import { chromium } from "playwright";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Login als unfertiger Kunde → wird zum Wizard redirected
await page.goto("https://app.ads-lift.de/academy", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', "demo-wizard@test.local");
await page.fill('input[type="password"]', "wizard123");
await page.getByRole("button", { name: /Anmelden/i }).click();
await page.waitForTimeout(5000);

// Sollten jetzt auf Welcome-Video-Intro sein
console.log("→ welcome video intro");
await page.screenshot({ path: `${OUT}/03-wistia-welcome.png` });

// Click "Onboarding starten" Button
try {
  await page.getByRole("button", { name: /Onboarding starten/i }).click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  console.log("→ wizard step 0 (agentur)");
  await page.screenshot({ path: `${OUT}/04-wizard-step-1.png` });
} catch (e) {
  console.warn("Could not advance past intro:", e.message);
}

await browser.close();
console.log("✓ saved");

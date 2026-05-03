import { chromium } from "playwright";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// Public: Handoff
console.log("→ /handoff");
await page.goto("https://adslift-os.vercel.app/handoff", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-handoff.png` });

// Public: Academy login
console.log("→ /academy login");
await page.goto("https://adslift-os.vercel.app/academy", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-academy-login.png` });

// Login as demo customer
console.log("→ login");
await page.fill('input[type="email"]', "demo-screenshots@test.local");
await page.fill('input[type="password"]', "demo123");
await page.getByRole("button", { name: /Anmelden/i }).click();
await page.waitForTimeout(4000);

// Dashboard
console.log("→ dashboard top");
await page.screenshot({ path: `${OUT}/06-dashboard-top.png` });

// scroll to module section
console.log("→ dashboard module section");
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/07-dashboard-modules.png` });

// scroll to bottom (kurse, etc)
console.log("→ dashboard kurse");
await page.evaluate(() => window.scrollTo(0, 1300));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/08-kurse-grid.png` });

await browser.close();
console.log("✓ saved to:", OUT);

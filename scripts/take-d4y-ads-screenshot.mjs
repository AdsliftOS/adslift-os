import { chromium } from "playwright";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots/d4y";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Login
await page.goto("https://adslift-os.vercel.app/academy?reset=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', "d4y-ads@test.local");
await page.fill('input[type="password"]', "adsdemo");
await page.getByRole("button", { name: /Anmelden/i }).click();
await page.waitForTimeout(6000);
console.log("→ url:", page.url());

// Click "Deine Meta-Ads" Tab
try {
  await page.getByRole("button", { name: /Deine Meta-Ads/i }).click({ timeout: 5000 });
  await page.waitForTimeout(8000); // Meta API needs time
  console.log("→ clicked Meta-Ads tab");
} catch (e) {
  console.warn("Tab click failed:", e.message);
}

// Top — Hero KPIs + Performance Chart
await page.screenshot({ path: `${OUT}/d4y-11-meta-ads-top.png`, fullPage: false });
console.log("✓ d4y-11-meta-ads-top");

// Scroll mid — Daily Leads + Spend Donut
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/d4y-12-meta-ads-charts.png`, fullPage: false });
console.log("✓ d4y-12-meta-ads-charts");

// Scroll bottom — Campaign list
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/d4y-13-meta-ads-campaigns.png`, fullPage: false });
console.log("✓ d4y-13-meta-ads-campaigns");

await browser.close();
console.log("Done.");

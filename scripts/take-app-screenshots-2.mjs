import { chromium } from "playwright";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Academy Login + Dashboard
await page.goto("https://app.ads-lift.de/academy", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.fill('input[type="email"]', "screenshots@test.local");
await page.fill('input[type="password"]', "screenshot123");
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

// Dashboard
await page.screenshot({ path: `${OUT}/03-kundenbereich-dashboard.png`, fullPage: false });
console.log("✓ 03-kundenbereich-dashboard");

// Scroll to module overview area
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-kundenbereich-module.png`, fullPage: false });
console.log("✓ 04-kundenbereich-module");

await browser.close();
console.log("Saved to:", OUT);

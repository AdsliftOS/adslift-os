import { chromium } from "playwright";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Login als D4Y-Demo
await page.goto("https://adslift-os.vercel.app/academy?reset=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', "d4y-shots@test.local");
await page.fill('input[type="password"]', "d4ydemo");
await page.getByRole("button", { name: /Anmelden/i }).click();
await page.waitForTimeout(5000);
console.log("→ url after login:", page.url());

// /portal — Tab Projekte
await page.screenshot({ path: `${OUT}/d4y-08-portal-projekte.png`, fullPage: false });
console.log("✓ d4y-08-portal-projekte");

// scroll down for full
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/d4y-09-portal-pipeline.png`, fullPage: false });
console.log("✓ d4y-09-portal-pipeline");

// scroll asset cards
await page.evaluate(() => window.scrollTo(0, 1100));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/d4y-10-portal-assets.png`, fullPage: false });
console.log("✓ d4y-10-portal-assets");

await browser.close();
console.log("Done.");

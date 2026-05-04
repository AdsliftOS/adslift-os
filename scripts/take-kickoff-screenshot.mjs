import { chromium } from "playwright";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto("https://app.ads-lift.de/academy", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', "demo-kickoff@test.local");
await page.fill('input[type="password"]', "kickoff123");
await page.getByRole("button", { name: /Anmelden/i }).click();
await page.waitForTimeout(6000);
console.log("→ url:", page.url());

await page.screenshot({ path: `${OUT}/09-kickoff-modal.png` });
console.log("✓ 09-kickoff-modal");

await browser.close();

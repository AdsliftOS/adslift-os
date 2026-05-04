import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "01-handoff",       url: "https://app.ads-lift.de/handoff",       w: 1280, h: 1000 },
  { name: "02-academy-login", url: "https://app.ads-lift.de/academy",       w: 1280, h: 1000 },
];

const browser = await chromium.launch({ headless: true });
for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: false });
    console.log(`✓ ${p.name}`);
  } catch (e) {
    console.warn(`× ${p.name}: ${e.message}`);
  }
  await ctx.close();
}
await browser.close();
console.log("Saved to:", OUT);

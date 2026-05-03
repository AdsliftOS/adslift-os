import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots/d4y";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// 01: Handoff
await page.goto("https://adslift-os.vercel.app/handoff", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/d4y-01-handoff.png` });
console.log("✓ d4y-01-handoff");

// 02: Welcome-Email rendern
const SRC = "/Users/alexandergoldmann/Desktop/adslift-skills/welcome-email-academy.html";
let html = readFileSync(SRC, "utf8");
html = html
  .replace(/\{\{first_name\}\}/g, "Markus")
  .replace(/\{\{email\}\}/g, "markus@mueller-webdesign.de")
  .replace(/\{\{password\}\}/g, "kf9p2qzx");
writeFileSync("/tmp/d4y-welcome-email.html", html);
const ctx2 = await browser.newContext({ viewport: { width: 700, height: 1100 }, deviceScaleFactor: 2 });
const p2 = await ctx2.newPage();
await p2.goto("file:///tmp/d4y-welcome-email.html", { waitUntil: "networkidle" });
await p2.waitForTimeout(800);
await p2.screenshot({ path: `${OUT}/d4y-02-welcome-email.png`, fullPage: true });
await ctx2.close();
console.log("✓ d4y-02-welcome-email");

// 03: Academy-Login
await page.goto("https://adslift-os.vercel.app/academy?reset=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/d4y-03-login.png` });
console.log("✓ d4y-03-login");

// Login mit Flow-Test-Customer
await page.fill('input[type="email"]', "d4y-flow@test.local");
await page.fill('input[type="password"]', "flowdemo");
await page.getByRole("button", { name: /Anmelden/i }).click();
await page.waitForTimeout(5000);

// 04: Wistia-Welcome-Video Intro
await page.screenshot({ path: `${OUT}/d4y-04-wistia-intro.png` });
console.log("✓ d4y-04-wistia-intro");

// Click "Onboarding starten" → Wizard Step 1
try {
  await page.getByRole("button", { name: /Onboarding starten|Briefing starten/i }).click({ timeout: 5000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/d4y-05-wizard-step-1.png` });
  console.log("✓ d4y-05-wizard-step-1");
} catch (e) {
  console.warn("Wizard click failed:", e.message);
}

await browser.close();
console.log("Done.");

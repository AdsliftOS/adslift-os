import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const SRC = "/Users/alexandergoldmann/Desktop/adslift-skills/welcome-email-academy.html";
const TMP = "/tmp/welcome-email-rendered.html";
const OUT = "/Users/alexandergoldmann/Desktop/adslift-skills/system-screenshots/05-welcome-email.png";

let html = readFileSync(SRC, "utf8");
// Template-Variablen mit Demo-Daten ersetzen
html = html
  .replace(/\{\{first_name\}\}/g, "Markus")
  .replace(/\{\{email\}\}/g, "markus@mueller-webdesign.de")
  .replace(/\{\{password\}\}/g, "8Ks2pQrm");
writeFileSync(TMP, html);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 700, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("file://" + TMP, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("✓ Welcome-Email saved:", OUT);

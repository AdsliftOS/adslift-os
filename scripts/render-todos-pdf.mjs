#!/usr/bin/env node
/**
 * Rendert /Users/alexandergoldmann/Desktop/adslift-skills/adslift-todos.html
 * via Playwright als PDF an dieselbe Stelle.
 *
 * Aufrufen wenn die HTML-TODO-Liste geupdated wurde:
 *   node scripts/render-todos-pdf.mjs
 */
import { chromium } from "playwright";

const HTML_PATH = "/Users/alexandergoldmann/Desktop/adslift-skills/adslift-todos.html";
const PDF_PATH = "/Users/alexandergoldmann/Desktop/adslift-skills/adslift-todos.pdf";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("file://" + HTML_PATH, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: PDF_PATH,
  format: "A4",
  printBackground: true,
  margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
});
await browser.close();
console.log("PDF gespeichert:", PDF_PATH);

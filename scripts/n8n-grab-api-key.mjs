#!/usr/bin/env node
/**
 * Navigates to n8n API settings and creates an API key, captures it.
 * Reuses the persisted session at .n8n-session/.
 */
import { chromium } from "playwright";
import { writeFileSync, appendFileSync, readFileSync } from "fs";

const SESSION_DIR = ".n8n-session";
const N8N_URL = "https://adsliftauto.app.n8n.cloud";

console.log("Launching Chromium ...");
const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1400, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(`${N8N_URL}/settings/api`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/n8n-api-page.png", fullPage: true });
console.log("Screenshot taken");
console.log("URL:", page.url());

// Look for any "Create" button
const buttons = await page.$$("button");
for (const btn of buttons) {
  const text = (await btn.textContent())?.trim() ?? "";
  if (/create|new|key/i.test(text)) {
    console.log("Found button:", text);
  }
}

// Try clicking "Create an API key" or similar
const createSelectors = [
  'button:has-text("Create an API key")',
  'button:has-text("Create API key")',
  'button:has-text("Create")',
  '[data-test-id="api-create-button"]',
];
let clicked = false;
for (const sel of createSelectors) {
  const el = await page.$(sel);
  if (el) {
    console.log("Clicking:", sel);
    await el.click();
    clicked = true;
    break;
  }
}

if (!clicked) {
  console.log("No Create-button found. Screenshotting current page.");
  await page.screenshot({ path: "/tmp/n8n-api-after.png", fullPage: true });
  await new Promise(() => {});
}

// Wait for key dialog
await page.waitForTimeout(2000);

// Look for an input or text containing 'n8n_api_'
const html = await page.content();
const match = html.match(/n8n_api_[A-Za-z0-9._\-]+/);
if (match) {
  const key = match[0];
  console.log("Found API key:", key.slice(0, 30) + "...");
  const env = readFileSync(".env", "utf8");
  if (!env.includes("N8N_API_KEY")) {
    appendFileSync(".env", `N8N_API_KEY=${key}\n`);
    console.log("Saved to .env");
  } else {
    console.log("N8N_API_KEY already in .env");
  }
} else {
  console.log("No API key found in HTML. Screenshot taken at /tmp/n8n-api-after.png");
  await page.screenshot({ path: "/tmp/n8n-api-final.png", fullPage: true });
}

await page.waitForTimeout(2000);
await ctx.close();
console.log("DONE");

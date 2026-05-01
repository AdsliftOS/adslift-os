#!/usr/bin/env node
import { chromium } from "playwright";

const SESSION_DIR = ".pandadoc-session";
const PANDADOC_URL = "https://app.pandadoc.com";

console.log("Launching Chromium ...");
const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1400, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

await page.goto(`${PANDADOC_URL}/a/#/integrations/webhooks`, { waitUntil: "domcontentloaded" });

console.log("\n>>> Browser ist offen, navigiert zu PandaDoc Webhooks.");
console.log(">>> Wenn du eingeloggt bist, solltest du die Webhook-Settings sehen.");
console.log(">>> Wenn nicht, logg dich ein.");
console.log(">>>");
console.log(">>> Webhook-Daten zum Eingeben:");
console.log(">>>   URL:   https://adsliftauto.app.n8n.cloud/webhook/pandadoc-signed");
console.log(">>>   Name:  Adslift Onboarding-Trigger");
console.log(">>>   Event: document_state_changed (oder document.completed)");
console.log("");
console.log("Browser bleibt offen. Sag wenn fertig oder Hilfe.");

await new Promise(() => {});

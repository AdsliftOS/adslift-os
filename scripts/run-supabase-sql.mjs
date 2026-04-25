import { chromium } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

const PROJECT_REF = "ofrvoxupatowfatpleji";
const SQL_FILE = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(process.cwd(), "add-google-event-id.sql");
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || "http://localhost:49633";

const sql = readFileSync(SQL_FILE, "utf8").trim();
console.log("[info] SQL:", sql);
console.log("[info] Connecting to existing Chrome at", CDP_ENDPOINT);

const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

try {
  await page.goto(`https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for editor to load
  await page.waitForTimeout(4000);

  // Monaco editor: click into it then paste
  const editor = page.locator(".monaco-editor").first();
  await editor.waitFor({ timeout: 30000 });
  await editor.click();

  // Clear existing content and paste our SQL
  const isMac = process.platform === "darwin";
  const meta = isMac ? "Meta" : "Control";
  await page.keyboard.press(`${meta}+A`);
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(sql);

  // Wait a tick for state to register
  await page.waitForTimeout(500);

  // Run: Cmd+Enter
  await page.keyboard.press(`${meta}+Enter`);

  // Wait for result
  await page.waitForTimeout(5000);

  // Screenshot for confirmation
  const shot = join(process.cwd(), "supabase-sql-result.png");
  await page.screenshot({ path: shot, fullPage: false });
  console.log("[info] Screenshot saved:", shot);

  console.log("[done]");
} catch (e) {
  console.error("[error]", e);
  try {
    await page.screenshot({ path: "supabase-sql-error.png" });
  } catch {}
  process.exitCode = 1;
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}

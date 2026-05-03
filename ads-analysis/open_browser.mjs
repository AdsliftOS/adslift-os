import { chromium } from '/Users/alexandergoldmann/.browser-use-env/lib/python3.13/site-packages/playwright/driver/package/node_modules/playwright/index.mjs';

const CDP_URL = 'http://localhost:50632';

try {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const context = contexts[0];
  let page = context.pages()[0];
  if (!page) page = await context.newPage();

  await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.bringToFront();
  console.log('OK: navigated to Meta Ads Manager');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}

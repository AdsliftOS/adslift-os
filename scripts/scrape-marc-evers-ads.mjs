import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve('./marc-evers-analysis');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const URL = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=DE&q=marc%20evers&search_type=keyword_unordered&media_type=all';

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1800 },
  locale: 'de-DE',
});
const page = await ctx.newPage();

console.log('Opening:', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);

// Cookie banner
const cookieButtons = ['Alle Cookies erlauben', 'Allow all cookies', 'Nur erforderliche Cookies erlauben', 'Decline optional cookies', 'Akzeptieren'];
for (const label of cookieButtons) {
  try {
    await page.getByRole('button', { name: new RegExp(label, 'i') }).first().click({ timeout: 2000 });
    console.log('clicked cookie:', label);
    break;
  } catch {}
}
await page.waitForTimeout(3000);

try { await page.screenshot({ path: path.join(OUTPUT_DIR, '01-initial.png'), fullPage: false, timeout: 10000, animations: 'disabled' }); console.log('initial screenshot saved'); } catch (e) { console.log('initial screenshot failed:', e.message); }

// Scroll repeatedly
for (let i = 0; i < 25; i++) {
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(1200);
}

try { await page.screenshot({ path: path.join(OUTPUT_DIR, '02-scrolled.png'), fullPage: false, timeout: 10000, animations: 'disabled' }); } catch (e) { console.log('scrolled screenshot failed:', e.message); }

// Get ALL text on page
const pageText = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(path.join(OUTPUT_DIR, 'page-text.txt'), pageText);
console.log('page text length:', pageText.length);

// Look for image URLs (ad creatives)
const images = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  return imgs
    .map(i => ({ src: i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight }))
    .filter(i => i.src.startsWith('https://') && (i.w > 200 || i.h > 200));
});
fs.writeFileSync(path.join(OUTPUT_DIR, 'images.json'), JSON.stringify(images, null, 2));
console.log('images:', images.length);

// Look for video URLs
const videos = await page.evaluate(() => {
  const vids = Array.from(document.querySelectorAll('video'));
  return vids.map(v => ({ src: v.src, poster: v.poster }));
});
fs.writeFileSync(path.join(OUTPUT_DIR, 'videos.json'), JSON.stringify(videos, null, 2));
console.log('videos:', videos.length);

// Try to grab structured ad cards by looking for "Bibliotheks-ID" or "Library ID" markers
const cards = await page.evaluate(() => {
  const results = [];
  // Walk through all elements, find ones containing the library id marker
  const all = document.querySelectorAll('*');
  const seenContainers = new Set();
  for (const el of all) {
    const t = el.innerText || '';
    if (t.length > 100 && t.length < 5000 && /Bibliotheks-?ID|Library ID/i.test(t) && /Marc|Evers/i.test(t)) {
      // Climb up to a reasonable container
      let p = el;
      for (let i = 0; i < 5 && p.parentElement; i++) p = p.parentElement;
      if (!seenContainers.has(p)) {
        seenContainers.add(p);
        results.push({
          text: t.slice(0, 4000),
        });
      }
    }
  }
  return results;
});
fs.writeFileSync(path.join(OUTPUT_DIR, 'cards.json'), JSON.stringify(cards, null, 2));
console.log('matched cards:', cards.length);

await browser.close();
console.log('done');

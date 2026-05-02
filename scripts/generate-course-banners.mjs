#!/usr/bin/env node
/**
 * Generiert 8 Course-Banner als PNG via Playwright + lädt sie in Supabase Storage.
 *
 * Output: writes to course-banners bucket, returns public URLs.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';

const env = readFileSync('.env', 'utf8');
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = 'ofrvoxupatowfatpleji';

const COURSES = [
  { slug: 'meta-business-manager', title: 'Meta Business Manager', subtitle: 'Setup & Konfiguration', gradient: ['#2563eb', '#4f46e5'], emoji: '⚙️' },
  { slug: 'zielgruppe',           title: 'Zielgruppe',             subtitle: 'Wer kauft eigentlich?',  gradient: ['#a855f7', '#ec4899'], emoji: '🎯' },
  { slug: 'offer-building',       title: 'Offer Building',         subtitle: 'Unwiderstehliche Angebote', gradient: ['#10b981', '#14b8a6'], emoji: '💎' },
  { slug: 'creatives',            title: 'Creatives & Werbemittel',subtitle: 'Visuelles, das verkauft', gradient: ['#f97316', '#ec4899'], emoji: '🎨' },
  { slug: 'copywriting',          title: 'Copywriting',            subtitle: 'Worte, die wirken',       gradient: ['#f59e0b', '#ef4444'], emoji: '✍️' },
  { slug: 'launch',               title: 'Launch der Kampagne',    subtitle: 'On-Air gehen ohne Crash', gradient: ['#06b6d4', '#3b82f6'], emoji: '🚀' },
  { slug: 'sales',                title: 'Sales',                  subtitle: 'Closing-Game pushen',     gradient: ['#f43f5e', '#dc2626'], emoji: '💰' },
  { slug: 'scaling',              title: 'One-Percent-Scaling',    subtitle: 'Vom Test zur Skalierung', gradient: ['#8b5cf6', '#4f46e5'], emoji: '📈' },
];

function bannerHTML({ title, subtitle, gradient, emoji }) {
  // Content vertikal zentriert, weil das Frontend einen dunklen Fade von unten drüberlegt.
  // Aspect-Ratio passt zum Card-Thumbnail (~2.5:1 → 1280x520).
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;}
  .banner{
    width:1280px;height:520px;
    background:linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%);
    position:relative;overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,"Inter","SF Pro Display",sans-serif;
    color:white;
  }
  .glow{position:absolute;width:700px;height:700px;border-radius:50%;background:rgba(255,255,255,0.14);filter:blur(80px);}
  .glow-1{top:-280px;right:-180px;}
  .glow-2{bottom:-360px;left:-220px;background:rgba(0,0,0,0.18);}
  .grain{position:absolute;inset:0;opacity:0.05;background-image:radial-gradient(circle at 1px 1px, white 1px, transparent 0);background-size:24px 24px;}
  .content{position:absolute;inset:0;padding:80px;display:flex;flex-direction:column;justify-content:center;gap:14px;max-width:75%;}
  .emoji{position:absolute;top:50%;right:90px;transform:translateY(-50%);font-size:200px;opacity:0.9;filter:drop-shadow(0 12px 30px rgba(0,0,0,0.25));}
  .label{font-size:20px;font-weight:600;letter-spacing:7px;text-transform:uppercase;color:rgba(255,255,255,0.75);}
  .title{font-size:96px;font-weight:800;letter-spacing:-3px;line-height:0.95;}
  .subtitle{font-size:30px;font-weight:500;color:rgba(255,255,255,0.88);}
</style></head><body>
<div class="banner">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="grain"></div>
  <div class="emoji">${emoji}</div>
  <div class="content">
    <div class="label">Modul</div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
  </div>
</div>
</body></html>`;
}

// Service Role Key holen
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { 'Authorization': 'Bearer ' + pat }
});
const keys = await keysRes.json();
const serviceRole = keys.find(k => k.name === 'service_role').api_key;
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const sb = createClient(SUPABASE_URL, serviceRole);

// Bucket ensure
const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + serviceRole, 'apikey': serviceRole, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'course-banners', name: 'course-banners', public: true })
});
console.log('Bucket:', bucketRes.status, bucketRes.ok ? 'created' : 'maybe existed');

// Render banners
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 520 } });
const page = await ctx.newPage();

const urls = {};
for (const c of COURSES) {
  await page.setContent(bannerHTML(c), { waitUntil: 'load' });
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 520 } });
  const path = `${c.slug}.png`;
  const { error } = await sb.storage.from('course-banners').upload(path, buf, {
    contentType: 'image/png', upsert: true,
  });
  if (error) { console.error(`Upload ${path}:`, error.message); continue; }
  const { data } = sb.storage.from('course-banners').getPublicUrl(path);
  urls[c.slug] = data.publicUrl;
  console.log(`✓ ${c.slug} → ${data.publicUrl}`);
}
await browser.close();

console.log('\nALL URLs:');
console.log(JSON.stringify(urls, null, 2));

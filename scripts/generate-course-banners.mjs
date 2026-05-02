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
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;}
  .banner{
    width:1280px;height:480px;
    background:linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%);
    position:relative;overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,"Inter","SF Pro Display",sans-serif;
    color:white;
  }
  .glow{position:absolute;width:600px;height:600px;border-radius:50%;background:rgba(255,255,255,0.12);filter:blur(80px);}
  .glow-1{top:-200px;right:-100px;}
  .glow-2{bottom:-300px;left:-150px;background:rgba(0,0,0,0.15);}
  .grain{position:absolute;inset:0;opacity:0.05;background-image:radial-gradient(circle at 1px 1px, white 1px, transparent 0);background-size:24px 24px;}
  .content{position:absolute;inset:0;padding:80px;display:flex;flex-direction:column;justify-content:flex-end;gap:12px;}
  .emoji{position:absolute;top:60px;right:80px;font-size:160px;opacity:0.9;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.25));}
  .label{font-size:18px;font-weight:600;letter-spacing:6px;text-transform:uppercase;color:rgba(255,255,255,0.7);}
  .title{font-size:96px;font-weight:800;letter-spacing:-3px;line-height:0.95;}
  .subtitle{font-size:30px;font-weight:500;color:rgba(255,255,255,0.85);}
  .brand{position:absolute;top:80px;left:80px;display:flex;align-items:center;gap:12px;font-size:18px;font-weight:600;color:rgba(255,255,255,0.85);letter-spacing:1px;}
  .dot{width:8px;height:8px;border-radius:50%;background:white;}
</style></head><body>
<div class="banner">
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="grain"></div>
  <div class="brand"><div class="dot"></div>ADSLIFT KUNDENBEREICH</div>
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 480 } });
const page = await ctx.newPage();

const urls = {};
for (const c of COURSES) {
  await page.setContent(bannerHTML(c), { waitUntil: 'load' });
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 480 } });
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

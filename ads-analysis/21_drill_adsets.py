"""
For each ad set: hover, click Bearbeiten, capture targeting / audience / placements.
"""
import asyncio, json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADSETS_URL = "https://adsmanager.facebook.com/adsmanager/manage/adsets?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

JS_HOVER_CLICK = """
(idx) => {
  const rows = document.querySelectorAll('div._1gd4');
  if (!rows[idx]) return {error: 'row missing'};
  const row = rows[idx];
  const r = row.getBoundingClientRect();
  ['mouseover','mouseenter','mousemove'].forEach(type => {
    row.dispatchEvent(new MouseEvent(type, {bubbles:true, clientX:r.left+50, clientY:r.top+30}));
  });
  return new Promise(resolve => {
    setTimeout(() => {
      const a = row.querySelector('a[aria-label="Bearbeiten"]');
      if (a) { a.click(); resolve({clicked: true}); }
      else { resolve({error: 'no edit'}); }
    }, 600);
  });
}
"""

JS_EXTRACT_TARGETING = """
() => {
  // Get ad set name
  const titleInput = Array.from(document.querySelectorAll('input[type="text"]'))
    .find(i => i.value && i.value.startsWith('Adslift'));
  const adSetName = titleInput ? titleInput.value : null;

  // Find the audience/targeting section.
  // Try section labels: 'Standort', 'Alter', 'Geschlecht', 'Sprache', 'Detailliertes Targeting', 'Custom Audience', 'Platzierungen'
  const labels = ['Standort', 'Standorte', 'Alter', 'Geschlecht', 'Sprachen', 'Sprache',
                  'Detailliertes Targeting', 'Detaillierte Zielgruppen', 'Custom Audience',
                  'Custom Audiences', 'Audience', 'Zielgruppe',
                  'Platzierungen', 'Manuelle Platzierungen', 'Advantage+ Platzierungen',
                  'Geräte', 'Geräteplattformen', 'Plattformen',
                  'Geschätzte tägliche Ergebnisse', 'Audience-Größe',
                  'Optimierung', 'Conversion-Event', 'Pixel',
                  'Werbeanzeigenplanung', 'Zeitplan', 'Tagesbudget', 'Budget'];
  const found = {};
  for (const lbl of labels) {
    const els = Array.from(document.querySelectorAll('div, span, h2, h3, h4, label'));
    const target = els.find(e => {
      const t = (e.innerText||'').trim();
      return t === lbl || t.startsWith(lbl + '\\n') || t.startsWith(lbl + ':');
    });
    if (target) {
      // walk up 2-3 levels and grab text
      let p = target.parentElement;
      let text = (target.innerText||'').trim();
      for (let i=0;i<3 && p; i++) {
        const candidate = (p.innerText||'').trim();
        if (candidate.length > text.length && candidate.length < 1500) text = candidate;
        p = p.parentElement;
      }
      found[lbl] = text.slice(0, 1500);
    }
  }
  return {adSetName, sections: found};
}
"""

async def go_list(page):
    await page.goto(ADSETS_URL, wait_until="domcontentloaded", timeout=45000)
    await page.wait_for_selector("div._1gd4", timeout=15000)
    await page.wait_for_timeout(3500)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2200, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        await go_list(page)
        # 7 ad sets, last row is totals
        results = []
        for idx in range(7):
            print(f"\n--- Ad Set {idx} ---")
            click = await page.evaluate(JS_HOVER_CLICK, idx)
            print("click:", click)
            if click.get("error"):
                continue
            try:
                await page.wait_for_url("**edit/standalone**", timeout=15000)
            except: pass
            await page.wait_for_timeout(7500)

            url = page.url
            adset_id = parse_qs(urlparse(url).query).get("selected_adset_ids", [None])[0]
            print("adset_id:", adset_id)
            shot = f"adset_{idx:02d}_{adset_id}.png"
            try:
                await page.screenshot(path=str(OUT / shot), full_page=False, timeout=15000)
            except Exception as e:
                print("shot fail:", e)
            data = await page.evaluate(JS_EXTRACT_TARGETING)
            data["url"] = url; data["adset_id"] = adset_id; data["screenshot"] = shot; data["index"] = idx
            results.append(data)
            (OUT / f"adset_{idx:02d}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
            print(f"NAME: {data['adSetName']}")
            for k, v in data['sections'].items():
                print(f"  [{k}] {v[:120]}")
            await go_list(page)

        (OUT / "all_adsets.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))

asyncio.run(main())

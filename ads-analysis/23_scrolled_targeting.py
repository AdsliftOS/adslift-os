"""
For each ad set: open editor, scroll to Zielgruppe + Platzierungen sections,
capture clean focused screenshots and extract full text from those panels.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
SECTIONS = OUT / "sections"
SECTIONS.mkdir(exist_ok=True)

EDITOR = "https://adsmanager.facebook.com/adsmanager/manage/adsets/edit/standalone?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum&selected_adset_ids={asid}&current_step=0"

ADSET_IDS = [
    ("00_Coaches", "120242521883340525"),
    ("01_Immo", "120242521665020525"),
    ("02_Garten", "120242520220720525"),
    ("03_Dienstleister", "120241611847300525"),
    ("04_OB_T03", "120241315820130525"),
    ("05_OB_T02", "120241169362520525"),
    ("06_OB_T01", "120240746720580525"),
]

# Sections to scroll to & capture
TARGET_SECTIONS = ["Zielgruppe", "Platzierungen", "Conversion", "Optimierung", "Performance-Ziel"]

JS_SCROLL_AND_CAPTURE = """
(label) => {
  const all = Array.from(document.querySelectorAll('div, h2, h3, h4, span'));
  const target = all.find(e => {
    const t = (e.innerText||'').trim();
    return (t === label || t.startsWith(label+'\\n')) && e.offsetHeight < 600;
  });
  if (!target) return null;
  target.scrollIntoView({block:'start', behavior:'instant'});
  // walk up to find the enclosing section/card
  let p = target.parentElement;
  let bestText = (target.innerText||'').trim();
  let bestEl = target;
  for (let i=0;i<8 && p; i++) {
    const t = (p.innerText||'').trim();
    if (t.length > bestText.length && t.length < 4000) {
      bestText = t;
      bestEl = p;
    }
    p = p.parentElement;
  }
  const r = bestEl.getBoundingClientRect();
  return {text: bestText, rect: {x: r.x, y: r.y, w: r.width, h: r.height}};
}
"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1700, "height": 2400, "deviceScaleFactor": 1.5, "mobile": False,
        })

        all_results = {}
        for tag, asid in ADSET_IDS:
            print(f"\n=== {tag} ===")
            await page.goto(EDITOR.format(asid=asid), wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(8000)
            results = {"asid": asid, "sections": {}}
            for sec in TARGET_SECTIONS:
                info = await page.evaluate(JS_SCROLL_AND_CAPTURE, sec)
                if not info:
                    print(f"  [{sec}] NOT FOUND")
                    continue
                await page.wait_for_timeout(500)
                # screenshot the section
                rect = info['rect']
                # clip with bounds
                clip = {
                    "x": max(0, rect['x']),
                    "y": max(0, rect['y']),
                    "width": min(rect['w'], 1500),
                    "height": min(rect['h'], 1800),
                }
                shot = SECTIONS / f"{tag}_{sec.replace(' ','_').replace('-','_')}.png"
                try:
                    if clip['width'] > 50 and clip['height'] > 50:
                        # Move scroll slightly above so the heading is visible
                        await page.evaluate("window.scrollBy(0, -40)")
                        await page.wait_for_timeout(200)
                        await page.screenshot(path=str(shot), full_page=False, timeout=10000)
                except Exception as e:
                    print(f"  [{sec}] shot fail: {e}")
                results['sections'][sec] = info['text']
                print(f"  [{sec}] len={len(info['text'])} -- preview: {info['text'][:140]}")
            all_results[tag] = results

        (OUT / "deep_targeting.json").write_text(json.dumps(all_results, ensure_ascii=False, indent=2))
        print("\nSaved deep_targeting.json")

asyncio.run(main())

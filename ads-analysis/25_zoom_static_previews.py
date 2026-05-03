"""
Open the editor for each STATIC IMAGE ad (idx 0..8) at high zoom and clip
the phone-preview area for clear readability.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ZOOM = OUT / "zoom_previews"
ZOOM.mkdir(exist_ok=True)

EDITOR = "https://adsmanager.facebook.com/adsmanager/manage/ads/edit/standalone?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum&selected_ad_ids={ad_id}&current_step=0"

# Use existing all_ads.json for ad_id mapping
ads = json.load(open(OUT / "all_ads.json"))

# Just capture static image ads (those that have textareas with copy)
targets = [a for a in ads if any(f.get('tag')=='TEXTAREA' and f.get('value') for f in a.get('fields',[]))]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        # Use high DPR for crisp text
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1400, "height": 1800, "deviceScaleFactor": 2.0, "mobile": False,
        })

        for a in targets:
            ad_id = a['ad_id']; idx = a['index']
            name = (a.get('adName') or '').replace('Adslift | ','').replace(' | ABO','')
            print(f"\n--- {idx} {name} ---")
            await page.goto(EDITOR.format(ad_id=ad_id), wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(7000)

            # find the phone-preview <img> with biggest size on right side of viewport
            box = await page.evaluate("""() => {
              const imgs = Array.from(document.querySelectorAll('img'));
              const candidates = imgs
                .filter(i => i.naturalWidth > 400 && i.naturalHeight > 400)
                .map(i => {
                  const r = i.getBoundingClientRect();
                  return {x: r.x, y: r.y, w: r.width, h: r.height, area: r.width*r.height};
                })
                .filter(b => b.x > 600 && b.area > 5000);
              if (!candidates.length) return null;
              candidates.sort((a,b)=>b.area-a.area);
              return candidates[0];
            }""")
            print("box:", box)
            if not box:
                continue
            # find the wrapper card around the phone preview by clicking-walking up
            # Just clip a region around the preview with some padding
            try:
                # Right column screenshot — avoid scrollbar at far right
                clip = {
                    "x": 800,
                    "y": 0,
                    "width": 580,
                    "height": 1300,
                }
                shot = ZOOM / f"ad_{idx:02d}_{ad_id}.png"
                await page.screenshot(path=str(shot), clip=clip, timeout=12000)
                print("saved", shot.name)
            except Exception as e:
                print("clip fail:", e)

asyncio.run(main())

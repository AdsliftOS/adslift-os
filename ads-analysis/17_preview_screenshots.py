"""
For ads without textareas, navigate directly via URL and capture a focused
high-res screenshot of the preview pane (right side of editor) so we can
read the copy visually.
"""
import asyncio, json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
PREV_OUT = OUT / "previews"
PREV_OUT.mkdir(exist_ok=True)

EDITOR_BASE = "https://adsmanager.facebook.com/adsmanager/manage/ads/edit/standalone?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum&selected_ad_ids={ad_id}&current_step=0"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1900, "height": 2000, "deviceScaleFactor": 1.5, "mobile": False,
        })

        existing = json.load(open(OUT / "all_ads.json"))
        missing = [a for a in existing if not any(f["tag"]=="TEXTAREA" and f["value"] for f in a["fields"])]
        print(f"to capture: {len(missing)} ads")

        for a in missing:
            ad_id = a["ad_id"]
            idx = a["index"]
            print(f"\n--- ad {idx} {ad_id} ---")
            await page.goto(EDITOR_BASE.format(ad_id=ad_id), wait_until="domcontentloaded", timeout=45000)
            # wait for preview area to render — poll for an image inside the editor body
            await page.wait_for_timeout(8000)

            # find the preview wrapper (phone mockup area) — look for the largest <img> on right side
            preview_box = await page.evaluate("""() => {
              const imgs = Array.from(document.querySelectorAll('img'));
              const big = imgs
                .filter(i => i.naturalWidth > 200 && i.naturalHeight > 200)
                .map(i => ({ rect: i.getBoundingClientRect(), w: i.naturalWidth }));
              if (!big.length) return null;
              // pick the biggest
              big.sort((a,b) => (b.rect.width*b.rect.height) - (a.rect.width*a.rect.height));
              const r = big[0].rect;
              return {x: r.x, y: r.y, w: r.width, h: r.height};
            }""")
            print("preview box:", preview_box)

            # screenshot whole page
            shot = PREV_OUT / f"ad_{idx:02d}_{ad_id}.png"
            await page.screenshot(path=str(shot))

            # also take a clipped screenshot of right half (where preview lives) for readability
            try:
                vp = page.viewport_size or {"width": 1900, "height": 2000}
                await page.screenshot(
                    path=str(PREV_OUT / f"ad_{idx:02d}_{ad_id}_right.png"),
                    clip={"x": int(vp["width"]*0.55), "y": 0, "width": int(vp["width"]*0.45), "height": vp["height"]}
                )
            except Exception as e:
                print("clip fail:", e)

asyncio.run(main())

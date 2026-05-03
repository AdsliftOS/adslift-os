"""
On the Ads tab, open Aufschlüsselung (Breakdown) menu and pick:
1) Land
2) Plattform
3) Alter
4) Geschlecht
Capture the resulting tables.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

async def go(page):
    await page.goto(ADS_LIST, wait_until="domcontentloaded", timeout=45000)
    await page.wait_for_selector("div._1gd4", timeout=15000)
    await page.wait_for_timeout(3500)

JS_OPEN_BREAKDOWN = """
() => {
  // Find the 'Aufschlüsselung' button in the toolbar
  const all = Array.from(document.querySelectorAll('div[role="button"], button, a'));
  const btn = all.find(e => /^Aufschlüsselung$/.test((e.innerText||'').trim())
    || /^Aufschlüsselung\\s/.test((e.innerText||'').trim()));
  if (btn) { btn.click(); return {opened: true, text: btn.innerText.trim()}; }
  return {error: 'no aufschluesselung button', candidates: all.map(e => (e.innerText||'').trim()).filter(t => t && t.length < 40).slice(0, 50)};
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
            "width": 2400, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        await go(page)
        try:
            await page.screenshot(path=str(OUT / "30_ads_overview.png"), timeout=12000)
        except Exception as e:
            print("shot1 fail:", e)
        res = await page.evaluate(JS_OPEN_BREAKDOWN)
        print("open:", res)
        await page.wait_for_timeout(1500)
        try:
            await page.screenshot(path=str(OUT / "30_breakdown_menu.png"), timeout=12000)
        except Exception as e:
            print("shot2 fail:", e)

asyncio.run(main())

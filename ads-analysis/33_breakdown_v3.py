"""
Use Playwright locator (handles scrolling). Click Aufschluesselung, then walk the menu.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        # Use a smaller viewport so the toolbar fits
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1000, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(500)

        await page.goto(ADS_LIST, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("div._1gd4", timeout=15000)
        await page.wait_for_timeout(3500)

        # Click Aufschluesselung via locator
        btn = page.locator("div[role='button']").filter(has_text="Aufschlüsselung").first
        await btn.click()
        await page.wait_for_timeout(1800)
        try:
            await page.screenshot(path=str(OUT / "33_aufschl_open.png"), timeout=8000)
        except: pass

        # menu items
        items = await page.evaluate("""() => {
          const role_items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'));
          return role_items.map(e => ({
            role: e.getAttribute('role'),
            ariaLabel: e.getAttribute('aria-label'),
            text: (e.innerText||'').trim().slice(0,80),
            haspopup: e.getAttribute('aria-haspopup'),
          }));
        }""")
        print(f"\nMENU ITEMS ({len(items)}):")
        for it in items[:60]:
            print(f"  {it}")

        # try to hover a 'Auslieferung' submenu, then click 'Land'
        if items:
            # find Auslieferung
            auslieferung = page.locator('[role="menuitem"]').filter(has_text="Auslieferung").first
            try:
                await auslieferung.hover()
                await page.wait_for_timeout(1500)
            except Exception as e:
                print("hover fail:", e)
            try:
                await page.screenshot(path=str(OUT / "33_after_hover.png"), timeout=8000)
            except: pass
            items2 = await page.evaluate("""() => {
              const role_items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'));
              return role_items.map(e => (e.innerText||'').trim().slice(0,60));
            }""")
            print(f"\nAFTER HOVER ITEMS ({len(items2)}):", items2[:80])

asyncio.run(main())

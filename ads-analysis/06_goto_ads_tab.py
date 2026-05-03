"""
Switch to the 'Anzeigen' (Ads) tab to see all individual ads.
"""
import asyncio
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        # find tabs
        clicked = await page.evaluate("""() => {
          const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
          const t = tabs.find(e => /^Werbeanzeigen$/.test((e.innerText||'').trim()));
          if (t) { t.click(); return t.innerText; }
          return tabs.map(e => (e.innerText||'').trim());
        }""")
        print("CLICKED TAB:", clicked)
        await page.wait_for_timeout(4000)
        await page.screenshot(path="/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/06_ads_tab.png")
        print("URL:", page.url)

asyncio.run(main())

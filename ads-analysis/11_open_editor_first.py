"""
Click Bearbeiten on the first ad. Capture screenshot of the editor panel.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)

        # hover row, then click 'Bearbeiten'
        rows = page.locator("div._1gd4")
        await rows.first.hover()
        await page.wait_for_timeout(700)

        clicked = await page.evaluate("""() => {
          const row = document.querySelectorAll('div._1gd4')[0];
          const a = row.querySelector('a[aria-label="Bearbeiten"]');
          if (a) { a.click(); return 'clicked Bearbeiten'; }
          return 'not found';
        }""")
        print(clicked)

        # editor opens — wait for it
        await page.wait_for_timeout(6000)
        await page.screenshot(path=str(OUT / "11_editor.png"), full_page=False)
        print("URL:", page.url)
        print("TITLE:", await page.title())

asyncio.run(main())

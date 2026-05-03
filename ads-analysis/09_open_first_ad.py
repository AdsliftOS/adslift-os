"""
Click on first ad to see what UI appears (side panel? modal? edit page?).
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
        await page.wait_for_timeout(1500)

        # find first ad name and click it
        clicked = await page.evaluate("""() => {
          // find a row containing 'Adslift' in some descendant text
          const rows = Array.from(document.querySelectorAll('div._1gd4'));
          if (!rows.length) return {error: 'no rows'};
          const r = rows[0];
          // find a clickable element containing the ad name 'Adslift |'
          const candidates = Array.from(r.querySelectorAll('a, [role="button"], div'));
          for (const c of candidates) {
            const t = (c.innerText||'').trim();
            if (t.startsWith('Adslift |') && t.length < 200) {
              c.click();
              return {clickedText: t.slice(0, 100)};
            }
          }
          return {error: 'no name found'};
        }""")
        print("CLICK:", clicked)
        await page.wait_for_timeout(3500)
        await page.screenshot(path=str(OUT / "09_after_click.png"))
        print("URL:", page.url)

asyncio.run(main())

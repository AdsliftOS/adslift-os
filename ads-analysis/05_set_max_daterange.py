"""
Open the date picker, click 'Maximum'.
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

        # the date button text contains 'Letzte' or '...Tage'
        # find by class or by text
        # try clicking the date filter button
        await page.evaluate("""() => {
          const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
          const cand = btns.find(b => /Letzte|Tage|Datum|Maximum|Heute|Gestern/i.test(b.innerText || ''));
          if (cand) { cand.click(); return cand.innerText; }
          return null;
        }""")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/05_datepicker.png")

        # try to click 'Maximum'
        clicked = await page.evaluate("""() => {
          const els = Array.from(document.querySelectorAll('*'));
          const t = els.find(e => e.children.length === 0 && /^Maximum$/.test((e.innerText||'').trim()));
          if (t) { t.click(); return 'Maximum'; }
          // alternative: 'Lebensdauer' or 'Alle'
          const t2 = els.find(e => e.children.length === 0 && /^(Lebensdauer|Alle)$/.test((e.innerText||'').trim()));
          if (t2) { t2.click(); return t2.innerText; }
          return null;
        }""")
        print("CLICKED:", clicked)
        await page.wait_for_timeout(1500)

        # click Update / Aktualisieren
        await page.evaluate("""() => {
          const els = Array.from(document.querySelectorAll('div[role="button"], button'));
          const t = els.find(e => /^(Aktualisieren|Update|Anwenden|Übernehmen)$/i.test((e.innerText||'').trim()));
          if (t) t.click();
        }""")
        await page.wait_for_timeout(3000)
        await page.screenshot(path="/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/05_after_max.png")

asyncio.run(main())

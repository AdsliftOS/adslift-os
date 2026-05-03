"""
Scroll the ads table to load all rows of the Age breakdown.
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

        # The Alter breakdown should still be applied
        # Repeatedly scroll the table to bottom
        for i in range(15):
            await page.evaluate("""() => {
              const tbl = document.querySelector('div[role="table"]');
              if (tbl) {
                tbl.scrollTop = tbl.scrollHeight;
                // also scroll any nested scrollable containers
                document.querySelectorAll('div').forEach(d => {
                  if (d.scrollHeight > d.clientHeight + 50 && d.clientHeight > 200) {
                    d.scrollTop = d.scrollHeight;
                  }
                });
              }
              window.scrollTo(0, document.body.scrollHeight);
            }""")
            await page.wait_for_timeout(800)

        rows = await page.evaluate("""() => {
          const rs = Array.from(document.querySelectorAll('div._1gd4'));
          return rs.map(r => (r.innerText||'').replace(/\\s+/g, ' ').trim());
        }""")
        print(f"ROWS: {len(rows)}")
        for i, row in enumerate(rows):
            print(f"[{i}] {row[:200]}")
        (OUT / "38_alter_full.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))

asyncio.run(main())

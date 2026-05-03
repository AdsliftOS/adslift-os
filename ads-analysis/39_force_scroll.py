"""
Force-scroll the ads table to load remaining rows.
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

        # find the last visible row, scroll it into view, repeat
        seen_count = -1
        for i in range(20):
            count = await page.evaluate("""() => {
              const rs = document.querySelectorAll('div._1gd4');
              if (!rs.length) return 0;
              rs[rs.length-1].scrollIntoView({block:'end'});
              return rs.length;
            }""")
            await page.wait_for_timeout(900)
            if count == seen_count:
                # not growing, try wheel events on the table
                await page.evaluate("""() => {
                  const tbl = document.querySelector('div[role="table"]');
                  if (tbl) {
                    const ev = new WheelEvent('wheel', {deltaY: 800, bubbles: true});
                    tbl.dispatchEvent(ev);
                    // also try scrollBy on the parent
                    let p = tbl;
                    while (p) {
                      p.scrollTop = (p.scrollTop || 0) + 600;
                      p = p.parentElement;
                    }
                  }
                }""")
                await page.wait_for_timeout(900)
            seen_count = count

        rows = await page.evaluate("""() => {
          const rs = Array.from(document.querySelectorAll('div._1gd4'));
          return rs.map(r => (r.innerText||'').replace(/\\s+/g, ' ').trim());
        }""")
        print(f"ROWS: {len(rows)}")
        for i, row in enumerate(rows):
            print(f"[{i}] {row[:200]}")
        (OUT / "39_alter_scrolled.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))

asyncio.run(main())

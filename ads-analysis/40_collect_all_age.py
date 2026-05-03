"""
Iterate scroll positions and accumulate all rows seen across scroll positions.
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

        # find the table scroll container
        scroll_info = await page.evaluate("""() => {
          const tbl = document.querySelector('div[role="table"]');
          if (!tbl) return null;
          // find the actual scrollable parent
          let p = tbl;
          while (p) {
            const o = window.getComputedStyle(p).overflowY;
            if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) {
              const r = p.getBoundingClientRect();
              return {found: true, top: p.scrollTop, height: p.scrollHeight, client: p.clientHeight, rect: {x: r.x, y: r.y, w: r.width, h: r.height}};
            }
            p = p.parentElement;
          }
          return {found: false, tableScroll: tbl.scrollHeight - tbl.clientHeight};
        }""")
        print("scroll container:", scroll_info)

        all_rows = {}
        # scroll the table position incrementally — set scrollTop on the actual scrollable container
        for step in range(0, 25):
            scroll_y = step * 350
            await page.evaluate(f"""(y) => {{
              const tbl = document.querySelector('div[role="table"]');
              let p = tbl;
              while (p) {{
                const o = window.getComputedStyle(p).overflowY;
                if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) {{
                  p.scrollTop = y;
                  return;
                }}
                p = p.parentElement;
              }}
              // fallback: window
              window.scrollTo(0, y);
            }}""", scroll_y)
            await page.wait_for_timeout(700)
            rows = await page.evaluate("""() => {
              const rs = Array.from(document.querySelectorAll('div._1gd4'));
              return rs.map(r => (r.innerText||'').replace(/\\s+/g, ' ').trim());
            }""")
            for r in rows:
                # use the first 80 chars as key
                key = r[:120]
                if key not in all_rows:
                    all_rows[key] = r
            print(f"step {step:02d} y={scroll_y} visible={len(rows)} unique total={len(all_rows)}")

        rows_out = list(all_rows.values())
        (OUT / "40_alter_all.json").write_text(json.dumps(rows_out, ensure_ascii=False, indent=2))
        print(f"\nTOTAL UNIQUE: {len(rows_out)}")
        for i, r in enumerate(rows_out):
            print(f"[{i}] {r[:200]}")

asyncio.run(main())

"""
Extract all campaign rows with cell-level structure.
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

        # headers
        headers = await page.evaluate("""() =>
          Array.from(document.querySelectorAll('[role="columnheader"]'))
            .map(h => (h.innerText||'').trim())
            .filter(Boolean)
        """)

        # rows: each row is a `._1gd4` presentation div, cells are `._1gda` direct descendants
        rows = await page.evaluate("""() => {
          const rowDivs = Array.from(document.querySelectorAll('div._1gd4'));
          return rowDivs.map(r => {
            // direct child cell divs
            const cells = Array.from(r.querySelectorAll(':scope > div._1gda, :scope div._1gda'));
            // dedupe by element identity (querySelectorAll already does)
            const cellTexts = cells.map(c => (c.innerText||'').replace(/\\s+/g, ' ').trim());
            return {
              fullText: (r.innerText||'').replace(/\\s+/g, ' ').trim(),
              cells: cellTexts,
            };
          });
        }""")

        out = {"headers": headers, "rows": rows, "count": len(rows)}
        (OUT / "04_campaigns.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"HEADERS ({len(headers)}):", headers)
        print(f"ROWS: {len(rows)}")
        for i, r in enumerate(rows):
            print(f"\n[{i}] cells={len(r['cells'])}")
            for j, c in enumerate(r['cells']):
                print(f"   {j}: {c[:120]}")

asyncio.run(main())

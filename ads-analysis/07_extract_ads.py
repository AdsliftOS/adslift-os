"""
Extract all individual ads. Same row structure (._1gd4).
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
        await page.wait_for_timeout(2000)

        # set big viewport
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2400, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(2000)

        headers = await page.evaluate("""() =>
          Array.from(document.querySelectorAll('[role="columnheader"]'))
            .map(h => (h.innerText||'').trim()).filter(Boolean)
        """)

        rows = await page.evaluate("""() => {
          const rowDivs = Array.from(document.querySelectorAll('div._1gd4'));
          return rowDivs.map(r => {
            // try to find image in row
            const img = r.querySelector('img');
            // get any links
            const links = Array.from(r.querySelectorAll('a')).map(a => ({href: a.href, text: (a.innerText||'').trim()}));
            return {
              fullText: (r.innerText||'').replace(/\\s+/g, ' ').trim(),
              imgSrc: img ? img.src : null,
              links: links.slice(0, 5),
            };
          });
        }""")

        out = {"headers": headers, "rows": rows, "count": len(rows)}
        (OUT / "07_ads.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"HEADERS ({len(headers)}):", headers)
        print(f"ROWS: {len(rows)}")

asyncio.run(main())

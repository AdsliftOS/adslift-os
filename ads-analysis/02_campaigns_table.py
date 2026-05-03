"""
Resize viewport, capture campaign table at high resolution, and scrape the visible rows
into structured JSON. No assumptions — only what's actually rendered.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = None
        for pg in ctx.pages:
            if "adsmanager" in pg.url:
                page = pg
                break
        if not page:
            print("ERR: no ads manager page found")
            return
        await page.bring_to_front()

        # set a large viewport via CDP so we render more columns
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2200,
            "height": 1400,
            "deviceScaleFactor": 1,
            "mobile": False,
        })
        await page.wait_for_timeout(1500)

        # screenshot
        await page.screenshot(path=str(OUT / "02_campaigns_full.png"), full_page=False)

        # Try to extract the table data
        # Ads Manager uses virtualized tables — grab role=row and role=cell
        rows = await page.evaluate("""() => {
          const rows = Array.from(document.querySelectorAll('[role="row"]'));
          return rows.map(r => {
            const cells = Array.from(r.querySelectorAll('[role="cell"], [role="columnheader"], [role="gridcell"]'));
            return cells.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean);
          }).filter(r => r.length > 0);
        }""")

        (OUT / "02_campaigns_rows.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
        print(f"ROWS: {len(rows)}")
        for i, r in enumerate(rows[:30]):
            print(f"  [{i}] {r}")

        # Also extract column headers explicitly
        headers = await page.evaluate("""() => {
          return Array.from(document.querySelectorAll('[role="columnheader"]'))
            .map(h => (h.innerText || h.textContent || '').trim());
        }""")
        print("HEADERS:", headers)
        (OUT / "02_headers.json").write_text(json.dumps(headers, ensure_ascii=False, indent=2))

        # Reset viewport override to avoid disturbing user
        await client.send("Emulation.clearDeviceMetricsOverride")

asyncio.run(main())

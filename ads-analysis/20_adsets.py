"""
Switch to Anzeigengruppen tab and extract all ad set data.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADSETS_URL = "https://adsmanager.facebook.com/adsmanager/manage/adsets?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2400, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        await page.goto(ADSETS_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("div._1gd4", timeout=15000)
        await page.wait_for_timeout(4000)
        await page.screenshot(path=str(OUT / "20_adsets.png"))

        headers = await page.evaluate("""() =>
          Array.from(document.querySelectorAll('[role="columnheader"]'))
            .map(h => (h.innerText||'').trim()).filter(Boolean)
        """)

        rows = await page.evaluate("""() => {
          const rowDivs = Array.from(document.querySelectorAll('div._1gd4'));
          return rowDivs.map(r => ({fullText: (r.innerText||'').replace(/\\s+/g,' ').trim()}));
        }""")

        out = {"headers": headers, "rows": rows}
        (OUT / "20_adsets.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"HEADERS: {headers}")
        for i, r in enumerate(rows):
            print(f"[{i}] {r['fullText'][:200]}")

asyncio.run(main())

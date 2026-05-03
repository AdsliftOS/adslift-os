"""
Navigate to Lead Form library and inspect each form.
Form library URL: https://www.facebook.com/leadgen-forms/?act=...
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
LIB_URL = "https://www.facebook.com/instant_forms_library/?act=2394298901030120&business_id=1285014529172853"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "facebook.com" in pg.url), None) or ctx.pages[0]
        await page.bring_to_front()
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1100, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(500)

        await page.goto(LIB_URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(6000)
        try:
            await page.screenshot(path=str(OUT / "42_lead_forms_lib.png"), timeout=10000)
        except Exception as e:
            print("shot fail:", e)
        print("URL:", page.url)
        print("TITLE:", await page.title())

        # capture text dump
        body = await page.evaluate("() => (document.body.innerText||'').slice(0, 6000)")
        print("\n--- BODY TEXT ---\n", body)

asyncio.run(main())

"""
Navigate to Business Manager / Geschäftspartner to:
- See all ad accounts under this business
- Find Lead Form library
- See pixel events
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = ctx.pages[0]
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1100, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(400)

        for url in [
            "https://business.facebook.com/billing_hub/accounts/details?asset_id=2394298901030120&business_id=1285014529172853",
            "https://business.facebook.com/settings/ad-accounts?business_id=1285014529172853",
            "https://business.facebook.com/leads_center/?business_id=1285014529172853",
            "https://business.facebook.com/events_manager2/list/pixel/?business_id=1285014529172853",
        ]:
            print("\n=== " + url + " ===")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(5000)
                print("RESOLVED URL:", page.url)
                print("TITLE:", await page.title())
                body = await page.evaluate("() => (document.body.innerText||'').slice(0, 4000)")
                print("BODY:\n", body[:2000])
                shot_name = "43_" + url.split('/')[3] + ".png"
                try:
                    await page.screenshot(path=str(OUT / shot_name), timeout=10000)
                except Exception as e:
                    print("shot fail:", e)
            except Exception as e:
                print("nav fail:", e)

asyncio.run(main())

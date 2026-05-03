"""
Open the creative gallery in the connected Chrome and screenshot it.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
HTML = "file:///Users/alexandergoldmann/Desktop/agency-core-os/Adslift%20Kuechen%20Creatives.html"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = await ctx.new_page()
        await page.bring_to_front()
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1100, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.goto(HTML, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        try:
            await page.screenshot(path="/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/55_gallery_top.png", timeout=15000)
        except Exception as e:
            print("shot fail:", e)

        # scroll mid
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight/3)")
        await page.wait_for_timeout(1500)
        try:
            await page.screenshot(path="/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/55_gallery_mid.png", timeout=15000)
        except Exception as e:
            print("shot fail:", e)

        # scroll bottom
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight*0.66)")
        await page.wait_for_timeout(1500)
        try:
            await page.screenshot(path="/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/55_gallery_bottom.png", timeout=15000)
        except Exception as e:
            print("shot fail:", e)

        print("URL:", page.url)
        print("TITLE:", await page.title())
        # count cards
        n = await page.evaluate("() => document.querySelectorAll('.card').length")
        print("Cards rendered:", n)

asyncio.run(main())

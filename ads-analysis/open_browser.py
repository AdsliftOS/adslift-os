import asyncio
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto("https://adsmanager.facebook.com/adsmanager/manage/campaigns",
                        wait_until="domcontentloaded", timeout=60000)
        await page.bring_to_front()
        print("OK: navigated to Meta Ads Manager")

asyncio.run(main())

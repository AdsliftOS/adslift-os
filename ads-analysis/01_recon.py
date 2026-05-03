"""
Recon: capture current state of Ads Manager — screenshot, URL, account name, campaigns visible.
No assumptions. Just observe.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
OUT.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        # find the ads manager page
        page = None
        for pg in ctx.pages:
            if "adsmanager" in pg.url or "facebook.com" in pg.url:
                page = pg
                break
        if not page:
            page = ctx.pages[0]
        await page.bring_to_front()

        url = page.url
        title = await page.title()
        print(f"URL: {url}")
        print(f"TITLE: {title}")

        # screenshot full page
        shot = OUT / "01_recon.png"
        await page.screenshot(path=str(shot), full_page=False)
        print(f"SHOT: {shot}")

        # try to grab the account selector text (top-left)
        try:
            # ad account name often in the top-left selector
            account_text = await page.evaluate("""() => {
                // grab any text that looks like an account id or account name in the header
                const headerCandidates = Array.from(document.querySelectorAll('[role="banner"] *, header *'))
                  .map(e => e.textContent?.trim())
                  .filter(t => t && t.length > 2 && t.length < 80);
                return headerCandidates.slice(0, 30);
            }""")
            print("HEADER_TEXTS:", json.dumps(account_text, ensure_ascii=False, indent=2))
        except Exception as e:
            print("header read failed:", e)

        # extract URL params (act_id is the ad account)
        from urllib.parse import urlparse, parse_qs
        u = urlparse(url)
        params = parse_qs(u.query)
        print("URL_PARAMS:", json.dumps(params, ensure_ascii=False, indent=2))

        # capture viewport size
        vp = page.viewport_size
        print("VIEWPORT:", vp)

asyncio.run(main())

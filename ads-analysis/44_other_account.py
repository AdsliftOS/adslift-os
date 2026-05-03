"""
Find the ad account ID list, navigate to one OTHER account to compare.
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
        page = next((pg for pg in ctx.pages if "facebook.com" in pg.url), None) or ctx.pages[0]
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1100, "deviceScaleFactor": 1, "mobile": False,
        })

        await page.goto("https://business.facebook.com/settings/ad-accounts?business_id=1285014529172853",
                        wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(6000)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(800)

        # Extract ad account ids visible on page
        accounts = await page.evaluate("""() => {
          const txt = document.body.innerText || '';
          const lines = txt.split('\\n').map(l => l.trim()).filter(Boolean);
          const out = [];
          for (let i=0; i<lines.length; i++) {
            const m = lines[i].match(/(\\d{12,18})/);
            if (m) {
              // look for a name in the previous 1-2 lines
              const nm = lines[i-1] || lines[i+1] || '?';
              out.push({id: m[1], context: nm});
            }
          }
          return out;
        }""")
        # dedup
        seen = set(); uniq = []
        for a in accounts:
            if a['id'] not in seen:
                seen.add(a['id']); uniq.append(a)
        print("\nACCOUNTS FOUND:")
        for a in uniq[:30]:
            print(a)
        (OUT / "44_account_list.json").write_text(json.dumps(uniq, ensure_ascii=False, indent=2))

asyncio.run(main())

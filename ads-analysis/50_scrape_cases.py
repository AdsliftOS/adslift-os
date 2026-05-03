"""
Open easybrand.biz and trendmarke.de, capture homepages and find case studies.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
CASES = OUT / "cases"
CASES.mkdir(exist_ok=True)

SITES = [
    ("easybrand", "https://easybrand.biz/"),
    ("trendmarke", "https://www.trendmarke.de/"),
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        # use a fresh page
        page = await ctx.new_page()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        results = {}
        for slug, url in SITES:
            print(f"\n=== {slug} :: {url} ===")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            except Exception as e:
                print("nav fail:", e)
                continue
            await page.wait_for_timeout(5000)
            # take homepage shot
            try:
                await page.screenshot(path=str(CASES / f"{slug}_home.png"), full_page=True, timeout=20000)
            except Exception as e:
                print("home shot fail:", e)
                try:
                    await page.screenshot(path=str(CASES / f"{slug}_home.png"), timeout=10000)
                except: pass

            # collect all internal links
            links = await page.evaluate(f"""() => {{
              const base = '{url}';
              const u = new URL(base);
              return Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.href)
                .filter(h => h.startsWith('http'))
                .filter(h => new URL(h).host.endsWith(u.host))
                .filter(h => !h.includes('#'))
            }}""")
            # dedupe
            uniq = list(dict.fromkeys(links))
            print(f"links: {len(uniq)}")

            # filter for case-study-like URLs
            candidates = [l for l in uniq if any(kw in l.lower() for kw in
                ['referenz', 'case', 'kunden', 'projekt', 'portfolio', 'erfolg', 'work', 'project', 'showcase'])]
            print("case candidates:")
            for c in candidates[:30]:
                print(f"  {c}")

            # also dump full body text of homepage for "case-mentioning" detection
            body = await page.evaluate("() => (document.body.innerText||'').slice(0, 12000)")
            results[slug] = {
                "url": url,
                "all_links": uniq,
                "case_candidates": candidates,
                "homepage_text": body,
            }

        (OUT / "50_cases_overview.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))

asyncio.run(main())

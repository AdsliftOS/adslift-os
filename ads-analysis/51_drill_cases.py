"""
Drill into the case/referenz pages and extract every case study text + image alts.
"""
import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
CASES = OUT / "cases"

PAGES = [
    ("easybrand_referenzen", "https://easybrand.biz/unsere-referenzen"),
    ("trendmarke_kunden", "https://www.trendmarke.de/kunden"),
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "easybrand" in pg.url or "trendmarke" in pg.url), None) or await ctx.new_page()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1400, "deviceScaleFactor": 1, "mobile": False,
        })

        all_data = {}
        for slug, url in PAGES:
            print(f"\n=== {slug} ===")
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(5000)

            # scroll all the way down to load lazy content
            for i in range(8):
                await page.evaluate("window.scrollBy(0, 1200)")
                await page.wait_for_timeout(700)
            await page.evaluate("window.scrollTo(0, 0)")
            await page.wait_for_timeout(800)

            # screenshot
            try:
                await page.screenshot(path=str(CASES / f"{slug}_full.png"), full_page=True, timeout=30000)
            except Exception as e:
                print("full shot fail:", e)
                try:
                    await page.screenshot(path=str(CASES / f"{slug}_full.png"), timeout=10000)
                except: pass

            # extract content
            data = await page.evaluate("""() => {
              const body = (document.body.innerText||'').replace(/\\n{3,}/g, '\\n\\n');
              const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({href: a.href, text: (a.innerText||'').trim()})).filter(l => l.text);
              const imgs = Array.from(document.querySelectorAll('img')).map(i => ({src: i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight})).filter(i => (i.alt||'').length > 0 || i.w > 200);
              const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim()).filter(Boolean);
              return {body, links, imgs: imgs.slice(0, 60), headings};
            }""")
            (OUT / f"51_{slug}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
            all_data[slug] = data
            print(f"body length: {len(data['body'])}")
            print(f"headings ({len(data['headings'])}): {data['headings'][:30]}")
            print(f"images: {len(data['imgs'])} — examples (with alt):")
            for img in [i for i in data['imgs'] if i['alt']][:30]:
                print(f"  alt='{img['alt'][:80]}' src={img['src'][:100]}")

asyncio.run(main())

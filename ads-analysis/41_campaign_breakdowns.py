"""
Switch to Campaigns tab, apply Alter breakdown.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
CAMPAIGNS = "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

async def open_breakdown_and_select(page, label):
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(400)
    btn = page.locator("div[role='button']").filter(has_text="Aufschlüsselung").first
    await btn.click()
    await page.wait_for_timeout(1500)
    return await page.evaluate(f"""() => {{
      const all = document.querySelectorAll('div, span');
      for (const el of all) {{
        if (el.children.length === 0 && (el.innerText||'').trim() === '{label}') {{
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {{
            el.click();
            return {{clicked: '{label}'}};
          }}
        }}
      }}
      return {{error: 'not found'}};
    }}""")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1100, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(500)

        await page.goto(CAMPAIGNS, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("div._1gd4", timeout=15000)
        await page.wait_for_timeout(3500)

        for label in ["Alter", "Geschlecht", "Plattform"]:
            print(f"\n=== {label} ===")
            r = await open_breakdown_and_select(page, label)
            print("apply:", r)
            await page.wait_for_timeout(5000)
            rows = await page.evaluate("""() => {
              const rs = Array.from(document.querySelectorAll('div._1gd4'));
              return rs.map(r => (r.innerText||'').replace(/\\s+/g, ' ').trim());
            }""")
            (OUT / f"41_camp_{label.lower()}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
            print(f"ROWS: {len(rows)}")
            for i, row in enumerate(rows):
                print(f"[{i}] {row[:200]}")

asyncio.run(main())

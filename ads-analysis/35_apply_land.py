"""
Apply Land breakdown and capture results.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

async def apply_breakdown(page, label):
    btn = page.locator("div[role='button']").filter(has_text="Aufschlüsselung").first
    await btn.click()
    await page.wait_for_timeout(1300)
    # click the menu item with that label by JS (since it has no role)
    clicked = await page.evaluate(f"""() => {{
      const btn = Array.from(document.querySelectorAll('div[role="button"]'))
        .find(b => (b.innerText||'').trim() === 'Aufschlüsselung');
      const menuId = btn && btn.getAttribute('aria-controls');
      const menuEl = menuId ? document.getElementById(menuId) :
        Array.from(document.querySelectorAll('div')).find(d => (d.innerText||'').includes('Beliebt') && d.innerText.includes('Land'));
      if (!menuEl) return {{error: 'no menu'}};
      const items = menuEl.querySelectorAll('div, span, a');
      for (const el of items) {{
        if (el.children.length === 0 && (el.innerText||'').trim() === '{label}') {{
          el.click();
          return {{clicked: '{label}'}};
        }}
      }}
      return {{error: 'item not found'}};
    }}""")
    return clicked

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1000, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(500)

        await page.goto(ADS_LIST, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("div._1gd4", timeout=15000)
        await page.wait_for_timeout(3500)

        for label, fname in [("Land", "land"), ("Plattform", "plattform"), ("Alter", "alter"), ("Demografische Angaben", "demografisch")]:
            print(f"\n=== Breakdown: {label} ===")
            r = await apply_breakdown(page, label)
            print("apply:", r)
            await page.wait_for_timeout(4000)
            try:
                await page.screenshot(path=str(OUT / f"35_{fname}.png"), timeout=10000)
            except Exception as e:
                print("shot fail:", e)
            # extract rows
            rows = await page.evaluate("""() => {
              const rs = Array.from(document.querySelectorAll('div._1gd4'));
              return rs.map(r => (r.innerText||'').replace(/\\s+/g, ' ').trim());
            }""")
            (OUT / f"35_{fname}_rows.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
            print(f"ROWS: {len(rows)}")
            for i, row in enumerate(rows[:30]):
                print(f"[{i}] {row[:200]}")

asyncio.run(main())

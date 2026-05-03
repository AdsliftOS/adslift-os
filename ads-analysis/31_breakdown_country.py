"""
Open the Aufschluesselung menu, navigate to Land breakdown, then extract table rows.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

JS_LIST_MENU = """
() => {
  // Find menu items currently visible
  const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], li, a'));
  return items.map(e => (e.innerText||'').trim()).filter(t => t && t.length < 80).slice(0, 80);
}
"""

JS_CLICK_TEXT = """
(needle) => {
  const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], div, span, a'));
  // exact match first
  let target = items.find(e => (e.innerText||'').trim() === needle);
  if (!target) target = items.find(e => (e.innerText||'').trim().startsWith(needle) && (e.innerText||'').trim().length < 50);
  if (target) { target.click(); return {clicked: target.innerText.trim()}; }
  return {error: 'not found', needle};
}
"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2400, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        await page.goto(ADS_LIST, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("div._1gd4", timeout=15000)
        await page.wait_for_timeout(3500)

        # 1) click Aufschluesselung
        res = await page.evaluate("""() => {
          const all = Array.from(document.querySelectorAll('div[role="button"], button, a, span'));
          const btn = all.find(e => /^Aufschlüsselung$/.test((e.innerText||'').trim()));
          if (btn) { btn.click(); return 'opened'; } return null;
        }""")
        print("Aufschlusselung:", res)
        await page.wait_for_timeout(1500)
        items = await page.evaluate(JS_LIST_MENU)
        print("Menu items:", items[:30])

        # 2) hover/click 'Auslieferung' submenu (where Country lives)
        for needle in ["Auslieferung", "Land", "Region", "Plattform", "Alter", "Geschlecht"]:
            r = await page.evaluate(JS_CLICK_TEXT, needle)
            print(f"click {needle}:", r)
            await page.wait_for_timeout(700)

        await page.wait_for_timeout(3000)
        # try save state
        try:
            await page.screenshot(path=str(OUT / "31_breakdown.png"), timeout=8000)
        except Exception as e:
            print("shot fail:", e)

        # try to extract table after breakdown applied
        rows = await page.evaluate("""() => {
          const rowDivs = Array.from(document.querySelectorAll('div._1gd4'));
          return rowDivs.map(r => (r.innerText||'').replace(/\\s+/g,' ').trim());
        }""")
        print(f"\\nROWS after breakdown: {len(rows)}")
        for i, r in enumerate(rows[:30]):
            print(f"[{i}] {r[:200]}")

        (OUT / "31_breakdown_rows.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))

asyncio.run(main())

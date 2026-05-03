"""
Open Aufschluesselung, dump ALL elements in the popup, find Country breakdown.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

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

        btn = page.locator("div[role='button']").filter(has_text="Aufschlüsselung").first
        await btn.click()
        await page.wait_for_timeout(1500)

        # find menu by aria-controls relationship
        menu_data = await page.evaluate("""() => {
          // any div with attribute aria-labelledby or role='menu' or class containing 'popup'
          const menus = Array.from(document.querySelectorAll('div'));
          // pick the one referenced by aria-controls of the Aufschluesselung button
          const btn = Array.from(document.querySelectorAll('div[role="button"]'))
            .find(b => (b.innerText||'').trim() === 'Aufschlüsselung');
          let menuId = btn ? btn.getAttribute('aria-controls') : null;
          let menuEl = menuId ? document.getElementById(menuId) : null;
          if (!menuEl) {
            // fallback: largest visible element with 'Allgemein' inside
            menuEl = Array.from(document.querySelectorAll('div'))
              .find(d => (d.innerText||'').trim().startsWith('Allgemein\\n') && (d.innerText||'').length < 800);
          }
          if (!menuEl) return {error: 'no menu', menuId};
          const items = [];
          menuEl.querySelectorAll('div, span, a').forEach(e => {
            const t = (e.innerText||'').trim();
            if (e.children.length === 0 && t && t.length < 60) {
              items.push({text: t, role: e.getAttribute('role'), tag: e.tagName, ariaLabel: e.getAttribute('aria-label')});
            }
          });
          return {menuId, items, fullText: (menuEl.innerText||'').trim()};
        }""")
        print(json.dumps(menu_data, ensure_ascii=False, indent=2))

asyncio.run(main())

"""
Better approach: find the Aufschluesselung button via its aria-label,
hover for submenu, click 'Auslieferung'-like submenu, click 'Land'.
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
            "width": 2400, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        await page.goto(ADS_LIST, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("div._1gd4", timeout=15000)
        await page.wait_for_timeout(3500)

        # close any open menus
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)

        # find Aufschluesselung button candidates
        cand = await page.evaluate("""() => {
          const all = Array.from(document.querySelectorAll('div[role="button"], button, a'));
          return all
            .filter(e => /Aufschlüsselung/.test((e.innerText||'') + (e.getAttribute('aria-label')||'')))
            .map(e => ({
              tag: e.tagName, role: e.getAttribute('role'),
              ariaLabel: e.getAttribute('aria-label'),
              text: (e.innerText||'').trim().slice(0,80),
              dataIdx: e.getAttribute('data-idx'),
            }));
        }""")
        print("aufsch candidates:", json.dumps(cand, ensure_ascii=False, indent=2))

        # click the toolbar one (with shorter text)
        clicked = await page.evaluate("""() => {
          const all = Array.from(document.querySelectorAll('div[role="button"], button, a'));
          // pick the one whose aria-label or text is exactly 'Aufschlüsselung' AND is in the page header/toolbar (not sidebar)
          const candidates = all.filter(e => {
            const t = (e.innerText||'').trim();
            const al = e.getAttribute('aria-label') || '';
            return (t === 'Aufschlüsselung' || al === 'Aufschlüsselung') && e.offsetWidth > 60 && e.offsetWidth < 250;
          });
          if (candidates.length) {
            // pick the one closest to the top of the page (toolbar)
            candidates.sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const el = candidates[0];
            const r = el.getBoundingClientRect();
            return {found: candidates.length, rect: {x: r.x, y: r.y, w: r.width, h: r.height}, el: el.outerHTML.slice(0,200)};
          }
          return {found: 0};
        }""")
        print("toolbar btn:", json.dumps(clicked, ensure_ascii=False, indent=2))

        if clicked.get('found'):
            # JS click instead of mouse coordinates (mouse may be off-screen)
            await page.evaluate("""() => {
              const all = Array.from(document.querySelectorAll('div[role="button"], button, a'));
              const t = all.find(e => (e.innerText||'').trim() === 'Aufschlüsselung' && e.offsetWidth > 60 && e.offsetWidth < 300);
              if (t) t.click();
            }""")
            await page.wait_for_timeout(1500)
            try:
                await page.screenshot(path=str(OUT / "32_aufschl_open.png"), timeout=8000)
            except: pass

            # dump items currently visible in menus
            items = await page.evaluate("""() => {
              const role_items = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'));
              return role_items.map(e => ({
                role: e.getAttribute('role'),
                ariaLabel: e.getAttribute('aria-label'),
                text: (e.innerText||'').trim().slice(0,80),
              }));
            }""")
            print(f"\nMENU ITEMS ({len(items)}):")
            for it in items[:60]:
                print(f"  {it}")

asyncio.run(main())

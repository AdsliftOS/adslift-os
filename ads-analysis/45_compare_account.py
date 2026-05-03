"""
Navigate to OrangeBeuaty ad account, apply Land + Alter breakdowns, capture data.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
OB_CAMPAIGNS = "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1427687325182023&business_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

async def open_breakdown(page, label):
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

async def set_max_date(page):
    # Click date picker, choose Maximum
    await page.evaluate("""() => {
      const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
      const cand = btns.find(b => /Letzte|Tage|Maximum/i.test(b.innerText || ''));
      if (cand) cand.click();
    }""")
    await page.wait_for_timeout(1500)
    await page.evaluate("""() => {
      const els = Array.from(document.querySelectorAll('*'));
      const t = els.find(e => e.children.length === 0 && /^Maximum$/.test((e.innerText||'').trim()));
      if (t) t.click();
    }""")
    await page.wait_for_timeout(1500)
    await page.evaluate("""() => {
      const els = Array.from(document.querySelectorAll('div[role="button"], button'));
      const t = els.find(e => /^(Aktualisieren|Anwenden|Übernehmen)$/i.test((e.innerText||'').trim()));
      if (t) t.click();
    }""")
    await page.wait_for_timeout(3500)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None) or ctx.pages[0]
        await page.bring_to_front()
        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 1500, "height": 1100, "deviceScaleFactor": 1, "mobile": False,
        })

        await page.goto(OB_CAMPAIGNS, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(6000)
        try:
            await page.screenshot(path=str(OUT / "45_orangebeuaty_overview.png"), timeout=10000)
        except: pass
        print("URL:", page.url)
        print("TITLE:", await page.title())

        # see if there are any rows
        rows_initial = await page.evaluate("""() => {
          const rs = Array.from(document.querySelectorAll('div._1gd4'));
          return rs.map(r => (r.innerText||'').replace(/\\s+/g,' ').trim());
        }""")
        print(f"\nINITIAL ROWS ({len(rows_initial)}):")
        for r in rows_initial[:15]:
            print(f"  {r[:200]}")

        # set max date
        await set_max_date(page)
        rows_max = await page.evaluate("""() => {
          const rs = Array.from(document.querySelectorAll('div._1gd4'));
          return rs.map(r => (r.innerText||'').replace(/\\s+/g,' ').trim());
        }""")
        print(f"\nMAX DATE ROWS ({len(rows_max)}):")
        for r in rows_max[:15]:
            print(f"  {r[:200]}")

        # apply Alter breakdown
        if rows_max:
            for label in ["Alter", "Land"]:
                print(f"\n=== {label} ===")
                r = await open_breakdown(page, label)
                print("apply:", r)
                await page.wait_for_timeout(5000)
                rows = await page.evaluate("""() => {
                  const rs = Array.from(document.querySelectorAll('div._1gd4'));
                  return rs.map(r => (r.innerText||'').replace(/\\s+/g,' ').trim());
                }""")
                (OUT / f"45_ob_{label.lower()}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
                print(f"ROWS: {len(rows)}")
                for i, row in enumerate(rows[:30]):
                    print(f"[{i}] {row[:200]}")

asyncio.run(main())

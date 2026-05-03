"""
Find row container by walking from a switch (the on/off toggle).
"""
import asyncio, json
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        info = await page.evaluate("""() => {
          const switches = document.querySelectorAll('[role="switch"]');
          if (!switches.length) return {error: 'no switches'};
          const sw = switches[0];
          const ancestors = [];
          let e = sw;
          for (let i=0; i<20 && e; i++) {
            const text = (e.innerText||'').replace(/\\s+/g,' ').slice(0, 200);
            ancestors.push({
              i,
              tag: e.tagName,
              role: e.getAttribute('role'),
              cls: (e.className||'').toString().slice(0,50),
              dataKey: e.getAttribute('data-key'),
              dataTestId: e.getAttribute('data-testid'),
              ariaRow: e.getAttribute('aria-rowindex'),
              ariaCol: e.getAttribute('aria-colindex'),
              text,
            });
            e = e.parentElement;
          }
          return {ancestors};
        }""")
        print(json.dumps(info, ensure_ascii=False, indent=2))

asyncio.run(main())

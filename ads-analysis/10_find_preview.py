"""
Hover the first ad row, capture a screenshot AND list all clickable buttons.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")

JS = """
async () => {
  const row = document.querySelectorAll('div._1gd4')[0];
  if (!row) return {error: 'no row'};
  const r = row.getBoundingClientRect();
  const ev = new MouseEvent('mouseover', {bubbles:true, clientX: r.left+50, clientY: r.top+30});
  row.dispatchEvent(ev);
  await new Promise(res => setTimeout(res, 600));
  const buttons = Array.from(row.querySelectorAll('a, [role="button"], button'))
    .map(b => ({
      tag: b.tagName,
      role: b.getAttribute('role'),
      ariaLabel: b.getAttribute('aria-label'),
      text: (b.innerText||'').trim().slice(0,80),
      hasIcon: !!b.querySelector('i, svg, img'),
    }))
    .filter(b => b.ariaLabel || b.text || b.hasIcon);
  return {buttons: buttons.slice(0, 50)};
}
"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        info = await page.evaluate(JS)
        print(json.dumps(info, ensure_ascii=False, indent=2))

        # also screenshot during hover via mouse move
        rows = page.locator("div._1gd4")
        first = rows.first
        await first.hover()
        await page.wait_for_timeout(700)
        await page.screenshot(path=str(OUT / "10_hover.png"))

asyncio.run(main())

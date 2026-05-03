"""
Click 'Bearbeiten' inside Platzierungen section to expand the actual checklist
of selected placements (Facebook Feed, Instagram Reels, etc).
Then dump.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
EDITOR = "https://adsmanager.facebook.com/adsmanager/manage/adsets/edit/standalone?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum&selected_adset_ids={asid}&current_step=0"

ADSETS = [
    ("00_Coaches", "120242521883340525"),
    ("02_Garten", "120242520220720525"),  # only check 2 — placement is account-level, likely same
]

JS_EXPAND_AND_DUMP = """
async () => {
  // find the Platzierungen section header
  const all = Array.from(document.querySelectorAll('div, h2, h3, span'));
  const header = all.find(e => /^Platzierungen$/.test((e.innerText||'').trim()));
  if (!header) return {error: 'no platzierungen header'};
  header.scrollIntoView({block:'start', behavior:'instant'});
  await new Promise(r => setTimeout(r, 1000));
  // find a 'Bearbeiten' / 'Manuell' / 'Manuelle Platzierungen' radio nearby
  let parent = header.parentElement;
  for (let i=0;i<10 && parent;i++) parent = parent.parentElement || parent;
  // simpler: find any radio button inside this section
  // Just dump the section's full text after expanding any closed containers
  const bsContainer = (() => {
    let p = header.parentElement;
    for (let i=0;i<10 && p;i++) {
      if ((p.innerText||'').length > 400 && (p.innerText||'').includes('Platzierungen')) return p;
      p = p.parentElement;
    }
    return header.parentElement;
  })();
  // try to find and click any 'Manuelle Platzierungen' radio
  const radios = Array.from(bsContainer.querySelectorAll('input[type="radio"], [role="radio"]'));
  // try clicking on labels that match 'Manuell'
  const labels = Array.from(bsContainer.querySelectorAll('label, div, span'));
  const manualLabel = labels.find(l => /Manuelle Platzierungen|Manuelle/.test((l.innerText||'').trim()) && (l.innerText||'').length < 80);
  // we don't actually want to change settings, so DON'T click radios.
  // Instead, just dump the full innerText
  return {text: (bsContainer.innerText||'').slice(0, 6000)};
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
            "width": 1700, "height": 2400, "deviceScaleFactor": 1.5, "mobile": False,
        })

        for tag, asid in ADSETS:
            print(f"\n=== {tag} ===")
            await page.goto(EDITOR.format(asid=asid), wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(8000)
            data = await page.evaluate(JS_EXPAND_AND_DUMP)
            print(data.get('text', '')[:3000])

asyncio.run(main())

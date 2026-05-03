"""
Open each ad set editor, expand all sections (click 'Bearbeiten' inside each),
then dump the full innerText of the left form column.
"""
import asyncio, json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
EDITOR = "https://adsmanager.facebook.com/adsmanager/manage/adsets/edit/standalone?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum&selected_adset_ids={asid}&current_step=0"

ADSET_IDS = [
    ("00_Coaches", "120242521883340525"),
    ("01_Immo", "120242521665020525"),
    ("02_Garten", "120242520220720525"),
    ("03_Dienstleister", "120241611847300525"),
    ("04_OB_T03", "120241315820130525"),
    ("05_OB_T02", "120241169362520525"),
    ("06_OB_T01", "120240746720580525"),
]

JS_DUMP = """
() => {
  // First click any 'Bearbeiten' (Edit) buttons to expand sections
  // Don't actually click — just dump full visible text in priority sections
  const all = Array.from(document.querySelectorAll('div, section, span, label'));
  const sections = {};
  const sectionLabels = ['Standort', 'Standorte', 'Alter', 'Geschlecht', 'Sprachen', 'Sprache',
                          'Detailliertes Targeting', 'Detaillierte Zielgruppen',
                          'Custom Audience', 'Custom Audiences', 'Lookalike Audience', 'Lookalike',
                          'Audience', 'Zielgruppe', 'Advantage+ Zielgruppe',
                          'Platzierungen', 'Geräteplattformen', 'Plattformen',
                          'Performance-Ziel', 'Conversion-Ereignis', 'Pixel', 'Conversion',
                          'Optimierung der Anzeigenschaltung', 'Werbeanzeigenplanung',
                          'Tagesbudget', 'Budget', 'Gebotsstrategie',
                          'Geschätzte tägliche Ergebnisse', 'Tägliche Ergebnisse',
                          'Lead-Form', 'Aufrufberechtigung'];
  for (const lbl of sectionLabels) {
    const target = all.find(e => {
      const t = (e.innerText||'').trim();
      return (t === lbl || t.startsWith(lbl + '\\n') || t.startsWith(lbl + ':')) && e.offsetHeight < 800;
    });
    if (target) {
      // walk up to find a richer container
      let p = target.parentElement;
      let best = (target.innerText||'').trim();
      for (let i=0;i<5 && p; i++) {
        const cand = (p.innerText||'').trim();
        if (cand.length > best.length && cand.length < 3000) best = cand;
        p = p.parentElement;
      }
      sections[lbl] = best;
    }
  }
  // also dump full text of left column / form area
  const form = document.querySelector('form, [role="main"]');
  const leftFull = form ? (form.innerText||'').slice(0, 12000) : null;
  return {sections, leftFull};
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
            "width": 1900, "height": 1400, "deviceScaleFactor": 1, "mobile": False,
        })

        out_all = []
        for tag, asid in ADSET_IDS:
            print(f"\n=== {tag} ({asid}) ===")
            await page.goto(EDITOR.format(asid=asid), wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(8000)

            # screenshot only viewport
            try:
                await page.screenshot(path=str(OUT / f"adset_{tag}.png"), timeout=15000)
            except Exception as e:
                print("shot fail:", e)

            # scroll the left form to top, then dump
            await page.evaluate("() => { const el = document.querySelector('form'); if (el) el.scrollTop = 0; }")
            await page.wait_for_timeout(800)
            data = await page.evaluate(JS_DUMP)
            (OUT / f"adset_{tag}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
            out_all.append({"tag": tag, "asid": asid, **data})
            # print key sections
            for k, v in data.get('sections', {}).items():
                print(f"  [{k}] {v[:150]}")

        (OUT / "all_adset_targeting.json").write_text(json.dumps(out_all, ensure_ascii=False, indent=2))

asyncio.run(main())

"""
Set big viewport, capture editor screenshot full and extract creative DOM data.
"""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "edit/standalone" in pg.url or "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2200, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(2500)

        url = page.url
        print("URL:", url)

        # extract selected_ad_ids
        from urllib.parse import urlparse, parse_qs
        ad_id = parse_qs(urlparse(url).query).get("selected_ad_ids", [None])[0]
        print("AD_ID:", ad_id)

        await page.screenshot(path=str(OUT / "12_editor_big.png"), full_page=False)

        # walk DOM for textareas, inputs, and the preview section
        data = await page.evaluate("""() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], textarea, input:not([type])'))
            .map(e => ({
              name: e.getAttribute('name'),
              ariaLabel: e.getAttribute('aria-label'),
              placeholder: e.getAttribute('placeholder'),
              value: e.value,
              type: e.tagName + (e.type ? '/' + e.type : ''),
            }))
            .filter(e => e.value || e.ariaLabel || e.placeholder);

          // look for the preview iframe area / phone mockup
          const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({src: f.src, name: f.name}));

          // try to find primary text and headline by section labels
          const sections = {};
          const labels = Array.from(document.querySelectorAll('div, span, label, h1, h2, h3, h4'));
          for (const lbl of labels) {
            const t = (lbl.innerText||'').trim();
            if (/^(Primärer Text|Überschrift|Beschreibung|Website-URL|Call-to-Action|Anzeigenkonto|Werbekonto)/i.test(t)
                && t.length < 60) {
              // find the next sibling content
              const parent = lbl.parentElement;
              if (parent) {
                sections[t] = (parent.innerText||'').slice(0, 500);
              }
            }
          }
          return {inputs, iframes, sections};
        }""")

        (OUT / "12_editor_data.json").write_text(json.dumps({"url": url, "ad_id": ad_id, "data": data}, ensure_ascii=False, indent=2))
        print(f"INPUTS: {len(data['inputs'])}")
        for i in data['inputs']:
            print(f"  {i['type']:18} aria={i['ariaLabel']!r:50} val={i['value'][:80]!r}")
        print(f"IFRAMES: {data['iframes']}")
        print(f"SECTIONS: {len(data['sections'])}")
        for k, v in data['sections'].items():
            print(f"  [{k}] {v[:120]}")

asyncio.run(main())

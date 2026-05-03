"""
Extract complete creative data from currently-open editor:
- Ad name
- Primary text (multiple variants supported)
- Headline (multiple variants)
- Description (multiple variants)
- CTA
- Website URL
- Selected_ad_id (from URL)
- Save preview screenshot

Returns a structured JSON record.
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")

JS_EXTRACT = """
() => {
  function findLabel(el) {
    // walk up looking for a header
    let p = el.parentElement;
    for (let i=0;i<8 && p; i++) {
      const labels = ['Primärer Text','Überschrift','Beschreibung','Website-URL','Anzeigenname','Anzeige-Name','Anzeigentext'];
      for (const lbl of labels) {
        if (p.innerText && p.innerText.startsWith(lbl)) return lbl;
      }
      p = p.parentElement;
    }
    return null;
  }
  const fields = [];
  document.querySelectorAll('input[type="text"], textarea').forEach(el => {
    fields.push({
      tag: el.tagName,
      value: el.value,
      ariaLabel: el.getAttribute('aria-label'),
      placeholder: el.getAttribute('placeholder'),
      label: findLabel(el),
    });
  });

  // also find the website-url-like fields (input with URL value)
  // and the CTA selector text
  const ctaWrap = Array.from(document.querySelectorAll('div, span'))
    .find(d => /^Call-to-Action$/.test((d.innerText||'').trim()) && d.parentElement);
  let cta = null;
  if (ctaWrap) {
    // sibling text after Call-to-Action label
    const parent = ctaWrap.parentElement;
    cta = (parent.innerText||'').replace('Call-to-Action','').replace(/Wähle eine Option aus/,'').trim().split('\\n')[0];
  }

  // ad name (from page title or first input)
  const titleInput = Array.from(document.querySelectorAll('input[type="text"]'))
    .find(i => i.value && i.value.startsWith('Adslift'));

  // any URLs visible in the page
  const urls = Array.from(document.querySelectorAll('a[href]'))
    .map(a => a.href)
    .filter(h => h && !h.includes('facebook.com') && !h.startsWith('javascript:') && !h.startsWith('mailto:'));

  return {
    fields,
    cta,
    adName: titleInput ? titleInput.value : null,
    externalUrls: Array.from(new Set(urls)).slice(0, 20),
  };
}
"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "edit/standalone" in pg.url), None)
        if not page:
            page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2200, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })
        await page.wait_for_timeout(1500)

        from urllib.parse import urlparse, parse_qs
        url = page.url
        ad_id = parse_qs(urlparse(url).query).get("selected_ad_ids", [None])[0]

        # full screenshot of editor
        shot_name = f"editor_{ad_id}.png"
        await page.screenshot(path=str(OUT / shot_name))

        data = await page.evaluate(JS_EXTRACT)
        record = {"ad_id": ad_id, "url": url, **data, "screenshot": shot_name}
        print(json.dumps(record, ensure_ascii=False, indent=2))

        # save
        (OUT / f"creative_{ad_id}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))

asyncio.run(main())

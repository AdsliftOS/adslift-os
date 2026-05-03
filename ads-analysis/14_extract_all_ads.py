"""
Iterate through all 21 ads:
  - Go to ads list
  - For each row index: hover, click Bearbeiten, extract creative, save
  - Close editor / navigate back
  - Repeat
"""
import asyncio, json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST_URL = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

JS_EXTRACT = """
() => {
  const fields = [];
  document.querySelectorAll('input[type="text"], textarea').forEach(el => {
    fields.push({tag: el.tagName, value: el.value, placeholder: el.getAttribute('placeholder')});
  });

  const ctaWrap = Array.from(document.querySelectorAll('div, span'))
    .find(d => /^Call-to-Action$/.test((d.innerText||'').trim()));
  let cta = null;
  if (ctaWrap && ctaWrap.parentElement) {
    cta = (ctaWrap.parentElement.innerText||'')
      .replace('Call-to-Action','')
      .replace(/Wähle eine Option aus/,'')
      .trim().split('\\n')[0];
  }

  const titleInput = Array.from(document.querySelectorAll('input[type="text"]'))
    .find(i => i.value && i.value.startsWith('Adslift'));

  // Look for the website URL near a "Website-URL" label
  const urlLabel = Array.from(document.querySelectorAll('div, span'))
    .find(d => /Website-URL/.test((d.innerText||'').trim()) && (d.innerText||'').length < 50);
  let websiteUrl = null;
  if (urlLabel) {
    let p = urlLabel.parentElement;
    for (let i=0;i<5 && p; i++) {
      const inp = p.querySelector('input[type="text"]');
      if (inp && inp.value && (inp.value.startsWith('http') || inp.value.includes('.'))) {
        websiteUrl = inp.value;
        break;
      }
      p = p.parentElement;
    }
  }

  return {fields, cta, adName: titleInput ? titleInput.value : null, websiteUrl};
}
"""

JS_HOVER_CLICK_EDIT = """
(idx) => {
  const rows = document.querySelectorAll('div._1gd4');
  if (!rows[idx]) return {error: 'row missing'};
  const row = rows[idx];
  // dispatch hover
  const r = row.getBoundingClientRect();
  ['mouseover','mouseenter','mousemove'].forEach(type => {
    row.dispatchEvent(new MouseEvent(type, {bubbles:true, clientX:r.left+50, clientY:r.top+30}));
  });
  // wait inline isn't possible; just click after small delay via Promise
  return new Promise(resolve => {
    setTimeout(() => {
      const a = row.querySelector('a[aria-label="Bearbeiten"]');
      if (a) {
        a.click();
        resolve({clicked: true});
      } else {
        resolve({error: 'no edit button'});
      }
    }, 400);
  });
}
"""

async def go_to_ads_list(page):
    await page.goto(ADS_LIST_URL, wait_until="domcontentloaded", timeout=45000)
    await page.wait_for_timeout(4000)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        page = next((pg for pg in ctx.pages if "adsmanager" in pg.url), None)
        await page.bring_to_front()

        client = await ctx.new_cdp_session(page)
        await client.send("Emulation.setDeviceMetricsOverride", {
            "width": 2200, "height": 1500, "deviceScaleFactor": 1, "mobile": False,
        })

        # ensure we're on ads list
        await go_to_ads_list(page)

        # how many rows? subtract 1 (totals row) but cap at 25
        row_count = await page.evaluate("() => document.querySelectorAll('div._1gd4').length")
        print(f"ROW COUNT: {row_count}")
        # last row is the totals row, so skip it
        ad_row_count = row_count - 1
        print(f"AD ROWS TO PROCESS: {ad_row_count}")

        all_data = []
        for idx in range(ad_row_count):
            print(f"\n--- Processing row {idx} ---")
            # hover + click edit
            click_res = await page.evaluate(JS_HOVER_CLICK_EDIT, idx)
            print("click:", click_res)
            if click_res.get("error"):
                continue
            # wait for editor URL
            try:
                await page.wait_for_url("**edit/standalone**", timeout=15000)
            except Exception as e:
                print("URL wait failed:", e)
            await page.wait_for_timeout(4500)

            url = page.url
            ad_id = parse_qs(urlparse(url).query).get("selected_ad_ids", [None])[0]
            print(f"AD_ID: {ad_id}")

            # screenshot
            shot = f"ad_{idx:02d}_{ad_id}.png"
            try:
                await page.screenshot(path=str(OUT / shot))
            except Exception as e:
                print("screenshot fail:", e)

            data = await page.evaluate(JS_EXTRACT)
            record = {"index": idx, "ad_id": ad_id, "url": url, "screenshot": shot, **data}
            all_data.append(record)
            (OUT / f"ad_{idx:02d}_{ad_id}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))

            # back to ads list
            await go_to_ads_list(page)

        (OUT / "all_ads.json").write_text(json.dumps(all_data, ensure_ascii=False, indent=2))
        print(f"\nTOTAL CAPTURED: {len(all_data)}")

asyncio.run(main())

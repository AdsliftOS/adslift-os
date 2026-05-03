"""
Retry the ads that returned 0 textareas. Use longer wait + wait_for_selector.
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
      .replace('Call-to-Action','').replace(/Wähle eine Option aus/,'').trim().split('\\n')[0];
  }
  const titleInput = Array.from(document.querySelectorAll('input[type="text"]'))
    .find(i => i.value && i.value.startsWith('Adslift'));
  return {fields, cta, adName: titleInput ? titleInput.value : null};
}
"""

JS_HOVER_CLICK = """
(idx) => {
  const rows = document.querySelectorAll('div._1gd4');
  if (!rows[idx]) return {error: 'row missing', count: rows.length};
  const row = rows[idx];
  const r = row.getBoundingClientRect();
  ['mouseover','mouseenter','mousemove'].forEach(type => {
    row.dispatchEvent(new MouseEvent(type, {bubbles:true, clientX:r.left+50, clientY:r.top+30}));
  });
  return new Promise(resolve => {
    setTimeout(() => {
      const a = row.querySelector('a[aria-label="Bearbeiten"]');
      if (a) { a.click(); resolve({clicked: true}); }
      else { resolve({error: 'no edit button'}); }
    }, 600);
  });
}
"""

async def go_to_ads_list(page):
    await page.goto(ADS_LIST_URL, wait_until="domcontentloaded", timeout=45000)
    # wait for rows to render
    await page.wait_for_selector("div._1gd4", timeout=15000)
    await page.wait_for_timeout(3500)

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

        # which need retry
        existing = json.load(open(OUT / "all_ads.json"))
        missing_idx = [a["index"] for a in existing if not any(f["tag"]=="TEXTAREA" and f["value"] for f in a["fields"])]
        print(f"MISSING: {missing_idx}")

        await go_to_ads_list(page)

        for idx in missing_idx:
            print(f"\n--- Retry row {idx} ---")
            click_res = await page.evaluate(JS_HOVER_CLICK, idx)
            print("click:", click_res)
            if click_res.get("error"):
                # may need to scroll
                await page.evaluate(f"() => {{ const rows = document.querySelectorAll('div._1gd4'); if (rows[{idx}]) rows[{idx}].scrollIntoView({{block:'center'}}); }}")
                await page.wait_for_timeout(1000)
                click_res = await page.evaluate(JS_HOVER_CLICK, idx)
                print("retry click:", click_res)
                if click_res.get("error"):
                    continue

            try:
                await page.wait_for_url("**edit/standalone**", timeout=15000)
            except Exception as e:
                print("URL wait failed:", e)
                continue

            # Wait for textarea to actually render in the editor
            try:
                await page.wait_for_selector("textarea", timeout=20000)
                # extra wait for value population
                await page.wait_for_timeout(4000)
            except Exception as e:
                print("textarea wait failed:", e)
                await page.wait_for_timeout(8000)

            url = page.url
            ad_id = parse_qs(urlparse(url).query).get("selected_ad_ids", [None])[0]
            print(f"AD_ID: {ad_id}")

            shot = f"ad_{idx:02d}_{ad_id}.png"
            await page.screenshot(path=str(OUT / shot))

            data = await page.evaluate(JS_EXTRACT)
            textarea_count = len([f for f in data['fields'] if f['tag']=='TEXTAREA' and f['value']])
            print(f"TEXTAREAS: {textarea_count}")

            record = {"index": idx, "ad_id": ad_id, "url": url, "screenshot": shot, **data}
            (OUT / f"ad_{idx:02d}_{ad_id}.json").write_text(json.dumps(record, ensure_ascii=False, indent=2))

            # update existing
            for i, e in enumerate(existing):
                if e["index"] == idx:
                    existing[i] = record
                    break

            # back to list
            await go_to_ads_list(page)

        (OUT / "all_ads.json").write_text(json.dumps(existing, ensure_ascii=False, indent=2))
        print("\n--- AFTER RETRY ---")
        for a in existing:
            tc = len([f for f in a["fields"] if f["tag"]=="TEXTAREA" and f["value"]])
            print(f"[{a['index']:02d}] textareas={tc} {a.get('adName')}")

asyncio.run(main())

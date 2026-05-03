"""
For ads that have no textareas (existing-post ads), extract copy from the
visible preview area in the editor.
"""
import asyncio, json
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

CDP_URL = "http://localhost:50632"
OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis")
ADS_LIST_URL = "https://adsmanager.facebook.com/adsmanager/manage/ads?act=2394298901030120&business_id=1285014529172853&global_scope_id=1285014529172853&date=2026-01-13_2026-04-28%2Cmaximum&insights_date=2026-01-13_2026-04-28%2Cmaximum"

JS_VISIBLE = """
() => {
  // Strategy: capture all visible text blocks larger than threshold,
  // grouped by their position. Plus iframe content and image alts/srcs.
  const out = {
    pageTitle: document.title,
    h1: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(e => e.innerText.trim()).filter(Boolean),
    images: Array.from(document.querySelectorAll('img'))
      .map(i => ({src: i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight}))
      .filter(i => i.w > 100 || i.alt),
    videos: Array.from(document.querySelectorAll('video'))
      .map(v => ({src: v.src || (v.querySelector('source')||{}).src, poster: v.poster})),
    iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({src: f.src})),
    // any link to facebook posts (post id pattern)
    fbPosts: Array.from(document.querySelectorAll('a[href*="facebook.com"]'))
      .map(a => a.href).filter(h => /\\/posts\\/|\\/videos\\/|story_fbid|reel|fbid/.test(h)).slice(0, 10),
    // any text blocks within an aside or main visible
    bigText: Array.from(document.querySelectorAll('div, span, p'))
      .map(e => ({text: (e.innerText||'').trim(), w: e.offsetWidth, h: e.offsetHeight}))
      .filter(t => t.text.length > 30 && t.text.length < 600 && t.w > 100 && t.h > 0)
      .slice(0, 60)
      .map(t => t.text),
  };
  return out;
}
"""

JS_HOVER_CLICK = """
(idx) => {
  const rows = document.querySelectorAll('div._1gd4');
  if (!rows[idx]) return {error: 'row missing'};
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

        existing = json.load(open(OUT / "all_ads.json"))
        missing_idx = [a["index"] for a in existing if not any(f["tag"]=="TEXTAREA" and f["value"] for f in a["fields"])]
        print(f"MISSING: {missing_idx}")

        await go_to_ads_list(page)

        for idx in missing_idx:
            print(f"\n--- Visible-copy extract row {idx} ---")
            click_res = await page.evaluate(JS_HOVER_CLICK, idx)
            if click_res.get("error"):
                await page.evaluate(f"() => {{ const rows = document.querySelectorAll('div._1gd4'); if (rows[{idx}]) rows[{idx}].scrollIntoView({{block:'center'}}); }}")
                await page.wait_for_timeout(800)
                click_res = await page.evaluate(JS_HOVER_CLICK, idx)
                if click_res.get("error"): continue

            try:
                await page.wait_for_url("**edit/standalone**", timeout=15000)
            except: pass
            await page.wait_for_timeout(7000)

            url = page.url
            ad_id = parse_qs(urlparse(url).query).get("selected_ad_ids", [None])[0]
            shot = f"ad_{idx:02d}_{ad_id}_visible.png"
            await page.screenshot(path=str(OUT / shot))

            data = await page.evaluate(JS_VISIBLE)
            print(f"AD_ID: {ad_id}")
            print(f"  H1/H2/H3 ({len(data['h1'])}): {data['h1'][:5]}")
            print(f"  big_text blocks: {len(data['bigText'])}")
            print(f"  videos: {len(data['videos'])}, images: {len(data['images'])}, iframes: {len(data['iframes'])}, fb-posts: {data['fbPosts']}")
            for i, t in enumerate(data['bigText'][:8]):
                print(f"    [{i}] {t[:120]}")

            (OUT / f"ad_{idx:02d}_{ad_id}_visible.json").write_text(json.dumps({"ad_id": ad_id, "url": url, "shot": shot, **data}, ensure_ascii=False, indent=2))

            await go_to_ads_list(page)

asyncio.run(main())

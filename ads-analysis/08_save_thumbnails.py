"""
Save all ad thumbnails locally so we can see them.
"""
import asyncio, json, urllib.request, ssl
from pathlib import Path

OUT = Path("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/thumbnails")
OUT.mkdir(exist_ok=True)

ads = json.load(open("/Users/alexandergoldmann/Desktop/agency-core-os/ads-analysis/07_ads.json"))["rows"]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# safe filename from ad text
import re
def safe(s, max_len=50):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', s)[:max_len]

for i, ad in enumerate(ads):
    if not ad.get("imgSrc"):
        continue
    name = ad["fullText"].split(" Kampagne")[0].split(" Anzeigengruppe")[0].split(" Nicht")[0]
    fname = f"{i:02d}__{safe(name)}.jpg"
    target = OUT / fname
    if target.exists():
        print(f"skip {fname}")
        continue
    try:
        req = urllib.request.Request(ad["imgSrc"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
            target.write_bytes(r.read())
        print(f"saved {fname}")
    except Exception as e:
        print(f"FAIL [{i}] {fname}: {e}")

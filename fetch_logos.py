#!/usr/bin/env python3
"""Keep a small copy of each team's logo in logos/, so the site does not lean on another site to show them.

  python3 fetch_logos.py              fetch any logo that is not here yet
  python3 fetch_logos.py --refresh    fetch every logo again (a school changed its mark)

Each team gets two files: logos/<id>.webp for light backgrounds and logos/dark/<id>.webp for dark ones.
A team with no dark version gets a copy of the light one. Run it after build_data.py, which writes data.json.

This script never stops the update. If a logo cannot be fetched, the site shows that team's logo straight
from the public address instead, and if that fails too, the team's colors.
"""
import io, json, os, shutil, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "logos")
BASE = os.environ.get("LTF_LOGO_BASE", "https://a.espncdn.com/i/teamlogos/ncaa")
SIZE = 160          # pixels on the long side: twice the largest size the site draws them at, for sharp phone screens


def get(url):
    """The file's bytes, None if it does not exist, or an error string."""
    for attempt in (1, 2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (level-the-field logo cache)"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
            err = f"HTTP {e.code}"
        except Exception as e:      # a timeout or a dropped connection
            err = repr(e)[:80]
        time.sleep(1.5)
    return err


def shrink(raw, path):
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    box = im.getchannel("A").getbbox()                  # trim empty space around the mark so it fills its slot
    if box:
        im = im.crop(box)
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
    canvas.save(path, "WEBP", quality=92, method=6)


def main():
    try:
        with open(os.path.join(HERE, "data.json"), encoding="utf-8") as f:
            teams = [(t["n"], t["lg"]) for t in json.load(f)["teams"] if t.get("lg")]
    except Exception as e:
        print("logos: no team list to work from,", repr(e)[:80])
        return
    refresh = "--refresh" in sys.argv
    os.makedirs(os.path.join(OUT, "dark"), exist_ok=True)
    got = had = strikes = 0
    missed = []
    for name, tid in teams:
        if strikes >= 5:                                # the logo source is down, so stop asking and try again next run
            missed.append(f"{name} (skipped, the source is not answering)")
            continue
        light, dark = os.path.join(OUT, f"{tid}.webp"), os.path.join(OUT, "dark", f"{tid}.webp")
        if not refresh and os.path.exists(light) and os.path.exists(dark):
            had += 1
            continue
        try:
            raw = get(f"{BASE}/500/{tid}.png")
            if not isinstance(raw, bytes):
                missed.append(f"{name} ({raw or 'not found'})")
                strikes = strikes + 1 if raw else 0     # "not found" is an answer; an error is not
                continue
            strikes = 0
            shrink(raw, light)
            raw_d = get(f"{BASE}/500-dark/{tid}.png")
            if isinstance(raw_d, bytes):
                shrink(raw_d, dark)
            elif raw_d is None:
                shutil.copy(light, dark)                # no dark version exists, so the light one serves both
            else:
                missed.append(f"{name}, dark version ({raw_d})")      # try again next run
                continue
            got += 1
            time.sleep(0.05)
        except Exception as e:
            missed.append(f"{name} ({repr(e)[:60]})")
    for m in missed[:6]:
        print("  missed:", m)
    print(f"logos: {had} already here, {got} fetched, {len(missed)} missed")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:          # logos are never worth failing an update over
        print("logos: skipped,", repr(e)[:120])

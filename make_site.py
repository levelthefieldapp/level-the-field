#!/usr/bin/env python3
"""Put the site together from the page source in src/ and the numbers in data.json.

  python3 make_site.py                         the publishable site, written to _site/
  python3 make_site.py --url https://my.site   same, with link-preview tags that point at that address
  python3 make_site.py --logos off             same, with team logos switched off for every visitor
  python3 make_site.py --single page.html      one self-contained page and nothing else, for a quick look

The daily update runs build_data.py first (which writes data.json), then this.
Everything in static/ is copied next to the page. Logos fetched by fetch_logos.py are copied to _site/logos/.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
JS = ["core.js", "gloss.js", "predict.js", "views1.js", "views2.js", "views3.js", "views4.js", "views5.js",
      "momentum.js", "scorecard.js", "app.js"]
NAME = "Level the Field"
BLURB = ("Every FBS team ranked on one scale, built from results, play-by-play efficiency and computer ratings. "
         "Rankings, team pages, game lines and a playoff picture.")
SHARE = "Every college football team on one scale. Rankings, game lines and picks that are graded every week."


def rd(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def swap_line(text, starts, new):
    """Replace the one line that begins with `starts`."""
    lines = text.split("\n")
    hits = [i for i, ln in enumerate(lines) if ln.startswith(starts)]
    assert len(hits) == 1, f"expected one line starting with {starts!r}, found {len(hits)}"
    lines[hits[0]] = new
    return "\n".join(lines)


def share_tags(url):
    """What a phone or a chat app reads to draw the preview card when someone shares the link."""
    esc = lambda s: s.replace("&", "&amp;").replace('"', "&quot;")
    u = url.rstrip("/")
    return "\n".join([
        f'<link rel="canonical" href="{u}/">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{NAME}">',
        f'<meta property="og:title" content="{NAME}">',
        f'<meta property="og:description" content="{esc(SHARE)}">',
        f'<meta property="og:url" content="{u}/">',
        f'<meta property="og:image" content="{u}/og.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{NAME}. Every team, one scale.">',
        '<meta name="twitter:card" content="summary_large_image">',
    ])


ICONS = "\n".join([
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="favicon.png" type="image/png" sizes="96x96">',
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
    '<meta name="theme-color" content="#000000">',
    f'<meta name="apple-mobile-web-app-title" content="{NAME}">',
])


def local_logos(logo_dir):
    """Team ids that have both a light and a dark logo file on hand."""
    have = lambda d: {f[:-5] for f in os.listdir(d) if f.endswith(".webp")} if os.path.isdir(d) else set()
    both = have(logo_dir) & have(os.path.join(logo_dir, "dark"))
    return sorted(int(i) for i in both if i.isdigit())


def page(data, url=None, hosted=False, logos=None):
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    head = rd("head.html")
    assert "<!--share-->" in head, "src/head.html has lost its <!--share--> marker"
    head = head.replace("<!--share-->", "\n".join(x for x in [ICONS if hosted else "", share_tags(url) if url else ""] if x))
    js = "\n".join(rd(f) for f in JS)
    site = {"hosted": True, "url": url, "logos": logos} if hosted else None
    js = swap_line(js, "const SITE = ", "const SITE = " + json.dumps(site, separators=(",", ":")) + ";")
    return head + "<style>" + rd("site.css") + "</style>" + rd("body.html") + "<script>\nconst D = " + blob + ";\n" + js + "</script>" + rd("tail.html")


if __name__ == "__main__":
    data_path = arg("--data", os.path.join(HERE, "data.json"))
    if not os.path.exists(data_path):
        sys.exit("No data.json yet. Run build_data.py first.")
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)

    single = arg("--single")
    if single:
        with open(single, "w", encoding="utf-8") as f:
            f.write(page(data))
        print("wrote", single)
        sys.exit(0)

    out = arg("--out", os.path.join(HERE, "_site"))
    url = arg("--url")
    logo_dir = os.path.join(HERE, "logos")
    logos = False if arg("--logos") == "off" else local_logos(logo_dir)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
        f.write(page(data, url=url, hosted=True, logos=logos))
    static = os.path.join(HERE, "static")
    for name in sorted(os.listdir(static)):
        shutil.copy(os.path.join(static, name), os.path.join(out, name))
    if url:      # tell the not-found page where the front page lives, so a mistyped address lands on the site
        from urllib.parse import urlparse
        base = (urlparse(url).path.rstrip("/") or "") + "/"
        nf = os.path.join(out, "404.html")
        with open(nf, encoding="utf-8") as f:
            text = f.read()
        with open(nf, "w", encoding="utf-8") as f:
            f.write(swap_line(text, "  var base = ", "  var base = " + json.dumps(base) + ";"))
    if logos:
        keep = {f"{i}.webp" for i in logos}
        for sub in ("", "dark"):
            os.makedirs(os.path.join(out, "logos", sub), exist_ok=True)
            for name in keep:
                shutil.copy(os.path.join(logo_dir, sub, name), os.path.join(out, "logos", sub, name))
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(out) for f in fs)
    print(f"wrote {out}: {len(os.listdir(out))} items, {size / 1e6:.1f} MB, "
          f"logos {'off' if logos is False else str(len(logos)) + ' teams'}, link previews {'for ' + url if url else 'not set'}")

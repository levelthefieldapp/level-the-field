#!/usr/bin/env python3
"""Put the site together from the page source in src/ and the numbers in data.json.

  python3 make_site.py                         the publishable site, written to _site/
  python3 make_site.py --url https://my.site   same, with link previews, a sitemap and full addresses for that site
  python3 make_site.py --logos off             same, with team logos switched off for every visitor
  python3 make_site.py --counter NAME          same, with the cookie-free visitor counter for that GoatCounter name
  python3 make_site.py --no-cards              same, without drawing the link-preview pictures (faster, for tests)
  python3 make_site.py --single page.html      one self-contained page and nothing else, for a quick look

The daily update runs build_data.py first (which writes data.json), then this.

What the published folder holds
  index.html                 the front page
  app.js, app.css, data.js   the site's code, its look and its numbers, shared by every page
  team/<name>/index.html     one small page per team, game, conference and section, so each has a real address
  cards/                     the picture each address shows when someone shares the link
  logos/, fonts/             team logos fetched by fetch_logos.py, and the site's typeface
  sitemap.xml                the list of addresses, for search engines
Everything in static/ is copied in as it is.
"""
import datetime, hashlib, html, json, math, os, re, shutil, sys, unicodedata
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
JS = ["core.js", "gloss.js", "predict.js", "views1.js", "views2.js", "views3.js", "views4.js", "views5.js", "views6.js", "views7.js",
      "momentum.js", "scorecard.js", "cards.js", "app.js"]
NAME = "Level the Field"
SHARE = ("Every college football team on one scale, built from this season's games and nothing else. "
         "No polls, no preseason rankings, no betting lines. Rankings, picks and an upset watch, graded every week.")
PARTS = {"res": "résumé", "off": "offense", "def": "defense", "mar": "scoring margin", "h1": "the first half"}      # the five parts of the LTF Index, as they read in a sentence

# Every section page that gets its own address: the name on the browser tab and one line about it.
PAGES = {
    "rankings": ("LTF rankings", "Every FBS team ranked on one scale, 0 to 100, with movement since last week."),
    "weights": ("Build your own rankings", "Set your own weights for résumé, offense, defense and scoring margin and watch the rankings change."),
    "conferences": ("Conferences", "Every conference on the same scale: average LTF Index and the record against everyone else."),
    "leagues": ("League strength", "How the leagues have done against each other this season, and a standing check on whether the rankings play favorites."),
    "momentum": ("Momentum", "Who is heating up and who is cooling off, by rating trend, recent play, streaks and upsets."),
    "radar": ("Under the radar", "Teams the LTF Index rates well that the polls have not caught up with."),
    "luck": ("Luck and steadiness", "Which teams have been helped or hurt by fumbles, tipped passes and kicking, and which play to the same level every week."),
    "games": ("Scores and schedule", "Every game by week, with the LTF line and the final score."),
    "picks": ("Picks", "The LTF pick for every game this week, with a confidence score and the reasons behind it."),
    "upsets": ("Upset watch", "Where an upset is most likely this week: the underdogs with a real chance and the top 25 teams with the least room for error."),
    "buysell": ("Buying and selling", "Teams on a winning streak with a hard road ahead, and teams on a losing streak with a soft one, by the LTF line. On file every week and graded."),
    "recap": ("Weekly recap", "How the LTF picks did last week: winners, the biggest upsets and the biggest misses."),
    "teams": ("All teams", "All FBS teams by conference. Every team has a page with their score, stats, results and remaining schedule."),
    "stats": ("Stats", "Every team on one chart, and every stat in one table, adjusted for opponent."),
    "compare": ("Compare two teams", "Any two teams side by side, with the LTF line between them."),
    "blind": ("Blind résumé", "Two real teams with the names taken off. Pick the better one, then see who they are."),
    "playoff": ("Playoff picture", "The 12-team bracket if the season ended today and the committee went by the LTF Index."),
    "odds": ("Season odds", "Each team's chance to make the playoff, win their conference and reach a bowl, from 2,500 simulated seasons."),
    "scorecard": ("Scorecard", "LTF graded every week next to SP+, FPI and the betting line, on the same games."),
    "track": ("LTF track record", "Every finished game where LTF had a line before kickoff, graded on the winner and the margin."),
    "vsline": ("Against the line", "Where LTF and the betting line disagreed on finished games, and who turned out right. A benchmark, graded every week."),
    "inputs": ("What goes in, and what stays out", "Everything the LTF Index is built from, and everything it leaves out on purpose: polls, preseason rankings, earlier seasons and betting lines."),
    "how": ("How it works", "What goes into the LTF Index, how picks are made, and what testing has shown."),
    "about": ("About", "What Level the Field is and who it is for."),
    "contact": ("Contact", "How to reach Level the Field."),
}
DETAIL = {"team", "game", "conference"}                      # pages that take a name or a number after them
RETIRED = {"spread": "picks", "model": "scorecard", "reputation": "radar"}      # the same list as MOVED in src/app.js


def rd(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def swap_line(text, starts, new):
    """Replace the one line that begins with `starts`."""
    lines = text.split("\n")
    hits = [i for i, ln in enumerate(lines) if ln.startswith(starts)]
    assert len(hits) == 1, f"expected one line starting with {starts!r}, found {len(hits)}"
    lines[hits[0]] = new
    return "\n".join(lines)


esc = lambda s: html.escape(str(s), quote=True)


def slug(s):
    """The same short name the page makes for a team or a conference: 'San José State' becomes 'san-jose-state'."""
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not 0x300 <= ord(c) <= 0x36F)
    s = s.replace("'", "").replace("’", "").lower().replace("&", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def standings(data):
    """Rank and LTF Index for every team, worked out the way the page does it."""
    teams = data["teams"]
    WEIGHTS = data["meta"]["wt"]      # the LTF Index, the same weights the page uses
    raw = [sum(WEIGHTS[k] * t["z"][k] for k in WEIGHTS) / sum(WEIGHTS.values()) for t in teams]
    mean = sum(raw) / len(raw)
    sd = math.sqrt(sum((v - mean) ** 2 for v in raw) / len(raw)) or 1.0
    rows = [{"t": t, "idx": max(0.0, min(100.0, 50 + 14 * (v - mean) / sd)), "z": (v - mean) / sd} for t, v in zip(teams, raw)]
    for i, r in enumerate(sorted(rows, key=lambda r: -r["z"])):
        r["rank"] = i + 1
    part = {k: {t["n"]: i + 1 for i, t in enumerate(sorted(teams, key=lambda t: -t["z"][k]))} for k in WEIGHTS}
    for r in rows:
        r["parts"] = {k: part[k][r["t"]["n"]] for k in WEIGHTS}
    return {r["t"]["n"]: r for r in rows}


def when(iso):
    d = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    try:
        from zoneinfo import ZoneInfo
        d = d.astimezone(ZoneInfo("America/New_York"))
    except Exception:
        d = d - datetime.timedelta(hours=4)
    return f"{d.strftime('%A, %B')} {d.day}"


# ---------------------------------------------------------------- the one-file preview
def single_page(data):
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    head = rd("head.html").replace("<!--share-->\n", "")
    js = "\n".join(rd(f) for f in JS)
    return head + "<style>" + rd("site.css") + "</style>" + rd("body.html") + "<script>\nconst D = " + blob + ";\n" + js + "</script>" + rd("tail.html")


# ---------------------------------------------------------------- the published site
FONT_CSS = """@font-face{font-family:Archivo;font-style:normal;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(fonts/archivo-latin-wdth-normal.woff2) format("woff2")}
@font-face{font-family:Archivo;font-style:italic;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(fonts/archivo-latin-wdth-italic.woff2) format("woff2")}
"""


def head_tags(prefix, title, desc, v, url=None, path="", image="og.png", counter=None):
    """The top of a page: what the browser tab says, and what a phone or a chat app reads to draw the link preview."""
    full = title if title == NAME else f"{title} | {NAME}"
    out = ['<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
           f'<title>{esc(full)}</title>', f'<meta name="description" content="{esc(desc)}">',
           f'<link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml">',
           f'<link rel="icon" href="{prefix}favicon.png" type="image/png" sizes="96x96">',
           f'<link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png">',
           '<meta name="theme-color" content="#000000">', f'<meta name="apple-mobile-web-app-title" content="{NAME}">',
           '<meta property="og:type" content="website">', f'<meta property="og:site_name" content="{NAME}">',
           f'<meta property="og:title" content="{esc(title)}">', f'<meta property="og:description" content="{esc(desc)}">',
           '<meta name="twitter:card" content="summary_large_image">']
    if url:
        u = url.rstrip("/")
        out += [f'<link rel="canonical" href="{u}/{path}">', f'<meta property="og:url" content="{u}/{path}">',
                f'<meta property="og:image" content="{u}/{image}">', '<meta property="og:image:width" content="1200">',
                '<meta property="og:image:height" content="630">', f'<meta property="og:image:alt" content="{esc(title)}. {NAME}.">']
    out += [f'<link rel="preload" href="{prefix}fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>',
            f'<link rel="preload" href="{prefix}fonts/archivo-latin-wdth-italic.woff2" as="font" type="font/woff2" crossorigin>',
            f'<link rel="stylesheet" href="{prefix}app.css?v={v}">']
    if counter:
        out.append('<script>window.goatcounter = {no_onload: true};</script>')      # the page counts its own views, one per page opened
        out.append(f'<script data-goatcounter="https://{esc(counter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>')
    return "\n".join(out) + "\n"


def shell(prefix, head, static, v):
    """One page of the site. `static` is what shows for a moment before the page draws itself, and what a search engine reads."""
    body = rd("body.html")
    assert body.count('<section id="view"></section>') == 1, "src/body.html has lost its empty view section"
    body = body.replace('<section id="view"></section>', f'<section id="view">{static}</section>')
    return head + body + f'<script src="{prefix}data.js?v={v}"></script>\n<script src="{prefix}app.js?v={v}"></script>' + rd("tail.html")


def static_view(prefix, heading, paras, links):
    go = " ".join(f'<a class="txt" href="{prefix}{href}">{esc(label)}</a>' for label, href in links)
    return f'<div class="pre"><h1 class="ptitle">{esc(heading)}</h1>' + "".join(f'<p class="pdek">{esc(p)}</p>' for p in paras) + (f'<p class="next">{go}</p>' if go else "") + "</div>"


def team_text(r, data, by_name, lm):
    t, m = r["t"], data["meta"]
    conf = "" if t["c"] == "Independent" else f", {t['cw']}-{t['cl']} in the {t['c']}"
    p = r["parts"]
    line = (f"{t['n']} is No. {r['rank']} of {len(data['teams'])} FBS teams in the LTF Index after week {m['through']}, with a score of {r['idx']:.1f}. "
            f"They are {t['w']}-{t['l']}{conf}.")
    why = ", ".join(f"{ordinal(p[k])} in {PARTS[k]}" for k in list(PARTS)[:-1]) + f" and {ordinal(p['h1'])} in {PARTS['h1']}."
    nxt = next((g for g in data["games"] if g["hp"] is None and t["n"] in (g["h"], g["a"])), None)
    nx = ""
    if nxt:
        opp = nxt["a"] if nxt["h"] == t["n"] else nxt["h"]
        site = "against" if nxt["n"] else ("at home against" if nxt["h"] == t["n"] else "at")
        rk = f"No. {by_name[opp]['rank']} " if opp in by_name else ""
        nx = f"Next: {site} {rk}{opp} on {when(nxt['d'])}."
        if nxt["id"] in lm:
            mg = lm[nxt["id"]] * (1 if nxt["h"] == t["n"] else -1)
            pts = round(abs(mg) * 2) / 2
            nx += " The LTF line is a pick 'em." if pts == 0 else f" The LTF line is {t['n'] if mg > 0 else opp} by {pts:g}."
    short = f"No. {r['rank']} in the LTF Index at {r['idx']:.1f}. {t['w']}-{t['l']}. {why}"
    return [line, why[0].upper() + why[1:], nx] if nx else [line, why[0].upper() + why[1:]], short


def game_text(g, by_name, lm):
    rk = lambda n: f"No. {by_name[n]['rank']} " if n in by_name else ""
    title = f"{g['a']} {'vs' if g['n'] else 'at'} {g['h']}"
    if g["hp"] is not None:
        win, lose = (g["h"], g["a"]) if g["hp"] > g["ap"] else (g["a"], g["h"])
        ws, ls = max(g["hp"], g["ap"]), min(g["hp"], g["ap"])
        paras = [f"Final, week {g['w']}: {win} {ws}, {lose} {ls}.", "The LTF line as it stood before kickoff, whether it had the winner, and how the two teams compare now."]
        return title, paras, f"Final: {win} {ws}, {lose} {ls}. How the LTF line did, and how the two teams compare."
    line = ""
    if g["id"] in lm:
        pts = round(abs(lm[g["id"]]) * 2) / 2
        line = " LTF line: pick 'em." if pts == 0 else f" LTF line: {g['h'] if lm[g['id']] > 0 else g['a']} by {pts:g}."
    lead = f"{rk(g['a'])}{g['a']} {'vs' if g['n'] else 'at'} {rk(g['h'])}{g['h']}, week {g['w']}, {when(g['d'])}.{line}"
    return title, [lead, "The LTF pick, a confidence score and the matchup, stat by stat."], lead


def find_browser():
    for c in [os.environ.get("CHROME"), "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]:
        if c and (shutil.which(c) or os.path.exists(c)):
            return shutil.which(c) or c
    return None


def draw_cards(out, wanted):
    """Ask a browser to draw the link-preview pictures with the site's own card code. Returns the names that were written.
    This is never worth failing an update over: with no browser, or on any error, pages fall back to the general preview."""
    import base64, functools, http.server, subprocess, tempfile, threading
    from concurrent.futures import ThreadPoolExecutor
    browser = find_browser()
    if not browser or not wanted:
        return set()

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    # the browser reads the site from this machine over http, the way a visitor would, so logos and fonts load normally
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=os.path.abspath(out)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    page = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    batches = [wanted[i:i + 24] for i in range(0, len(wanted), 24)]

    def run(batch):
        with tempfile.TemporaryDirectory() as prof:
            cmd = [browser, "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", f"--user-data-dir={prof}",
                   "--virtual-time-budget=25000", "--dump-dom", page + "#!cards=" + ",".join(batch)]
            try:
                dom = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
            except Exception:
                return {}
        m = re.search(r'<script type="application/json" id="cards-out">(.*?)</script>', dom, re.S)
        try:
            return json.loads(html.unescape(m.group(1))) if m else {}
        except Exception:
            return {}

    done = set()
    with ThreadPoolExecutor(4) as pool:
        for got in pool.map(run, batches):
            for name, uri in got.items():
                if isinstance(uri, str) and uri.startswith("data:image/png;base64,") and re.fullmatch(r"[a-z0-9/-]+", name):
                    path = os.path.join(out, "cards", name + ".png")
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    raw = base64.b64decode(uri.split(",", 1)[1])
                    try:      # flat colors and type: 256 colors look the same and are a third of the size
                        import io
                        from PIL import Image
                        buf = io.BytesIO()
                        Image.open(io.BytesIO(raw)).convert("RGB").quantize(256, dither=Image.Dither.NONE).save(buf, "PNG", optimize=True)
                        raw = buf.getvalue() if 0 < buf.tell() < len(raw) else raw
                    except Exception:
                        pass
                    with open(path, "wb") as f:
                        f.write(raw)
                    done.add(name)
    srv.shutdown()
    return done


def local_logos(logo_dir):
    """Team ids that have both a light and a dark logo file on hand."""
    have = lambda d: {f[:-5] for f in os.listdir(d) if f.endswith(".webp")} if os.path.isdir(d) else set()
    both = have(logo_dir) & have(os.path.join(logo_dir, "dark"))
    return sorted(int(i) for i in both if i.isdigit())


def build_site(data, out, url=None, logos=None, counter=None, cards=True):
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    static = os.path.join(HERE, "static")
    shutil.copytree(static, out, dirs_exist_ok=True)
    logo_dir = os.path.join(HERE, "logos")
    if logos:
        keep = {f"{i}.webp" for i in logos}
        for sub in ("", "dark"):
            os.makedirs(os.path.join(out, "logos", sub), exist_ok=True)
            for name in keep:
                shutil.copy(os.path.join(logo_dir, sub, name), os.path.join(out, "logos", sub, name))

    # the shared files
    site = {"hosted": True, "paths": True, "url": url, "logos": logos, "counter": counter or None}
    js = swap_line("\n".join(rd(f) for f in JS), "const SITE = ", "const SITE = " + json.dumps(site, separators=(",", ":")) + ";")
    blob = "const D = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n"
    css = FONT_CSS + rd("site.css")
    v = hashlib.sha1((js + blob + css).encode("utf-8")).hexdigest()[:10]
    write(os.path.join(out, "app.js"), js)
    write(os.path.join(out, "data.js"), blob)
    write(os.path.join(out, "app.css"), css)

    st = standings(data)
    m = data["meta"]
    lm = {q["id"]: q["lm"] for q in data.get("picks", []) if "lm" in q}
    top = sorted(st.values(), key=lambda r: r["rank"])
    lead = f"After week {m['through']}: " + ", ".join(f"{r['rank']}. {r['t']['n']}" for r in top[:5]) + "."
    nav = [("LTF rankings", "rankings/"), ("This week's picks", "picks/"), ("Upset watch", "upsets/"), ("Scores and schedule", "games/"), ("All teams", "teams/")]

    # the front page first, so a browser can draw the preview pictures from it
    home = shell("", head_tags("", NAME, SHARE, v, url, "", "og.png", counter), static_view("", NAME, [SHARE, lead], nav), v)
    write(os.path.join(out, "index.html"), home)

    # which pictures to draw: every team, this week's games and last week's, and the lists
    week = [g for g in data["games"] if g["h"] in st and g["a"] in st and g["w"] in (m.get("next"), m["through"])]
    confs = sorted({t["c"] for t in data["teams"] if t["c"] != "Independent"})
    wanted = ["list/top10"] + [f"team/{slug(n)}" for n in st] + [f"game/{g['id']}" for g in week] + [f"conference/{slug(c)}" for c in confs] + \
             ["list/tiers", "list/polls", "list/conferences", "list/receipts", "list/buysell"]
    have = draw_cards(out, wanted) if cards else set()
    pic = lambda name, fallback="og.png": f"cards/{name}.png" if name in have else fallback
    if "list/top10" in have:      # the front page and the rankings share the top 10 as their preview
        write(os.path.join(out, "index.html"), shell("", head_tags("", NAME, SHARE, v, url, "", pic("list/top10"), counter), static_view("", NAME, [SHARE, lead], nav), v))

    pages = [""]
    special = {"rankings": "list/top10", "conferences": "list/conferences", "leagues": "list/conferences", "radar": "list/polls", "recap": "list/receipts", "scorecard": "list/receipts", "buysell": "list/buysell"}
    for key, (title, desc) in PAGES.items():
        paras = [desc, lead] if key in ("rankings", "teams", "picks", "games", "weights") else [desc]
        page = shell("../", head_tags("../", title, desc, v, url, f"{key}/", pic(special.get(key, "-")), counter), static_view("../", title, paras, nav), v)
        write(os.path.join(out, key, "index.html"), page)
        pages.append(f"{key}/")
    for name, r in st.items():
        s = slug(name)
        paras, short = team_text(r, data, st, lm)
        title = f"{name}: No. {r['rank']} in the LTF Index"
        links = [("LTF rankings", "rankings/"), (f"{r['t']['c']} teams" if r["t"]["c"] != "Independent" else "All teams", f"conference/{slug(r['t']['c'])}/" if r["t"]["c"] != "Independent" else "teams/")]
        page = shell("../../", head_tags("../../", title, short, v, url, f"team/{s}/", pic(f"team/{s}"), counter), static_view("../../", name, paras, links), v)
        write(os.path.join(out, "team", s, "index.html"), page)
        pages.append(f"team/{s}/")
    for c in sorted({t["c"] for t in data["teams"]}):
        s = slug(c)
        label = "Independents" if c == "Independent" else c
        rows = sorted((r for r in st.values() if r["t"]["c"] == c), key=lambda r: r["rank"])
        desc = f"{label}: every team ranked by the LTF Index after week {m['through']}. " + ", ".join(f"{r['t']['n']} (No. {r['rank']})" for r in rows[:3]) + " lead."
        page = shell("../../", head_tags("../../", f"{label} rankings", desc, v, url, f"conference/{s}/", pic(f"conference/{s}"), counter), static_view("../../", label, [desc], nav), v)
        write(os.path.join(out, "conference", s, "index.html"), page)
        pages.append(f"conference/{s}/")
    for g in data["games"]:
        title, paras, short = game_text(g, st, lm)
        links = [("Scores and schedule", "games/")] + [(n, f"team/{slug(n)}/") for n in (g["a"], g["h"]) if n in st]
        page = shell("../../", head_tags("../../", title, short, v, url, f"game/{g['id']}/", pic(f"game/{g['id']}"), counter), static_view("../../", title, paras, links), v)
        write(os.path.join(out, "game", str(g["id"]), "index.html"), page)
        pages.append(f"game/{g['id']}/")

    # pages retired on October 7, 2026. An old link still opens, and the site sends it on to the page that replaced it.
    for gone, now in RETIRED.items():
        title, desc = PAGES[now]
        write(os.path.join(out, gone, "index.html"), shell("../", head_tags("../", title, desc, v, url, f"{now}/", pic(special.get(now, "-")), counter), static_view("../", title, [desc], nav), v))

    # a mistyped address: hand it to the front page, which shows the right page or says it is missing
    nf = os.path.join(out, "404.html")
    if url and os.path.exists(nf):
        base = (urlparse(url).path.rstrip("/") or "") + "/"
        with open(nf, encoding="utf-8") as f:
            text = f.read()
        write(nf, swap_line(text, "  var base = ", "  var base = " + json.dumps(base) + ";"))
    if url:
        u = url.rstrip("/")
        day = m.get("built") or datetime.date.today().isoformat()
        rows = "".join(f"<url><loc>{esc(u)}/{p}</loc><lastmod>{day}</lastmod></url>\n" for p in pages)
        write(os.path.join(out, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "</urlset>\n")
        write(os.path.join(out, "robots.txt"), f"User-agent: *\nAllow: /\nSitemap: {u}/sitemap.xml\n")
    return {"pages": len(pages), "cards": len(have), "v": v}


def view_names():
    """The pages the site itself knows how to draw, read out of its own code, so this list and that one cannot drift apart."""
    m = re.search(r"const VIEWS = \{(.*?)\};", rd("app.js"), re.S)
    return set(re.findall(r"(\w+)\s*:", m.group(1))) if m else set()


if __name__ == "__main__":
    data_path = arg("--data", os.path.join(HERE, "data.json"))
    if not os.path.exists(data_path):
        sys.exit("No data.json yet. Run build_data.py first.")
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)

    single = arg("--single")
    if single:
        write(os.path.abspath(single), single_page(data))
        print("wrote", single)
        sys.exit(0)

    missing = view_names() - set(PAGES) - DETAIL - {"home"}
    if missing:
        sys.exit(f"make_site.py has no entry in PAGES for: {', '.join(sorted(missing))}")
    out = arg("--out", os.path.join(HERE, "_site"))
    url = arg("--url")
    counter = arg("--counter")
    if counter and not re.fullmatch(r"[a-z0-9-]{1,60}", counter):
        print("note: the visitor counter name has to be lowercase letters, digits and dashes, so the counter was left off")
        counter = None
    logos = False if arg("--logos") == "off" else local_logos(os.path.join(HERE, "logos"))
    info = build_site(data, out, url=url or None, logos=logos, counter=counter, cards="--no-cards" not in sys.argv)
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(out) for f in fs)
    print(f"wrote {out}: {info['pages']} pages, {info['cards']} preview pictures, {size / 1e6:.1f} MB, "
          f"logos {'off' if logos is False else str(len(logos)) + ' teams'}, link previews {'for ' + url if url else 'not set'}, "
          f"visitor counter {'on' if counter else 'off'}")

#!/usr/bin/env python3
"""The last look before anything is published. If this script fails, nothing goes live and the site keeps
showing the last good version.

  python3 check_site.py                              check _site/ on its own
  python3 check_site.py --before ledger.before.json  also compare with the ledger as it stood before this run
  python3 check_site.py --live live.html             and with a copy of the site as it is published right now

It checks four things:
  1. The page is whole: the data inside it reads cleanly and has every team and game it should.
  2. Nothing went backward: the season, the week and the count of final scores have not dropped.
  3. Nothing on file was touched: every pick and scorecard number locked earlier is exactly as it was,
     and nothing new was locked for a game that had already kicked off.
  4. The page draws: a real browser opens the main pages and each one shows content with no error.
     (Skipped with a note if the machine has no browser. GitHub's runners have one.)
"""
import json, math, os, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
problems, notes = [], []
bad = problems.append


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def one_line(text, starts, where):
    hits = [ln for ln in text.split("\n") if ln.startswith(starts)]
    if len(hits) != 1:
        bad(f"expected one line starting with {starts!r} in {where}, found {len(hits)}")
        return None
    try:
        return json.loads(hits[0][len(starts):].rstrip().rstrip(";").replace("<\\/", "</"))
    except Exception as e:
        bad(f"the line starting with {starts!r} in {where} does not read as data: {repr(e)[:100]}")
        return None


def check_page(site):
    """The site's files are all there and whole. Returns the numbers and the settings built into them."""
    read = lambda name: open(os.path.join(site, name), encoding="utf-8").read() if os.path.exists(os.path.join(site, name)) else None
    index, app, data, css = read("index.html"), read("app.js"), read("data.js"), read("app.css")
    for name, text, least in (("index.html", index, 2_000), ("app.js", app, 150_000), ("data.js", data, 200_000), ("app.css", css, 20_000)):
        if text is None:
            bad(f"{name} is missing from the site folder")
        elif len(text) < least:
            bad(f"{name} is only {len(text):,} characters, far smaller than it should be")
    if index is not None:
        for must in ("<title>Level the Field</title>", 'id="view"', "app.js?v=", "data.js?v=", "</html>"):
            if must not in index:
                bad(f"index.html is missing {must!r}")
    if app is not None and "function render()" not in app:
        bad("app.js is cut off or is not the site's code")
    for name in ("404.html", "og.png", "favicon.png", "apple-touch-icon.png", "fonts/archivo-latin-wdth-normal.woff2", "fonts/archivo-latin-wdth-italic.woff2",
                 "rankings/index.html", "picks/index.html", "scorecard/index.html", "upsets/index.html", "buysell/index.html", "leagues/index.html", "inputs/index.html"):
        if not os.path.exists(os.path.join(site, name)):
            bad(f"{name} is missing from the site folder")
    d = one_line(data, "const D = ", "data.js") if data else None
    cfg = one_line(app, "const SITE = ", "app.js") if app else None
    if d:
        for kind, want in (("team", len(d.get("teams", []))), ("game", len(d.get("games", [])))):
            folder = os.path.join(site, kind)
            have = len(os.listdir(folder)) if os.path.isdir(folder) else 0
            if have != want:
                bad(f"{have} {kind} pages were written, expected {want}")
    return d, cfg


def check_data(d):
    m, teams, games = d.get("meta", {}), d.get("teams", []), d.get("games", [])
    if not 120 <= len(teams) <= 150:
        bad(f"{len(teams)} teams, expected about 136")
    if len(games) < 600:
        bad(f"only {len(games)} games on the schedule")
    if not isinstance(m.get("through"), int) or m["through"] < 1:
        bad(f"the week number is {m.get('through')!r}")
    for t in teams:
        z = t.get("z", {})
        if any(not isinstance(z.get(k), (int, float)) or not math.isfinite(z[k]) for k in m.get("wt", {"res": 0})):
            bad(f"{t.get('n')} has a missing or broken score part")
            break
    if len({t.get("n") for t in teams}) != len(teams):
        bad("a team appears twice")
    last = [t for t in teams if not any(h.get("w") == m.get("through") for h in t.get("h", []))]
    if last:
        bad(f"{len(last)} teams have no entry for week {m.get('through')}, for example {last[0].get('n')}")
    if set(m.get("wt", {})) != {"res", "off", "def", "mar", "h1"}:
        bad(f"the index's parts are {sorted(m.get('wt', {}))}, not the five it is built from")
    if not m.get("api"):
        notes.append("no AP poll, SP+, FPI or closing lines in this build, so the comparisons on the scorecard will be empty")
    ids = [q.get("id") for q in d.get("picks", [])]
    if len(ids) != len(set(ids)):
        bad("a game is on file twice")
    known = {g["id"] for g in games}
    if any(i not in known for i in ids):
        bad("a pick is on file for a game that is not on the schedule")


def from_page(path):
    """What a published copy of the site has on file, in the same shape as the ledger."""
    text = open(path, encoding="utf-8").read()
    hits = [ln for ln in text.split("\n") if ln.startswith("const D = ")]
    if len(hits) != 1:
        return None
    d = json.loads(hits[0][len("const D = "):].rstrip().rstrip(";").replace("<\\/", "</"))
    return {"season": d["meta"].get("season"), "through": d["meta"].get("through", 0), "picks": d.get("picks", []),
            "calls": [c for c in d.get("calls", []) if not c.get("rb")],
            "finals": sum(1 for g in d.get("games", []) if g.get("hp") is not None)}


def on_file(season, ledger, live):
    """Everything already on file anywhere: the ledger as it stood, plus the live site. Where they differ, the ledger rules."""
    srcs = [s for s in (live, ledger) if s and s.get("season") == season]      # the ledger is applied last, so it wins
    if not srcs:
        return None
    out = {"season": season, "through": max(s.get("through", 0) for s in srcs), "finals": max(s.get("finals", 0) for s in srcs), "picks": []}
    picks = {}
    for s in srcs:
        for q in s.get("picks", []):
            picks[q["id"]] = merge_pick(picks[q["id"]], q) if q["id"] in picks else dict(q)
    out["picks"] = list(picks.values())
    calls = {}
    for s in srcs:
        for c in s.get("calls", []):
            if not c.get("rb"):
                calls[(c["w"], c["t"])] = c
    out["calls"] = list(calls.values())
    return out


# Betting lines and the retired model's numbers sat beside a number on file before October 7, 2026. They are no longer
# kept, so their going missing is not a change.
RETIRED_KEYS = ("mm", "mt", "ho", "hs", "oo", "ou", "tb", "v")


def merge_pick(a, b):
    """One game's entry from two copies, b applied over a. Made under different versions of the formula, the newer is kept whole."""
    fa, fb = a.get("f", 1), b.get("f", 1)
    if fa != fb:
        hi, lo = (a, b) if fa > fb else (b, a)
        return {**{k: v for k, v in lo.items() if k in ("sp", "fp", "sa")}, **hi}
    return {**a, **b}


def check_ledger(d, before):
    m = d["meta"]
    if m["through"] < before.get("through", 0):
        bad(f"the week went backward, from {before['through']} to {m['through']}")
    finals = sum(1 for g in d["games"] if g.get("hp") is not None)
    if finals < before.get("finals", 0) - 2:
        bad(f"final scores dropped from {before['finals']} to {finals}")
    new = {q["id"]: q for q in d["picks"]}
    game = {g["id"]: g for g in d["games"]}
    built = datetime.strptime(m["builtAt"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    kicked = lambda gid: datetime.fromisoformat(game[gid]["d"].replace("Z", "+00:00")) <= built
    formula = m.get("formula", 1)
    for q in before.get("picks", []):
        n = new.get(q["id"])
        if n is None:
            bad(f"a pick that was on file is gone (game {q['id']}, week {q['w']})")
            continue
        q = {k: v for k, v in q.items() if k not in RETIRED_KEYS}
        started = game[q["id"]].get("hp") is not None or kicked(q["id"]) if q["id"] in game else True
        if q.get("f", 1) != n.get("f", 1):
            # The one change allowed to a number on file: made under an earlier version of the formula, it is refiled under
            # today's while the game is still unplayed, and the earlier number is kept in the entry.
            if started:
                bad(f"a number on file was refiled after kickoff (game {q['id']})")
            elif n.get("f", 1) != formula or q.get("f", 1) > formula:
                bad(f"a number on file changed formula in a way that is not a refile (game {q['id']})")
            elif q.get("lm") is not None and (not n.get("was") or {k: n["was"][-1].get(k) for k in ("f", "lm", "at")} != {"f": q.get("f", 1), "lm": q["lm"], "at": q.get("at")}):
                bad(f"a refiled number did not keep the earlier one (game {q['id']})")
            else:
                moved = [k for k, v in q.items() if k not in ("lm", "at", "f", "was", "rf") and n.get(k) != v]
                if moved:
                    bad(f"a number on file changed (game {q['id']}: {', '.join(moved)})")
            continue
        changed = [k for k, v in q.items() if n.get(k) != v]
        if changed:
            bad(f"a number on file changed (game {q['id']}: {', '.join(changed)})")
        added = [k for k in n if k not in q]
        if added and started:
            bad(f"a number was added after kickoff (game {q['id']}: {', '.join(added)})")
    old_ids = {q["id"] for q in before.get("picks", [])}
    for gid, n in new.items():
        if gid not in old_ids and gid in game and (game[gid].get("hp") is not None or kicked(gid)):
            bad(f"a pick went on file after kickoff (game {gid})")
    # Buying and selling: a call on file never changes, and none goes on file once the team's next game has kicked off.
    # Calls marked "rb" were rebuilt and are not on file, so they are free to change.
    calls = {(c["w"], c["t"]): c for c in d.get("calls", []) if not c.get("rb")}
    was = {(c["w"], c["t"]): c for c in before.get("calls", [])}
    for key, c in was.items():
        if key not in calls:
            bad(f"a buy or sell call that was on file is gone ({c['t']}, after week {c['w']})")
        elif calls[key] != c:
            bad(f"a buy or sell call on file changed ({c['t']}, after week {c['w']})")
    for key, c in calls.items():
        first = c["g"][0][0] if c.get("g") else None
        if first not in game:
            bad(f"a buy or sell call names a game that is not on the schedule ({c['t']}, after week {c['w']})")
        elif key not in was and (game[first].get("hp") is not None or kicked(first)):
            bad(f"a buy or sell call went on file after kickoff ({c['t']}, after week {c['w']})")


def find_browser():
    for c in [os.environ.get("CHROME"), "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]:
        if c and (shutil.which(c) or os.path.exists(c)):
            return shutil.which(c) or c
    return None


def dump(browser, url):
    with tempfile.TemporaryDirectory() as prof:
        cmd = [browser, "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", f"--user-data-dir={prof}",
               "--virtual-time-budget=6000", "--dump-dom", url]
        try:
            return subprocess.run(cmd, capture_output=True, text=True, timeout=90).stdout
        except Exception:
            return ""


def check_render(site, d):
    browser = find_browser()
    if not browser:
        notes.append("no browser on this machine, so the pages were not opened")
        return
    if "level-ok" not in dump(browser, "data:text/html,<p>level-ok</p>"):
        notes.append("the browser would not start, so the pages were not opened")
        return
    m, teams, games = d["meta"], d["teams"], d["games"]
    plain = [t["n"] for t in teams if re.fullmatch(r"[A-Za-z ]+", t["n"])]      # names whose page address is easy to predict
    slug = lambda s: s.lower().replace(" ", "-")
    routes = ["", "rankings", "weights", "games", "picks", "upsets", "buysell", "scorecard", "track", "vsline", "inputs", "playoff", "odds", "momentum", "recap",
              "stats", "conferences", "leagues", "radar", "luck", "how"] + ["team/" + slug(n) for n in plain[:1] + plain[-1:]]
    done = [g for g in games if g.get("hp") is not None]
    todo = [g for g in games if g.get("hp") is None and g["w"] == m.get("next")]
    routes += [f"game/{g['id']}" for g in (done[-1:] + todo[:1])]
    root = "file://" + os.path.abspath(site)
    urls = [(("/" + r if r else "the front page"), f"{root}/index.html#/{r}") for r in routes]
    # a few pages opened at their own address, the way a shared link arrives
    own = ["rankings", "team/" + slug(plain[0])] + [f"game/{g['id']}" for g in todo[:1]]
    urls += [(f"/{r}/ at its own address", f"{root}/{r}/index.html") for r in own]
    with ThreadPoolExecutor(4) as pool:
        doms = list(pool.map(lambda u: dump(browser, u[1]), urls))
    for (name, _), dom in zip(urls, doms):
        err = re.search(r'<html[^>]*\sdata-err="([^"]*)"', dom)
        drawn = re.search(r'<html[^>]*\sdata-drawn="([^"]*)"', dom)
        view = re.search(r'<section id="view">(.*?)</section>\s*</main>', dom, re.S)
        if err:
            bad(f"{name} hit an error in the browser: {err.group(1)}")
        elif not drawn or not view or len(view.group(1)) < 400 or 'class="pre"' in view.group(1):
            bad(f"{name} came up empty in the browser")
        else:
            text = re.sub(r"<[^>]+>", " ", view.group(1))
            if "isn't here" in text:
                bad(f"{name} opened as a missing page")
            hit = re.search(r"\b(undefined|NaN|Infinity)\b|\[object", text)
            if hit:
                bad(f"{name} shows a broken value ({text[max(0, hit.start() - 40):hit.end() + 20].strip()!r})")
    notes.append(f"a browser opened {len(urls)} pages")


if __name__ == "__main__":
    site = arg("--site", os.path.join(HERE, "_site"))
    data, site_cfg = check_page(site)
    if data:
        try:
            check_data(data)
            before_path, live_path = arg("--before"), arg("--live")
            ledger = json.load(open(before_path, encoding="utf-8")) if before_path and os.path.exists(before_path) else None
            live = None
            if live_path and os.path.exists(live_path) and os.path.getsize(live_path) > 0:
                try:
                    live = from_page(live_path)
                except Exception:
                    notes.append("the copy of the live site could not be read, so it was not compared")
            before = on_file(data["meta"].get("season"), ledger, live)
            if before:
                check_ledger(data, before)
                notes.append("compared with " + " and ".join(n for n, s in (("the ledger", ledger), ("the live site", live)) if s))
            elif before_path or live_path:
                notes.append("nothing earlier to compare with (first run, or a new season)")
            if not problems and "--no-browser" not in sys.argv:
                check_render(site, data)
        except Exception as e:
            bad(f"the check itself hit an error: {repr(e)[:200]}")
    for n in notes:
        print("note:", n)
    if problems:
        print(f"NOT PUBLISHING. {len(problems)} problem{'s' if len(problems) != 1 else ''} found:")
        for p in problems[:25]:
            print("  -", p)
        sys.exit(1)
    m = data["meta"]
    print(f"site check passed: {len(data['teams'])} teams, LTF Index through week {m['through']}, "
          f"{sum(1 for g in data['games'] if g.get('hp') is not None)} final scores, {len(data['picks'])} picks on file")

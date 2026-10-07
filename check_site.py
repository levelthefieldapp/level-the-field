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


def one_line(text, starts):
    hits = [ln for ln in text.split("\n") if ln.startswith(starts)]
    if len(hits) != 1:
        bad(f"expected one line starting with {starts!r} in the page, found {len(hits)}")
        return None
    try:
        return json.loads(hits[0][len(starts):].rstrip().rstrip(";").replace("<\\/", "</"))
    except Exception as e:
        bad(f"the line starting with {starts!r} does not read as data: {repr(e)[:100]}")
        return None


def check_page(site):
    path = os.path.join(site, "index.html")
    if not os.path.exists(path):
        bad("there is no index.html to publish")
        return None, None
    text = open(path, encoding="utf-8").read()
    if len(text) < 400_000:
        bad(f"index.html is only {len(text):,} characters, far smaller than a full site")
    for must in ("<title>Level the Field</title>", 'id="view"', "</html>"):
        if must not in text:
            bad(f"index.html is missing {must!r}")
    for name in ("404.html", "og.png", "favicon.png", "apple-touch-icon.png"):
        if not os.path.exists(os.path.join(site, name)):
            bad(f"{name} is missing from the site folder")
    return one_line(text, "const D = "), one_line(text, "const SITE = ")


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
        if any(not isinstance(z.get(k), (int, float)) or not math.isfinite(z[k]) for k in ("res", "off", "def", "cmp")):
            bad(f"{t.get('n')} has a missing or broken score part")
            break
    if len({t.get("n") for t in teams}) != len(teams):
        bad("a team appears twice")
    last = [t for t in teams if not any(h.get("w") == m.get("through") for h in t.get("h", []))]
    if last:
        bad(f"{len(last)} teams have no entry for week {m.get('through')}, for example {last[0].get('n')}")
    if not m.get("api"):
        notes.append("no betting lines or outside ratings in this build")
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
    cmp_ = {}
    for t in d.get("teams", []):
        for h in t.get("h", []):
            if h.get("c") is not None:
                cmp_.setdefault(str(h["w"]), {})[t["n"]] = h["c"]
    return {"season": d["meta"].get("season"), "through": d["meta"].get("through", 0), "picks": d.get("picks", []), "cmp": cmp_,
            "finals": sum(1 for g in d.get("games", []) if g.get("hp") is not None)}


def on_file(season, ledger, live):
    """Everything already on file anywhere: the ledger as it stood, plus the live site. Where they differ, the ledger rules."""
    srcs = [s for s in (live, ledger) if s and s.get("season") == season]      # the ledger is applied last, so it wins
    if not srcs:
        return None
    out = {"season": season, "through": max(s.get("through", 0) for s in srcs), "finals": max(s.get("finals", 0) for s in srcs), "picks": [], "cmp": {}}
    picks = {}
    for s in srcs:
        for q in s.get("picks", []):
            picks[q["id"]] = {**picks.get(q["id"], {}), **q}
        for w, row in s.get("cmp", {}).items():
            out["cmp"].setdefault(w, {}).update(row)
    out["picks"] = list(picks.values())
    return out


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
    for q in before.get("picks", []):
        n = new.get(q["id"])
        if n is None:
            bad(f"a pick that was on file is gone (game {q['id']}, week {q['w']})")
            continue
        changed = [k for k, v in q.items() if n.get(k) != v]
        if changed:
            bad(f"a number on file changed (game {q['id']}: {', '.join(changed)})")
        added = [k for k in n if k not in q]
        if added and (game[q["id"]].get("hp") is not None or kicked(q["id"])):
            bad(f"a number was added after kickoff (game {q['id']}: {', '.join(added)})")
    old_ids = {q["id"] for q in before.get("picks", [])}
    for gid, n in new.items():
        if gid not in old_ids and gid in game and (game[gid].get("hp") is not None or kicked(gid)):
            bad(f"a pick went on file after kickoff (game {gid})")
    hist = {(t["n"], h["w"]): h.get("c") for t in d["teams"] for h in t.get("h", [])}
    for w, row in before.get("cmp", {}).items():
        if int(w) >= m["through"]:
            continue                      # the current week's ratings are still moving
        diff = [t for t, c in row.items() if (t, int(w)) in hist and hist[(t, int(w))] != c]
        if diff:
            bad(f"saved computer ratings for week {w} changed for {len(diff)} teams")


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
    routes = ["", "rankings", "games", "picks", "spread", "scorecard", "track", "model", "playoff", "odds", "momentum", "recap",
              "stats", "conferences", "how"] + ["team/" + slug(n) for n in plain[:1] + plain[-1:]]
    done = [g for g in games if g.get("hp") is not None]
    todo = [g for g in games if g.get("hp") is None and g["w"] == m.get("next")]
    routes += [f"game/{g['id']}" for g in (done[-1:] + todo[:1])]
    base = "file://" + os.path.abspath(os.path.join(site, "index.html"))
    with ThreadPoolExecutor(4) as pool:
        doms = list(pool.map(lambda r: dump(browser, f"{base}#/{r}"), routes))
    for r, dom in zip(routes, doms):
        name = "/" + r if r else "the front page"
        err = re.search(r'<html[^>]*\sdata-err="([^"]*)"', dom)
        view = re.search(r'<section id="view">(.*?)</section>\s*</main>', dom, re.S)
        if err:
            bad(f"{name} hit an error in the browser: {err.group(1)}")
        elif not view or len(view.group(1)) < 400:
            bad(f"{name} came up empty in the browser")
        else:
            text = re.sub(r"<[^>]+>", " ", view.group(1))
            if "isn't here" in text:
                bad(f"{name} opened as a missing page")
            hit = re.search(r"\b(undefined|NaN|Infinity)\b|\[object", text)
            if hit:
                bad(f"{name} shows a broken value ({text[max(0, hit.start() - 40):hit.end() + 20].strip()!r})")
    notes.append(f"a browser opened {len(routes)} pages")


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

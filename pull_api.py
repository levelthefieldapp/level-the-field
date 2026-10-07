#!/usr/bin/env python3
"""
Gets four things from CollegeFootballData.com and saves them to raw/cfb_api.json, where
build_data.py picks them up. None of them is part of the LTF Index. They are shown next to it:

  the AP poll        for the Under the radar page and the upset watch
  SP+ and FPI        graded next to LTF on the scorecard
  closing lines      for finished games, graded on the scorecard as one more yardstick

The index is built from scores and play-by-play alone, so the site updates the same with or
without this file. If the API is down, this script says so and the update carries on without
the comparisons. If the key is missing or rejected, it stops, because that needs the owner.

The API key is read from the CFBD_API_KEY environment variable. On GitHub that is the
repository secret with the same name. The key is never written to a file or printed.

Four API calls per run. Two runs a day is about 250 calls a month, inside the free plan's 1,000.
"""
import datetime, json, os, sys, time, urllib.error, urllib.request

SEASON = 2026
BASE = os.environ.get("CFBD_BASE", "https://api.collegefootballdata.com")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw", "cfb_api.json")

ENDPOINTS = {
    "lines": f"/lines?year={SEASON}",
    "sp": f"/ratings/sp?year={SEASON}",
    "fpi": f"/ratings/fpi?year={SEASON}",
    "rankings": f"/rankings?year={SEASON}",
}


def get(path, key):
    """One API call. A dropped connection or a busy server gets one more try; a rejected key or a used-up limit does not."""
    req = urllib.request.Request(BASE + path, headers={
        "Authorization": "Bearer " + key, "Accept": "application/json", "User-Agent": "level-the-field/1.0"})
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if attempt == 2 or e.code < 500:
                raise
        except Exception:
            if attempt == 2:
                raise
        time.sleep(8)


def main():
    key = os.environ.get("CFBD_API_KEY", "").strip()
    if not key:
        sys.exit("No API key. Set the CFBD_API_KEY environment variable (in GitHub: a repository secret with that name).")
    if any(c.isspace() for c in key):
        sys.exit("The API key has a space or a line break inside it. Paste it again into the CFBD_API_KEY secret, with nothing before or after it.")
    data, errors, refused = {}, {}, False
    for name, path in ENDPOINTS.items():
        try:
            rows = get(path, key)
            if name == "lines":          # keep only what the site uses
                rows = [{"id": r.get("id"), "week": r.get("week"), "seasonType": r.get("seasonType"),
                         "homeTeam": r.get("homeTeam"), "awayTeam": r.get("awayTeam"), "lines": r.get("lines")} for r in rows]
            data[name] = rows
            print(f"{name}: {len(rows)} rows")
        except urllib.error.HTTPError as e:
            errors[name] = f"HTTP {e.code}" + (" (the API rejected the key)" if e.code in (401, 403) else " (call limit reached)" if e.code == 429 else "")
            refused = refused or e.code in (401, 403)
            print(f"{name} FAILED: {errors[name]}")
        except Exception as e:
            errors[name] = repr(e)[:200]
            print(f"{name} FAILED: {errors[name]}")
        time.sleep(0.3)
    if refused:
        sys.exit("CollegeFootballData rejected the API key. Check the CFBD_API_KEY secret. Nothing was saved, so the site keeps showing its last good version.")
    if not data:      # the API is down or the call limit is used up. The rankings do not need it, so carry on without the comparisons.
        print(f"note: nothing came back from CollegeFootballData ({errors}). The update goes on without the AP poll, SP+, FPI and closing lines.")
        return
    if errors:
        print(f"note: could not get {', '.join(errors)}. The update goes on without {'it' if len(errors) == 1 else 'them'}.")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"source": "collegefootballdata.com", "season": SEASON,
                   "pulledAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
                   "errors": errors, "data": data}, f, separators=(",", ":"))
    print("saved", OUT)


if __name__ == "__main__":
    main()

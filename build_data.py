#!/usr/bin/env python3
"""
Level the Field: data pipeline
==============================
Builds data.json, the snapshot the site reads.

What the LTF Index is made of
-----------------------------
This season's games and nothing else. No earlier seasons, no preseason rankings, no polls, no betting
lines and no other rating systems go into the score.

  resume      20  : strength of record 65, quality wins 20, scoring margin 15
  offense     25  : EPA/play 30, success rate 25, points/drive 20, points/scoring opp 10,
                    explosive plays 10, yards/game 5
  defense     25  : EPA/play 25, success rate 20, points/drive 20, stop rate 10,
                    points/scoring opp 10, explosive plays 5, havoc 5, yards/game 5
  margin      20  : final scoring margin, adjusted for opponent and home field
  first half  10  : scoring margin at halftime, adjusted the same way

Two rules shape every opponent-adjusted number above (offense, defense and both margins):

  1. Every game counts. A game against a lower-division team is kept, with all such teams treated as
     one pooled opponent whose strength is worked out from this season's games. The one exception is
     the first-half part, which uses games between FBS teams only, because a halftime lead over a
     lower-division team says little.
  2. League strength, in two levels. A team's number is the level of its tier (the four power leagues
     and Notre Dame, or everyone else), plus the level of its league, plus its own difference. The gap
     between the two tiers is held loosely, so this season's games between them set it. One league's
     level against another's in the same tier is held very firmly, so a league only gets credit over
     another when this season's games between them clearly call for it.

Where the data comes from
-------------------------
The public sportsdataverse / cfbfastR data repositories on GitHub. These are open mirrors built from
the CollegeFootballData.com (CFBD) API and ESPN's play-by-play feed, refreshed during the season:

  schedule + scores : sportsdataverse/cfbfastR-data  schedules/csv/cfb_schedules_<season>.csv
  play-by-play      : sportsdataverse/sportsdataverse-data  release cfbfastR_cfb_pbp
  team colors       : sportsdataverse/cfbfastR-data  teams/teams_colors_logos.csv

pull_api.py also fetches three things from the CollegeFootballData.com API into raw/cfb_api.json.
None of them is part of the score. They are shown next to it, for comparison:

  AP poll           : on the Under the radar page
  SP+ and FPI       : graded next to LTF on the scorecard
  betting line      : graded next to LTF on the scorecard, as one more yardstick

Without that file the index builds exactly the same. Only the comparisons go missing.

Needs: pandas, numpy, pyarrow.

Run:  python3 build_data.py                    downloads what is missing into ./raw, writes data.json
      python3 build_data.py --refresh          re-download everything first (the daily update does this)
      python3 build_data.py --prev old.html    also read picks out of an older copy of the site

What carries over from one run to the next lives in ledger.json: every LTF number put on file before
kickoff, with the SP+ and FPI numbers for the same game. Each run reads the ledger, adds to it, and never
changes a number once the game has kicked off. One thing can change before kickoff: a number filed under an
earlier version of the formula is refiled under today's, with the earlier number kept beside it, so every game is
graded on the formula in use. make_site.py then turns data.json into the site.

When the week turns over
------------------------
Scores and picks refresh on every run. The index itself moves once a week: a week counts when nearly all
of its games are final and their play-by-play has arrived (see week_in_books). A Tuesday or Thursday
result shows on the site at once and joins the ratings when the rest of the week is in.
"""
import json, math, os, sys, re, datetime, urllib.request
import numpy as np
import pandas as pd

SEASON = 2026
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
# The ledger is the site's memory: every LTF number put on file before kickoff, with the SP+ and FPI numbers for the
# same game. Each run reads it, adds to it and never rewrites what is there.
LEDGER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ledger.json")


def now_utc():
    """The moment of this run. Setting LTF_NOW lets a test pretend it is another day."""
    v = os.environ.get("LTF_NOW")
    return pd.Timestamp(v).tz_convert("UTC") if v else pd.Timestamp.now(tz="UTC")


def today_et():
    """Dates on the site are Eastern, the clock the college football week runs on."""
    return now_utc().tz_convert("America/New_York").date().isoformat()

# ---- model constants -------------------------------------------------------
HFA = 2.5            # home field, in points
SIGMA = 16.0         # std dev of a game result around its expected margin
MARGIN_CAP = 24      # blowouts count for no more than this
FCS_RATING = -20.0   # every FCS opponent is treated as 20 points below an average FBS team
ALPHA_PLAY = 2.5     # ridge strength for per-play efficiency numbers
ALPHA_MARGIN = 1.5   # ridge strength for scoring margin, full game and first half
ALPHA_TIER = 0.3     # how firmly the gap between the power leagues and everyone else is held. Loosely: this season's games set it.
ALPHA_LEAGUE = 40.0  # how firmly one league is held level with the others in its tier. Very: only a clear record between them moves it.
H1_CAP = None        # a cap on halftime leads. None: a first-half lead counts in full. (A cap of 24 tested no better.)
H1_FBS_ONLY = True   # The first-half part uses games between FBS teams only: a halftime lead over a lower-division team says
H1_LEAGUES = True    # little. League strength is on, as in the other parts. Both were compared in research/bt_variants.py.
POOL = "~lower division"     # every lower-division opponent, treated as one pooled team
# The LTF Index: the share each part gets. Changed October 7, 2026 to use this season only. Until then the parts were
# résumé 20, offense 25, defense 25 and computer ratings 30 (SP+, FPI, SRS and Elo, which all carry earlier seasons).
WEIGHTS = {"res": 20, "off": 25, "def": 25, "mar": 20, "h1": 10}
FORMULA = 2          # the version of the formula a number on file was made with. 1 was the formula before October 7, 2026.
# Fields that sat beside a number on file before October 7, 2026: betting lines and totals, and the retired prediction
# model's numbers. The site is out of betting and shows no line for a game still to be played, so these are no longer kept.
RETIRED_KEYS = ("mm", "mt", "ho", "hs", "oo", "ou", "tb", "v")
GARBAGE = {1: 43, 2: 37, 3: 27, 4: 21}

# The résumé recipe: the share each piece gets. Until October 6, 2026 it was strength of record 40, quality wins 20,
# losses 15, margin 15 and schedule strength 10. Two of those were dropped after a test on 2021 to 2025
# (research/resume_study.py): the losses piece was the win-loss record over again, and schedule strength was being
# counted twice, since strength of record already allows for who a team has played. Accuracy was unchanged.
RESUME = {"sor": 0.65, "qw": 0.20, "mar": 0.15}
# ---- what past seasons say ----------------------------------------------------------------------------------------
# Everything from here to the end of this block comes out of research/backtest_site.py, which rebuilds the index week by
# week for twelve past seasons with the code in this file. It has to be re-run whenever the formula changes, and its
# output pasted here. No number in this block feeds the rankings. SLOPE turns a gap in the index into points for the
# LTF line, and the rest is what the site quotes about its own record.
#
# SLOPE: points per one standard deviation of the index, by week of the season: the index frozen after week W against
#   every later regular-season game.
# BACKTEST: how the index's picks did on the next week's games. "cal" compares the win chance the index gave with how
#   often that side won. "dog" is the same from the underdog's side, for the upset watch. "gw" is how far one unexpected
#   result moves a team's score, by the week of the game: a lot in September, about half as much by November. "w6" is
#   the weights test on the How it works page. "mkt" numbers are the betting line on the same games, as a yardstick.
# CONFIDENCE: "hz" is how picks held up by how far ahead they were made. "steady" is favorites whose level swings least.
# MOMENTUM: whether a hot or cold stretch says anything the index does not already know.
# LEAGUE_CHECK: in games between two different power leagues, how far each league's teams beat or fell short of the
#   LTF line, and how far the line fell short when a power team played a team from another league.
#<<backtest
SLOPE = {2: 8.5, 3: 9.56, 4: 9.95, 5: 10.45, 6: 10.83, 7: 11.38, 8: 11.61, 9: 11.95, 10: 12.07, 11: 12.13, 12: 12.53}
BACKTEST = {"seasons": "2014 to 2025", "n": 12, "games": 7452, "su": 72.3, "miss": 13.1, "mktGames": 7450, "mktSu": 74.2, "mktMiss": 12.3, "ltfOnMkt": 72.3, "ltfMissOnMkt": 13.1, "cal": [{"lo": 50, "hi": 55, "n": 968, "pred": 52.4, "act": 53.1}, {"lo": 55, "hi": 60, "n": 961, "pred": 57.4, "act": 55.9}, {"lo": 60, "hi": 65, "n": 965, "pred": 62.4, "act": 66.4}, {"lo": 65, "hi": 70, "n": 886, "pred": 67.4, "act": 69.9}, {"lo": 70, "hi": 75, "n": 774, "pred": 72.4, "act": 74.5}, {"lo": 75, "hi": 80, "n": 767, "pred": 77.5, "act": 80.2}, {"lo": 80, "hi": 85, "n": 752, "pred": 82.4, "act": 82.0}, {"lo": 85, "hi": 90, "n": 564, "pred": 87.4, "act": 87.1}, {"lo": 90, "hi": 95, "n": 507, "pred": 92.3, "act": 94.1}, {"lo": 95, "hi": 100, "n": 308, "pred": 97.0, "act": 96.4}], "conf": [{"lo": 50, "hi": 60, "label": "Toss-up", "n": 1929, "act": 54.5}, {"lo": 60, "hi": 75, "label": "Lean", "n": 2625, "act": 70.0}, {"lo": 75, "hi": 90, "label": "Likely", "n": 2083, "act": 82.7}, {"lo": 90, "hi": 100, "label": "Very likely", "n": 815, "act": 95.0}], "dog": [{"lo": 40, "hi": 50, "n": 1929, "pred": 45.1, "act": 45.5}, {"lo": 30, "hi": 40, "n": 1851, "pred": 35.2, "act": 31.9}, {"lo": 20, "hi": 30, "n": 1541, "pred": 25.0, "act": 22.6}, {"lo": 10, "hi": 20, "n": 1316, "pred": 15.5, "act": 15.8}, {"lo": 0, "hi": 10, "n": 815, "pred": 5.9, "act": 5.0}], "byWeek": [{"lab": "Weeks 3 and 4", "n": 1135, "su": 72.7, "miss": 14.0, "mktSu": 78.0, "mktMiss": 12.2}, {"lab": "Weeks 5 to 7", "n": 1854, "su": 68.9, "miss": 13.0, "mktSu": 73.2, "mktMiss": 12.1}, {"lab": "Weeks 8 to 10", "n": 1923, "su": 72.7, "miss": 13.0, "mktSu": 73.0, "mktMiss": 12.5}, {"lab": "Weeks 11 to 13", "n": 2056, "su": 74.4, "miss": 12.8, "mktSu": 74.8, "mktMiss": 12.4}, {"lab": "Weeks 14 and 15", "n": 484, "su": 73.1, "miss": 12.6, "mktSu": 71.1, "mktMiss": 12.4}], "bySeason": {"best": 76.1, "worst": 69.7}, "gw": {"3": 0.701, "4": 0.534, "5": 0.466, "6": 0.404, "7": 0.343, "8": 0.313, "9": 0.287, "10": 0.261, "11": 0.231, "12": 0.219, "13": 0.202, "14": 0.206}, "gamma": 0.206, "w6": {"games": 4968, "rows": [{"lab": "Résumé only", "miss": 14.28, "su": 67.7}, {"lab": "Scoring margin only", "miss": 13.71, "su": 69.9}, {"lab": "Offense and defense only", "miss": 13.52, "su": 70.5}, {"lab": "60 / 10 / 10 / 10 / 10", "miss": 13.83, "su": 69.2}, {"lab": "Even, 20 each", "miss": 13.52, "su": 70.7}, {"lab": "20 / 25 / 25 / 20 / 10, the LTF Index", "miss": 13.49, "su": 70.7}, {"lab": "Best fit the data could find, 10 / 40 / 30 / 10 / 10", "miss": 13.45, "su": 70.6}, {"lab": "Betting line, for comparison", "miss": 12.41, "su": 73.4}]}, "was": {"games": 7452, "su": 72.4, "miss": 13.0, "bare": {"games": 7452, "su": 71.1, "miss": 13.4}}}
CONFIDENCE = {"hz": [{"lab": "next week", "lo": 1, "hi": 1, "n": 7452, "act": 72.3, "pred": 71.0}, {"lab": "two or three weeks out", "lo": 2, "hi": 3, "n": 13088, "act": 70.5, "pred": 70.2}, {"lab": "four to six weeks out", "lo": 4, "hi": 6, "n": 14824, "act": 69.2, "pred": 69.3}, {"lab": "seven or more weeks out", "lo": 7, "hi": 99, "n": 12408, "act": 67.4, "pred": 67.7}], "steady": {"n": 2076, "pred": 71.0, "act": 72.9}, "updown": {"n": 2076, "pred": 70.8, "act": 71.1}}
MOMENTUM = {"seasons": "2014 to 2025", "games": 6920, "carry": {"n": 13339, "corr": 0.034, "hot": 51.7, "hotN": 2628, "cold": 48.2, "coldN": 2600}, "fav": {"hot": {"n": 1384, "pred": 74.7, "act": 75.9}, "cold": {"n": 1384, "pred": 67.9, "act": 68.9}}, "fix": {"n": 6920, "gain": 0.001, "win": -0.06, "better": 7, "of": 12}, "upL": {"n": 672, "ltf": 0.2, "se": 0.6, "won": 53.0, "pos": 6, "yrs": 12}, "upW": {"n": 663, "ltf": 0.1, "se": 0.6, "won": 45.9, "pos": 7, "yrs": 12}}
LEAGUE_CHECK = {"seasons": "2014 to 2025", "pp": {"n": 238, "su": 71.8, "miss": 13.4}, "cross": {"n": 626, "su": 83.2, "short": 4.0, "won": 83.5, "by": 18.9, "before": 10.8}, "lean": [{"lg": "SEC", "n": 78, "by": 0.1, "se": 1.9, "beat": 38}, {"lg": "Big Ten", "n": 64, "by": -1.5, "se": 2.3, "beat": 30}, {"lg": "Big 12", "n": 42, "by": 7.3, "se": 2.4, "beat": 29}, {"lg": "ACC", "n": 158, "by": -4.2, "se": 1.3, "beat": 60}, {"lg": "Pac-12", "n": 40, "by": 1.2, "se": 2.6, "beat": 23}, {"lg": "Notre Dame", "n": 94, "by": 4.1, "se": 1.7, "beat": 58}], "rec": [{"lg": "SEC", "w": 93, "l": 71, "by": 2.6}, {"lg": "Big Ten", "w": 72, "l": 77, "by": -0.4}, {"lg": "Big 12", "w": 55, "l": 59, "by": 1.0}, {"lg": "ACC", "w": 88, "l": 157, "by": -6.6}, {"lg": "Pac-12", "w": 49, "l": 47, "by": -2.8}, {"lg": "Notre Dame", "w": 82, "l": 28, "by": 12.8}], "pairs": [{"a": "SEC", "b": "ACC", "w": 54, "l": 41, "by": 3.7}, {"a": "SEC", "b": "Big 12", "w": 17, "l": 12, "by": 0.8}, {"a": "SEC", "b": "Big Ten", "w": 8, "l": 9, "by": 0.3}, {"a": "Big Ten", "b": "ACC", "w": 26, "l": 23, "by": 1.5}, {"a": "Big Ten", "b": "Big 12", "w": 19, "l": 15, "by": 1.3}, {"a": "Big 12", "b": "ACC", "w": 17, "l": 12, "by": 3.5}], "b12Early": 41, "top25": {"SEC": 7.2, "Pac-12": 3.2, "Big 12": 4.1, "Big Ten": 4.8, "ACC": 3.8, "Other": 1.1, "Notre Dame": 0.8}, "without": {"su": 71.8, "miss": 13.3}}
BUYSELL = {"seasons": "2014 to 2025", "weeks": 132, "sell": {"n": 374, "per": 2.8, "before": 78.1, "exp": 41.7, "act": 39.5, "w": 416, "l": 636, "none": 20, "of": 12, "rec": 61.8, "seasons": 12}, "buy": {"n": 731, "per": 5.5, "before": 43.8, "exp": 59.5, "act": 58.9, "w": 1225, "l": 856, "none": 17, "of": 12, "rec": 56.2, "seasons": 12}}
VSLINE = {"seasons": "2014 to 2025", "games": 7450, "split": {"n": 901, "w": 381, "l": 520, "pct": 42.3, "seasons": 0, "of": 12, "early": {"n": 471, "w": 166, "l": 305, "pct": 35.2}, "late": {"n": 430, "w": 215, "l": 215, "pct": 50.0}}, "gaps": [{"lo": 0, "n": 7450, "w": 3658, "l": 3658, "beat": 50.0, "closer": 44.4}, {"lo": 3, "n": 4057, "w": 2015, "l": 1963, "beat": 50.7, "closer": 42.2}, {"lo": 7, "n": 1375, "w": 690, "l": 661, "beat": 51.1, "closer": 38.0}, {"lo": 10, "n": 574, "w": 283, "l": 280, "beat": 50.3, "closer": 33.8}]}
#backtest>>

POWER = ["ACC", "Big 12", "Big Ten", "SEC"]
CONF_SHORT = {"American Athletic": "American", "Conference USA": "C-USA", "Mid-American": "MAC",
              "FBS Independents": "Independent"}

# names in the colors file that differ from the schedule file
COLOR_ALIAS = {"App State": "Appalachian State", "Massachusetts": "UMass", "Sam Houston": "Sam Houston State",
               "Southern Miss": "Southern Mississippi", "UConn": "Connecticut", "UL Monroe": "Louisiana Monroe",
               "UTSA": "UT San Antonio"}

BASE = "https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main/"
FILES = {
    "sched.csv": BASE + f"schedules/csv/cfb_schedules_{SEASON}.csv",
    "colors.csv": BASE + "teams/teams_colors_logos.csv",
    "pbp.parquet": "https://github.com/sportsdataverse/sportsdataverse-data/releases/download/"
                   f"cfbfastR_cfb_pbp/play_by_play_{SEASON}.parquet",
}


API = os.path.join(RAW, "cfb_api.json")     # output of pull_api.py, optional


def load_api():
    if not os.path.exists(API):
        return None
    with open(API, encoding="utf-8") as f:
        return json.load(f)


def fetch(refresh=False):
    """Download the public data files. Each is tried three times and only replaces the old copy once it is whole."""
    import time
    os.makedirs(RAW, exist_ok=True)
    for name, url in FILES.items():
        path = os.path.join(RAW, name)
        if not refresh and os.path.exists(path):
            continue
        for attempt in (1, 2, 3):
            try:
                print("downloading", name)
                urllib.request.urlretrieve(url, path + ".part")
                if os.path.getsize(path + ".part") < 1000:
                    raise IOError("the file came back nearly empty")
                os.replace(path + ".part", path)
                break
            except Exception as e:
                if attempt == 3:
                    sys.exit(f"Could not download {name} after three tries ({repr(e)[:120]}). Nothing was changed.")
                time.sleep(10 * attempt)


# ---- small math helpers ----------------------------------------------------
def phi(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def probit(p):
    # inverse normal CDF (Acklam), good to ~1e-9
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    pl = 0.02425
    if p < pl:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    if p > 1 - pl:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    q = p - 0.5
    r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


def z(s):
    s = pd.Series(s, dtype=float)
    sd = s.std(ddof=0)
    return (s - s.mean()) / sd if sd > 0 else s * 0.0


def resume_z(sor_z, qw_z, mar_z):
    """The résumé grade from its three pieces, each already a standard score across FBS."""
    return z(RESUME["sor"] * sor_z + RESUME["qw"] * qw_z + RESUME["mar"] * mar_z)

def ridge(X, y, w, alpha, n_free):
    """Weighted ridge. The first n_free columns are not penalized."""
    w = np.asarray(w, float)
    w = w / w.mean()
    XtW = X.T * w
    pen = np.eye(X.shape[1]) * alpha
    pen[:n_free, :n_free] = 0.0
    return np.linalg.solve(XtW @ X + pen, XtW @ y)


def fbs_names(sched):
    return set(sched[sched.home_division == "fbs"].home_team) | set(sched[sched.away_division == "fbs"].away_team)


def leagues_of(sched):
    """Each FBS team's league, and whether it sits in the power tier. Independents have no league.
    Notre Dame is counted with the power leagues, as it is everywhere on the site."""
    conf = {}
    for r in sched.itertuples():
        if r.home_division == "fbs": conf[r.home_team] = r.home_conference
        if r.away_division == "fbs": conf[r.away_team] = r.away_conference
    league = {t: (None if (not isinstance(c, str) or "Independent" in c) else c) for t, c in conf.items()}
    power = {t: (conf[t] in POWER or t == "Notre Dame") for t in conf}
    return league, power


def league_design(teams, league, power):
    """Which league and which tier each team in a fit belongs to, as two tables of ones and zeros."""
    names = sorted({league[t] for t in teams if league.get(t)})
    at = {c: i for i, c in enumerate(names)}
    M, M2 = np.zeros((len(teams), len(names))), np.zeros((len(teams), 1))
    for i, t in enumerate(teams):
        if league.get(t): M[i, at[league[t]]] = 1.0
        if power.get(t): M2[i, 0] = 1.0
    return {"M": M, "M2": M2, "names": names}


def ridge_leagues(X, y, w, alpha, n_free, L):
    """Weighted ridge in which a team's number is the level of its tier, plus the level of its league, plus its own
    difference from that. The team columns of X come in blocks of one column per team (offense then defense, or a single
    block for a margin). Returns the numbers per team, and the tier and league levels found for each block.

    The tier level is held loosely (ALPHA_TIER), so the season's games between the power leagues and everyone else set
    it. Each league's own level is held very firmly (ALPHA_LEAGUE), so one league only pulls away from another in its
    tier when this season's games between them clearly call for it. Without the levels, every team is pulled toward one
    national average, which sells the gap between the two tiers short by about a touchdown (research/pure_gap.py)."""
    M, M2 = L["M"], L["M2"]
    T, k = M.shape
    blocks = (X.shape[1] - n_free) // T
    parts, pens = [X], []
    for b in range(blocks):
        Xb = X[:, n_free + b * T: n_free + (b + 1) * T]
        parts += [Xb @ M, Xb @ M2]
        pens += [ALPHA_LEAGUE] * k + [ALPHA_TIER]
    XX = np.hstack(parts)
    w = np.asarray(w, float)
    w = w / w.mean()
    XtW = XX.T * w
    pen = np.diag(np.r_[np.zeros(n_free), np.full(X.shape[1] - n_free, float(alpha)), np.array(pens)])
    b = np.linalg.solve(XtW @ XX + pen, XtW @ y)
    out, k0, levels = b[:X.shape[1]].copy(), X.shape[1], []
    for i in range(blocks):
        lv, tv = b[k0 + i * (k + 1): k0 + i * (k + 1) + k], float(b[k0 + i * (k + 1) + k])
        out[n_free + i * T: n_free + (i + 1) * T] += M @ lv + M2[:, 0] * tv
        levels.append({"tier": tv, "league": dict(zip(L["names"], (float(v) for v in lv)))})
    return out, levels


def pooled(sched, pbp):
    """The schedule and the plays with every lower-division team renamed to one pooled opponent, so that games against
    them count. Their strength is then worked out from this season's games like any other team's."""
    fb = fbs_names(sched)
    s, p = sched.copy(), pbp.copy()
    for c in ("home_team", "away_team"):
        s[c] = s[c].where(s[c].isin(fb), POOL)
    for c in ("pos_team", "def_pos_team", "home_team", "away_team"):
        p[c] = p[c].where(p[c].isin(fb), POOL)
    return s[(s.home_team != POOL) | (s.away_team != POOL)], p


# ---- load ------------------------------------------------------------------
def load():
    sched = pd.read_csv(os.path.join(RAW, "sched.csv"))
    sched = sched[sched.season_type == "regular"].copy()
    cols = ["game_id", "week", "pos_team", "def_pos_team", "home_team", "away_team", "period",
            "pos_score_diff_start", "rush", "pass", "penalty_no_play", "EPA", "success", "yards_gained",
            "sack", "int", "fumble_vec", "pass_breakup_player_name", "punt", "fg_inds",
            "drive_id", "drive_result", "formatted_spread", "over_under", "down", "yards_to_goal", "distance", "play_type",
            "pos_team_score", "def_pos_team_score"]
    pbp = pd.read_parquet(os.path.join(RAW, "pbp.parquet"), columns=cols)
    pbp = pbp[pbp.game_id.isin(sched.game_id)].copy()
    colors = pd.read_csv(os.path.join(RAW, "colors.csv"), encoding="latin-1")
    return sched, pbp, colors


def game_lines(pbp):
    """Closing spread (from the home team's side) and total for each game."""
    g = pbp.groupby("game_id").agg(home=("home_team", "first"), away=("away_team", "first"),
                                   fs=("formatted_spread", "first"), ou=("over_under", "first")).reset_index()
    out = {}
    for r in g.itertuples():
        hs = None
        if isinstance(r.fs, str):
            m = re.match(r"^(.*)\s([-+]?[\d.]+)$", r.fs.strip())
            if m:
                fav, num = m.group(1), abs(float(m.group(2)))
                if fav == r.home:
                    hs = -num
                elif fav == r.away:
                    hs = num
            elif r.fs.strip().upper() in ("EVEN", "PK", "PICK"):
                hs = 0.0
        ou = float(r.ou) if pd.notna(r.ou) and r.ou > 0 else None
        out[r.game_id] = (hs, ou)
    return out


# ---- efficiency ------------------------------------------------------------
# a drive counts as a stop when it ends in a punt, a turnover or a turnover on downs
STOPS = ["PUNT", "DOWNS", "INT", "FUMBLE", "INT TD", "FUMBLE RETURN TD", "FUMBLE TD", "PUNT TD", "SF"]


def efficiency(pbp, fbs_games, teams, L=None):
    """Opponent-adjusted offense and defense numbers for each team in `teams`, from the games given. The site passes
    every game, with lower-division opponents pooled as one team (the last name in `teams`), and the league design L.
    Garbage time is removed from everything except yards per game."""
    idx = {t: i for i, t in enumerate(teams)}
    T = len(teams)
    keys = ["game_id", "pos_team", "def_pos_team", "home_team"]
    p_all = pbp[pbp.game_id.isin(fbs_games.game_id)]
    is_scrim = ((p_all.rush == 1) | (p_all["pass"] == 1)) & (p_all.penalty_no_play != True)
    yards = p_all[is_scrim].groupby(keys).yards_gained.sum().rename("yds").reset_index()

    lead = p_all.pos_score_diff_start.abs()
    limit = p_all.period.map(GARBAGE).fillna(21)
    p = p_all[~(lead > limit)].copy()

    scrim = p[((p.rush == 1) | (p["pass"] == 1)) & (p.penalty_no_play != True) & p.EPA.notna()].copy()
    scrim["explosive"] = (((scrim.rush == 1) & (scrim.yards_gained >= 10)) |
                          ((scrim["pass"] == 1) & (scrim.yards_gained >= 20))).astype(float)
    scrim["havoc"] = ((scrim.sack == 1) | (scrim.int == 1) | (scrim.fumble_vec == 1) |
                      scrim.pass_breakup_player_name.notna() |
                      ((scrim.rush == 1) & (scrim.yards_gained < 0))).astype(float)
    tg = scrim.groupby(keys).agg(
        n=("EPA", "size"), epa=("EPA", "mean"), sr=("success", "mean"),
        exp=("explosive", "mean"), hav=("havoc", "mean")).reset_index()

    extras = "distance" in scrim.columns and "play_type" in scrim.columns
    if extras:      # standard downs: first down, second and 7 or less, third or fourth and 4 or less
        dn, ds = scrim.down.fillna(1), scrim.distance.fillna(10)
        scrim["sdn"] = (dn == 1) | ((dn == 2) & (ds <= 7)) | ((dn >= 3) & (ds <= 4))
        for mask, pre, col in [(scrim.rush == 1, "ru", "EPA"), (scrim["pass"] == 1, "pa", "EPA"), (scrim.sdn, "sdn", "success"), (~scrim.sdn, "pdn", "success")]:
            part = scrim[mask].groupby(keys).agg(**{"n_" + pre: (col, "size"), pre: (col, "mean")}).reset_index()
            tg = tg.merge(part, on=keys, how="left")
            tg["n_" + pre] = tg["n_" + pre].fillna(0)

    real = ~p.drive_result.isin(["END OF HALF", "END OF GAME", "END OF 4TH QUARTER", "Uncategorized", "KICKOFF", "PENALTY"])
    dp = p[real & p.drive_id.notna()].copy()
    # a scoring opportunity: a first down at or inside the opponent's 40 (or a touchdown from farther out)
    dp["in40"] = ((dp.down == 1) & (dp.yards_to_goal <= 40) & ((dp.rush == 1) | (dp["pass"] == 1))).astype(float)
    dr = dp.groupby(["game_id", "drive_id"]).agg(
        pos_team=("pos_team", "first"), def_pos_team=("def_pos_team", "first"),
        home_team=("home_team", "first"), res=("drive_result", "first"), in40=("in40", "max")).reset_index()
    dr["pts"] = dr.res.map({"TD": 7.0, "FG": 3.0}).fillna(0.0)
    dr["opp"] = ((dr.in40 > 0) | (dr.res == "TD")).astype(float)
    dr["opp_pts"] = dr.pts * dr.opp
    dr["stop"] = dr.res.isin(STOPS).astype(float)
    dg = dr.groupby(keys).agg(nd=("pts", "size"), ppd=("pts", "mean"), stop=("stop", "mean"),
                              nopp=("opp", "sum"), opp_pts=("opp_pts", "sum")).reset_index()
    dg["ppo"] = np.where(dg.nopp > 0, dg.opp_pts / dg.nopp.where(dg.nopp > 0, 1), np.nan)
    tg = tg.merge(dg, on=keys, how="left").merge(yards, on=keys, how="left")
    tg["one"] = 1.0

    neutral = dict(zip(fbs_games.game_id, fbs_games.neutral_site))
    tg = tg[tg.pos_team.isin(idx) & tg.def_pos_team.isin(idx)]
    h = np.where(tg.game_id.map(neutral).astype(bool), 0.0, np.where(tg.pos_team == tg.home_team, 1.0, -1.0))

    def fit(col, wcol):
        ok = (tg[col].notna() & (tg[wcol] > 0)).values
        d = tg[ok]
        X = np.zeros((len(d), 2 + 2 * T))
        X[:, 0] = 1.0
        X[:, 1] = h[ok]
        X[np.arange(len(d)), 2 + d.pos_team.map(idx).values] = 1.0
        X[np.arange(len(d)), 2 + T + d.def_pos_team.map(idx).values] = -1.0
        yv = d[col].values.astype(float)
        b = ridge_leagues(X, yv, d[wcol].values, ALPHA_PLAY, 2, L)[0] if L else ridge(X, yv, d[wcol].values, ALPHA_PLAY, 2)
        return b[0] + b[2:2 + T], b[0] - b[2 + T:]     # what the offense produces, what the defense gives up

    res = pd.DataFrame(index=teams)
    for col, wcol in [("epa", "n"), ("sr", "n"), ("exp", "n"), ("hav", "n"), ("ppd", "nd"),
                      ("ppo", "nopp"), ("stop", "nd"), ("yds", "one")]:
        o, d = fit(col, wcol)
        res["o_" + col], res["d_" + col] = o, d
    # for havoc and stop rate the "d_" number is what the defense forces, so higher is better there
    if extras:
        for col in ("ru", "pa", "sdn", "pdn"):
            o, d = fit(col, "n_" + col)
            res["o_" + col], res["d_" + col] = o, d
        # luck: things that swing games but mostly do not repeat
        pt = p_all.play_type.fillna("")
        lost = pt.isin(["Fumble Recovery (Opponent)", "Fumble Recovery (Opponent) Touchdown", "Fumble Return Touchdown"])
        kept = pt.isin(["Fumble Recovery (Own)", "Fumble Recovery (Own) Touchdown"])
        made = pt == "Field Goal Good"
        tried = made | pt.isin(["Field Goal Missed", "Blocked Field Goal", "Blocked Field Goal Touchdown", "Missed Field Goal Return", "Missed Field Goal Return Touchdown"])
        lk = pd.DataFrame({"pos_team": p_all.pos_team, "def_pos_team": p_all.def_pos_team, "fl": lost.astype(int), "fo": kept.astype(int),
                           "it": (p_all.int == 1).astype(int), "pbu": p_all.pass_breakup_player_name.notna().astype(int),
                           "fgm": made.astype(int), "fga": tried.astype(int)})
        mine = lk.groupby("pos_team")[["fl", "fo", "it", "pbu"]].sum().reindex(teams).fillna(0)
        opp = lk.groupby("def_pos_team")[["fl", "fo", "it", "pbu", "fgm", "fga"]].sum().reindex(teams).fillna(0)
        gp_ = pd.concat([fbs_games.home_team, fbs_games.away_team]).value_counts().reindex(teams).replace(0, np.nan)
        tot_f = mine.fl + mine.fo + opp.fl + opp.fo
        rho = lk.it.sum() / max(1, lk.it.sum() + lk.pbu.sum())            # share of passes defensed that become interceptions
        pfg = lk.fgm.sum() / max(1, lk.fga.sum())
        res["fum_got"], res["fum_all"] = (mine.fo + opp.fl).values, tot_f.values
        res["fum_luck"] = (((mine.fo + opp.fl) - 0.5 * tot_f) / gp_).fillna(0).values                      # extra fumbles recovered per game
        res["int_luck"] = (((opp.it - rho * (opp.it + opp.pbu)) - (mine.it - rho * (mine.it + mine.pbu))) / gp_).fillna(0).values
        res["fg_luck"] = ((3 * (pfg * opp.fga - opp.fgm)) / gp_).fillna(0).values                          # points from opponents' kicking, per game
        res["opp_fgm"], res["opp_fga"] = opp.fgm.values, opp.fga.values

    # special teams: net expected points on field goals and punts, per game. Shown on the site, not scored.
    st = p[((p.fg_inds == 1) | (p.punt == 1)) & p.EPA.notna()]
    own = st.groupby("pos_team").EPA.sum()
    opp = st.groupby("def_pos_team").EPA.sum()
    ng = pd.concat([fbs_games.home_team, fbs_games.away_team]).value_counts()
    res["st"] = ((own.reindex(teams).fillna(0) - opp.reindex(teams).fillna(0)) / ng.reindex(teams)).values

    realA = ~p_all.drive_result.isin(["END OF HALF", "END OF GAME", "END OF 4TH QUARTER", "Uncategorized", "KICKOFF", "PENALTY"])
    dcount = p_all[realA & p_all.drive_id.notna()].groupby(["game_id", "pos_team"]).drive_id.nunique().reset_index()
    res["dpg"] = dcount.groupby("pos_team").drive_id.mean().reindex(teams).values
    res = res.drop(index=POOL, errors="ignore")      # the pooled lower-division opponent has done its job
    return score_stats(res)


def score_stats(res):
    """The offense and defense grades, as standard scores among the teams in the table."""
    res = res.copy()
    res["off_z"] = z(0.30 * z(res.o_epa) + 0.25 * z(res.o_sr) + 0.20 * z(res.o_ppd) + 0.10 * z(res.o_ppo)
                     + 0.10 * z(res.o_exp) + 0.05 * z(res.o_yds)).values
    res["def_z"] = z(-0.25 * z(res.d_epa) - 0.20 * z(res.d_sr) - 0.20 * z(res.d_ppd) - 0.10 * z(res.d_ppo)
                     - 0.05 * z(res.d_exp) - 0.05 * z(res.d_yds)
                     + 0.10 * z(res.d_stop) + 0.05 * z(res.d_hav)).values
    res["eff_z"] = z(0.5 * res.off_z + 0.5 * res.def_z).values
    return res


def margin_rating(games, teams, L=None):
    """Scoring margin per game against an average team, adjusted for opponent and home field. Blowouts are capped."""
    idx = {t: i for i, t in enumerate(teams)}
    T = len(teams)
    g = games
    X = np.zeros((len(g), T))
    X[np.arange(len(g)), g.home_team.map(idx).values] = 1.0
    X[np.arange(len(g)), g.away_team.map(idx).values] = -1.0
    m = (g.home_points - g.away_points).clip(-MARGIN_CAP, MARGIN_CAP).values - HFA * (~g.neutral_site.astype(bool)).values
    if L:
        b, lv = ridge_leagues(X, m.astype(float), np.ones(len(g)), ALPHA_MARGIN, 0, L)
        return pd.Series(b, index=teams), lv[0]
    return pd.Series(ridge(X, m.astype(float), np.ones(len(g)), ALPHA_MARGIN, 0), index=teams), None


def halftime_margins(pbp):
    """The home team's lead at halftime in each game, read from the score as the third quarter starts."""
    h = pbp[pbp.period == 3].groupby("game_id").head(1)
    lead = np.where(h.pos_team == h.home_team, h.pos_team_score - h.def_pos_team_score, h.def_pos_team_score - h.pos_team_score)
    return pd.Series(lead.astype(float), index=h.game_id.values)


def first_half_rating(pbp, games, teams, L=None):
    """Scoring margin at halftime against an average team, adjusted for opponent, with home field left for the fit to
    find. A lead built by halftime says more about the two teams than what happens once the game is decided.
    The site passes games between FBS teams only (see H1_FBS_ONLY)."""
    idx = {t: i for i, t in enumerate(teams)}
    T = len(teams)
    g = games.assign(h1=games.game_id.map(halftime_margins(pbp)))
    g = g[g.h1.notna()]
    if len(g) < 5:
        return pd.Series(0.0, index=teams)
    X = np.zeros((len(g), 1 + T))
    X[:, 0] = (~g.neutral_site.astype(bool)).values.astype(float)
    X[np.arange(len(g)), 1 + g.home_team.map(idx).values] = 1.0
    X[np.arange(len(g)), 1 + g.away_team.map(idx).values] = -1.0
    y = g.h1.clip(-H1_CAP, H1_CAP).values.astype(float) if H1_CAP else g.h1.values.astype(float)
    b = ridge_leagues(X, y, np.ones(len(g)), ALPHA_MARGIN, 1, L)[0] if L else ridge(X, y, np.ones(len(g)), ALPHA_MARGIN, 1)
    return pd.Series(b[1:], index=teams)


def power_ratings(sched, pbp, max_week, pool=None):
    """Everything the index is built from, using completed games through max_week: the efficiency numbers, the two
    margin ratings, and a points-scale power rating (the yardstick strength of record measures opponents with).
    `pool` is the output of pooled(sched, pbp), passed in when it has already been worked out."""
    done = sched[sched.completed & (sched.week <= max_week)].copy()
    fbs = done[(done.home_division == "fbs") & (done.away_division == "fbs")].copy()
    teams = sorted(fbs_names(sched))
    teams = [t for t in teams if t in set(fbs.home_team) | set(fbs.away_team)]
    ps, pp = pool if pool is not None else pooled(sched, pbp)
    games = ps[ps.completed & (ps.week <= max_week)]
    played = sorted((set(games.home_team) | set(games.away_team)) - {POOL}) + [POOL]
    league, power = leagues_of(sched)
    L = league_design(played, league, power)
    plays = pp[pp.week <= max_week]
    drop = lambda v: v.drop(index=POOL, errors="ignore")
    eff = score_stats(efficiency(plays, games, played, L).reindex(teams))      # graded among the teams being ranked
    mar, levels = margin_rating(games, played, L)
    if H1_FBS_ONLY:      # a study setting: the first-half part from games between FBS teams only
        ft = sorted(set(fbs.home_team) | set(fbs.away_team))
        h1 = first_half_rating(pbp[pbp.week <= max_week], fbs, ft, league_design(ft, league, power) if H1_LEAGUES else None)
    else:
        h1 = first_half_rating(plays, games, played, L if H1_LEAGUES else None)
    mar, h1 = drop(mar), drop(h1)
    mar, h1 = (mar - mar.mean()).reindex(teams), (h1 - h1.mean()).reindex(teams)      # against an average FBS team
    pz = z(0.6 * eff.eff_z + 0.4 * z(mar).values)
    # put the z-score on a points scale: the slope that best maps rating gaps onto actual margins
    x = (fbs.home_team.map(pz) - fbs.away_team.map(pz)).values
    y = (fbs.home_points - fbs.away_points).clip(-35, 35).values - HFA * (~fbs.neutral_site.astype(bool)).values
    k = float((x * y).sum() / (x * x).sum())
    return {"teams": teams, "eff": eff, "mar": mar, "h1": h1, "pw": pz * k, "k": k, "done": done, "fbs": fbs, "levels": levels}


def index_z(res_z, off_z, def_z, mar_z, h1_z):
    """The LTF Index as a standard score, from its five parts."""
    W = WEIGHTS
    return z((W["res"] * res_z + W["off"] * off_z + W["def"] * def_z + W["mar"] * mar_z + W["h1"] * h1_z) / sum(W.values()))


STAT_COLS = ["o_epa", "d_epa", "o_sr", "d_sr", "o_ppd", "d_ppd", "o_ppo", "d_ppo", "o_exp", "d_exp", "o_yds", "d_yds", "d_stop", "d_hav",
             "o_ru", "d_ru", "o_pa", "d_pa", "o_sdn", "d_sdn", "o_pdn", "d_pdn"]


def stat_fields(row):
    """One team's stats in the names and units the site uses."""
    f = lambda v, n: round(float(v), n)
    return {"oepa": f(row.o_epa, 3), "depa": f(row.d_epa, 3), "osr": f(row.o_sr * 100, 1), "dsr": f(row.d_sr * 100, 1),
            "oexp": f(row.o_exp * 100, 1), "dexp": f(row.d_exp * 100, 1), "oppd": f(row.o_ppd, 2), "dppd": f(row.d_ppd, 2),
            "oppo": f(row.o_ppo, 2), "dppo": f(row.d_ppo, 2), "oyds": f(row.o_yds, 1), "dyds": f(row.d_yds, 1),
            "stop": f(row.d_stop * 100, 1), "hav": f(row.d_hav * 100, 1),
            "oru": f(row.o_ru, 3), "dru": f(row.d_ru, 3), "opa": f(row.o_pa, 3), "dpa": f(row.d_pa, 3),
            "osd": f(row.o_sdn * 100, 1), "dsd": f(row.d_sdn * 100, 1), "opd": f(row.o_pdn * 100, 1), "dpd": f(row.d_pdn * 100, 1)}


def record_parts(P, done):
    """Each team's record and the pieces of the résumé, from the power ratings P and the finished games."""
    teams, pw = P["teams"], P["pw"]
    tset = set(teams)
    pw_rank = pw.rank(ascending=False, method="min")
    ref = float(pw.sort_values(ascending=False).head(25).mean())      # a typical top-25 team
    L = {t: [] for t in teams}
    for g in done.sort_values(["week", "start_date"]).itertuples():
        neutral = bool(g.neutral_site)
        for side in ("home", "away"):
            team = g.home_team if side == "home" else g.away_team
            if team not in L:
                continue
            opp = g.away_team if side == "home" else g.home_team
            pf = g.home_points if side == "home" else g.away_points
            pa = g.away_points if side == "home" else g.home_points
            s_ = 0 if neutral else (1 if side == "home" else -1)
            r_opp = float(pw[opp]) if opp in tset else FCS_RATING
            pref = phi((ref - r_opp + s_ * HFA) / SIGMA)
            L[team].append({"wk": int(g.week), "opp": opp, "fcs": opp not in tset, "win": pf > pa, "loss": pf < pa, "pref": pref,
                            "site": "N" if neutral else ("H" if side == "home" else "A"), "conf": bool(g.conference_game)})
    rows = []
    for t in teams:
        G = L[t]
        w = sum(1 for x in G if x["win"])
        # strength of record: chance a typical top-25 team does at least this well against this schedule
        dist = np.array([1.0])
        for x in G:
            dist = np.convolve(dist, [1 - x["pref"], x["pref"]])
        sor = 1.0 - (dist[w + 1:].sum() + 0.5 * dist[w])
        qw, qlist = 0.0, []
        for x in G:
            if x["win"] and not x["fcs"]:
                rk = int(pw_rank[x["opp"]])
                base = 1.0 if rk <= 25 else (0.6 if rk <= 50 else 0.0)
                if base:
                    qw += base * {"H": 1.0, "N": 1.1, "A": 1.2}[x["site"]]
                    qlist.append(x["opp"])
        rows.append({"team": t, "w": w, "l": len(G) - w, "sor": sor, "qw": qw, "qlist": qlist,
                     "bl": sum(x["pref"] for x in G if x["loss"]), "sos": 1.0 - float(np.mean([x["pref"] for x in G]))})
    S = pd.DataFrame(rows).set_index("team")
    S["sor_z"], S["qw_z"] = z(S.sor.clip(0.002, 0.998).map(probit)), z(S.qw)
    S["mar"], S["h1"] = P["mar"].reindex(S.index), P["h1"].reindex(S.index)
    S["mar_z"], S["h1_z"] = z(S.mar), z(S.h1)
    S["res_z"] = resume_z(S.sor_z, S.qw_z, S.mar_z)
    S["off_z"], S["def_z"] = P["eff"].off_z, P["eff"].def_z
    S["idx_z"] = index_z(S.res_z, S.off_z, S.def_z, S.mar_z, S.h1_z)
    return S, ref


def snapshot(sched, pbp, W, pool=None):
    """The index's parts as they stood after week W, from games played through W only."""
    P = power_ratings(sched, pbp, W, pool)
    S, _ = record_parts(P, P["done"])
    for c_ in STAT_COLS:
        S[c_] = P["eff"][c_]
    return S


def week_in_books(sched, pbp_ids):
    """The last week that counts as played. A week turns over when nearly all of its games are final and
    their play-by-play has arrived, so the index never moves on half a Saturday. Games from a week still
    in progress show their scores and grade their picks right away, and join the ratings when the week
    turns over."""
    now, best, notes = now_utc(), None, []
    for W, g in sched.groupby("week"):
        c = g[g.completed & g.home_points.notna()]
        if not len(c):
            continue
        frac = len(c) / len(g)
        hours = (now - pd.to_datetime(g.start_date, utc=True).max()).total_seconds() / 3600
        played = frac >= 0.9 or (frac >= 0.5 and hours > 36)       # a postponed game or two does not hold the week up
        cover = float(c.game_id.isin(pbp_ids).mean())
        ready = cover >= 0.9 or hours > 60                         # past 60 hours, go with what there is
        if played and ready:
            best = int(W)
            if cover < 0.9:
                notes.append(f"week {int(W)} turned over with only {cover:.0%} of its play-by-play, since none has arrived in 60 hours")
        elif played:
            notes.append(f"week {int(W)} is played but only {cover:.0%} of its play-by-play has arrived, so it waits for the next run")
        else:
            notes.append(f"week {int(W)} is under way: {len(c)} of {len(g)} games final")
    if best is None:                                               # the season's first days
        best = int(sched[sched.completed & sched.home_points.notna()].week.min())
    return best, notes


def load_ledger():
    if not os.path.exists(LEDGER):
        return None
    with open(LEDGER, encoding="utf-8") as f:
        led = json.load(f)
    return led if led.get("season") == SEASON else None


def save_ledger(data):
    """One pick per line, in a fixed order, so the file's history shows exactly what was added and when."""
    picks = sorted(data["picks"], key=lambda q: (q["w"], q["id"]))
    dump = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
    finals = sum(1 for g in data["games"] if g["hp"] is not None)
    calls = sorted((q for q in data.get("calls", []) if not q.get("rb")), key=lambda q: (q["w"], q["k"] != "sell", q["t"]))
    out = ["{", f'"season": {SEASON},', f'"through": {data["meta"]["through"]},', f'"finals": {finals},', '"picks": [']
    out += [dump(q) + ("," if i < len(picks) - 1 else "") for i, q in enumerate(picks)]
    out += ["],", '"calls": [']
    out += [dump(q) + ("," if i < len(calls) - 1 else "") for i, q in enumerate(calls)]
    out += ["]", "}"]
    with open(LEDGER, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"ledger: {len(picks)} picks on file, {len(calls)} buy and sell calls")


# ---- buying and selling ----------------------------------------------------------------
# A team's streak says one thing and LTF's read of their next games says another. Selling: they have won three or more
# in a row, and LTF expects them to lose more than they win over their next three games. Buying: they have lost two or
# more in a row, and LTF expects them to win more than they lose. "Next three" means games against FBS teams, since LTF
# sets no line against anyone else, and late in the season the two that are left will do. This is not a new prediction.
# It is the LTF line for those games, added up team by team. The same function grades past seasons in backtest_site.py.
BUY_SELL = {"win": 3, "loss": 2, "games": 3, "least": 2}


def buy_sell(sched, W, idx, slope):
    """The two lists as they stood after week W. sched: the season's games. idx: the LTF Index after week W, by FBS team,
    in standard deviations. slope: points per standard deviation at that point of the season."""
    s = sched.sort_values(["start_date", "game_id"])
    fin = s[(s.week <= W) & s.completed.astype(bool) & s.home_points.notna()]
    res = {}
    for g in fin.itertuples():
        if g.home_team in idx.index:
            res.setdefault(g.home_team, []).append(bool(g.home_points > g.away_points))
        if g.away_team in idx.index:
            res.setdefault(g.away_team, []).append(bool(g.away_points > g.home_points))
    nxt = {}
    for g in s[(s.week > W) & s.home_team.isin(idx.index) & s.away_team.isin(idx.index)].itertuples():
        for t in (g.home_team, g.away_team):
            if len(nxt.setdefault(t, [])) < BUY_SELL["games"]:
                nxt[t].append(g)
    out = []
    for t, r in res.items():
        k = 1
        while k < len(r) and r[-k - 1] == r[-1]:
            k += 1
        st = k if r[-1] else -k
        gs = nxt.get(t, [])
        if not (st >= BUY_SELL["win"] or st <= -BUY_SELL["loss"]) or len(gs) < BUY_SELL["least"]:
            continue
        ps = []
        for g in gs:
            p = phi((slope * (idx[g.home_team] - idx[g.away_team]) + (0.0 if bool(g.neutral_site) else HFA)) / SIGMA)
            ps.append(p if g.home_team == t else 1 - p)
        x, half = sum(ps), len(ps) / 2
        kind = "sell" if st > 0 and x < half else "buy" if st < 0 and x > half else None
        if kind:
            out.append({"t": t, "k": kind, "st": int(st), "r": [int(sum(r)), int(len(r) - sum(r))], "x": round(float(x), 2),
                        "g": [[int(g.game_id), round(float(p), 3)] for g, p in zip(gs, ps)]})
    out.sort(key=lambda q: (q["k"] != "sell", -abs(q["x"] - len(q["g"]) / 2), q["t"]))
    return out


def merge_pick(a, b):
    """One game's entry from two copies of what is on file, b applied over a. When the two were made under different
    versions of the formula, the newer one is kept whole, so an old copy can never put an old number back under a new label."""
    fa, fb = a.get("f", 1), b.get("f", 1)
    if fa != fb:
        hi, lo = (a, b) if fa > fb else (b, a)
        return {**{k: v for k, v in lo.items() if k in ("sp", "fp", "sa")}, **hi}
    return {**a, **b}


def load_prev(path):
    """Read an earlier data snapshot (data.json, or the site file with the data inside it), if there is one."""
    if not path or not os.path.exists(path):
        return None
    txt = open(path, encoding="utf-8").read()
    if path.endswith(".html"):
        hit = [ln for ln in txt.split("\n") if ln.startswith("const D = ")]
        if not hit:
            return None
        txt = hit[0][len("const D = "):].rstrip().rstrip(";").replace("<\\/", "</")
    try:
        return json.loads(txt)
    except Exception:
        return None


# ---- build -----------------------------------------------------------------
def build(prev_path=None):
    sched, pbp, colors = load()
    lines = game_lines(pbp)
    api = load_api()
    A = api["data"] if api else {}
    for l in A.get("lines", []):      # fill any finished game the play-by-play feed had no closing line for
        best = None
        for p in l.get("lines") or []:
            if p.get("spread") is None:
                continue
            if p.get("provider") == "DraftKings":
                best = p
                break
            best = best or p
        if best and lines.get(l["id"], (None, None))[0] is None:
            lines[l["id"]] = (float(best["spread"]), None)
    through, week_notes = week_in_books(sched, set(pbp.game_id.unique()))
    for n_ in week_notes:
        print("note:", n_)
    pool = pooled(sched, pbp)
    P = power_ratings(sched, pbp, through, pool)
    teams, eff, mar, h1, pw, k, done = P["teams"], P["eff"], P["mar"], P["h1"], P["pw"], P["k"], P["done"]
    assert set(fbs_names(sched)) == set(teams), "an FBS team has no FBS game yet"
    conf = {}
    for r in sched.itertuples():
        if r.home_division == "fbs": conf[r.home_team] = r.home_conference
        if r.away_division == "fbs": conf[r.away_team] = r.away_conference
    R, ref = record_parts(P, done)
    R["sos_z"] = z(R.sos)
    rec_now = {t: [0, 0, 0, 0] for t in teams}      # wins, losses, conference wins, conference losses, every final counted
    for g in sched[sched.completed & sched.home_points.notna()].itertuples():
        for nm, won in ((g.home_team, g.home_points > g.away_points), (g.away_team, g.away_points > g.home_points)):
            if nm in rec_now:
                rec_now[nm][0 if won else 1] += 1
                if bool(g.conference_game):
                    rec_now[nm][2 if won else 3] += 1

    # Shown for comparison only, never part of the score: the AP poll, and the SP+ and FPI ratings the scorecard grades.
    out_rate = {}
    for key, field in (("sp", "rating"), ("fpi", "fpi")):
        col = pd.Series({r["team"]: r[field] for r in A.get(key, []) if r.get(field) is not None}, dtype=float).reindex(R.index)
        if col.notna().mean() > 0.9:
            out_rate[key] = col
    ap_rank, ap_week = {}, None
    weekly = [r for r in A.get("rankings", []) if r.get("seasonType") == "regular"]
    if weekly:
        latest = max(weekly, key=lambda r: r["week"])
        for p_ in latest["polls"]:
            if p_["poll"] == "AP Top 25":
                ap_rank = {x["school"]: int(x["rank"]) for x in p_["ranks"] if x.get("rank")}
                ap_week = int(latest["week"])

    # week-by-week history of the five parts, so the site can show movement and trends. Every week is rebuilt from the
    # games played through that week, under today's formula.
    hist = {t: [] for t in teams}
    idx_week = {}                        # the LTF Index after each week, for the buying and selling lists
    prev_stats = {}                      # last week's stat values, for trend arrows
    prev = load_prev(prev_path)
    if prev and prev.get("meta", {}).get("season") != SEASON:
        prev = None
    ledger = load_ledger()
    for W in range(2, through + 1):
        try:
            S = snapshot(sched, pbp, W, pool)
        except Exception as e:
            print("history skipped week", W, repr(e)[:100])
            continue
        if W == through:      # the history must agree with the main calculation
            gap = float((S.idx_z.reindex(R.index) - R.idx_z).abs().max())
            assert gap < 0.01, f"history and main calculation disagree by {gap}"
        if W == through - 1:
            prev_stats = {t: stat_fields(S.loc[t]) for t in S.index}
        idx_week[W] = S.idx_z.copy()
        for t in S.index:
            hist[t].append({"w": W, "r": round(float(S.res_z[t]), 3), "o": round(float(S.off_z[t]), 3), "d": round(float(S.def_z[t]), 3),
                            "m": round(float(S.mar_z[t]), 3), "f": round(float(S.h1_z[t]), 3), "rec": f"{int(S.w[t])}-{int(S.l[t])}"})

    cinfo = colors.drop_duplicates("school").set_index("school")
    cinfo = cinfo.rename(index={v: k2 for k2, v in COLOR_ALIAS.items() if v in cinfo.index and k2 not in cinfo.index})
    close = {}                           # record in games decided by 8 points or fewer
    for g in done.itertuples():
        if abs(g.home_points - g.away_points) <= 8:
            for nm, won in ((g.home_team, g.home_points > g.away_points), (g.away_team, g.away_points > g.home_points)):
                c_ = close.setdefault(nm, [0, 0]); c_[0] += int(won); c_[1] += 1

    out_teams = []
    for t in teams:
        c = conf[t]
        tier = "P4" if (c in POWER or t == "Notre Dame") else "G6"
        col = cinfo.color.get(t) if t in cinfo.index else None
        ab = cinfo.abbreviation.get(t) if t in cinfo.index else None
        alt = cinfo.alt_color.get(t) if t in cinfo.index and "alt_color" in cinfo.columns else None
        lg_ = cinfo.logo.get(t) if t in cinfo.index and "logo" in cinfo.columns else None
        lg_ = re.search(r"/(\d+)\.png", lg_) if isinstance(lg_, str) else None       # the id in the public logo address
        out_teams.append({
            "n": t, "ab": ab.strip() if isinstance(ab, str) else t[:4].upper().strip(),
            "c": CONF_SHORT.get(c, c), "tier": tier, "col": col if isinstance(col, str) else "#888888",
            "alt": alt if isinstance(alt, str) else None, "lg": int(lg_.group(1)) if lg_ else None,
            "w": rec_now[t][0], "l": rec_now[t][1], "cw": rec_now[t][2], "cl": rec_now[t][3],
            "z": {"res": round(float(R.res_z[t]), 4), "off": round(float(R.off_z[t]), 4), "def": round(float(R.def_z[t]), 4),
                  "mar": round(float(R.mar_z[t]), 4), "h1": round(float(R.h1_z[t]), 4)},
            "d": {"sor": round(float(R.sor[t]) * 100, 1), "qw": R.qlist[t], "bl": round(float(R.bl[t]), 2),
                  "sos": round(float(R.sos[t]) * 100, 1), "mar": round(float(mar[t]), 1), "h1": round(float(h1[t]), 1),
                  "pw": round(float(pw[t]), 2), "apr": ap_rank.get(t),
                  "st": round(float(eff.st[t]), 2), "dpg": round(float(eff.dpg[t]), 2),
                  "oru": round(float(eff.o_ru[t]), 3), "dru": round(float(eff.d_ru[t]), 3), "opa": round(float(eff.o_pa[t]), 3), "dpa": round(float(eff.d_pa[t]), 3),
                  "osd": round(float(eff.o_sdn[t]) * 100, 1), "dsd": round(float(eff.d_sdn[t]) * 100, 1), "opd": round(float(eff.o_pdn[t]) * 100, 1), "dpd": round(float(eff.d_pdn[t]) * 100, 1),
                  "lk": {"fum": round(float(eff.fum_luck[t]), 2), "int": round(float(eff.int_luck[t]), 2), "fg": round(float(eff.fg_luck[t]), 2),
                         "fg_": [int(eff.fum_got[t]), int(eff.fum_all[t])], "ofg": [int(eff.opp_fgm[t]), int(eff.opp_fga[t])], "cl": close.get(t, [0, 0])},
                  "oppo": round(float(eff.o_ppo[t]), 2), "dppo": round(float(eff.d_ppo[t]), 2),
                  "oyds": round(float(eff.o_yds[t]), 1), "dyds": round(float(eff.d_yds[t]), 1),
                  "stop": round(float(eff.d_stop[t]) * 100, 1),
                  "oepa": round(float(eff.o_epa[t]), 3), "depa": round(float(eff.d_epa[t]), 3),
                  "osr": round(float(eff.o_sr[t]) * 100, 1), "dsr": round(float(eff.d_sr[t]) * 100, 1),
                  "oexp": round(float(eff.o_exp[t]) * 100, 1), "dexp": round(float(eff.d_exp[t]) * 100, 1),
                  "oppd": round(float(eff.o_ppd[t]), 2), "dppd": round(float(eff.d_ppd[t]), 2),
                  "hav": round(float(eff.d_hav[t]) * 100, 1)},
            "h": hist[t], "pv": prev_stats.get(t),
        })

    nxt = sched[(~sched.completed) & (sched.week > through)]      # a postponed game from an old week does not hold the calendar back
    next_week = int(nxt.week.min()) if len(nxt) else None
    games = []
    for g in sched.sort_values(["week", "start_date"]).itertuples():
        fin = bool(g.completed) and pd.notna(g.home_points)
        # The betting line is kept for finished games only, as a yardstick on the scorecard. Lines for games still to be
        # played are not put on the site.
        games.append({"id": int(g.game_id), "w": int(g.week), "d": g.start_date, "h": g.home_team, "a": g.away_team,
                      "n": bool(g.neutral_site), "c": bool(g.conference_game), "tbd": bool(g.start_time_tbd) and not fin,
                      "hp": int(g.home_points) if fin else None, "ap": int(g.away_points) if fin else None,
                      "hs": lines.get(g.game_id, (None, None))[0] if fin else None})

    by_id = {p_["id"]: dict(p_) for p_ in (prev.get("picks", []) if prev else [])}
    for p_ in (ledger.get("picks", []) if ledger else []):
        by_id[p_["id"]] = merge_pick(by_id.get(p_["id"], {}), p_) if p_["id"] in by_id else dict(p_)
    picks = sorted(by_id.values(), key=lambda q_: (q_["w"], q_["id"]))
    for q_ in picks:
        for k_ in RETIRED_KEYS:
            q_.pop(k_, None)
    now_ = now_utc()
    kick = {int(g_.game_id): pd.Timestamp(g_.start_date) for g_ in sched.itertuples()}
    unplayed = lambda gid: gid in kick and kick[gid] > now_          # nothing goes on file once a game has kicked off

    # The scorecard: what LTF says about each of next week's games, put on file before kickoff and never changed after,
    # with what SP+ and FPI say about the same game. Each is a margin for the home team in points, home field included.
    # A game goes on file once, the first time it is seen unplayed. Nothing is ever written for a game that has kicked off.
    # A number made under an earlier version of the formula is refiled under today's while the game is still unplayed. The
    # earlier number, its date and its version stay in the entry under "was", and "rf" is the moment of the refile.
    if next_week is not None:
        slope_now = SLOPE[min(max(through, min(SLOPE)), max(SLOPE))]
        today_ = today_et()
        tg = sched[(~sched.completed) & (sched.week == next_week) & (sched.home_division == "fbs") & (sched.away_division == "fbs")]
        on_file = {p_["id"]: p_ for p_ in picks}
        refiled = 0
        for g_ in tg.itertuples():
            gid = int(g_.game_id)
            if not unplayed(gid) or g_.home_team not in R.index or g_.away_team not in R.index:
                continue
            hf_ = 0.0 if bool(g_.neutral_site) else HFA
            q_ = on_file.get(gid)
            lm_ = round(float(slope_now * (R.idx_z[g_.home_team] - R.idx_z[g_.away_team]) + hf_), 1)
            if q_ is None:
                q_ = {"id": gid, "w": int(g_.week), "at": today_, "f": FORMULA, "lm": lm_}
                picks.append(q_)
            elif q_.get("f", 1) != FORMULA:
                if q_.get("lm") is not None:
                    q_["was"] = list(q_.get("was", [])) + [{"f": q_.get("f", 1), "lm": q_["lm"], "at": q_.get("at")}]
                q_.update({"lm": lm_, "at": today_, "f": FORMULA, "rf": now_.strftime("%Y-%m-%dT%H:%MZ")})
                refiled += 1
            for key_, col_ in (("sp", "sp"), ("fp", "fpi")):      # added if the outside rating was not there yet. A number already on file is never touched.
                if key_ not in q_ and col_ in out_rate and pd.notna(out_rate[col_][g_.home_team]) and pd.notna(out_rate[col_][g_.away_team]):
                    q_[key_] = round(float(out_rate[col_][g_.home_team] - out_rate[col_][g_.away_team] + hf_), 1)
        picks.sort(key=lambda q_: (q_["w"], q_["id"]))
        if refiled:
            print(f"refiled {refiled} numbers under formula {FORMULA}, before kickoff")

    # Buying and selling. The lists for the week just finished go on file before each team's next game and are never
    # changed after. A team whose next game had already kicked off cannot go on file, and the weeks from before the lists
    # were kept are rebuilt from the games played to that point. Both are marked "rb" and stay out of the ledger.
    filed = {}
    for src_ in (prev, ledger):
        for q_ in (src_.get("calls", []) if src_ else []):
            if not q_.get("rb"):
                filed[(q_["w"], q_["t"])] = dict(q_)
    calls, new_calls = [], 0
    for W in sorted(idx_week):
        if W < 3:
            continue
        for q_ in buy_sell(sched, W, idx_week[W], SLOPE[min(max(W, min(SLOPE)), max(SLOPE))]):
            key_ = (W, q_["t"])
            if key_ in filed:
                continue
            q_ = {"w": W, **q_}
            if W == through and unplayed(q_["g"][0][0]):
                q_.update({"at": today_et(), "f": FORMULA, "ft": now_.strftime("%Y-%m-%dT%H:%MZ")})
                filed[key_] = q_
                new_calls += 1
            else:
                calls.append({**q_, "rb": 1})
    calls = sorted(list(filed.values()) + calls, key=lambda q_: (q_["w"], q_["k"] != "sell", -abs(q_["x"] - len(q_["g"]) / 2), q_["t"]))
    if new_calls:
        print(f"buying and selling: {new_calls} calls put on file for the week after week {through}")

    # League strength, as the scoring-margin fit found it this season: points a game for the power tier over everyone
    # else, and each league's own level on top of its tier. Shown on the League strength page.
    lv = P["levels"] or {"tier": 0.0, "league": {}}
    leagues = {"tier": round(lv["tier"], 2), "league": {CONF_SHORT.get(c_, c_): round(v_, 2) for c_, v_ in lv["league"].items()}}

    last = sched[sched.completed & sched.home_points.notna()].start_date.max()
    last_local = pd.Timestamp(last).tz_convert("America/New_York")
    data = {
        "meta": {"season": SEASON, "through": through, "next": next_week, "lastGame": last, "lastLabel": f"{last_local.strftime('%b')} {last_local.day}", "fcs": FCS_RATING,
                 "built": today_et(), "builtAt": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"), "hfa": HFA, "sigma": SIGMA,
                 "ref": round(ref, 2), "k": round(k, 2), "games": int(len(done)), "fbsGames": int(len(P["fbs"])),
                 "lined": int(sum(1 for g in P["fbs"].game_id if lines.get(g, (None,))[0] is not None)),
                 "book": "DraftKings", "apWeek": ap_week, "wt": WEIGHTS, "formula": FORMULA, "leagues": leagues,
                 "slope": {str(k_): v_ for k_, v_ in SLOPE.items()}, "bt": BACKTEST, "cfd": CONFIDENCE, "mom": MOMENTUM, "lgc": LEAGUE_CHECK, "bs": BUYSELL, "vs": VSLINE,
                 "lastWeek": int(sched.week.max()), "api": bool(api),
                 "pulled": (lambda d: f"{d.strftime('%b')} {d.day}")(pd.Timestamp(api["pulledAt"]).tz_convert("America/New_York")) if api else None},
        "teams": out_teams, "games": games, "picks": picks, "calls": calls,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    save_ledger(data)
    print(f"wrote {OUT}: {len(out_teams)} teams, {len(done)} games through week {through}, k={k:.2f}, ref={ref:.2f}")
    return data, R, eff, pw


if __name__ == "__main__":
    fetch(refresh="--refresh" in sys.argv)
    arg = lambda flag: sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else None
    # the ledger carries everything forward; --prev also reads an older copy of the site, for moving a site over
    build(arg("--prev"))

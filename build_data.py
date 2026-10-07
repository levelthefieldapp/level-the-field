#!/usr/bin/env python3
"""
College Football Index: data pipeline
=====================================
Builds data.json, the snapshot the site reads.

Where the data comes from
-------------------------
The public sportsdataverse / cfbfastR data repositories on GitHub. These are
open mirrors built from the CollegeFootballData.com (CFBD) API and ESPN's
play-by-play feed, refreshed during the season:

  schedule + scores + Elo : sportsdataverse/cfbfastR-data  schedules/csv/cfb_schedules_<season>.csv
  play-by-play + lines    : sportsdataverse/sportsdataverse-data  release cfbfastR_cfb_pbp
  team colors             : sportsdataverse/cfbfastR-data  teams/teams_colors_logos.csv

Not in those mirrors: SP+, FPI, SRS, and lines for games not yet played. Those
come from the CollegeFootballData.com API. pull_api.py fetches them and saves
raw/cfb_api.json, and this script picks that file up:

  computer ratings : average of SP+, FPI, SRS and Elo
  upcoming games   : current market spread and total

Without that file the index still builds, with Elo alone for computer ratings.
Polls are not used.

The score has four parts, each a slider on the site:
  resume   : strength of record 65, quality wins 20, margin 15
  offense  : EPA/play 30, success rate 25, points/drive 20, points/scoring opp 10,
             explosive plays 10, yards/game 5
  defense  : EPA/play 25, success rate 20, points/drive 20, stop rate 10,
             points/scoring opp 10, explosive plays 5, havoc 5, yards/game 5
  computer : SP+, FPI, SRS, Elo

Needs: pandas, numpy, pyarrow.

Run:  python3 build_data.py                    downloads what is missing into ./raw, writes data.json
      python3 build_data.py --refresh          re-download everything first (the daily update does this)
      python3 build_data.py --prev old.html    also read picks and weekly ratings out of an older copy of the site

What carries over from one run to the next lives in ledger.json: every pick and scorecard number put on
file before kickoff, and the computer-ratings part as it stood each week. Each run reads the ledger, adds
to it, and never changes what is already there. make_site.py then turns data.json into the site.

When the week turns over
------------------------
Scores, lines and picks refresh on every run. The index itself moves once a week: a week counts when
nearly all of its games are final and their play-by-play has arrived (see week_in_books). A Tuesday or
Thursday result shows on the site at once and joins the ratings when the rest of the week is in.
"""
import json, math, os, sys, re, datetime, urllib.request
import numpy as np
import pandas as pd

SEASON = 2026
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
# The ledger is the site's memory: every pick and scorecard number put on file before kickoff, and the
# computer-ratings part as it stood each week. Each run reads it, adds to it and never rewrites what is there.
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
ALPHA_MARGIN = 1.5   # ridge strength for scoring margin
GARBAGE = {1: 43, 2: 37, 3: 27, 4: 21}

# The résumé recipe: the share each piece gets. Until October 6, 2026 it was strength of record 40, quality wins 20,
# losses 15, margin 15 and schedule strength 10. Two of those were dropped after a test on 2021 to 2025
# (research/resume_study.py): the losses piece was the win-loss record over again, and schedule strength was being
# counted twice, since strength of record already allows for who a team has played. Accuracy was unchanged.
RESUME = {"sor": 0.65, "qw": 0.20, "mar": 0.15}
# Points per one standard deviation of the index, by week of the season. Fitted on 2021-2025:
# the index frozen after week W against every later regular-season game (see the backtest).
# How the index's picks did on the next week's games across five past seasons (see the backtest).
# "cal" compares the win chance the index gave with how often that side won. "ats" is how often the index's side
# covered, by the size of its disagreement with the market. "gw" is how far one unexpected result moves a team's score,
# by the week of the game: a lot in September, about half as much by November. "w6" is the weights test on the How it works
# page. All of it comes from research/backtest_site.py, which has to be re-run whenever the index formula changes.
BACKTEST = {"seasons": "2021 to 2025", "games": 2491, "su": 71.5, "mktSu": 72.8, "miss": 12.5, "mktMiss": 12.0, "atsN": 2449, "atsAll": 51.1, "cal": [{"lo": 50, "hi": 55, "n": 355, "pred": 52.6, "act": 57.5}, {"lo": 55, "hi": 60, "n": 313, "pred": 57.5, "act": 57.8}, {"lo": 60, "hi": 65, "n": 351, "pred": 62.5, "act": 60.7}, {"lo": 65, "hi": 70, "n": 323, "pred": 67.4, "act": 71.8}, {"lo": 70, "hi": 75, "n": 253, "pred": 72.5, "act": 73.9}, {"lo": 75, "hi": 80, "n": 257, "pred": 77.6, "act": 77.0}, {"lo": 80, "hi": 85, "n": 256, "pred": 82.5, "act": 85.9}, {"lo": 85, "hi": 90, "n": 160, "pred": 87.5, "act": 84.4}, {"lo": 90, "hi": 95, "n": 141, "pred": 92.4, "act": 91.5}, {"lo": 95, "hi": 100, "n": 82, "pred": 97.0, "act": 98.8}], "conf": [{"lo": 50, "hi": 60, "label": "Toss-up", "n": 668, "act": 57.6}, {"lo": 60, "hi": 75, "label": "Lean", "n": 927, "act": 68.2}, {"lo": 75, "hi": 90, "label": "Likely", "n": 673, "act": 82.2}, {"lo": 90, "hi": 100, "label": "Very likely", "n": 223, "act": 94.2}], "ats": [{"lo": 0, "hi": 4, "label": "No real lean", "n": 1605, "hit": 50.3}, {"lo": 4, "hi": 8, "label": "Slight lean", "n": 620, "hit": 52.6}, {"lo": 8, "hi": 100, "label": "Stronger lean", "n": 224, "hit": 52.7}], "gw": {"4": 0.567, "5": 0.445, "6": 0.413, "7": 0.378, "8": 0.344, "9": 0.301, "10": 0.28, "11": 0.254}, "gamma": 0.254, "w6": {"games": 2177, "rows": [{"lab": "Résumé only", "miss": 14.0, "su": 65.8}, {"lab": "60 / 15 / 15 / 10", "miss": 13.5, "su": 68.0}, {"lab": "30 / 30 / 30 / 10", "miss": 13.2, "su": 69.7}, {"lab": "20 / 25 / 25 / 30, the LTF Index", "miss": 13.1, "su": 70.8}, {"lab": "Best fit the data could find, 10 / 25 / 20 / 45", "miss": 13.0, "su": 70.9}, {"lab": "Betting line, for comparison", "miss": 12.3, "su": 71.9}]}}
# What makes a pick more or less reliable, from the same five seasons (research/conf_study.py).
# "cf" turns the LTF line and the market line into the chance the LTF pick wins: 1 / (1 + exp(-(b0 + bm*ltf + bk*market))),
# with both lines measured in points toward the LTF pick. "mk" is how the pick did when the market agreed or disagreed
# on the winner. "hz" is how picks held up by how far ahead they were made. "steady" is favorites whose level swings least.
CONFIDENCE = {"cf": {"b0": 0.0775, "bm": 0.0084, "bk": 0.0976},
              "mk": {"agree": {"n": 2197, "pred": 72.0, "act": 74.9}, "split": {"n": 252, "pred": 56.9, "act": 43.7}},
              "hz": [{"lab": "next week", "lo": 1, "hi": 1, "n": 2451, "act": 71.6}, {"lab": "two or three weeks out", "lo": 2, "hi": 3, "n": 4856, "act": 71.1}, {"lab": "four to six weeks out", "lo": 4, "hi": 6, "n": 5608, "act": 69.9}, {"lab": "seven or more weeks out", "lo": 7, "hi": 99, "n": 3914, "act": 68.5}],
              "steady": {"n": 733, "pred": 70.9, "act": 74.2},
              "cal": [{"lo": 0, "hi": 40, "n": 44, "conf": 35.6, "act": 29.5}, {"lo": 40, "hi": 50, "n": 195, "conf": 46.1, "act": 48.2}, {"lo": 50, "hi": 60, "n": 288, "conf": 57.5, "act": 56.2}, {"lo": 60, "hi": 70, "n": 655, "conf": 64.9, "act": 64.9}, {"lo": 70, "hi": 80, "n": 468, "conf": 75.0, "act": 75.0}, {"lo": 80, "hi": 90, "n": 478, "conf": 84.6, "act": 86.0}, {"lo": 90, "hi": 100, "n": 323, "conf": 93.8, "act": 92.6}]}
SLOPE = {2: 8.13, 3: 8.13, 4: 8.53, 5: 8.9, 6: 9.18, 7: 9.49, 8: 9.74, 9: 9.92, 10: 10.33, 11: 10.57}   # points per standard deviation of the index, by week

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


# ---- load ------------------------------------------------------------------
def load():
    sched = pd.read_csv(os.path.join(RAW, "sched.csv"))
    sched = sched[sched.season_type == "regular"].copy()
    cols = ["game_id", "week", "pos_team", "def_pos_team", "home_team", "away_team", "period",
            "pos_score_diff_start", "rush", "pass", "penalty_no_play", "EPA", "success", "yards_gained",
            "sack", "int", "fumble_vec", "pass_breakup_player_name", "punt", "fg_inds",
            "drive_id", "drive_result", "formatted_spread", "over_under", "down", "yards_to_goal", "distance", "play_type"]
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


def efficiency(pbp, fbs_games, teams):
    """Opponent-adjusted offense and defense numbers for each FBS team, using only
    FBS-vs-FBS games. Garbage time is removed from everything except yards per game."""
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
        b = ridge(X, d[col].values.astype(float), d[wcol].values, ALPHA_PLAY, 2)
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
    res["off_z"] = z(0.30 * z(res.o_epa) + 0.25 * z(res.o_sr) + 0.20 * z(res.o_ppd) + 0.10 * z(res.o_ppo)
                     + 0.10 * z(res.o_exp) + 0.05 * z(res.o_yds)).values
    res["def_z"] = z(-0.25 * z(res.d_epa) - 0.20 * z(res.d_sr) - 0.20 * z(res.d_ppd) - 0.10 * z(res.d_ppo)
                     - 0.05 * z(res.d_exp) - 0.05 * z(res.d_yds)
                     + 0.10 * z(res.d_stop) + 0.05 * z(res.d_hav)).values
    res["eff_z"] = z(0.5 * res.off_z + 0.5 * res.def_z).values
    return res


def margin_rating(fbs_games, teams):
    idx = {t: i for i, t in enumerate(teams)}
    T = len(teams)
    g = fbs_games
    X = np.zeros((len(g), T))
    X[np.arange(len(g)), g.home_team.map(idx).values] = 1.0
    X[np.arange(len(g)), g.away_team.map(idx).values] = -1.0
    m = (g.home_points - g.away_points).clip(-MARGIN_CAP, MARGIN_CAP).values - HFA * (~g.neutral_site.astype(bool)).values
    b = ridge(X, m.astype(float), np.ones(len(g)), ALPHA_MARGIN, 0)
    return pd.Series(b, index=teams)


def power_ratings(sched, pbp, max_week):
    """The yardstick: a points-scale rating built from efficiency and adjusted margin,
    using completed games through max_week."""
    done = sched[sched.completed & (sched.week <= max_week)].copy()
    fbs = done[(done.home_division == "fbs") & (done.away_division == "fbs")].copy()
    teams = sorted(set(sched[sched.home_division == "fbs"].home_team) | set(sched[sched.away_division == "fbs"].away_team))
    teams = [t for t in teams if t in set(fbs.home_team) | set(fbs.away_team)]
    eff = efficiency(pbp[pbp.week <= max_week], fbs, teams)
    mar = margin_rating(fbs, teams)
    pz = z(0.6 * eff.eff_z + 0.4 * z(mar).values)
    # put the z-score on a points scale: the slope that best maps rating gaps onto actual margins
    x = (fbs.home_team.map(pz) - fbs.away_team.map(pz)).values
    y = (fbs.home_points - fbs.away_points).clip(-35, 35).values - HFA * (~fbs.neutral_site.astype(bool)).values
    k = float((x * y).sum() / (x * x).sum())
    return teams, eff, mar, pz * k, k, done, fbs


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


def snapshot(sched, pbp, W):
    """The index's parts as they stood after week W, from games played through W only.
    Computer ratings here are Elo alone, because that is the only rating with week-by-week history."""
    teams, eff, mar, pw, k, done, fbs = power_ratings(sched, pbp, W)
    tset = set(teams)
    pw_rank = pw.rank(ascending=False, method="min")
    ref = float(pw.sort_values(ascending=False).head(25).mean())
    L = {t: [] for t in teams}
    elo = {}
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
            e = g.home_postgame_elo if side == "home" else g.away_postgame_elo
            # the Elo attached to games against FCS teams is stale in the source data, so skip those rows
            if pd.notna(e) and g.home_division == "fbs" and g.away_division == "fbs":
                elo[team] = float(e)
            L[team].append((opp, pf > pa, pref, "N" if neutral else ("H" if side == "home" else "A")))
    rows = []
    for t in teams:
        G = L[t]
        w = sum(1 for x in G if x[1])
        dist = np.array([1.0])
        for x in G:
            dist = np.convolve(dist, [1 - x[2], x[2]])
        sor = 1.0 - (dist[w + 1:].sum() + 0.5 * dist[w])
        qw = 0.0
        for x in G:
            if x[1] and x[0] in tset:
                rk = int(pw_rank[x[0]])
                base = 1.0 if rk <= 25 else (0.6 if rk <= 50 else 0.0)
                qw += base * {"H": 1.0, "N": 1.1, "A": 1.2}[x[3]]
        bl = sum(x[2] for x in G if not x[1])
        rows.append({"team": t, "w": w, "l": len(G) - w, "sor": sor, "qw": qw, "bl": bl,
                     "sos": 1.0 - float(np.mean([x[2] for x in G]))})
    S = pd.DataFrame(rows).set_index("team")
    sor_z = z(S.sor.clip(0.002, 0.998).map(probit))
    S["res_z"] = resume_z(sor_z, z(S.qw), z(mar.reindex(S.index)))
    S["off_z"], S["def_z"] = eff.off_z, eff.def_z
    S["elo_z"] = z(pd.Series(elo).reindex(S.index))
    for c_ in STAT_COLS:
        S[c_] = eff[c_]
    return S


# Does momentum predict anything? Twelve seasons (research/momentum_study.py). "carry" is whether beating the spread one week
# says anything about the next. "sig" is how the team with more of each kind of momentum did against the spread, overall and
# for the strongest fifth of cases. "fav" is how LTF favorites did when hot or cold. "fix" is how much the LTF line improves
# if momentum is added to it. "upW" and "upL" are the week after an upset win or an upset loss of 7 points or more.
MOMENTUM = {"seasons": "2014 to 2025", "games": 6033, 
            "carry": {"n": 11958, "corr": 0.018, "hot": 50.2, "hotN": 3049, "cold": 50.1, "coldN": 3031}, 
            "sig": [{"k": "trend3", "n": 5596, "ats": 50.1, "top": 50.3, "nb": 1120}, {"k": "form2", "n": 5090, "ats": 50.7, "top": 50.5, "nb": 1018}, {"k": "last1", "n": 5858, "ats": 50.7, "top": 50.2, "nb": 1172}, {"k": "wstreak", "n": 5062, "ats": 50.9, "top": 51.9, "nb": 1123}, {"k": "cstreak", "n": 4825, "ats": 50.2, "top": 47.3, "nb": 1497}, {"k": "ats3", "n": 5810, "ats": 50.1, "top": 52.5, "nb": 1169}, {"k": "lastcm", "n": 5801, "ats": 50.0, "top": 49.7, "nb": 1199}, {"k": "ups3", "n": 2336, "ats": 50.2, "top": 50.2, "nb": 2336}, {"k": "prog", "n": 4707, "ats": 50.5, "top": 49.9, "nb": 942}], 
            "fav": {"cold": {"n": 595, "pred": 69.7, "act": 69.2}, "hot": {"n": 595, "pred": 71.5, "act": 73.1}, "streak": {"n": 371, "pred": 78.2, "act": 80.3}, "skid": {"n": 294, "pred": 63.8, "act": 63.3}}, 
            "fix": {"n": 2031, "gain": 0.07, "win": -0.39, "better": 5, "of": 5}, 
            "upW": {"n": 538, "ats": 50.7, "ltf": -1.5, "se": 1.1, "nl": 204, "mod": -0.8, "nm": 400, "pos": 0, "yrs": 5}, 
            "upL": {"n": 538, "ats": 52.4, "ltf": 3.1, "se": 1.1, "nl": 208, "mod": 0.7, "nm": 413, "pos": 5, "yrs": 5}, 
            "upLfix": {"n": 2150, "gain": 0.024, "win": -0.14, "better": 4, "of": 5}}

# Breakout finder (research/breakout_study.py). After weeks 4 to 7, three things marked teams the LTF Index was too low on:
# failing to cover the spread, a much higher rating before the season, and bad turnover luck. "wk" holds, for each week,
# the weight on each of the three ("c") and how the top and bottom tenth of teams by that score went on to do.
BREAKOUT = {"seasons": "2021 to 2025", "long": {"seasons": "2014 to 2025", "n": 1510}, "wk": {"4": {"c": [0.737, 1.604, 0.414], "n": 664, "corr": 0.214, "top": {"n": 68, "surprise": 3.0, "climb": 11.3, "up10": 51.5, "cover": 52.7}, "bottom": {"n": 69, "surprise": -2.7, "climb": -9.8, "down10": 39.1}, "base10": 29.4}, "5": {"c": [1.12, 0.616, 0.551], "n": 664, "corr": 0.181, "top": {"n": 68, "surprise": 3.1, "climb": 9.3, "up10": 44.1, "cover": 51.9}, "bottom": {"n": 69, "surprise": -2.8, "climb": -9.1, "down10": 40.6}, "base10": 26.2}, "6": {"c": [1.261, 0.23, 0.594], "n": 664, "corr": 0.168, "top": {"n": 68, "surprise": 2.0, "climb": 7.2, "up10": 35.3, "cover": 50.9}, "bottom": {"n": 69, "surprise": -1.8, "climb": -5.5, "down10": 34.8}, "base10": 24.4}, "7": {"c": [1.35, -0.305, 0.44], "n": 664, "corr": 0.125, "top": {"n": 68, "surprise": 1.8, "climb": 6.3, "up10": 32.4, "cover": 50.5}, "bottom": {"n": 69, "surprise": -2.0, "climb": -6.1, "down10": 34.8}, "base10": 22.0}}}
# When LTF and the prediction model are on the same side against the spread (research/agree_study.py). Against closing
# lines it is a coin flip. Against opening lines it has done better, and the line then tends to move that way.
AGREE = {"seasons": "2021 to 2025", "close": {"n": 1814, "pct": 52.4, "se": 1.2}, "close4": {"n": 436, "pct": 49.8, "se": 2.4}, "with": {"n": 606, "pct": 52.3, "se": 2.0}, "against": {"n": 927, "pct": 51.9, "se": 1.6}, "open": {"n": 1798, "pct": 53.4, "se": 1.2}, "open2": {"n": 997, "pct": 53.5, "se": 1.6, "toward": 61.1, "clv": 0.55}, "open4": {"n": 455, "pct": 52.3, "se": 2.3, "toward": 64.7, "clv": 0.81}, "ltf": {"n": 2449, "pct": 51.1, "se": 1.0}, "mod": {"n": 2449, "pct": 52.4, "se": 1.0}, "splitLtf": {"n": 635, "pct": 47.6, "se": 2.0}, "splitMod": {"n": 635, "pct": 52.4, "se": 2.0}}

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.json")     # the prediction model, fitted on 2015 to 2025

# What the model did on 6,441 games it had never seen, 2017 to 2025 (see research/). Shown on the tracker page.
RESEARCH = {"games": 6441, "seasons": "2017 to 2025", "su": 72.2, "mktSu": 73.9, "miss": 12.9, "closeMiss": 12.2, "openMiss": 12.4,
            "atsClose": [3214, 3073], "atsOpen": [2908, 2798], "gap4Close": [1217, 1241], "gap4Open": [1144, 1077],
            "p4Open": [428, 358], "lateOpen": [328, 260], "totClose": 50.3, "totOpen": 52.1, "ml": -6.5, "moveToward": 58.7, "movePts": 0.86}


def model_predict(model, sched, eff, mar, fbs, targets, prior=None):
    """Margin and total the prediction model expects for each target game (FBS against FBS), from stats to date.
    This must stay in step with research/research_model.py, which is where the model was fitted."""
    good, prior = model["good"], (prior if prior is not None else model["prior"])
    cols = list(good) + ["dpg"]
    t = eff.copy(); t["mar"] = mar
    zt = t[cols].astype(float)
    for c in cols:
        sd = zt[c].std(ddof=0)
        zt[c] = (zt[c] - zt[c].mean()) / sd if sd > 0 else 0.0
    zt = zt.fillna(0.0)
    gpf = pd.concat([fbs.home_team, fbs.away_team]).value_counts()
    rest, lastd = {}, {}
    for g in sched.sort_values("start_date").itertuples():
        d = pd.Timestamp(g.start_date)
        for nm in (g.home_team, g.away_team):
            rest[(g.game_id, nm)] = (d - lastd[nm]).days if nm in lastd else None
            lastd[nm] = d
    cm, ct = model["margin"]["coef"], model["total"]["coef"]
    out = {}
    for g in targets.itertuples():
        h, a = g.home_team, g.away_team
        if pd.isna(g.home_pregame_elo) or pd.isna(g.away_pregame_elo):
            continue
        have = h in zt.index and a in zt.index
        rel = (min(gpf.get(h, 0), 8) + min(gpf.get(a, 0), 8)) / 16.0 if have else 0.0
        f = {"elo": (g.home_pregame_elo - g.away_pregame_elo) / 25.0, "homef": 0.0 if g.neutral_site else 1.0}
        f["r_elo"] = f["elo"] * rel
        clip = lambda v: min(16, max(4, 14 if v is None else v))
        f["restd"] = clip(rest.get((g.game_id, h))) - clip(rest.get((g.game_id, a)))
        for c, sgn in good.items():
            f["r_d_" + c] = (sgn * (zt.at[h, c] - zt.at[a, c]) if have else 0.0) * rel
        for c in model["prior_cols"]:
            pv = (prior[h][c] if h in prior else -1.0) - (prior[a][c] if a in prior else -1.0)
            f["p_" + c] = pv
            f["q_p_" + c] = pv * (1 - rel)
        f["aelo"] = abs(f["elo"]); f["elosum"] = (g.home_pregame_elo + g.away_pregame_elo - 3000) / 25.0
        f["ps_off"] = (prior[h]["off_z"] if h in prior else 0.0) + (prior[a]["off_z"] if a in prior else 0.0)
        f["ps_def"] = (prior[h]["def_z"] if h in prior else 0.0) + (prior[a]["def_z"] if a in prior else 0.0)
        f["q_off"] = f["ps_off"] * (1 - rel); f["q_def"] = f["ps_def"] * (1 - rel)
        for c in model["off"] + model["def"] + ["dpg"]:
            f["rs_s_" + c] = ((zt.at[h, c] + zt.at[a, c]) if have else 0.0) * rel
        out[g.game_id] = (model["margin"]["intercept"] + sum(v * f[k] for k, v in cm.items()),
                          model["total"]["intercept"] + sum(v * f[k] for k, v in ct.items()))
    return out


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
    cmp_ = {}
    for t in data["teams"]:
        for h in t["h"]:
            if h.get("c") is not None:
                cmp_.setdefault(str(h["w"]), {})[t["n"]] = h["c"]
    dump = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
    finals = sum(1 for g in data["games"] if g["hp"] is not None)
    out = ["{", f'"season": {SEASON},', f'"through": {data["meta"]["through"]},', f'"finals": {finals},', '"picks": [']
    out += [dump(q) + ("," if i < len(picks) - 1 else "") for i, q in enumerate(picks)]
    out += ["],", '"cmp": {']
    wks = sorted(cmp_, key=int)
    out += [f'"{w}": ' + dump(cmp_[w]) + ("," if i < len(wks) - 1 else "") for i, w in enumerate(wks)]
    out += ["}", "}"]
    with open(LEDGER, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"ledger: {len(picks)} picks on file, computer ratings kept for weeks {', '.join(wks) or 'none'}")


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
    api_lines = {}                      # game id -> (home spread, total, book); DraftKings when it has one
    open_lines = {}                     # game id -> (opening home spread, opening total)
    for l in A.get("lines", []):
        best = None
        for p in l.get("lines") or []:
            if p.get("spread") is None:
                continue
            if p.get("provider") == "DraftKings":
                best = p
                break
            best = best or p
        if best:
            api_lines[l["id"]] = (float(best["spread"]), best.get("overUnder"), best.get("provider"))
            if best.get("spreadOpen") is not None:
                open_lines[l["id"]] = (float(best["spreadOpen"]), best.get("overUnderOpen"))
    for gid, (hs, ou, _) in api_lines.items():      # fill any finished game the play-by-play feed had no line for
        if lines.get(gid, (None, None))[0] is None:
            lines[gid] = (hs, float(ou) if ou else None)
    through, week_notes = week_in_books(sched, set(pbp.game_id.unique()))
    for n_ in week_notes:
        print("note:", n_)
    teams, eff, mar, pw, k, done, fbs = power_ratings(sched, pbp, through)
    all_fbs = sorted(set(sched[sched.home_division == "fbs"].home_team) | set(sched[sched.away_division == "fbs"].away_team))
    assert set(all_fbs) == set(teams), "an FBS team has no FBS game yet"
    conf = {}
    for r in sched.itertuples():
        if r.home_division == "fbs": conf[r.home_team] = r.home_conference
        if r.away_division == "fbs": conf[r.away_team] = r.away_conference

    pw_rank = pw.rank(ascending=False, method="min")
    ref = float(pw.sort_values(ascending=False).head(25).mean())   # a typical top-25 team

    def opp_rating(name):
        return float(pw[name]) if name in pw.index else FCS_RATING

    # per-team game logs
    logs = {t: [] for t in teams}
    elo = {}
    for g in done.sort_values(["week", "start_date"]).itertuples():
        hs, ou = lines.get(g.game_id, (None, None))
        neutral = bool(g.neutral_site)
        for side in ("home", "away"):
            team = g.home_team if side == "home" else g.away_team
            if team not in logs:
                continue
            opp = g.away_team if side == "home" else g.home_team
            pf = int(g.home_points if side == "home" else g.away_points)
            pa = int(g.away_points if side == "home" else g.home_points)
            site = "N" if neutral else ("H" if side == "home" else "A")
            s = 0 if neutral else (1 if side == "home" else -1)
            spr = None if hs is None else (hs if side == "home" else -hs)
            p_ref = phi((ref - opp_rating(opp) + s * HFA) / SIGMA)
            e = g.home_postgame_elo if side == "home" else g.away_postgame_elo
            # the Elo attached to games against FCS teams is stale in the source data, so skip those rows
            if pd.notna(e) and g.home_division == "fbs" and g.away_division == "fbs":
                elo[team] = float(e)
            logs[team].append({
                "wk": int(g.week), "opp": opp, "fcs": opp not in logs, "site": site, "pf": pf, "pa": pa,
                "conf": bool(g.conference_game), "spr": spr, "ou": ou, "pref": round(p_ref, 4),
            })

    rows = []
    for t in teams:
        L = logs[t]
        w = sum(1 for x in L if x["pf"] > x["pa"])
        l = len(L) - w
        # strength of record: chance a typical top-25 team does at least this well against this schedule
        dist = np.array([1.0])
        for x in L:
            dist = np.convolve(dist, [1 - x["pref"], x["pref"]])
        midp = dist[w + 1:].sum() + 0.5 * dist[w]
        sor = 1.0 - midp
        qw = 0.0
        qlist = []
        for x in L:
            if x["pf"] > x["pa"] and not x["fcs"]:
                rk = int(pw_rank[x["opp"]])
                base = 1.0 if rk <= 25 else (0.6 if rk <= 50 else 0.0)
                if base:
                    qw += base * {"H": 1.0, "N": 1.1, "A": 1.2}[x["site"]]
                    qlist.append(x["opp"])
        bl = sum(x["pref"] for x in L if x["pf"] < x["pa"])
        sos = 1.0 - float(np.mean([x["pref"] for x in L]))
        rows.append({"team": t, "w": w, "l": l, "sor": sor, "qw": qw, "bl": bl, "sos": sos,
                     "cw": sum(1 for x in L if x["conf"] and x["pf"] > x["pa"]),
                     "cl": sum(1 for x in L if x["conf"] and x["pf"] < x["pa"]), "qlist": qlist})
    R = pd.DataFrame(rows).set_index("team")
    rec_now = {t: [0, 0, 0, 0] for t in teams}      # wins, losses, conference wins, conference losses, every final counted
    for g in sched[sched.completed & sched.home_points.notna()].itertuples():
        for nm, won in ((g.home_team, g.home_points > g.away_points), (g.away_team, g.away_points > g.home_points)):
            if nm in rec_now:
                rec_now[nm][0 if won else 1] += 1
                if bool(g.conference_game):
                    rec_now[nm][2 if won else 3] += 1
    sor_z = z(R.sor.clip(0.002, 0.998).map(probit))
    R["sos_z"] = z(R.sos)
    R["mar_z"] = z(mar.reindex(R.index))
    R["res_z"] = resume_z(sor_z, z(R.qw), R.mar_z)
    R["elo"] = pd.Series(elo).reindex(R.index)
    cmp_src = {}
    for label, key, field in [("SP+", "sp", "rating"), ("FPI", "fpi", "fpi"), ("SRS", "srs", "rating")]:
        col = pd.Series({r["team"]: r[field] for r in A.get(key, []) if r.get(field) is not None},
                        dtype=float).reindex(R.index)
        if col.notna().mean() > 0.9:
            cmp_src[label] = col
            R[key] = col
    cmp_src["Elo"] = R.elo
    R["cmp_z"] = z(pd.concat([z(c) for c in cmp_src.values()], axis=1).mean(axis=1).fillna(0))


    # AP rank, shown on the site for comparison only. It is not part of the score.
    ap_rank, ap_week = {}, None
    weekly = [r for r in A.get("rankings", []) if r.get("seasonType") == "regular"]
    if weekly:
        latest = max(weekly, key=lambda r: r["week"])
        for p_ in latest["polls"]:
            if p_["poll"] == "AP Top 25":
                ap_rank = {x["school"]: int(x["rank"]) for x in p_["ranks"] if x.get("rank")}
                ap_week = int(latest["week"])

    # week-by-week history of the four parts, so the site can show movement and trends
    hist = {t: [] for t in teams}
    prev_stats = {}                      # last week's stat values, for trend arrows
    prev = load_prev(prev_path)
    if prev and prev.get("meta", {}).get("season") != SEASON:
        prev = None
    ledger = load_ledger()
    prev_c = {}
    if prev:
        for pt in prev.get("teams", []):
            for h_ in pt.get("h", []):
                if h_.get("c") is not None:
                    prev_c[(pt["n"], h_["w"])] = h_["c"]
    if ledger:                           # what the ledger holds always wins
        for w_, row_ in ledger.get("cmp", {}).items():
            for t_, c_ in row_.items():
                prev_c[(t_, int(w_))] = c_
    for W in range(2, through + 1):
        try:
            S = snapshot(sched, pbp, W)
        except Exception as e:
            print("history skipped week", W, repr(e)[:100])
            continue
        if W == through:      # the history must agree with the main calculation
            gap = max(float((S.res_z.reindex(R.index) - R.res_z).abs().max()),
                      float((S.off_z.reindex(R.index) - eff.off_z.reindex(R.index)).abs().max()))
            assert gap < 0.01, f"history and main calculation disagree by {gap}"
        if W == through - 1:
            prev_stats = {t: stat_fields(S.loc[t]) for t in S.index}
        for t in S.index:
            full = float(R.cmp_z[t]) if W == through else prev_c.get((t, W))
            hist[t].append({"w": W, "r": round(float(S.res_z[t]), 3), "o": round(float(S.off_z[t]), 3),
                            "d": round(float(S.def_z[t]), 3), "e": round(float(S.elo_z[t]), 3),
                            "c": None if full is None else round(full, 3), "rec": f"{int(S.w[t])}-{int(S.l[t])}"})

    cinfo = colors.drop_duplicates("school").set_index("school")
    cinfo = cinfo.rename(index={v: k2 for k2, v in COLOR_ALIAS.items() if v in cinfo.index and k2 not in cinfo.index})
    close = {}                           # record in games decided by 8 points or fewer
    for g in done.itertuples():
        if abs(g.home_points - g.away_points) <= 8:
            for nm, won in ((g.home_team, g.home_points > g.away_points), (g.away_team, g.away_points > g.home_points)):
                c_ = close.setdefault(nm, [0, 0]); c_[0] += int(won); c_[1] += 1
    # what the betting market thinks of each team, read back out of its own lines: the last three
    # weeks of closing spreads plus this week's, with newer lines counting for more
    mk_rows = []
    idx = {t: i for i, t in enumerate(teams)}
    upc_ = sched[(~sched.completed) & (sched.week > through)]
    next_wk_ = int(upc_.week.min()) if len(upc_) else None
    for g in sched[(sched.home_division == "fbs") & (sched.away_division == "fbs")].itertuples():
        if g.completed and g.week > through:
            hs_ = lines.get(g.game_id, (None, None))[0]; wt = 1.0
            if hs_ is None: hs_ = api_lines.get(g.game_id, (None,))[0]
        elif g.completed and through - 2 <= g.week <= through:
            hs_ = lines.get(g.game_id, (None, None))[0]; wt = {0: 0.7, 1: 0.5, 2: 0.35}[through - g.week]
        elif (not g.completed) and next_wk_ is not None and g.week == next_wk_:
            hs_ = api_lines.get(g.game_id, (None,))[0]; wt = 1.0
        else:
            continue
        if hs_ is not None and g.home_team in idx and g.away_team in idx:
            mk_rows.append((idx[g.home_team], idx[g.away_team], -float(hs_) - (0.0 if g.neutral_site else HFA), wt))
    mkt = {}
    if len(mk_rows) > len(teams):
        Xm = np.zeros((len(mk_rows), len(teams))); ym = np.zeros(len(mk_rows)); wm = np.zeros(len(mk_rows))
        for i_, (hi_, ai_, y_, w_) in enumerate(mk_rows):
            Xm[i_, hi_] = 1.0; Xm[i_, ai_] = -1.0; ym[i_] = y_; wm[i_] = w_
        bm = ridge(Xm, ym, wm, 0.3, 0)
        cnt = np.abs(Xm).sum(axis=0)
        bm = bm - bm[cnt >= 2].mean()
        mkt = {t: round(float(bm[idx[t]]), 1) for t in teams if cnt[idx[t]] >= 2}

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
            "z": {"res": round(float(R.res_z[t]), 4), "off": round(float(eff.off_z[t]), 4),
                  "def": round(float(eff.def_z[t]), 4), "cmp": round(float(R.cmp_z[t]), 4)},
            "d": {"sor": round(float(R.sor[t]) * 100, 1), "qw": R.qlist[t], "bl": round(float(R.bl[t]), 2),
                  "sos": round(float(R.sos[t]) * 100, 1), "mar": round(float(mar[t]), 1),
                  "elo": int(round(R.elo[t])), "pw": round(float(pw[t]), 2), "apr": ap_rank.get(t),
                  **{k3: round(float(R[k3][t]), 1) for k3 in ("sp", "fpi", "srs") if k3 in R and pd.notna(R[k3][t])},
                  "st": round(float(eff.st[t]), 2), "dpg": round(float(eff.dpg[t]), 2),
                  "oru": round(float(eff.o_ru[t]), 3), "dru": round(float(eff.d_ru[t]), 3), "opa": round(float(eff.o_pa[t]), 3), "dpa": round(float(eff.d_pa[t]), 3),
                  "osd": round(float(eff.o_sdn[t]) * 100, 1), "dsd": round(float(eff.d_sdn[t]) * 100, 1), "opd": round(float(eff.o_pdn[t]) * 100, 1), "dpd": round(float(eff.d_pdn[t]) * 100, 1),
                  "lk": {"fum": round(float(eff.fum_luck[t]), 2), "int": round(float(eff.int_luck[t]), 2), "fg": round(float(eff.fg_luck[t]), 2),
                         "fg_": [int(eff.fum_got[t]), int(eff.fum_all[t])], "ofg": [int(eff.opp_fgm[t]), int(eff.opp_fga[t])], "cl": close.get(t, [0, 0])},
                  "mkt": mkt.get(t),
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
        if fin:
            hs, ou = lines.get(g.game_id, (None, None))
        else:
            hs, ou, _ = api_lines.get(g.game_id, (None, None, None))
            ou = float(ou) if ou else None
        games.append({"id": int(g.game_id), "w": int(g.week), "d": g.start_date, "h": g.home_team, "a": g.away_team,
                      "n": bool(g.neutral_site), "c": bool(g.conference_game), "tbd": bool(g.start_time_tbd) and not fin,
                      "hp": int(g.home_points) if fin else None, "ap": int(g.away_points) if fin else None,
                      "hs": hs, "ou": ou, "ho": open_lines.get(g.game_id, (None, None))[0],
                      "oo": (lambda v: float(v) if v else None)(open_lines.get(g.game_id, (None, None))[1])})

    pre_ = {}      # the Elo each team carried into the season, for the breakout watch list
    for g_ in sched[(sched.home_division == "fbs") & (sched.away_division == "fbs")].sort_values(["week", "start_date"]).itertuples():
        for nm_, e_ in ((g_.home_team, g_.home_pregame_elo), (g_.away_team, g_.away_pregame_elo)):
            if nm_ not in pre_ and pd.notna(e_): pre_[nm_] = int(round(float(e_)))
    for ot_ in out_teams: ot_["d"]["pe"] = pre_.get(ot_["n"])
    model = json.load(open(MODEL)) if os.path.exists(MODEL) else None
    if model:      # where each team stood at the end of last season, by the model's power rating, for the program trend on the momentum page
        pr_ = sorted(((v_["pw"], t_) for t_, v_ in model["prior"].items() if t_ in set(teams)), reverse=True)
        ly_ = {t_: i_ + 1 for i_, (_, t_) in enumerate(pr_)}
        for ot_ in out_teams: ot_["d"]["ly"] = ly_.get(ot_["n"])
    by_id = {p_["id"]: dict(p_) for p_ in (prev.get("picks", []) if prev else [])}
    for p_ in (ledger.get("picks", []) if ledger else []):
        by_id[p_["id"]] = {**by_id.get(p_["id"], {}), **p_}
    picks = sorted(by_id.values(), key=lambda q_: (q_["w"], q_["id"]))
    now_ = now_utc()
    kick = {int(g_.game_id): pd.Timestamp(g_.start_date) for g_ in sched.itertuples()}
    unplayed = lambda gid: gid in kick and kick[gid] > now_          # nothing goes on file once a game has kicked off
    if model and next_week is not None:
        tg = sched[(~sched.completed) & (sched.week == next_week) & (sched.home_division == "fbs") & (sched.away_division == "fbs")]
        preds = model_predict(model, sched, eff, mar, fbs, tg)
        seen = {p_["id"] for p_ in picks}
        fresh = []
        for gm in games:
            if gm["id"] in preds:
                gm["mm"], gm["mt"] = round(float(preds[gm["id"]][0]), 1), round(float(preds[gm["id"]][1]), 1)
                # lock the model's view against the line available today, once, the first time a game has both
                if gm["id"] not in seen and gm["hs"] is not None and unplayed(gm["id"]):
                    fresh.append({"id": gm["id"], "w": gm["w"], "at": today_et(), "hs": gm["hs"], "ho": gm["ho"],
                                  "ou": gm["ou"], "oo": gm["oo"], "mm": gm["mm"], "mt": gm["mt"], "v": 1})
        # the totals model runs high or low as scoring changes from year to year, so measure that lean
        # against the market on every game logged so far and take it out before comparing
        both = [q_ for q_ in picks + fresh if q_.get("ou") is not None and q_.get("mt") is not None]
        lean = round(float(np.mean([q_["mt"] - q_["ou"] for q_ in both])), 2) if both else 0.0
        for q_ in fresh:
            q_["tb"] = lean
        picks += fresh

    # The scorecard: what LTF, SP+ and FPI each say about a game, put on file before kickoff and never changed after.
    # Each is a margin for the home team in points, home field included. A game already on file gets these added only
    # while it is still unplayed. Nothing is ever written for a game that has kicked off.
    if next_week is not None:
        ltf_z = z(0.20 * R.res_z + 0.25 * eff.off_z.reindex(R.index) + 0.25 * eff.def_z.reindex(R.index) + 0.30 * R.cmp_z)
        slope_now = SLOPE[min(max(through, min(SLOPE)), max(SLOPE))]
        open_ids = {int(g_.game_id): g_ for g_ in sched[~sched.completed].itertuples()}
        today_ = today_et()
        for q_ in picks:
            g_ = open_ids.get(q_["id"])
            if g_ is None or "lm" in q_ or not unplayed(q_["id"]) or g_.home_team not in ltf_z.index or g_.away_team not in ltf_z.index:
                continue
            hf_ = 0.0 if bool(g_.neutral_site) else HFA
            q_["lm"] = round(float(slope_now * (ltf_z[g_.home_team] - ltf_z[g_.away_team]) + hf_), 1)
            for key_, col_ in (("sp", "sp"), ("fp", "fpi")):
                if col_ in R and pd.notna(R[col_][g_.home_team]) and pd.notna(R[col_][g_.away_team]):
                    q_[key_] = round(float(R[col_][g_.home_team] - R[col_][g_.away_team] + hf_), 1)
            q_["sa"] = today_

    last = sched[sched.completed & sched.home_points.notna()].start_date.max()
    last_local = pd.Timestamp(last).tz_convert("America/New_York")
    data = {
        "meta": {"season": SEASON, "through": through, "next": next_week, "lastGame": last, "lastLabel": f"{last_local.strftime('%b')} {last_local.day}", "fcs": FCS_RATING,
                 "built": today_et(), "builtAt": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"), "hfa": HFA, "sigma": SIGMA,
                 "ref": round(ref, 2), "k": round(k, 2), "games": int(len(done)),
                 "lined": int(sum(1 for g in done.game_id if lines.get(g, (None,))[0] is not None)),
                 "book": "DraftKings", "cmpSrc": list(cmp_src), "apWeek": ap_week,
                 "slope": {str(k_): v_ for k_, v_ in SLOPE.items()}, "bt": BACKTEST, "cfd": CONFIDENCE, "research": RESEARCH, "mom": MOMENTUM, "brk": BREAKOUT, "agree": AGREE, "prior": (model.get("prior_season") if model else None), "model": ({"trained": model["trained_on"], "games": model["games"], "version": 1} if model else None), "lastWeek": int(sched.week.max()),
                 "api": bool(api), "talent": bool(A.get("talent")),
                 "pulled": (lambda d: f"{d.strftime('%b')} {d.day}")(pd.Timestamp(api["pulledAt"]).tz_convert("America/New_York")) if api else None},
        "teams": out_teams, "games": games, "picks": picks,
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

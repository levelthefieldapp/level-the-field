# Level the Field

College football rankings, picks and an upset watch. Every FBS team on one scale, built from this season's games and nothing else: no polls, no preseason rankings, no earlier seasons, no betting lines.

This repository holds the site and everything that keeps it current. It updates itself. Nothing here needs to be run by hand.

## What happens on its own

Twice a day from August through January, at about 7:17 in the morning and 3:17 in the afternoon Eastern, GitHub runs the update:

1. Gets scores and play-by-play from the public cfbfastR files. These are all the rankings are built from. It also gets the AP poll, SP+, FPI and closing lines from CollegeFootballData, which are shown next to the rankings for comparison and are never part of them.
2. Rebuilds every number on the site.
3. Puts the LTF number for each of next week's games on file in `ledger.json`, before kickoff, along with the week's buying and selling lists, and grades the games that have finished.
4. Builds the site: a page with its own address for every team, game, conference and section, and the picture each one shows when its link is shared.
5. Opens the new version in a browser and checks it against the ledger and the live site. If anything is wrong, it stops.
6. Publishes it.

If any step fails, nothing is published and the site keeps showing the last good version. GitHub opens a note titled "The site update failed" and emails it to the owner. The note closes itself the next time an update works.

To see whether it ran, look at the first line of the site's front page, which gives the date and time of the last update, or open the Actions tab here and look for a green check.

## The files

| File | What it is |
| --- | --- |
| `ledger.json` | The site's memory: every LTF number put on file before kickoff. The update adds to it and never changes a number once a game has kicked off. Leave it alone. If an old copy is ever uploaded over it, the next update restores what is missing from the live site. |
| `build_data.py` | Rebuilds the numbers from scores and play-by-play. The formula and what it leaves out are described at the top of the file. |
| `pull_api.py` | Gets the comparisons from CollegeFootballData: the AP poll, SP+, FPI and closing lines. If that service is down, the update carries on without them. |
| `make_site.py` | Turns the numbers and the page source into the finished site: every page, the link-preview pictures and the sitemap. |
| `check_site.py` | The last look before publishing. |
| `fetch_logos.py` | Keeps a small copy of each team's logo in `logos/`. |
| `src/` | The site itself: layout, wording, style and the share cards (`cards.js`). |
| `static/` | The icon, the general link-preview image, the not-found page and the typeface in `fonts/`. |
| `requirements.txt` | The Python libraries the update uses. |
| `.github/workflows/update.yml` | The schedule and the steps above. |

## The API key

The CollegeFootballData key lives in one place: the repository secret named `CFBD_API_KEY`, under Settings, Secrets and variables, Actions. It is never in a file. Everything in this repository is public, and a secret is the one thing that is not.

## If the site was hosted before October 7, 2026

The formula changed that day. Upload this kit over the old files, then delete `model.json` from the repository, since nothing reads it any more. Old links to the Spread, Model tracker and Reputation gap pages still open and land on the page that replaced each one.

## Changing the site

Upload the changed files over the old ones with Add file, Upload files. The update starts by itself a few seconds later and publishes the change in about three minutes.

Two settings live under Settings, Secrets and variables, Actions, on the Variables tab. Neither is a secret.

| Variable | Value | What it does |
| --- | --- | --- |
| `GOATCOUNTER` | your GoatCounter name, such as `levelthefield` | Counts page views with no cookies. Leave it out and nothing is counted. |
| `LOGOS` | `off` | Switches team logos off for every visitor. |

After adding or changing one, run the update from the Actions tab.

## Before next season

Two things are set for the 2026 season and need a new version each August: the season year at the top of `build_data.py` and `pull_api.py`, and `ledger.json`, which starts over. The numbers the site quotes about past seasons live in one marked block in `build_data.py` and are re-run with the scripts in the kit's research folder. GitHub also pauses a schedule after 60 days with no changes to the repository, so the update will need switching back on from the Actions tab.

Team names, colors and logos belong to the schools. This site is independent and is not connected to any school, conference or sportsbook. Data from the public cfbfastR data sets and the CollegeFootballData.com API.

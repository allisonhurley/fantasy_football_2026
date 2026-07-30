"""
PHASE 4: Team-level context stats
-----------------------------------
Builds a team-season table with the context fields that get joined onto
every player on that team:
    - avg_team_time_on_offense
    - odd_run / odd_throw (run vs pass tendency)
    - strength_o_line (proxy: pressure/sack rate allowed)
    - strength_of_schedule (proxy: avg opponent win % from schedule)
    - stadium_type, division, BYE  (static/reference, rarely changes)

Run AFTER 01_pull_player_season_stats.py.

Install:
    pip install nfl_data_py pandas

Output:
    team_season_context.csv
    team_static_reference.csv   (divisions + stadium type, edit by hand once)
"""

import nfl_data_py as nfl
import pandas as pd
import os

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

YEARS = list(range(2018, 2025))  # 2018 through 2024 (2025 not yet on nflverse)

# ---------------------------------------------------------------------------
# 1. PLAY-BY-PLAY -> run/pass tendency, time of possession proxy, pressure rate
# ---------------------------------------------------------------------------
print("Pulling play-by-play data (this is the slow step)...")
pbp_cols = [
    "season", "week", "posteam", "defteam", "play_type",
    "rush", "pass", "qb_dropback", "sack", "qb_hit",
    "game_seconds_remaining", "drive", "game_id",
]
pbp = nfl.import_pbp_data(YEARS, columns=pbp_cols, downcast=True)

# Keep only real offensive plays (drop kneels/spikes/no-plays etc. if flagged)
offense_plays = pbp[pbp["play_type"].isin(["run", "pass"])].copy()

# --- run/pass tendency per team-season ---
tendency = (
    offense_plays.groupby(["season", "posteam"])
    .agg(
        run_plays=("rush", "sum"),
        pass_plays=("pass", "sum"),
    )
    .reset_index()
)
tendency["total_plays"] = tendency["run_plays"] + tendency["pass_plays"]
tendency["odd_run"] = tendency["run_plays"] / tendency["total_plays"]
tendency["odd_throw"] = tendency["pass_plays"] / tendency["total_plays"]

# --- O-line proxy: sacks allowed per dropback (lower = better line) ---
oline = (
    pbp[pbp["qb_dropback"] == 1]
    .groupby(["season", "posteam"])
    .agg(dropbacks=("qb_dropback", "sum"), sacks_allowed=("sack", "sum"))
    .reset_index()
)
oline["sack_rate_allowed"] = oline["sacks_allowed"] / oline["dropbacks"]
# Convert to a 0-100 "strength" score where higher = better (invert + scale).
# This is a simple proxy, not an official grade -- swap in PFF grades here
# if you have access to them.
oline["strength_o_line"] = (
    100 * (1 - (oline["sack_rate_allowed"] - oline["sack_rate_allowed"].min())
    / (oline["sack_rate_allowed"].max() - oline["sack_rate_allowed"].min()))
)

# --- Time of possession proxy: total offensive plays run is a reasonable
#     stand-in when true TOP isn't in the columns pulled. For true TOP,
#     pull team box-score "time_of_possession" from nfl.import_schedules()
#     or ESPN's team stats endpoint instead. ---
top_proxy = (
    offense_plays.groupby(["season", "posteam", "game_id"])
    .size()
    .reset_index(name="offensive_plays_in_game")
)
avg_top_proxy = (
    top_proxy.groupby(["season", "posteam"])["offensive_plays_in_game"]
    .mean()
    .reset_index()
    .rename(columns={"offensive_plays_in_game": "avg_offensive_plays_per_game"})
)

team_context = tendency.merge(oline[["season", "posteam", "strength_o_line"]],
                               on=["season", "posteam"], how="left")
team_context = team_context.merge(avg_top_proxy, on=["season", "posteam"], how="left")
team_context = team_context.rename(columns={"posteam": "team"})

# ---------------------------------------------------------------------------
# 2. STRENGTH OF SCHEDULE (proxy from schedules + team win totals)
# ---------------------------------------------------------------------------
print("Pulling schedules for SOS...")
schedules = nfl.import_schedules(YEARS)

# Compute each team's win% per season first
home = schedules[["season", "home_team", "home_score", "away_score"]].rename(
    columns={"home_team": "team"}
)
home["win"] = (home["home_score"] > home["away_score"]).astype(int)
away = schedules[["season", "away_team", "home_score", "away_score"]].rename(
    columns={"away_team": "team"}
)
away["win"] = (away["away_score"] > away["home_score"]).astype(int)
results = pd.concat([home[["season", "team", "win"]], away[["season", "team", "win"]]])
win_pct = results.groupby(["season", "team"])["win"].mean().reset_index(name="win_pct")

# Now, for each team-season, find opponents and average their win_pct
sched_long = pd.concat([
    schedules[["season", "home_team", "away_team"]].rename(
        columns={"home_team": "team", "away_team": "opponent"}),
    schedules[["season", "home_team", "away_team"]].rename(
        columns={"away_team": "team", "home_team": "opponent"}),
])
sched_long = sched_long.merge(
    win_pct.rename(columns={"team": "opponent", "win_pct": "opp_win_pct"}),
    on=["season", "opponent"], how="left",
)
sos = (
    sched_long.groupby(["season", "team"])["opp_win_pct"]
    .mean()
    .reset_index(name="strength_of_schedule")
)

team_context = team_context.merge(sos, on=["season", "team"], how="left")

# NOTE on strength_of_schedule_2026: 2026 games haven't been played yet, so
# opponents' win_pct must come from their 2025 season instead (i.e. SOS_2026
# uses each team's 2026 schedule but 2025 opponent win rates as the proxy
# for opponent strength). Compute this separately once the 2026 schedule
# is released -- logic is the same, just point win_pct lookups at season-1.

team_context.to_csv(os.path.join(OUTPUT_DIR, "team_season_context.csv"), index=False)
print(f"Wrote team_season_context.csv with {len(team_context)} rows")

# ---------------------------------------------------------------------------
# 3. STATIC REFERENCE: division + stadium type + bye week
#    These rarely change -- build once by hand (or from ESPN team API) and
#    reuse every season. Starter template below; fill in stadium_type and
#    confirm division alignment (teams occasionally realign).
# ---------------------------------------------------------------------------
static_rows = [
    # team, division, stadium_type
    ("BUF", "AFC East", "outdoor"), ("MIA", "AFC East", "outdoor"),
    ("NE", "AFC East", "outdoor"),  ("NYJ", "AFC East", "outdoor"),
    ("BAL", "AFC North", "outdoor"), ("CIN", "AFC North", "outdoor"),
    ("CLE", "AFC North", "outdoor"), ("PIT", "AFC North", "outdoor"),
    ("HOU", "AFC South", "indoor"),  ("IND", "AFC South", "indoor"),
    ("JAX", "AFC South", "outdoor"), ("TEN", "AFC South", "outdoor"),
    ("DEN", "AFC West", "outdoor"),  ("KC", "AFC West", "outdoor"),
    ("LV", "AFC West", "indoor"),    ("LAC", "AFC West", "outdoor"),
    ("DAL", "NFC East", "indoor"),   ("NYG", "NFC East", "outdoor"),
    ("PHI", "NFC East", "outdoor"),  ("WAS", "NFC East", "outdoor"),
    ("CHI", "NFC North", "outdoor"), ("DET", "NFC North", "indoor"),
    ("GB", "NFC North", "outdoor"),  ("MIN", "NFC North", "indoor"),
    ("ATL", "NFC South", "indoor"),  ("CAR", "NFC South", "outdoor"),
    ("NO", "NFC South", "indoor"),   ("TB", "NFC South", "outdoor"),
    ("ARI", "NFC West", "indoor"),   ("LA", "NFC West", "outdoor"),
    ("SF", "NFC West", "outdoor"),   ("SEA", "NFC West", "outdoor"),
]
static_ref = pd.DataFrame(static_rows, columns=["team", "division", "stadium_type"])
static_ref.to_csv(os.path.join(OUTPUT_DIR, "team_static_reference.csv"), index=False)
print("Wrote team_static_reference.csv -- please review, some stadiums have "
      "retractable roofs (e.g. ARI, LV, DAL, HOU, ATL, LA) -- decide how you "
      "want those classified since they're technically both.")

# BYE weeks come out of nfl.import_schedules() per season -- can derive as
# "the week number 1-18 in which a team has no game_id" -- left as a join
# in the final build script since it's trivial once schedules are loaded.

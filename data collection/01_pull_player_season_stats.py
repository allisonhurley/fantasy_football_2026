"""
PHASE 3: Player-season level stats
-----------------------------------
Builds a long-format table: one row per (player, season).

Data source: nfl_data_py (wraps the free nflverse data — nflfastR play-by-play,
weekly stats, seasonal stats, and rosters). No API key needed, but you DO need
internet access to run this (pulls parquet/csv files from GitHub releases).

Install first:
    pip install nfl_data_py pandas

Run:
    python 01_pull_player_season_stats.py

Output:
    player_season_stats.csv  -> one row per player-season
"""

import nfl_data_py as nfl
import pandas as pd
import os

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
POSITIONS = ["QB", "WR", "RB", "TE"]

# nflfastR-based data reliably starts at 1999, but for "years in league" (exp)
# and manageable file sizes, pull a rolling window. Adjust as needed.
YEARS = list(range(2018, 2025))  # 2018 through 2024 seasons (2025 not yet on nflverse)

# ---------------------------------------------------------------------------
# 1. ROSTERS (gives us position, exp, team, depth chart-ish info per season)
# ---------------------------------------------------------------------------
print("Pulling seasonal rosters...")
rosters = nfl.import_seasonal_rosters(YEARS)
# Key columns typically include: season, team, position, depth_chart_position,
# player_name, player_id (gsis_id), years_exp, status, etc.
rosters = rosters[rosters["position"].isin(POSITIONS)].copy()

roster_cols = [
    "season", "team", "player_id", "player_name",
    "position", "depth_chart_position", "years_exp",
    "jersey_number", "status",
]
roster_cols = [c for c in roster_cols if c in rosters.columns]
rosters = rosters[roster_cols].drop_duplicates(subset=["season", "player_id"])

# ---------------------------------------------------------------------------
# 2. WEEKLY DATA -> aggregate to season
#    This is where rush attempts, targets, completions, YAC, YPC, TDs live.
# ---------------------------------------------------------------------------
print("Pulling weekly player stats...")
weekly = nfl.import_weekly_data(YEARS)

# Filter to only the positions we care about (weekly data includes all pos)
weekly = weekly[weekly["position"].isin(POSITIONS)].copy()

# Games played = count of weeks with any snap/stat recorded
games_played = (
    weekly.groupby(["season", "player_id"])
    .size()
    .reset_index(name="games_played")
)

# Core counting/rate stats aggregated per season.
# NOTE: column names below match nfl_data_py's weekly schema as of the
# 2024/2025 releases. Run nfl.see_weekly_cols() locally to confirm exact
# names before your first run, in case the schema has shifted.
agg_map = {
    "carries": "sum",              # rush attempts
    "rushing_yards": "sum",
    "rushing_tds": "sum",
    "targets": "sum",               # receiving targets
    "receptions": "sum",
    "receiving_yards": "sum",
    "receiving_tds": "sum",
    "receiving_yards_after_catch": "sum",
    "passing_tds": "sum",
    "completions": "sum",
    "attempts": "sum",              # pass attempts (QB)
    "passing_yards": "sum",
}
agg_map = {k: v for k, v in agg_map.items() if k in weekly.columns}

season_stats = (
    weekly.groupby(["season", "player_id", "player_name", "position", "recent_team"])
    .agg(agg_map)
    .reset_index()
    .rename(columns={"recent_team": "team", "carries": "rush_attempts", "targets": "receive_attempts"})
)

season_stats = season_stats.merge(games_played, on=["season", "player_id"], how="left")

# ---------------------------------------------------------------------------
# 3. DERIVED RATE STATS
# ---------------------------------------------------------------------------
season_stats["completion_rate"] = (
    season_stats["completions"] / season_stats["attempts"]
).where(season_stats.get("attempts", 0) > 0)

season_stats["avg_yds_per_carry"] = (
    season_stats["rushing_yards"] / season_stats["rush_attempts"]
).where(season_stats["rush_attempts"] > 0)

season_stats["avg_yds_after_catch"] = (
    season_stats["receiving_yards_after_catch"] / season_stats["receptions"]
).where(season_stats["receptions"] > 0)

season_stats["TD"] = (
    season_stats.get("rushing_tds", 0).fillna(0)
    + season_stats.get("receiving_tds", 0).fillna(0)
    + season_stats.get("passing_tds", 0).fillna(0)
)

# ---------------------------------------------------------------------------
# 4. POSSESSIONS (approximation)
#    True "possessions involved in" needs play-by-play + drive-level joins.
#    Team-level possessions per season come from Phase 4 (team context) and
#    get joined on later. Player-level "possessions" as originally requested
#    likely means TEAM possessions while that player was on offense --
#    flagging this as a design decision, see notes at bottom of file.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 5. MERGE ROSTER INFO (exp, depth_chart_position) ONTO SEASON STATS
# ---------------------------------------------------------------------------
final = season_stats.merge(
    rosters,
    on=["season", "player_id", "team", "position"],
    how="left",
    suffixes=("", "_roster"),
)

# ---------------------------------------------------------------------------
# 6. CAREER-LEVEL ROLL-UPS (games_played_total_career, avg_games_played_per_szn)
# ---------------------------------------------------------------------------
career = (
    final.groupby("player_id")
    .agg(
        games_played_total_career=("games_played", "sum"),
        seasons_in_data=("season", "nunique"),
    )
    .reset_index()
)
career["avg_games_played_per_szn"] = (
    career["games_played_total_career"] / career["seasons_in_data"]
)

final = final.merge(career, on="player_id", how="left")

# ---------------------------------------------------------------------------
# OUTPUT
# ---------------------------------------------------------------------------
final = final.sort_values(["player_name", "season"])
out_path = os.path.join(OUTPUT_DIR, "player_season_stats.csv")
final.to_csv(out_path, index=False)
print(f"Wrote {out_path} with {len(final)} rows")
print(final.head(10))

# ---------------------------------------------------------------------------
# NOTES / DECISIONS NEEDED FROM YOU:
# ---------------------------------------------------------------------------
# 1. "games_played" here = games with a recorded stat line. If you want
#    games ACTIVE ON ROSTER (including 0-stat games), we need weekly roster
#    data (nfl.import_weekly_rosters) instead/additionally.
# 2. "possessions_202x" -- please confirm definition: (a) team offensive
#    possessions in games this player played, or (b) possessions where this
#    specific player recorded a touch/target. (a) is a team-context stat
#    joined per player; (b) requires play-by-play participation data and is
#    much heavier to compute. Recommend (a) for now.
# 3. Column names in nfl_data_py's weekly dataset occasionally change
#    between versions -- if this script errors on a KeyError, run
#    `import nfl_data_py as nfl; print(nfl.see_weekly_cols())` and send me
#    the output so I can patch the column mapping.

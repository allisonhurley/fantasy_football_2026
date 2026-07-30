"""
FINAL STEP: Join player-season stats + team context + static reference
into one dataset.

Run after 01_ and 02_ scripts.

Output:
    final_player_season_dataset.csv   (long format: one row per player-season)

To get to your originally-described WIDE format (one row per player, with
TD_2023 / TD_2024 / TD_2025 as separate columns), pivot at the very end --
see the pivot section below. Long format is recommended for analysis; wide
is better for a human-readable spreadsheet.
"""

import pandas as pd
import nfl_data_py as nfl
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

players = pd.read_csv(os.path.join(DATA_DIR, "player_season_stats.csv"))
team_context = pd.read_csv(os.path.join(DATA_DIR, "team_season_context.csv"))
static_ref = pd.read_csv(os.path.join(DATA_DIR, "team_static_reference.csv"))

# ---------------------------------------------------------------------------
# BYE WEEKS (derived per team-season from schedules)
# ---------------------------------------------------------------------------
YEARS = sorted(players["season"].unique().tolist())
schedules = nfl.import_schedules(YEARS)

all_weeks = schedules[["season", "week"]].drop_duplicates()
team_weeks = pd.concat([
    schedules[["season", "week", "home_team"]].rename(columns={"home_team": "team"}),
    schedules[["season", "week", "away_team"]].rename(columns={"away_team": "team"}),
])
byes = (
    all_weeks.merge(team_weeks[["season", "team"]].drop_duplicates(), how="cross")
    if False else None  # placeholder, replaced by explicit approach below
)

# Explicit approach: for each (season, team), bye = week 1..18 not in
# that team's played weeks (regular season only, weeks <=18)
records = []
for (season, team), grp in team_weeks.groupby(["season", "team"]):
    played = set(grp["week"])
    all_reg_weeks = set(range(1, 19))
    bye_weeks = all_reg_weeks - played
    bye = min(bye_weeks) if bye_weeks else None
    records.append({"season": season, "team": team, "BYE": bye})
bye_df = pd.DataFrame(records)

# ---------------------------------------------------------------------------
# JOIN EVERYTHING
# ---------------------------------------------------------------------------
final = players.merge(team_context, on=["season", "team"], how="left")
final = final.merge(bye_df, on=["season", "team"], how="left")
final = final.merge(static_ref, on="team", how="left")

# ---------------------------------------------------------------------------
# strength_of_qb (for WR/RB/TE only)
# Proxy: starting QB's completion_rate * some weighting, or passer rating if
# available. Simple version below uses team-season QB completion rate as a
# stand-in -- swap for EPA/play or passer rating if you want something
# stronger. Computed BEFORE the team->team_2025 rename so the join key exists.
# ---------------------------------------------------------------------------
qb_strength = (
    final[final["position"] == "QB"]
    .groupby(["season", "team"])["completion_rate"]
    .mean()
    .reset_index()
    .rename(columns={"completion_rate": "strength_of_qb"})
)
final = final.merge(qb_strength, on=["season", "team"], how="left")
# Only meaningful for skill positions -- blank out for QBs themselves
final.loc[final["position"] == "QB", "strength_of_qb"] = None

# Rename for clarity per your spec
final = final.rename(columns={
    "team": "team_2025",  # NOTE: rename dynamically if season != 2025, see below
    "years_exp": "exp",
    "depth_chart_position": "pos_roster",
    "avg_offensive_plays_per_game": "avg_team_time_on_offense",
    "strength_of_schedule": "strength_of_schedule_calc",
})

# ---------------------------------------------------------------------------
# SAVE LONG FORMAT (recommended)
# ---------------------------------------------------------------------------
final.to_csv(os.path.join(DATA_DIR, "final_player_season_dataset_long.csv"), index=False)
print(f"Long format: {len(final)} rows -> final_player_season_dataset_long.csv")

# ---------------------------------------------------------------------------
# OPTIONAL: PIVOT TO WIDE FORMAT (one row per player, TD_2023/TD_2024/... cols)
# ---------------------------------------------------------------------------
metric_cols = [
    "TD", "possessions", "rush_attempts", "receive_attempts",
    "completion_rate", "avg_yds_after_catch", "avg_yds_per_carry",
    "games_played",
]
metric_cols = [c for c in metric_cols if c in final.columns]

id_cols = ["player_id", "player_name", "position"]
wide = final.pivot_table(index=id_cols, columns="season", values=metric_cols)
wide.columns = [f"{metric}_{season}" for metric, season in wide.columns]
wide = wide.reset_index()

# Bring back the "current" (most recent season) descriptive fields that
# don't vary by year in the wide view: team_2026, exp, pos_roster, etc.
most_recent = final.sort_values("season").groupby("player_id").tail(1)
descriptive_cols = [
    "player_id", "team_2025", "division", "stadium_type", "BYE", "exp",
    "pos_roster", "avg_team_time_on_offense", "strength_o_line",
    "strength_of_schedule_calc", "strength_of_qb", "odd_run", "odd_throw",
    "games_played_total_career", "avg_games_played_per_szn",
]
descriptive_cols = [c for c in descriptive_cols if c in most_recent.columns]
wide = wide.merge(most_recent[descriptive_cols], on="player_id", how="left")

wide.to_csv(os.path.join(DATA_DIR, "final_player_dataset_wide.csv"), index=False)
print(f"Wide format: {len(wide)} rows -> final_player_dataset_wide.csv")

# ---------------------------------------------------------------------------
# STILL MANUAL / TODO:
# ---------------------------------------------------------------------------
# 1. team_2026 -- 2026 rosters are still moving (FA, trades, draft). Pull
#    fresh from ESPN roster API close to the season, not from historical
#    nflverse data.
# 2. strength_of_schedule_2026 -- needs the 2026 schedule (released ~May)
#    joined against 2025 win_pct as the opponent-strength proxy. Re-run the
#    SOS block in script 02 once that schedule drops.
# 3. strength_o_line_2026 -- can't be computed from plays that haven't
#    happened; typically proxied with an early-season power ranking or last
#    year's o-line grade as a placeholder until real 2026 pbp accumulates.
# 4. pos_roster (WR1/WR2/etc) -- nflverse depth_chart_position is often
#    inconsistent/missing. For a reliable current depth chart, pull ESPN's
#    roster endpoint (site.api.espn.com/apis/site/v2/sports/football/nfl/
#    teams/{team}/depthcharts) instead and join on player name/team.

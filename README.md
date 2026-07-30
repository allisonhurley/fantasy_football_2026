# fantasy_football_2026

A fantasy football draft assistant and supporting data pipeline for the 2026
season. Two parts live in this repo:

1. **Draft app** (`fantasy-draft-app/`) — a React + Vite single-page app that
   helps you run a live draft or simulate one against auto-drafting opponents.
2. **Data collection** (`data collection/`) — Python scripts that pull NFL
   player and team stats from [nflverse](https://github.com/nflverse/nflfastR)
   via `nfl_data_py` and build analysis-ready datasets in `data/`.

---

## Draft app

Located in `fantasy-draft-app/`. Built with React 19, Vite 8, and Oxlint.

### Run it

```bash
cd fantasy-draft-app
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run lint     # oxlint
```

### Features

- **Live draft & simulator modes.** In live mode you enter every pick as it
  happens; the app auto-detects whose turn it is from your draft slot. In
  simulator mode, opponent teams auto-draft using value-over-replacement
  scoring with randomized noise so you can rehearse strategy.
- **Position-based "Best available."** Value-over-replacement is weighted by
  positional scarcity (`POS_PRIORITY`): RB/WR/TE are boosted, QB discounted,
  K/DEF deprioritized. Kickers are hard-gated out of recommendations until
  every other starter slot is filled.
- **Dual rankings.** The player table sorts by ESPN overall rank, your
  per-position rank, or the delta between them. A colored Δ chip next to each
  name flags sleepers (green, you rank higher) and market favorites (red,
  ESPN ranks higher). The profile modal shows both ranks plus a verbal label.
- **Roster-aware filtering.** Positions with 0 roster slots are hidden from
  the filter chips and the All-players table.
- **Player profiles.** Click any player to open a modal with stats, news,
  rankings comparison, and an ESPN headshot (falls back to a colored-initials
  block when no `espn_id` is available).
- **CSV upload.** Bring your own projections per position; sample data is
  preloaded for QB, RB, WR, TE, K, and DEF.
- **Bye-week conflict banner.** Warns when 3+ starters share a bye week.

### ESPN fetch script

```bash
cd fantasy-draft-app
npm run fetch:espn
```

Pulls ESPN's public fantasy rankings and athlete IDs, matches them by name to
the per-position CSVs at the repo root, and writes `espn_rank` + `espn_id`
columns in place. Any unmatched players are written to `unmatched.csv` for
review. No API key required.

### Input CSVs

Six per-position CSVs live at the repo root (`qb_ranks.csv`, `rb_ranks.csv`,
`wr_ranks.csv`, `te_ranks.csv`, `k_ranks.csv`, `def_ranks.csv`). Required
columns:

```
player, pos, team, bye_week, rank, predicted_fantasy_pts,
fantasy_pts_2025, games_played_2025, espn_rank, espn_id, news_details
```

- `rank` — your per-position rank (1 = best at the position).
- `espn_rank` — ESPN's overall rank (populated by `npm run fetch:espn`).
- `espn_id` — ESPN numeric athlete ID, used for headshot URLs
  (`https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png`).

See `PLAN.md` for the full design history.

---

## Data collection

Located in `data collection/`. Python 3 scripts that build the historical
dataset under `data/`. Run them in order — each script reads the previous
script's output.

### Setup

```bash
pip install nfl_data_py pandas requests
```

### Scripts

| # | Script | Output | Description |
|---|--------|--------|-------------|
| 01 | `01_pull_player_season_stats.py` | `data/player_season_stats.csv` | Seasonal rosters + weekly stats aggregated to one row per player-season (QB/WR/RB/TE, 2018–2024). Includes rate stats, TDs, career roll-ups. |
| 02 | `02_pull_team_context_stats.py` | `data/team_season_context.csv`, `data/team_static_reference.csv` | Play-by-play-derived team context: run/pass tendency, O-line strength proxy, time-of-possession proxy, strength of schedule. Static reference for divisions + stadium type. |
| 03 | `03_build_final_dataset.py` | `data/final_player_season_dataset_long.csv`, `data/final_player_dataset_wide.csv` | Joins player stats + team context + byes + static reference; computes `strength_of_qb` proxy. Long format (one row per player-season) and wide format (one row per player, `TD_2018`/…/`TD_2024` columns). |
| 04 | `04_add_player_images.py` | `data/final_player_dataset_with_images.csv`, `data/player_images/` | Adds an `image_url` column using nflverse headshot URLs with ESPN CDN fallback. Optionally downloads the PNGs locally (gitignored — ~1.2GB, reproducible). |

### Run

```bash
cd "data collection"
python3 01_pull_player_season_stats.py
python3 02_pull_team_context_stats.py
python3 03_build_final_dataset.py
python3 04_add_player_images.py
```

All scripts write to `../data/`. Script 02 (play-by-play pull) is the slow
step — expect several minutes. Scripts 01–04 cover 2018–2024; 2025 isn't on
nflverse yet. Bump `YEARS` in each script once it's published.

### `data/` contents

- `player_season_stats.csv` — 4,082 player-season rows.
- `team_season_context.csv` — 224 team-season rows.
- `team_static_reference.csv` — 32 teams (division + stadium type).
- `final_player_season_dataset_long.csv` — 4,082 rows, joined + enriched.
- `final_player_dataset_wide.csv` — 1,308 players, per-season metric columns.
- `final_player_dataset_with_images.csv` — long dataset + `image_url`.
- `player_images/` — 1,298 headshot PNGs (gitignored).

---

## Repository layout

```
.
├── PLAN.md                      # implementation plan + design decisions
├── README.md
├── qb_ranks.csv                 # per-position input CSVs for the draft app
├── rb_ranks.csv
├── wr_ranks.csv
├── te_ranks.csv
├── k_ranks.csv
├── def_ranks.csv
├── data collection/             # Python data pipeline (nfl_data_py)
│   ├── 01_pull_player_season_stats.py
│   ├── 02_pull_team_context_stats.py
│   ├── 03_build_final_dataset.py
│   └── 04_add_player_images.py
├── data/                        # generated datasets (committed except images)
│   ├── player_season_stats.csv
│   ├── team_season_context.csv
│   ├── team_static_reference.csv
│   ├── final_player_season_dataset_long.csv
│   ├── final_player_dataset_wide.csv
│   ├── final_player_dataset_with_images.csv
│   └── player_images/           # gitignored (~1.2GB of CDN pulls)
└── fantasy-draft-app/           # React + Vite draft assistant
    ├── scripts/fetch_espn.mjs   # ESPN rankings + ID fetcher
    └── src/App.jsx              # the app
```

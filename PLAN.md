# Fantasy Draft Assistant — Implementation Plan

## Data model decisions

- `rank` = **your predicted rank** (ordinal, 1–N per position). Already exists in CSVs.
- `espn_rank` = ESPN's overall rank (1 = best overall). New column, populated by the fetch script.
- `espn_id` = ESPN numeric athlete ID (for headshots). New column, populated by the fetch script.
- Delta = `rank` (your per-position rank) vs `espn_rank` (overall) — both ordinal, subtraction works directly. When sorted by one, the other shows as a colored chip.

---

## Part A — ESPN fetch script (new file)

**New file:** `fantasy-draft-app/scripts/fetch_espn.mjs`

Runs locally via `node scripts/fetch_espn.mjs`, writes updated CSVs back to the repo root.

**What it does:**
1. Calls ESPN's public ADP/rankings endpoint (`lm-api-reads.fantasy.espn.com/apis/v3/games/fflseasons/{season}/segments/0/leaguedefaults/3?view=kona_player_info`) — no auth needed for public league defaults view.
2. Also hits the player info endpoint to map ESPN athlete IDs → headshot URLs (or constructs headshot URLs directly from the athlete ID via the known CDN pattern: `https://a.espncdn.com/i/headshots/nfl/players/full/{id}.png`).
3. Matches ESPN players to your existing CSVs by name (fuzzy match on player name; flag any unmatched for manual review).
4. Writes enriched CSVs with two new columns: `espn_rank`, `espn_id`. Preserves all your existing columns and row order.
5. Handles K and DEF: K players use the same athlete-ID pattern; DEF uses team abbreviation → `https://a.espncdn.com/i/teamlogos/nfl/500/{teamAbbr}.png` (no `espn_id` needed, team abbrev is already in the CSV).
6. Prints a summary: how many players matched, how many unmatched, and writes an `unmatched.csv` for review if any.

**Output format** (final CSV header for all position files):
```
player,pos,team,bye_week,rank,predicted_fantasy_pts,fantasy_pts_2025,games_played_2025,espn_rank,espn_id,news_details
```

**For the current sample data:** Until you run the script with real data, sample `espn_rank` and `espn_id` values are populated with best-effort real values for the ~60 sample players so the UI is functional out of the box. You'll overwrite these with your real CSVs (post-script-run) before draft day.

**npm script addition:** Add `"fetch:espn": "node scripts/fetch_espn.mjs"` to `package.json` so you can re-run it anytime.

---

## Part B — App.jsx changes

All edits in `fantasy-draft-app/src/App.jsx` unless noted. The legacy `fantasy_draft_assistant.jsx` at repo root will be deleted (confirmed dead code — the Vite app supersedes it).

### B1. Data schema updates

- Add `espn_rank` and `espn_id` to `FIELDS` array (App.jsx:137).
- Update `buildDefaultPlayers()` (App.jsx:139-150) to carry both new fields from `SAMPLE` arrays.
- Add `espn_rank` and `espn_id` values to every row in `SAMPLE` (QB, RB, WR, TE, K, DEF).
- Update `handleUpload` CSV parser (App.jsx:307-330) to read both fields: `Number(r.espn_rank) || null`, `Number(r.espn_id) || null`.
- Update SetupScreen upload hint text (App.jsx:1006-1009) to list the new columns.

### B2. Dual-rankings UI (table)

New sort control above the player table with three options: **ESPN**, **Mine**, **Delta**.

- New state: `const [rankSort, setRankSort] = useState("espn")` (default to ESPN since that's the "market" view you're scouting against).
- `filtered` useMemo — change sort logic:
  ```js
  if (posFilter === "ALL") {
    list = [...list].sort((a, b) => {
      const av = rankSort === "espn" ? a.espn_rank : a.rank;
      const bv = rankSort === "espn" ? b.espn_rank : b.rank;
      return (av ?? 9999) - (bv ?? 9999);
    });
  } else {
    list = [...list].sort((a, b) => a.rank - b.rank);
  }
  ```
  - When `rankSort === "delta"`, sort by absolute difference `|rank - espn_rank|` descending — surfaces biggest disagreements.
- **Rank column** in table header: label changes based on `rankSort` ("ESPN RK" / "MY RK" / "DELTA"). Grid template adjusts if we show both columns on desktop (optional — see below).
- **Delta chip** next to each player name: a small colored chip showing `+3` (green, you rank higher = sleeper) or `-4` (red, ESPN ranks higher = likely gone early). Computed as `rank - espn_rank` within position context. Hidden when either value is null.
- **Desktop table layout (width permitting):** show both `ESPN RK` and `MY RK` as thin columns, with the non-active one dimmed and the delta chip in the name cell. On **mobile:** single rank column (the active sort) + delta chip only.
- Add a `RankSortToggle` component (three buttons or a segmented control) next to the filter chips.

### B3. Dual-rankings in recommendation cards & profile modal

- **Recommendation cards**: add a tiny delta chip below the existing "Rank #X · Y pts" line. E.g. `ESPN #15 · Δ +3`.
- **Profile modal**: add a "Rankings" section with two rows:
  ```
  ESPN Overall Rank     #15
  Your Position Rank    #3   (Δ +12 — you rank higher)
  ```
  Include the delta with a colored label ("Sleeper pick" / "Market favorite" / "Consensus").

### B4. Position-based "Best available" logic (original Change 1)

- Add `POS_PRIORITY` constant: `{ RB: 1.15, WR: 1.15, TE: 1.10, QB: 0.90, K: 0.50, DEF: 0.70 }`.
- In `recommendations` useMemo: multiply final `score` by `POS_PRIORITY[p.pos]`.
- Tighten need multipliers: no-need mult for QB/K/DEF goes down (0.55), for RB/WR/TE goes up (0.85).
- Mirror exactly in `pickBestFor` so simulator stays consistent.

### B5. Kickers always last (original Change 2)

- In `recommendations` and `pickBestFor`: compute `onlyKAndBenchLeft` boolean (all non-K, non-BENCH starter needs are 0).
- Filter out `p.pos === "K"` from candidates unless `onlyKAndBenchLeft` is true.
- `POS_PRIORITY.K = 0.50` is the backstop but the hard filter is the guarantee.

### B6. Hide positions with 0 roster slots (original Change 4)

- Chip list: `["QB","RB","WR","TE","K","DEF"].filter(p => (roster[p] || 0) > 0)` then prepend "ALL".
- In `filtered`: when `posFilter === "ALL"`, exclude players where `roster[p.pos] === 0`.
- Guard: if user changes roster config making current `posFilter` invalid, reset to `"ALL"`.

### B7. Player profile images (original Change 5)

- Helper function `playerImageUrl(p)`:
  - DEF: `https://a.espncdn.com/i/teamlogos/nfl/500/${p.team}.png`
  - Others: `https://a.espncdn.com/i/headshots/nfl/players/full/${p.espn_id}.png` (if `espn_id` exists, else null)
- In profile modal: add `<img>` block at top, ~96×96 rounded. `onError` hides image, falls back to a colored initials block (first letter of name on position-color background).
- V1: modal only. No thumbnails in table rows (keeps table dense).

---

## Part C — Cleanup

- Delete `fantasy_draft_assistant.jsx` (dead root-level file superseded by Vite app).
- Optionally generate `k_ranks.csv` and `def_ranks.csv` from the current inline `SAMPLE` data so all six positions have consistent, uploadable CSVs. (Currently only QB/RB/WR/TE have CSVs.)

---

## Implementation order

1. **Fetch script** (`scripts/fetch_espn.mjs`) + populate sample `espn_rank`/`espn_id`.
2. **Data schema** in App.jsx (FIELDS, SAMPLE, handleUpload, default players).
3. **B6 — hide 0-slot positions** (small, isolated).
4. **B4 + B5 — position priority + kickers last** (touch `recommendations` and `pickBestFor` together).
5. **B2 — dual-rankings table UI** (sort toggle, delta chips, columns).
6. **B3 — delta in cards + modal.**
7. **B7 — profile images.**
8. **Cleanup** (delete legacy file, generate K/DEF CSVs).
9. **Verify:** `npm run lint && npm run build` after each step; manual smoke test in browser.

---

## Verification

No test framework configured — verification is `npm run lint` (oxlint) + `npm run build` (Vite) + manual browser check after each logical chunk. Run both after each step listed above.

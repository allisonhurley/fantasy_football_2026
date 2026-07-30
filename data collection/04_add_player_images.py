"""
PHASE 5: Player headshot images
--------------------------------
Adds an `image_url` column to the final dataset, and optionally downloads
the actual image files locally.

Two sources, in priority order:
  1. nflverse roster data's `headshot_url` field (already a full CDN link,
     comes free with the roster pull you're already doing in script 01).
  2. ESPN CDN fallback, built directly from the player's ESPN athlete ID:
     https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png
     Used only for players missing a headshot_url from nflverse.

Run after 03_build_final_dataset.py.

Install:
    pip install nfl_data_py pandas requests

Output:
    final_player_dataset_with_images.csv   (adds image_url column)
    player_images/                         (optional local .png downloads)
"""

import os
import time
import pandas as pd
import requests
import nfl_data_py as nfl

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
IMAGE_DIR = os.path.join(DATA_DIR, "player_images")

YEARS = list(range(2018, 2025))  # 2018 through 2024 (2025 not yet on nflverse)
DOWNLOAD_IMAGES = True          # set False if you only want the URLs, not files

# ---------------------------------------------------------------------------
# 1. LOAD YOUR EXISTING DATASET
# ---------------------------------------------------------------------------
df = pd.read_csv(os.path.join(DATA_DIR, "final_player_season_dataset_long.csv"))

# ---------------------------------------------------------------------------
# 2. PULL HEADSHOT URLS FROM NFLVERSE ROSTERS
# ---------------------------------------------------------------------------
print("Pulling roster data for headshot URLs...")
rosters = nfl.import_seasonal_rosters(YEARS)

headshot_cols = ["season", "player_id"]
# nflverse roster tables typically expose one of these -- keep whichever exists
for candidate in ["headshot_url", "headshot", "espn_id"]:
    if candidate in rosters.columns:
        headshot_cols.append(candidate)

headshots = rosters[headshot_cols].drop_duplicates(subset=["season", "player_id"])

df = df.merge(headshots, on=["season", "player_id"], how="left")

# ---------------------------------------------------------------------------
# 3. BUILD image_url: prefer headshot_url, else build from espn_id
# ---------------------------------------------------------------------------
def resolve_image_url(row):
    if "headshot_url" in row and pd.notna(row.get("headshot_url")):
        return row["headshot_url"]
    if "espn_id" in row and pd.notna(row.get("espn_id")):
        espn_id = int(row["espn_id"])
        return f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png"
    return None

df["image_url"] = df.apply(resolve_image_url, axis=1)

missing = df["image_url"].isna().sum()
print(f"{missing} of {len(df)} rows have no resolvable image URL "
      f"(likely players nflverse doesn't have an ESPN id mapping for -- "
      f"these can be filled in manually or via nfl.import_ids() cross-reference).")

df.to_csv(os.path.join(DATA_DIR, "final_player_dataset_with_images.csv"), index=False)
print("Wrote final_player_dataset_with_images.csv")

# ---------------------------------------------------------------------------
# 4. OPTIONAL: DOWNLOAD ACTUAL IMAGE FILES LOCALLY
# ---------------------------------------------------------------------------
if DOWNLOAD_IMAGES:
    os.makedirs(IMAGE_DIR, exist_ok=True)
    unique_players = df.dropna(subset=["image_url"]).drop_duplicates("player_id")

    print(f"Downloading {len(unique_players)} unique player images to "
          f"./{IMAGE_DIR}/ ...")
    for _, row in unique_players.iterrows():
        pid = row["player_id"]
        url = row["image_url"]
        out_path = os.path.join(IMAGE_DIR, f"{pid}.png")
        if os.path.exists(out_path):
            continue  # already downloaded, skip
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                with open(out_path, "wb") as f:
                    f.write(resp.content)
            else:
                print(f"  skip {row.get('player_name', pid)}: HTTP {resp.status_code}")
        except requests.RequestException as e:
            print(f"  error {row.get('player_name', pid)}: {e}")
        time.sleep(0.05)  # light throttling, be a good citizen to ESPN's CDN

    print("Done downloading images.")

# ---------------------------------------------------------------------------
# NOTES
# ---------------------------------------------------------------------------
# 1. Filenames are keyed by nflverse player_id (gsis_id), not name -- more
#    reliable for joining back into your dataset/UI than name-based files.
# 2. If you want ESPN's own player bio page image (not just headshot), ESPN's
#    site API also returns `athlete.headshot.href` per player when you hit
#    site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team}/roster
#    -- useful if nflverse's headshot_url field is ever missing/stale.
# 3. Respect ESPN's terms of use if displaying these images publicly --
#    headshots are typically fine for personal/analytical dashboards but
#    check ESPN's media guidelines for anything commercial/public-facing.

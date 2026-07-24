#!/usr/bin/env node
// fetch_espn.mjs
// Pulls ESPN public fantasy football rankings + player IDs and enriches the
// existing per-position CSVs at the repo root with two new columns:
//   - espn_rank : ESPN overall rank (1 = best overall)
//   - espn_id   : ESPN numeric athlete ID (used for headshot URLs)
//
// Usage:  node scripts/fetch_espn.mjs
// (or)    npm run fetch:espn
//
// No API key required — uses ESPN's public league defaults endpoints.
// Run from the repo root; writes enriched CSVs in place and an unmatched.csv
// for any players that couldn't be matched by name.

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname, "..");
const CSV_DIR = REPO_ROOT;
const SEASON = process.env.ESPN_SEASON || new Date().getFullYear();

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

// ESPN public endpoints (no auth, no CORS issue when run from Node)
const RANKINGS_URL = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fflseasons/${SEASON}/segments/0/leaguedefaults/3?view=kona_player_info`;
const TEAMS_URL = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`;

// Normalized name matching — strip suffixes, punctuation, lowercase
function norm(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/jr|sr|ii|iii|iv|v$/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "fantasy-draft-assistant/1.0 (node script)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Build a lookup of ESPN player info keyed by normalized name.
// Returns: Map<normalizedName, { espnId, espnRank, pos, team }>
async function fetchEspnPlayers() {
  console.log(`Fetching ESPN rankings for season ${SEASON}...`);
  const data = await fetchJson(RANKINGS_URL);

  // The kona_player_info view returns players under players[].player
  const players = data?.players || [];
  const out = new Map();
  let rankedCount = 0;

  players.forEach((entry, i) => {
    const p = entry.player || entry;
    const espnId = p.id;
    const name = p.fullName || p.name;
    const pos = (p.defaultPosition || p.position || {}).abbreviation || "";
    const team = (p.proTeam || p.team || {}).abbreviation || "";
    // rankings come through on the player object as rankings[*].rank
    // Public ADP/rank varies year to year; we approximate overall rank by
    // the order ESPN returns them in the rankings view, falling back to
    // the array index if no explicit rank is present.
    let rank = null;
    if (Array.isArray(p.rankings) && p.rankings.length > 0) {
      rank = p.rankings[0].rank ?? p.rankings[0].overallRank ?? null;
    }
    if (rank == null) rank = i + 1;
    rankedCount += 1;

    if (name) {
      out.set(norm(name), { espnId, espnRank: rank, pos, team, rawName: name });
    }
  });

  console.log(`Loaded ${out.size} unique ESPN players (${rankedCount} ranked).`);
  return out;
}

// Parse a CSV file into { header, rows } where rows are arrays of strings.
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function csvCell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvCell).join(",");
}

async function processPosition(pos, espnMap) {
  const file = path.join(CSV_DIR, `${pos.toLowerCase()}_ranks.csv`);
  let text;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    console.warn(`No ${file} found — skipping ${pos}.`);
    return { pos, matched: 0, unmatched: [], missing: true };
  }

  const { header, rows } = parseCsv(text);
  const playerIdx = header.indexOf("player");
  if (playerIdx === -1) {
    console.warn(`${file}: no 'player' column — skipping.`);
    return { pos, matched: 0, unmatched: [], missing: false };
  }

  // Ensure espn_rank and espn_id columns exist, inserted before news_details
  // if it's present, else appended.
  let newHeader = [...header];
  const insertBefore = header.indexOf("news_details");
  if (!newHeader.includes("espn_rank")) {
    if (insertBefore === -1) newHeader.push("espn_rank");
    else newHeader.splice(insertBefore, 0, "espn_rank");
  }
  if (!newHeader.includes("espn_id")) {
    const insertAt = newHeader.indexOf("news_details");
    if (insertAt === -1) newHeader.push("espn_id");
    else newHeader.splice(insertAt, 0, "espn_id");
  }
  const espnRankIdx = newHeader.indexOf("espn_rank");
  const espnIdIdx = newHeader.indexOf("espn_id");

  let matched = 0;
  const unmatched = [];

  const newRows = rows.map((cells) => {
    const padded = [...cells];
    while (padded.length < newHeader.length) padded.push("");
    const playerName = padded[playerIdx];
    const key = norm(playerName);
    const hit = espnMap.get(key);
    const out = padded.slice(0, newHeader.length);
    if (hit) {
      out[espnRankIdx] = String(hit.espnRank);
      out[espnIdIdx] = String(hit.espnId);
      matched++;
    } else {
      out[espnRankIdx] = "";
      out[espnIdIdx] = "";
      unmatched.push(playerName);
    }
    return out;
  });

  const newText = [rowToCsv(newHeader), ...newRows.map(rowToCsv)].join("\n") + "\n";
  await fs.writeFile(file, newText, "utf8");
  console.log(`${pos}: ${matched}/${rows.length} matched, ${unmatched.length} unmatched.`);
  return { pos, matched, unmatched, missing: false };
}

async function main() {
  const espnMap = await fetchEspnPlayers();

  const results = [];
  for (const pos of POSITIONS) {
    results.push(await processPosition(pos, espnMap));
  }

  const allUnmatched = results.flatMap((r) => r.unmatched.map((name) => ({ pos: r.pos, name })));
  if (allUnmatched.length > 0) {
    const unmatchedFile = path.join(CSV_DIR, "unmatched.csv");
    const text = ["pos,player", ...allUnmatched.map((u) => `${u.pos},${csvCell(u.name)}`)].join("\n") + "\n";
    await fs.writeFile(unmatchedFile, text, "utf8");
    console.log(`\nWrote ${allUnmatched.length} unmatched players to ${unmatchedFile}.`);
  }

  const totalMatched = results.reduce((n, r) => n + r.matched, 0);
  const missing = results.filter((r) => r.missing).map((r) => r.pos);
  console.log(`\nDone. Matched ${totalMatched} players across ${POSITIONS.length} files.`);
  if (missing.length > 0) console.log(`Missing CSVs for: ${missing.join(", ")}`);
}

main().catch((err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});

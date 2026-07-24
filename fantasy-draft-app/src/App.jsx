import React, { useState, useMemo, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  Search, Upload, Settings, Users, TrendingUp, AlertTriangle,
  Plus, X, ChevronRight, Star, RotateCcw, Newspaper, ArrowLeftRight,
  Circle, CircleDot, Zap, FastForward, Dices
} from "lucide-react";

// ---------- ESPN-inspired design tokens ----------
const COLORS = {
  bg: "#EDEDED",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F6F7",
  line: "#D9DBDC",
  text: "#1A1A1A",
  muted: "#6B6E70",
  red: "#E4002B",
  redDark: "#B5001F",
  navy: "#141415",
  good: "#1E7A34",
  warn: "#C77700",
};
const POS_COLOR = {
  QB: "#7B2FF7",
  RB: "#00A868",
  WR: "#0091EA",
  TE: "#FF6B00",
  K: "#C2185B",
  DEF: "#37474F",
};

const FONT_IMPORT_ID = "fda-fonts";
function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_IMPORT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_IMPORT_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

// ---------- Sample data (placeholder — replace with your real projections before draft day) ----------
const SAMPLE = {
  QB: [
    ["Josh Allen","BUF",7,1,398.5,412.3,17,"Locked in as elite rushing/passing dual threat. No offseason surgeries reported."],
    ["Lamar Jackson","BAL",14,2,389.2,401.1,16,"Missed one game late season with knee soreness; fully cleared for offseason program."],
    ["Jayden Daniels","WAS",12,3,372.0,378.4,17,"Entering year 2, expanded route tree for weapons around him."],
    ["Patrick Mahomes","KC",10,4,365.8,358.9,17,"New OC hire expected to open up downfield passing game."],
    ["Joe Burrow","CIN",10,5,358.1,349.2,17,"Fully healthy after prior wrist injury, no limitations."],
    ["Jalen Hurts","PHI",9,6,352.4,360.7,16,"Tush push usage may decrease slightly per coaching staff comments."],
    ["C.J. Stroud","HOU",6,7,340.6,331.5,17,"Improved offensive line via free agency additions."],
    ["Justin Herbert","LAC",8,8,335.9,328.0,17,"New weapons added at WR this offseason."],
    ["Kyler Murray","ARI",11,9,318.2,309.8,16,"Camp battle for starting job not expected; entrenched starter."],
    ["Bo Nix","DEN",12,10,312.5,305.1,17,"Second-year leap candidate with weapons upgrade."],
    ["Brock Purdy","SF",9,11,308.7,300.4,15,"Coming off shoulder injury, monitor camp reps."],
    ["Anthony Richardson","IND",14,12,300.1,262.3,11,"High rushing ceiling but accuracy concerns persist."],
    ["Caleb Williams","CHI",5,13,296.4,288.9,17,"New head coach installing more QB-friendly scheme."],
    ["Dak Prescott","DAL",10,14,290.8,275.2,12,"Returning from hamstring injury, full participant in offseason work."],
    ["Trevor Lawrence","JAX",8,15,278.3,265.0,15,"New coaching staff emphasizing quick-game passing."],
  ],
  RB: [
    ["Bijan Robinson","ATL",11,1,325.4,318.2,17,"Workhorse role fully established, minimal committee usage."],
    ["Jahmyr Gibbs","DET",8,2,312.8,320.5,16,"Shares backfield but leads in high-value touches and receiving work."],
    ["Ashton Jeanty","LV",4,3,298.6,285.1,17,"Rookie year exceeded expectations; entrenched as lead back entering year 2."],
    ["Saquon Barkley","PHI",9,4,295.3,310.7,16,"Age-related regression watch, but offensive line remains elite."],
    ["De'Von Achane","MIA",12,5,288.9,275.4,15,"Explosive but has missed time with minor injuries in past two seasons."],
    ["Christian McCaffrey","SF",9,6,282.1,290.3,14,"Injury history is a real concern; monitor camp workload."],
    ["Jonathan Taylor","IND",14,7,278.5,295.8,17,"Coming off career year, contract situation resolved."],
    ["Derrick Henry","BAL",14,8,270.2,288.6,17,"Age 32, but showed no signs of slowing in prior season."],
    ["Kyren Williams","LAR",8,9,265.7,258.3,17,"Goal-line role secure, mild receiving-work upside."],
    ["Josh Jacobs","GB",5,10,260.4,268.9,17,"Featured back in run-heavy offense."],
    ["Breece Hall","NYJ",9,11,255.8,240.1,16,"New coaching staff expected to feature him more in passing game."],
    ["James Cook","BUF",7,12,248.3,252.7,17,"Extension signed, workload expected to stay stable."],
    ["Chase Brown","CIN",10,13,242.6,238.4,17,"Emerged as lead back, minimal competition on roster."],
    ["Bucky Irving","TB",9,14,238.1,245.2,16,"Efficient dual-threat back with expanding role."],
    ["Alvin Kamara","NO",11,15,225.4,230.8,15,"Aging veteran but remains involved in passing downs."],
    ["Kenneth Walker III","SEA",8,16,220.7,215.3,15,"Injury-prone but explosive when healthy."],
    ["Tony Pollard","TEN",10,17,210.2,205.6,17,"Lead back role but offense projects as pass-funnel negative game script."],
    ["Aaron Jones","MIN",6,18,205.5,212.4,13,"Timeshare back, touchdown-dependent scoring."],
    ["Isiah Pacheco","KC",10,19,198.3,190.7,12,"Returning from injury, camp health is the main question."],
    ["Rachaad White","TB",9,20,190.6,195.4,17,"Complementary back behind Irving, limited standalone value."],
  ],
  WR: [
    ["Ja'Marr Chase","CIN",10,1,335.2,342.8,17,"Elite target share with healthy Joe Burrow, no concerns."],
    ["Justin Jefferson","MIN",6,2,320.6,315.4,17,"Locked in as WR1 target hog regardless of QB play."],
    ["CeeDee Lamb","DAL",10,3,308.4,298.7,15,"Fully healthy after shoulder injury late last season."],
    ["Malik Nabers","NYG",14,4,300.1,305.9,15,"Elite target volume, offense around him remains a question."],
    ["Amon-Ra St. Brown","DET",8,5,296.8,290.2,17,"PPR floor is elite due to short-target usage."],
    ["Nico Collins","HOU",6,6,288.5,278.9,15,"Healthy entering camp after missing time to injury last year."],
    ["Puka Nacua","LAR",8,7,282.3,275.6,15,"Injury history is the main risk, otherwise elite target earner."],
    ["Brian Thomas Jr.","JAX",8,8,275.7,268.4,17,"Entering year 2 as clear WR1 in new-look offense."],
    ["A.J. Brown","PHI",9,9,270.2,255.8,15,"Reported frustration with target share resolved via offseason talks."],
    ["Drake London","ATL",11,10,265.4,260.1,17,"Red zone role expanded, consistent target hog."],
    ["Ladd McConkey","LAC",8,11,258.9,252.3,17,"Slot role secure with expanded route tree."],
    ["Tyreek Hill","MIA",12,12,250.3,220.5,13,"Coming off down year and ankle injury, upside/risk profile."],
    ["Marvin Harrison Jr.","ARI",11,13,245.6,238.2,16,"Year 2 leap candidate with improved QB chemistry."],
    ["Davante Adams","LAR",8,14,240.1,258.7,17,"Aging but remains highly efficient target earner."],
    ["DK Metcalf","PIT",9,15,235.8,225.4,16,"New team fit still developing after trade."],
    ["Terry McLaurin","WAS",12,16,230.2,240.6,17,"Consistent target share in ascending offense."],
    ["Garrett Wilson","NYJ",9,17,225.7,232.1,17,"New coaching staff installing more WR-friendly scheme."],
    ["DJ Moore","CHI",5,18,218.4,222.8,17,"Steady target earner with new coaching staff."],
    ["Jaxon Smith-Njigba","SEA",8,19,215.1,228.3,17,"Breakout campaign last season, expected lead WR role."],
    ["Mike Evans","TB",9,20,210.6,215.9,16,"Consistent touchdown producer, age-related decline risk."],
  ],
  TE: [
    ["Brock Bowers","LV",4,1,245.8,268.4,17,"Elite target volume for the position, locked in as focal point of passing game."],
    ["Trey McBride","ARI",11,2,228.3,235.7,17,"Established as top target earner in Arizona's offense."],
    ["Sam LaPorta","DET",8,3,210.5,205.2,16,"Target share dipped slightly with WR additions, still strong red zone role."],
    ["George Kittle","SF",9,4,198.7,215.6,15,"Age-related risk but remains highly involved when healthy."],
    ["Mark Andrews","BAL",14,5,185.2,178.9,15,"Touchdown-dependent scoring profile, target share modest."],
    ["T.J. Hockenson","MIN",6,6,178.6,188.3,16,"Fully healthy after prior ACL recovery."],
    ["Evan Engram","DEN",12,7,165.4,170.2,16,"Consistent target earner in new offense."],
    ["Kyle Pitts","ATL",11,8,158.9,155.4,17,"Long-awaited breakout still unrealized, boom/bust profile."],
    ["David Njoku","CLE",9,9,152.3,160.8,15,"Steady red zone role in offense-in-transition."],
    ["Dalton Kincaid","BUF",7,10,148.7,142.5,15,"Competing for targets in run-heavy offense."],
    ["Jake Ferguson","DAL",10,11,140.2,148.6,17,"Reliable underneath option, capped ceiling."],
    ["Dallas Goedert","PHI",9,12,135.6,138.4,14,"Committee role behind receivers, touchdown-dependent."],
  ],
  K: [
    ["Brandon Aubrey","DAL",10,1,152.0,158.3,17,"Elite leg strength, high-volume attempt offense."],
    ["Chris Boswell","PIT",9,2,148.5,152.1,17,"Accurate veteran in a low-scoring, field-goal-heavy offense."],
    ["Jake Bates","DET",8,3,144.2,146.8,17,"Big leg, high powered offense generates lots of attempts."],
    ["Harrison Butker","KC",10,4,140.8,138.5,17,"Consistent scorer in efficient red zone offense."],
    ["Cameron Dicker","LAC",8,5,138.1,135.9,17,"Reliable accuracy, improving offense around him."],
  ],
  DEF: [
    ["Broncos","DEN",12,1,145.2,150.4,17,"Aggressive pass rush generates high sack and turnover totals."],
    ["Eagles","PHI",9,2,140.6,138.9,17,"Deep defensive line rotation, strong takeaway numbers."],
    ["Steelers","PIT",9,3,136.3,142.7,17,"Perennially strong unit with veteran leadership."],
    ["Vikings","MIN",6,4,132.8,130.5,17,"Aggressive scheme creates frequent turnover opportunities."],
    ["49ers","SF",9,5,128.4,135.6,17,"Talented front seven, injury durability is the main risk."],
  ],
};

const FIELDS = ["player","team","bye_week","rank","predicted_fantasy_pts","fantasy_pts_2025","games_played_2025","news_details"];

function buildDefaultPlayers() {
  let id = 1;
  const out = [];
  Object.entries(SAMPLE).forEach(([pos, rows]) => {
    rows.forEach((r) => {
      const obj = { id: id++, pos };
      FIELDS.forEach((f, i) => (obj[f] = r[i]));
      out.push(obj);
    });
  });
  return out;
}

const DEFAULT_ROSTER = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 6 };
const FLEX_ELIGIBLE = ["RB", "WR", "TE"];
const POS_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BENCH"];

function buildRosterSlots(roster) {
  const slotList = [];
  POS_ORDER.forEach((type) => {
    for (let i = 0; i < (roster[type] || 0); i++) slotList.push({ type, player: null });
  });
  return slotList;
}

function fillSlots(slotList, teamPlayers) {
  const sorted = [...teamPlayers].sort((a, b) => (a._overall || 0) - (b._overall || 0));
  sorted.forEach((pl) => {
    let slot = slotList.find((s) => s.type === pl.pos && !s.player);
    if (!slot && FLEX_ELIGIBLE.includes(pl.pos)) slot = slotList.find((s) => s.type === "FLEX" && !s.player);
    if (!slot) slot = slotList.find((s) => s.type === "BENCH" && !s.player);
    if (!slot) {
      slot = { type: "OVERFLOW", player: null };
      slotList.push(slot);
    }
    slot.player = pl;
  });
  return slotList;
}

function needsFromSlots(slotList) {
  const need = {};
  ["QB", "RB", "WR", "TE", "K", "DEF"].forEach((pos) => {
    need[pos] = slotList.filter((s) => s.type === pos && !s.player).length;
  });
  need.FLEX = slotList.filter((s) => s.type === "FLEX" && !s.player).length;
  return need;
}

// ---------- Small UI atoms ----------
function PosBadge({ pos }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 32, padding: "2px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 700,
        letterSpacing: 0.4, color: "#FFFFFF", background: POS_COLOR[pos] || "#6B6E70",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {pos}
    </span>
  );
}

function Chip({ children, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700,
        border: `1.5px solid ${active ? (color || COLORS.red) : COLORS.line}`,
        background: active ? (color || COLORS.red) : "#FFFFFF",
        color: active ? "#FFFFFF" : COLORS.muted, cursor: "pointer", transition: "all .12s ease",
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ icon, text, small }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: COLORS.red }}>
      {icon}
      <span
        className="fda-display"
        style={{ fontSize: small ? 12 : 13, fontWeight: 600, letterSpacing: 0.6, color: COLORS.text }}
      >
        {text}
      </span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: COLORS.surfaceAlt, borderRadius: 6, padding: "7px 10px", border: `1px solid ${COLORS.line}` }}>
      <div style={{ fontSize: 9.5, color: COLORS.muted, letterSpacing: 0.5, marginBottom: 2, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: COLORS.text }}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{
          width: 56, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.line}`,
          borderRadius: 5, padding: "5px 7px", color: COLORS.text, fontSize: 13, textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      />
    </div>
  );
}

// ---------- Responsive hook ----------
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// ---------- Main component ----------
export default function FantasyDraftAssistant() {
  ensureFonts();
  const isMobile = useMediaQuery("(max-width: 760px)");

  const [stage, setStage] = useState("setup"); // setup | draft
  const [mode, setMode] = useState("live"); // live | simulator
  const [numTeams, setNumTeams] = useState(12);
  const [myPickSlot, setMyPickSlot] = useState(5);
  const [snake, setSnake] = useState(true);
  const [roster, setRoster] = useState(DEFAULT_ROSTER);

  const [players, setPlayers] = useState(buildDefaultPlayers());
  const [drafted, setDrafted] = useState({}); // id -> { team: slotNumber, overall }
  const [overallPick, setOverallPick] = useState(1);
  const [posFilter, setPosFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [log, setLog] = useState([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [noiseMap, setNoiseMap] = useState({});

  const rounds = useMemo(
    () => roster.QB + roster.RB + roster.WR + roster.TE + roster.FLEX + roster.K + roster.DEF + roster.BENCH,
    [roster]
  );

  // --- CSV upload ---
  const handleUpload = useCallback((posKey, file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.map((r, i) => ({
          id: `${posKey}-${Date.now()}-${i}`,
          pos: (r.pos || posKey).toUpperCase(),
          player: r.player,
          team: r.team || "",
          bye_week: Number(r.bye_week) || 0,
          rank: Number(r.rank) || i + 1,
          predicted_fantasy_pts: Number(r.predicted_fantasy_pts) || 0,
          fantasy_pts_2025: Number(r.fantasy_pts_2025) || 0,
          games_played_2025: Number(r.games_played_2025) || 0,
          news_details: r.news_details || "",
        }));
        setPlayers((prev) => [...prev.filter((p) => p.pos !== posKey), ...rows]);
        setUploadMsg(`Loaded ${rows.length} ${posKey} players.`);
      },
      error: () => setUploadMsg(`Could not parse that file. Check the column headers.`),
    });
  }, []);

  function startDraft() {
    const nm = {};
    players.forEach((p) => { nm[p.id] = 0.85 + Math.random() * 0.3; });
    setNoiseMap(nm);
    setDrafted({});
    setLog([]);
    setOverallPick(1);
    setStage("draft");
  }

  // --- Replacement baselines for value calc ---
  const baselines = useMemo(() => {
    const b = {};
    ["QB", "RB", "WR", "TE", "K", "DEF"].forEach((pos) => {
      const sorted = players.filter((p) => p.pos === pos).sort((a, c) => a.rank - c.rank);
      let starters = roster[pos] || 0;
      if (FLEX_ELIGIBLE.includes(pos)) starters += roster.FLEX / 3;
      const replacementIdx = Math.max(0, Math.round(starters * numTeams) - 1);
      const p = sorted[Math.min(replacementIdx, sorted.length - 1)];
      b[pos] = p ? p.predicted_fantasy_pts : 0;
    });
    return b;
  }, [players, roster, numTeams]);

  // --- Whose turn is it (auto-detected from pick # and my slot) ---
  const currentRound = Math.ceil(overallPick / numTeams);
  const pickInRound = overallPick - (currentRound - 1) * numTeams;
  const slotOnClock = snake && currentRound % 2 === 0 ? numTeams - pickInRound + 1 : pickInRound;
  const isMyPick = slotOnClock === myPickSlot;
  const draftOver = overallPick > rounds * numTeams;

  // --- My roster ---
  const mySlots = useMemo(() => {
    const slotList = buildRosterSlots(roster);
    const mine = players
      .filter((p) => drafted[p.id]?.team === myPickSlot)
      .map((p) => ({ ...p, _overall: drafted[p.id].overall }));
    return fillSlots(slotList, mine);
  }, [players, drafted, roster, myPickSlot]);

  const openNeeds = useMemo(() => needsFromSlots(mySlots), [mySlots]);

  // Bye week conflicts among my starters (non-bench)
  const byeConflicts = useMemo(() => {
    const starters = mySlots.filter((s) => s.type !== "BENCH" && s.type !== "OVERFLOW" && s.player);
    const byWeek = {};
    starters.forEach((s) => {
      const w = s.player.bye_week;
      byWeek[w] = byWeek[w] || [];
      byWeek[w].push(s.player);
    });
    return Object.entries(byWeek).filter(([, arr]) => arr.length >= 3);
  }, [mySlots]);

  const available = useMemo(() => players.filter((p) => !drafted[p.id]), [players, drafted]);

  const filtered = useMemo(() => {
    let list = available;
    if (posFilter !== "ALL") list = list.filter((p) => p.pos === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.player.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [available, posFilter, search]);

  const recommendations = useMemo(() => {
    const scored = available.map((p) => {
      const base = baselines[p.pos] || 0;
      const value = p.predicted_fantasy_pts - base;
      let mult = 0.7;
      if (openNeeds[p.pos] > 0) mult = 1.35;
      else if (FLEX_ELIGIBLE.includes(p.pos) && openNeeds.FLEX > 0) mult = 1.1;
      return { ...p, score: value * mult };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [available, baselines, openNeeds]);

  // draft a specific player to whichever team slot is currently on the clock
  function draftPlayer(id, teamSlot) {
    setDrafted((prev) => ({ ...prev, [id]: { team: teamSlot, overall: overallPick } }));
    const p = players.find((pl) => pl.id === id);
    setLog((prev) => [{ pick: overallPick, round: currentRound, player: p, team: teamSlot }, ...prev]);
    setOverallPick((n) => n + 1);
  }

  function undoLast() {
    if (log.length === 0) return;
    const [last, ...rest] = log;
    setDrafted((prev) => {
      const cp = { ...prev };
      delete cp[last.player.id];
      return cp;
    });
    setLog(rest);
    setOverallPick((n) => Math.max(1, n - 1));
  }

  // Best pick for an auto-drafted (simulated) team, given the current in-progress state
  function pickBestFor(teamSlot, currentDraftedMap) {
    const teamPlayers = players
      .filter((p) => currentDraftedMap[p.id]?.team === teamSlot)
      .map((p) => ({ ...p, _overall: currentDraftedMap[p.id].overall }));
    const needs = needsFromSlots(fillSlots(buildRosterSlots(roster), teamPlayers));
    const avail = players.filter((p) => !currentDraftedMap[p.id]);
    if (avail.length === 0) return null;
    let best = null;
    let bestScore = -Infinity;
    avail.forEach((p) => {
      const noise = noiseMap[p.id] ?? 1;
      const base = baselines[p.pos] || 0;
      const value = p.predicted_fantasy_pts * noise - base;
      let mult = 0.6;
      if (needs[p.pos] > 0) mult = 1.3;
      else if (FLEX_ELIGIBLE.includes(p.pos) && needs.FLEX > 0) mult = 1.05;
      const score = value * mult;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    });
    return best;
  }

  // Simulate opponent picks until it's my turn (or draft ends)
  function simulateToMyPick() {
    let curDrafted = { ...drafted };
    let curLog = [...log];
    let pick = overallPick;
    let safety = rounds * numTeams + 5;
    while (safety-- > 0) {
      if (pick > rounds * numTeams) break;
      const rnd = Math.ceil(pick / numTeams);
      const pInRnd = pick - (rnd - 1) * numTeams;
      const slot = snake && rnd % 2 === 0 ? numTeams - pInRnd + 1 : pInRnd;
      if (slot === myPickSlot) break;
      const best = pickBestFor(slot, curDrafted);
      if (!best) break;
      curDrafted = { ...curDrafted, [best.id]: { team: slot, overall: pick } };
      curLog = [{ pick, round: rnd, player: best, team: slot }, ...curLog];
      pick++;
    }
    setDrafted(curDrafted);
    setLog(curLog);
    setOverallPick(pick);
  }

  // In simulator mode, auto-advance opponents the instant it becomes their turn
  useEffect(() => {
    if (mode !== "simulator" || stage !== "draft" || draftOver) return;
    if (!isMyPick) {
      const t = setTimeout(() => simulateToMyPick(), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stage, overallPick, isMyPick, draftOver]);

  const profilePlayer = players.find((p) => p.id === profileId);

  function teamLabel(slot) {
    return slot === myPickSlot ? "You" : `Team ${slot}`;
  }

  // ---------- Render ----------
  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: COLORS.bg,
        color: COLORS.text,
        height: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: isMobile ? "auto" : "hidden",
      }}
    >
      <style>{`
        .fda-display { font-family: 'Oswald', sans-serif; text-transform: uppercase; }
        .fda-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
        .fda-scroll::-webkit-scrollbar-thumb { background: ${COLORS.line}; border-radius: 4px; }
        .fda-row:hover { background: ${COLORS.surfaceAlt} !important; }
        .fda-btn { transition: transform .1s ease, opacity .1s ease, background .12s ease; }
        .fda-btn:active { transform: scale(0.96); }
        .fda-btn:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.red}; outline-offset: 2px; }
        * { box-sizing: border-box; }
      `}</style>

      {stage === "setup" ? (
        <div className="fda-scroll" style={{ overflowY: "auto", height: "100%" }}>
          <SetupScreen
            mode={mode} setMode={setMode}
            numTeams={numTeams} setNumTeams={setNumTeams}
            myPickSlot={myPickSlot} setMyPickSlot={setMyPickSlot}
            snake={snake} setSnake={setSnake}
            roster={roster} setRoster={setRoster}
            rounds={rounds}
            handleUpload={handleUpload}
            uploadMsg={uploadMsg}
            onStart={startDraft}
          />
        </div>
      ) : (
        <>
          {/* Top nav */}
          <div
            style={{
              background: COLORS.navy, borderBottom: `3px solid ${COLORS.red}`,
              padding: isMobile ? "8px 12px" : "9px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0, gap: 8, flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="fda-display" style={{ color: "#FFFFFF", fontSize: isMobile ? 14 : 16, fontWeight: 700, letterSpacing: 1 }}>
                Fantasy Draft Assistant
              </span>
              <span
                style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 3,
                  background: mode === "simulator" ? COLORS.red : "#333", color: "#FFF",
                }}
              >
                {mode === "simulator" ? "SIMULATOR" : "LIVE DRAFT"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="fda-btn"
                onClick={undoLast}
                disabled={log.length === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 5,
                  background: "transparent", border: "1px solid #444", color: "#CCC",
                  cursor: log.length ? "pointer" : "not-allowed", fontSize: 12,
                }}
              >
                <RotateCcw size={13} /> Undo
              </button>
              <button
                className="fda-btn"
                onClick={() => setStage("setup")}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 5,
                  background: "transparent", border: "1px solid #444", color: "#CCC", cursor: "pointer", fontSize: 12,
                }}
              >
                <Settings size={13} /> Settings
              </button>
            </div>
          </div>

          {/* Draft clock */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: COLORS.surface, borderBottom: `1px solid ${COLORS.line}`,
              padding: isMobile ? "9px 12px" : "10px 18px", flexWrap: "wrap", gap: 10, flexShrink: 0,
              borderLeft: `5px solid ${isMyPick ? COLORS.red : COLORS.line}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className="fda-display" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: COLORS.red, lineHeight: 1 }}>
                {draftOver ? "DONE" : `${currentRound}.${String(pickInRound).padStart(2, "0")}`}
              </span>
              <span style={{ fontSize: 11.5, color: COLORS.muted, fontWeight: 600 }}>
                {draftOver ? "Draft complete" : `Pick #${overallPick} of ${rounds * numTeams} · Round ${currentRound} of ${rounds}`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ArrowLeftRight size={14} color={snake ? COLORS.red : COLORS.muted} />
              {!draftOver && (
                <span
                  className="fda-display"
                  style={{
                    fontSize: 13.5, fontWeight: 700, padding: "5px 12px", borderRadius: 5, letterSpacing: 0.5,
                    background: isMyPick ? COLORS.red : COLORS.surfaceAlt,
                    color: isMyPick ? "#FFFFFF" : COLORS.text,
                    border: `1px solid ${isMyPick ? COLORS.red : COLORS.line}`,
                  }}
                >
                  {isMyPick ? "On the clock: YOU" : `On the clock: ${teamLabel(slotOnClock)}`}
                </span>
              )}
            </div>
            {mode === "simulator" && !draftOver && !isMyPick && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: COLORS.muted }}>
                <Zap size={13} color={COLORS.red} /> Auto-drafting other teams…
              </div>
            )}
            {mode === "simulator" && !draftOver && isMyPick && (
              <button
                className="fda-btn"
                onClick={simulateToMyPick}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 5,
                  background: COLORS.surfaceAlt, border: `1px solid ${COLORS.line}`, color: COLORS.text,
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                <FastForward size={13} /> Skip to next opponent round after my pick
              </button>
            )}
          </div>

          {/* Bye conflicts banner */}
          {byeConflicts.length > 0 && (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                background: "#FFF4E5", borderBottom: `1px solid ${COLORS.warn}`,
                padding: isMobile ? "7px 12px" : "7px 18px", fontSize: 12.5, flexShrink: 0,
              }}
            >
              <AlertTriangle size={14} color={COLORS.warn} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                {byeConflicts.map(([week, arr]) => (
                  <span key={week} style={{ marginRight: 14 }}>
                    <strong style={{ color: COLORS.warn }}>Bye {week}:</strong>{" "}
                    {arr.map((p) => p.player).join(", ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Main content */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr", gap: isMobile ? 12 : 16, padding: isMobile ? "12px" : "14px 18px", flex: isMobile ? "none" : 1, minHeight: 0 }}>
            {/* LEFT: player pool */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* Recommendations */}
              <div style={{ marginBottom: 10, flexShrink: 0 }}>
                <SectionLabel icon={<TrendingUp size={13} />} text="Best available for your roster" small />
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }} className="fda-scroll">
                  {recommendations.map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => setProfileId(p.id)}
                      style={{
                        cursor: "pointer", flex: "0 0 auto", minWidth: 150,
                        background: COLORS.surface, border: `1px solid ${idx === 0 ? COLORS.red : COLORS.line}`,
                        borderRadius: 7, padding: "8px 10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <PosBadge pos={p.pos} />
                        {idx === 0 && <Star size={12} color={COLORS.red} fill={COLORS.red} />}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{p.player}</div>
                      <div style={{ fontSize: 10.5, color: COLORS.muted, fontVariantNumeric: "tabular-nums" }}>
                        Rank #{p.rank} · {p.predicted_fantasy_pts.toFixed(1)} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
                {["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map((pos) => (
                  <Chip key={pos} active={posFilter === pos} onClick={() => setPosFilter(pos)} color={POS_COLOR[pos]}>
                    {pos}
                  </Chip>
                ))}
                <div style={{ position: "relative", marginLeft: "auto", flex: "0 1 200px" }}>
                  <Search size={13} color={COLORS.muted} style={{ position: "absolute", left: 9, top: 8 }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search player or team"
                    style={{
                      width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.line}`,
                      borderRadius: 5, padding: "6px 8px 6px 28px", color: COLORS.text, fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              {/* Player table */}
              <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: COLORS.surface }}>
                <div
                  style={{
                    display: "grid", gridTemplateColumns: isMobile ? "34px 1fr 64px 40px" : "38px 1fr 56px 78px 78px 40px",
                    padding: isMobile ? "6px 10px" : "6px 12px", background: COLORS.surfaceAlt, fontSize: 10, color: COLORS.muted,
                    letterSpacing: 0.4, fontWeight: 700, borderBottom: `1px solid ${COLORS.line}`, flexShrink: 0,
                  }}
                >
                  <div>POS</div><div>PLAYER</div>
                  {!isMobile && <div>RK</div>}
                  <div>PROJ</div>
                  {!isMobile && <div>2025</div>}
                  <div></div>
                </div>
                <div className="fda-scroll" style={{ overflowY: "auto", flex: 1 }}>
                  {filtered.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 12.5 }}>
                      No players match. Try a different filter or search term.
                    </div>
                  )}
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      className="fda-row"
                      style={{
                        display: "grid", gridTemplateColumns: isMobile ? "34px 1fr 64px 40px" : "38px 1fr 56px 78px 78px 40px",
                        padding: isMobile ? "7px 10px" : "7px 12px", borderTop: `1px solid ${COLORS.line}`, alignItems: "center",
                        fontSize: 12.5, cursor: "pointer",
                      }}
                      onClick={() => setProfileId(p.id)}
                    >
                      <div><PosBadge pos={p.pos} /></div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 700 }}>{p.player}</span>{" "}
                        <span style={{ color: COLORS.muted, fontSize: 11 }}>{p.team} · bye {p.bye_week}</span>
                      </div>
                      {!isMobile && <div style={{ color: COLORS.muted, fontVariantNumeric: "tabular-nums" }}>#{p.rank}</div>}
                      <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{p.predicted_fantasy_pts.toFixed(1)}</div>
                      {!isMobile && <div style={{ color: COLORS.muted, fontVariantNumeric: "tabular-nums" }}>{p.fantasy_pts_2025.toFixed(1)}</div>}
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          title={isMyPick ? "Draft to your team" : `Draft to ${teamLabel(slotOnClock)}`}
                          className="fda-btn"
                          disabled={draftOver}
                          onClick={() => draftPlayer(p.id, slotOnClock)}
                          style={{
                            width: 26, height: 26, borderRadius: 5,
                            border: `1px solid ${isMyPick ? COLORS.red : COLORS.line}`,
                            background: isMyPick ? COLORS.red : "transparent",
                            color: isMyPick ? "#FFF" : COLORS.muted, cursor: draftOver ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: my roster + log */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 12 }}>
              <div style={{ flexShrink: 0 }}>
                <SectionLabel icon={<Users size={13} />} text="Your roster" small />
                <div className="fda-scroll" style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "auto", maxHeight: isMobile ? "none" : "38vh", background: COLORS.surface }}>
                  {mySlots.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                        borderTop: i === 0 ? "none" : `1px solid ${COLORS.line}`,
                        background: s.player ? "transparent" : COLORS.surfaceAlt,
                      }}
                    >
                      <span style={{ width: 42, fontSize: 9.5, color: COLORS.muted, flexShrink: 0, letterSpacing: 0.4, fontWeight: 700 }}>
                        {s.type}
                      </span>
                      {s.player ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                          <PosBadge pos={s.player.pos} />
                          <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.player.player}
                          </span>
                          <span style={{ fontSize: 10.5, color: COLORS.muted, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                            bye {s.player.bye_week}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: COLORS.muted, fontStyle: "italic" }}>Empty</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
                <SectionLabel icon={<Newspaper size={13} />} text="Draft log" small />
                <div className="fda-scroll" style={{ overflowY: "auto", flex: 1, border: `1px solid ${COLORS.line}`, borderRadius: 8, background: COLORS.surface }}>
                  {log.length === 0 && (
                    <div style={{ padding: 16, fontSize: 12, color: COLORS.muted, textAlign: "center" }}>
                      No picks yet. Draft a player to get started.
                    </div>
                  )}
                  {log.map((entry) => (
                    <div
                      key={entry.pick}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, padding: "6px 12px",
                        borderTop: `1px solid ${COLORS.line}`, fontSize: 12,
                      }}
                    >
                      <span style={{ color: COLORS.muted, width: 30, fontVariantNumeric: "tabular-nums" }}>{entry.pick}</span>
                      <PosBadge pos={entry.player.pos} />
                      <span style={{ flex: 1, fontWeight: entry.team === myPickSlot ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.player.player}
                      </span>
                      {entry.team === myPickSlot ? (
                        <span style={{ color: COLORS.red, fontSize: 10.5, fontWeight: 700 }}>YOU</span>
                      ) : (
                        <span style={{ color: COLORS.muted, fontSize: 10.5 }}>{teamLabel(entry.team)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Player profile modal */}
      {profilePlayer && (
        <div
          onClick={() => setProfileId(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10,
              maxWidth: 400, width: "100%", padding: 22, boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <PosBadge pos={profilePlayer.pos} />
                <h3 className="fda-display" style={{ fontSize: 21, margin: "8px 0 2px", fontWeight: 700 }}>
                  {profilePlayer.player}
                </h3>
                <div style={{ fontSize: 11.5, color: COLORS.muted, fontVariantNumeric: "tabular-nums" }}>
                  {profilePlayer.team} · Bye {profilePlayer.bye_week} · Rank #{profilePlayer.rank}
                </div>
              </div>
              <button
                onClick={() => setProfileId(null)}
                style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer" }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <Stat label="Predicted pts" value={profilePlayer.predicted_fantasy_pts.toFixed(1)} />
              <Stat label="2025 pts" value={profilePlayer.fantasy_pts_2025.toFixed(1)} />
              <Stat label="2025 games" value={profilePlayer.games_played_2025} />
              <Stat
                label="Pts / game (2025)"
                value={profilePlayer.games_played_2025 ? (profilePlayer.fantasy_pts_2025 / profilePlayer.games_played_2025).toFixed(1) : "—"}
              />
            </div>

            <div style={{ fontSize: 10.5, color: COLORS.muted, marginBottom: 5, letterSpacing: 0.5, fontWeight: 700 }}>NEWS</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.text, marginBottom: 18 }}>
              {profilePlayer.news_details}
            </p>

            {stage === "draft" && !drafted[profilePlayer.id] && !draftOver && (
              <button
                className="fda-btn"
                onClick={() => { draftPlayer(profilePlayer.id, slotOnClock); setProfileId(null); }}
                style={{
                  width: "100%", padding: "10px", borderRadius: 6, border: "none",
                  background: COLORS.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer", fontSize: 13,
                }}
              >
                {isMyPick ? "Draft to your team" : `Draft to ${teamLabel(slotOnClock)}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SetupScreen({
  mode, setMode,
  numTeams, setNumTeams, myPickSlot, setMyPickSlot, snake, setSnake,
  roster, setRoster, rounds, handleUpload, uploadMsg, onStart,
}) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: isMobile ? "24px 14px 60px" : "40px 20px 70px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: COLORS.red, fontSize: 11.5, letterSpacing: 1.5, marginBottom: 6, fontWeight: 800 }}>
          DRAFT ROOM SETUP
        </div>
        <h1 className="fda-display" style={{ fontSize: isMobile ? 28 : 38, fontWeight: 700, margin: 0, lineHeight: 1.05 }}>
          Build your board.
        </h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 8, maxWidth: 560 }}>
          Set your league format and roster requirements, then load your ranking files.
          Sample rankings are preloaded for QB, RB, WR, TE, K, and DEF so you can try the tool right away —
          swap them out with your own projections before your real draft.
        </p>
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <SectionLabel icon={<Dices size={14} />} text="Draft type" />
        <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
          <button
            onClick={() => setMode("live")}
            className="fda-btn"
            style={{
              flex: 1, textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
              border: `1.5px solid ${mode === "live" ? COLORS.red : COLORS.line}`,
              background: mode === "live" ? "#FFF1F3" : COLORS.surface,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>Live draft</div>
            <div style={{ fontSize: 11.5, color: COLORS.muted }}>
              You enter each pick as it happens — yours and everyone else's. The tool figures out who's on
              the clock automatically.
            </div>
          </button>
          <button
            onClick={() => setMode("simulator")}
            className="fda-btn"
            style={{
              flex: 1, textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
              border: `1.5px solid ${mode === "simulator" ? COLORS.red : COLORS.line}`,
              background: mode === "simulator" ? "#FFF1F3" : COLORS.surface,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>Draft simulator</div>
            <div style={{ fontSize: 11.5, color: COLORS.muted }}>
              Practice run. Other teams auto-draft using a randomized version of the rankings (based on
              need and value), so you can rehearse strategy before the real thing.
            </div>
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 18 }}>
          <SectionLabel icon={<Users size={14} />} text="League format" />
          <NumberField label="Number of teams" value={numTeams} onChange={setNumTeams} min={4} max={20} />
          <NumberField label="Your draft slot" value={myPickSlot} onChange={setMyPickSlot} min={1} max={numTeams} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Snake draft</span>
            <button
              onClick={() => setSnake((s) => !s)}
              style={{
                width: 40, height: 22, borderRadius: 11, border: `1px solid ${COLORS.line}`,
                background: snake ? COLORS.red : COLORS.surfaceAlt, position: "relative", cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "absolute", top: 2, left: snake ? 19 : 2, width: 16, height: 16, borderRadius: "50%",
                  background: snake ? "#FFF" : COLORS.muted, transition: "left .15s ease",
                }}
              />
            </button>
          </div>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 18 }}>
          <SectionLabel icon={<CircleDot size={14} />} text="Roster requirements" />
          {POS_ORDER.map((k) => (
            <NumberField key={k} label={k} value={roster[k]} onChange={(v) => setRoster((r) => ({ ...r, [k]: v }))} min={0} max={12} />
          ))}
          <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${COLORS.line}`, fontSize: 12, color: COLORS.muted }}>
            {rounds} total roster spots → {rounds} rounds
          </div>
        </div>
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 18, marginBottom: 28 }}>
        <SectionLabel icon={<Upload size={14} />} text="Ranking files (optional)" />
        <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
          Upload a CSV per position with columns: player, pos, team, bye_week, rank, predicted_fantasy_pts,
          fantasy_pts_2025, games_played_2025, news_details. Uploading replaces the sample data for that position only.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["QB", "RB", "WR", "TE", "K", "DEF"].map((pos) => (
            <label
              key={pos}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 6,
                border: `1px solid ${COLORS.line}`, fontSize: 12, cursor: "pointer", color: COLORS.text,
              }}
            >
              <PosBadge pos={pos} /> Upload {pos} CSV
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleUpload(pos, e.target.files[0])} />
            </label>
          ))}
        </div>
        {uploadMsg && <div style={{ marginTop: 10, fontSize: 12, color: COLORS.good, fontWeight: 600 }}>{uploadMsg}</div>}
      </div>

      <button
        className="fda-btn"
        onClick={onStart}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "14px", borderRadius: 8, border: "none", background: COLORS.red, color: "#FFFFFF",
          fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}
      >
        Enter draft room <ChevronRight size={17} />
      </button>
    </div>
  );
}

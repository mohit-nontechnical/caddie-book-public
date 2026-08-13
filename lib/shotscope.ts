// ── Shot Scope shot-level analysis ───────────────────────────
// Rounds imported from Shot Scope Connex carry per-shot data in
// stats.shots. This module classifies shots into strokes-gained
// categories, aggregates per-club performance, and surfaces
// recurring patterns (3-putts, chunks, trouble sequences).
//
// Distance semantics per shot row:
//   dist = how far the shot traveled (y, or ft on the green)
//   rem  = distance to the hole AFTER the shot (null = holed)
// The distance-to-hole BEFORE a shot is the previous shot's rem
// (or dist + rem for the opening shot of a hole).

import type { Round } from "./caddie-store";

export interface Shot {
  hole: number;
  par: number;
  seq: number; // 1-based shot number within the hole
  club: string; // "D", "3w", "H21", "6i", "Pw", "51", "54", "60", "P"
  lie: "Tee" | "Fairway" | "Rough" | "Green" | string;
  dist: number;
  distUnit: "y" | "ft";
  rem: number | null; // null = holed
  remUnit: "y" | "ft" | null;
  sg: number;
  // ── GPS (from Shot Scope's v2 API, when captured) ──
  sLat?: number; // shot start
  sLng?: number;
  eLat?: number; // shot end (ball position after the shot)
  eLng?: number;
  lost?: boolean; // lost-ball flag
}

export type ShotCategory = "tee" | "approach" | "short" | "putting";

const FT_PER_YD = 3;

function toYards(v: number, unit: string | null): number {
  return unit === "ft" ? v / FT_PER_YD : v;
}

/** Distance to the hole before each shot, in yards. */
function startDistances(shots: Shot[]): number[] {
  const out: number[] = [];
  let prevRem: number | null = null;
  let prevHole = -1;
  for (const s of shots) {
    if (s.hole !== prevHole) {
      // Opening shot: approximate hole length as travel + remaining.
      out.push(toYards(s.dist, s.distUnit) + toYards(s.rem ?? 0, s.remUnit));
      prevHole = s.hole;
    } else {
      out.push(prevRem ?? toYards(s.dist, s.distUnit));
    }
    prevRem = s.rem == null ? 0 : toYards(s.rem, s.remUnit);
  }
  return out;
}

export function categorize(shot: Shot, startYds: number): ShotCategory {
  if (shot.lie === "Green") return "putting";
  if (shot.seq === 1 && shot.lie === "Tee" && shot.par >= 4) return "tee";
  if (startYds <= 50) return "short";
  return "approach";
}

export interface ClubLine {
  club: string;
  shots: number;
  totalSG: number;
  avgSG: number;
}

export interface ShotInsights {
  shotCount: number;
  sgByCategory: Record<ShotCategory, number>;
  clubs: ClubLine[]; // sorted worst total SG first
  threePuttHoles: number[];
  lagLeaves: { hole: number; fromFt: number; leftFt: number }[]; // first putts ≥20ft leaving >5ft
  chunks: { hole: number; club: string; traveledYds: number; startYds: number }[]; // ≤10y travel from ≥20y out
  troubleSequences: { hole: number; club: string; consecutive: number }[]; // same club from rough 2+ times in a row
  disasters: { hole: number; club: string; lie: string; sg: number }[]; // sg ≤ -0.9 single shots
}

export function analyzeShots(shots: Shot[]): ShotInsights {
  const starts = startDistances(shots);

  const sgByCategory: Record<ShotCategory, number> = { tee: 0, approach: 0, short: 0, putting: 0 };
  const clubMap = new Map<string, { shots: number; totalSG: number }>();
  const chunks: ShotInsights["chunks"] = [];
  const disasters: ShotInsights["disasters"] = [];
  const puttsByHole = new Map<number, Shot[]>();

  shots.forEach((s, i) => {
    const startYds = starts[i];
    sgByCategory[categorize(s, startYds)] += s.sg;

    const c = clubMap.get(s.club) ?? { shots: 0, totalSG: 0 };
    c.shots += 1;
    c.totalSG += s.sg;
    clubMap.set(s.club, c);

    if (s.lie !== "Green") {
      const traveled = toYards(s.dist, s.distUnit);
      if (traveled <= 10 && startYds >= 20) {
        chunks.push({ hole: s.hole, club: s.club, traveledYds: Math.round(traveled), startYds: Math.round(startYds) });
      }
    }
    if (s.sg <= -0.9) {
      disasters.push({ hole: s.hole, club: s.club, lie: s.lie, sg: s.sg });
    }
    if (s.lie === "Green") {
      const list = puttsByHole.get(s.hole) ?? [];
      list.push(s);
      puttsByHole.set(s.hole, list);
    }
  });

  const threePuttHoles: number[] = [];
  const lagLeaves: ShotInsights["lagLeaves"] = [];
  for (const [hole, putts] of puttsByHole) {
    if (putts.length >= 3) threePuttHoles.push(hole);
    const first = putts[0];
    const fromFt = first.distUnit === "ft" ? first.dist : first.dist * FT_PER_YD;
    const leftFt = first.rem == null ? 0 : first.remUnit === "ft" ? first.rem : first.rem * FT_PER_YD;
    if (fromFt >= 20 && leftFt > 5) lagLeaves.push({ hole, fromFt: Math.round(fromFt), leftFt: Math.round(leftFt) });
  }
  threePuttHoles.sort((a, b) => a - b);

  // Same club used from the rough on consecutive shots of one hole (grinding with the wrong tool).
  const troubleSequences: ShotInsights["troubleSequences"] = [];
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i - 1];
    const cur = shots[i];
    if (
      cur.hole === prev.hole &&
      cur.club === prev.club &&
      cur.lie === "Rough" &&
      prev.lie === "Rough" &&
      cur.club !== "P"
    ) {
      const last = troubleSequences[troubleSequences.length - 1];
      if (last && last.hole === cur.hole && last.club === cur.club) last.consecutive += 1;
      else troubleSequences.push({ hole: cur.hole, club: cur.club, consecutive: 2 });
    }
  }

  const clubs: ClubLine[] = [...clubMap.entries()]
    .map(([club, v]) => ({ club, shots: v.shots, totalSG: round2(v.totalSG), avgSG: round2(v.totalSG / v.shots) }))
    .sort((a, b) => a.totalSG - b.totalSG);

  for (const k of Object.keys(sgByCategory) as ShotCategory[]) {
    sgByCategory[k] = round2(sgByCategory[k]);
  }

  return {
    shotCount: shots.length,
    sgByCategory,
    clubs,
    threePuttHoles,
    lagLeaves,
    chunks,
    troubleSequences,
    disasters,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Friendly display name for a Shot Scope club code. */
export function clubLabel(code: string): string {
  const c = code.trim();
  if (c === "D") return "Driver";
  if (c === "P") return "Putter";
  if (/^\d+w$/i.test(c)) return c.replace(/w$/i, "") + "-wood";
  if (/^H\d+$/i.test(c)) return "Hybrid " + c.slice(1) + "°";
  if (/^\d+i$/i.test(c)) return c.replace(/i$/i, "") + "-iron";
  if (/^[PS]w$/i.test(c)) return c.toUpperCase().slice(0, 1) + "W";
  if (/^\d{2}$/.test(c)) return c + "° wedge";
  return c;
}

export interface HoleShots {
  hole: number;
  par: number;
  strokes: number;
  sg: number; // sum of per-shot SG for the hole
  shots: Shot[];
}

/** Group a round's shots by hole, with per-hole SG sums. */
export function groupShotsByHole(shots: Shot[]): HoleShots[] {
  const byHole = new Map<number, HoleShots>();
  for (const s of shots) {
    let h = byHole.get(s.hole);
    if (!h) {
      h = { hole: s.hole, par: s.par, strokes: 0, sg: 0, shots: [] };
      byHole.set(s.hole, h);
    }
    h.strokes += 1;
    h.sg = round2(h.sg + s.sg);
    h.shots.push(s);
  }
  return [...byHole.values()].sort((a, b) => a.hole - b.hole);
}

// ── Club dispersion ──────────────────────────────────────────
// Where each club's shots finished (landed lie = the NEXT shot's starting lie,
// or "holed"), plus — when GPS is present — true lateral dispersion: how far
// left/right of the start→target line each shot finished.

export interface ClubDispersion {
  club: string;
  attempts: number; // non-putt shots with this club
  avgDistYds: number | null; // average travel of full shots (yards-measured only)
  landed: { fairway: number; green: number; rough: number; holed: number; other: number };
  accuracyPct: number | null; // (fairway+green+holed) / attempts
  // GPS-derived lateral dispersion (target = pin, or hole-out point)
  avgOffsetYds: number | null; // mean |lateral| miss
  biasYds: number | null; // signed mean: negative = left, positive = right
  leftPct: number | null;
  rightPct: number | null;
  offsetsYds: number[]; // signed lateral misses for a compact shot-pattern plot
}

const EARTH_YDS = 6371000 * 1.09361; // Earth radius in yards

/** Approximate local ENU offset in yards from a → b. */
function enuYds(aLat: number, aLng: number, bLat: number, bLng: number): [number, number] {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = dLng * Math.cos((aLat * Math.PI) / 180) * EARTH_YDS; // east
  const y = dLat * EARTH_YDS; // north
  return [x, y];
}

/**
 * Signed lateral offset (yards) of the shot's end point from the straight
 * line start → target. Negative = left of the line, positive = right.
 */
export function lateralOffsetYds(
  s: { sLat?: number; sLng?: number; eLat?: number; eLng?: number },
  target: [number, number] | null
): number | null {
  if (s.sLat == null || s.eLat == null || !target) return null;
  const [tx, ty] = enuYds(s.sLat, s.sLng!, target[0], target[1]);
  const tLen = Math.hypot(tx, ty);
  if (tLen < 10) return null; // too close to the target to define a line
  const [ex, ey] = enuYds(s.sLat, s.sLng!, s.eLat, s.eLng!);
  // cross product z: >0 = end left of target vector (ENU), we flip so + = right
  const cross = tx * ey - ty * ex;
  return round2(-cross / tLen);
}

/** Per-club dispersion table from a round's shots (pins optional, per hole). */
export function clubDispersion(shots: Shot[], pins?: Record<number, [number, number]>): ClubDispersion[] {
  const byClub = new Map<string, Shot[]>();
  for (const s of shots) {
    if (s.lie === "Green") continue; // putts aren't dispersion
    const arr = byClub.get(s.club) ?? [];
    arr.push(s);
    byClub.set(s.club, arr);
  }

  const nextLie = (s: Shot): string => {
    if (s.rem == null) return "holed";
    const i = shots.indexOf(s);
    const nxt = shots[i + 1];
    return nxt && nxt.hole === s.hole ? nxt.lie.toLowerCase() : "other";
  };

  const out: ClubDispersion[] = [];
  for (const [club, list] of byClub) {
    const landed = { fairway: 0, green: 0, rough: 0, holed: 0, other: 0 };
    const dists: number[] = [];
    const offsets: number[] = [];
    for (const s of list) {
      const lie = nextLie(s);
      if (lie === "fairway") landed.fairway++;
      else if (lie === "green") landed.green++;
      else if (lie === "rough") landed.rough++;
      else if (lie === "holed") landed.holed++;
      else landed.other++;
      if (s.distUnit === "y" && s.dist > 20) dists.push(s.dist);
      const off = lateralOffsetYds(s, pins?.[s.hole] ?? null);
      if (off != null) offsets.push(off);
    }
    const attempts = list.length;
    const good = landed.fairway + landed.green + landed.holed;
    out.push({
      club,
      attempts,
      avgDistYds: dists.length ? Math.round(dists.reduce((a, b) => a + b, 0) / dists.length) : null,
      landed,
      accuracyPct: attempts ? Math.round((good / attempts) * 100) : null,
      avgOffsetYds: offsets.length ? round2(offsets.reduce((a, b) => a + Math.abs(b), 0) / offsets.length) : null,
      biasYds: offsets.length ? round2(offsets.reduce((a, b) => a + b, 0) / offsets.length) : null,
      leftPct: offsets.length ? Math.round((offsets.filter((o) => o < 0).length / offsets.length) * 100) : null,
      rightPct: offsets.length ? Math.round((offsets.filter((o) => o > 0).length / offsets.length) * 100) : null,
      offsetsYds: offsets.map(round2),
    });
  }
  return out.sort((a, b) => b.attempts - a.attempts);
}

export type FlagStatus = "red" | "watch" | "good";

export interface RedFlagMetric {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: "%" | "per 18" | "SG";
  direction: "higher" | "lower"; // which direction is better
  status: FlagStatus;
  severity: number;
}

export interface RoundRedFlags {
  metrics: RedFlagMetric[];
  redCount: number;
  watchCount: number;
  weakestArea?: string;
  weakestAreaSg?: number;
  weakestHole?: string;
  weakestHoleSg?: number;
}

/** Per-round benchmark dashboard using the same ~20-HCP targets as the sheet. */
export function roundRedFlags(round: Round, insights?: ShotInsights): RoundRedFlags {
  const stats = round.stats ?? {};
  const holes = Math.max(1, stats.holeCount ?? round.holes.length ?? 18);
  const per18 = (value: number) => round2((value * 18) / holes);
  const girPct = stats.girHoleCount ? round2(((stats.gir ?? 0) / stats.girHoleCount) * 100) : null;
  const firPct = stats.fairwayHoleCount ? round2(((stats.fairwayHits ?? 0) / stats.fairwayHoleCount) * 100) : null;

  const metric = (
    key: string,
    label: string,
    value: number | null | undefined,
    target: number,
    unit: RedFlagMetric["unit"],
    direction: RedFlagMetric["direction"]
  ): RedFlagMetric | null => {
    if (value == null || !Number.isFinite(value)) return null;
    const miss = direction === "higher" ? target - value : value - target;
    const scale = Math.max(Math.abs(target), unit === "SG" ? 2 : 1);
    const severity = round2(Math.max(0, miss / scale));
    const status: FlagStatus = miss <= 0 ? "good" : severity >= 0.5 ? "red" : "watch";
    return { key, label, value: round2(value), target, unit, direction, status, severity };
  };

  const threePutts = stats.threePutts ?? insights?.threePuttHoles.length;
  const values = [
    metric("gir", "Greens in regulation", girPct, 30, "%", "higher"),
    metric("fir", "Fairways in regulation", firPct, 50, "%", "higher"),
    metric("putts", "Putts", stats.putts == null ? null : per18(stats.putts), 32, "per 18", "lower"),
    metric("approach", "SG approaches", stats.sgApproach, 0, "SG", "higher"),
    metric("short", "SG short game", stats.sgShort, 0, "SG", "higher"),
    metric("putting", "SG putting", stats.sgPutting, 0, "SG", "higher"),
    metric("trouble", "Tee shots in trouble", stats.teeShotsInTrouble == null ? null : per18(stats.teeShotsInTrouble), 3.3, "per 18", "lower"),
    metric("chips", "Multiple chips inside 50y", stats.multipleChipsInside50 == null ? null : per18(stats.multipleChipsInside50), 2.1, "per 18", "lower"),
    metric("three-putts", "3-putts or worse", threePutts == null ? null : per18(threePutts), 2.5, "per 18", "lower"),
    metric("short-misses", "Missed putts inside 5ft", stats.missedPuttsInside5 == null ? null : per18(stats.missedPuttsInside5), 2.7, "per 18", "lower"),
  ].filter((m): m is RedFlagMetric => m != null);

  return {
    metrics: values.sort((a, b) => b.severity - a.severity),
    redCount: values.filter((m) => m.status === "red").length,
    watchCount: values.filter((m) => m.status === "watch").length,
    weakestArea: stats.weakestArea,
    weakestAreaSg: stats.weakestAreaSg,
    weakestHole: stats.weakestHole,
    weakestHoleSg: stats.weakestHoleSg,
  };
}

/** Rounds that carry shot-level data. */
export function roundsWithShots(rounds: Round[]): Round[] {
  return rounds.filter((r) => Array.isArray(r.stats?.shots) && (r.stats!.shots as Shot[]).length > 0);
}

/**
 * Deep-ish copy of rounds with stats.shots removed, for inlining in LLM
 * prompts without blowing up the context window.
 */
export function stripShots(rounds: Round[]): Round[] {
  return rounds.map((r) => {
    if (!r.stats?.shots) return r;
    const { shots: _omit, ...rest } = r.stats as Record<string, unknown>;
    return { ...r, stats: rest as Round["stats"] };
  });
}

/**
 * Compact plain-text block summarizing shot-level data for LLM prompts.
 * Empty string when no round has shots.
 */
export function shotscopePromptBlock(rounds: Round[]): string {
  const withShots = roundsWithShots(rounds);
  if (!withShots.length) return "";

  const sections = withShots.slice(0, 3).map((r) => {
    const ins = analyzeShots(r.stats!.shots as Shot[]);
    const cat = ins.sgByCategory;
    const worstClubs = ins.clubs.slice(0, 3).map((c) => `${c.club} ${c.totalSG} (${c.shots} shots)`).join(", ");
    const bestClub = ins.clubs[ins.clubs.length - 1];
    const lines = [
      `${r.course} ${r.date.slice(0, 10)} — ${ins.shotCount} tracked shots:`,
      `  SG: tee ${cat.tee}, approach ${cat.approach}, short game ${cat.short}, putting ${cat.putting}`,
      `  Worst clubs by total SG: ${worstClubs}; best: ${bestClub.club} ${bestClub.totalSG}`,
    ];
    if (ins.threePuttHoles.length) lines.push(`  3-putt holes: ${ins.threePuttHoles.join(", ")}`);
    if (ins.lagLeaves.length)
      lines.push(
        `  Lag putts ≥20ft leaving >5ft: ${ins.lagLeaves.map((l) => `hole ${l.hole} (${l.fromFt}ft→${l.leftFt}ft)`).join(", ")}`
      );
    if (ins.chunks.length)
      lines.push(
        `  Chunked/duffed shots (≤10y travel from ≥20y): ${ins.chunks.map((c) => `hole ${c.hole} ${c.club} (${c.traveledYds}y from ${c.startYds}y)`).join(", ")}`
      );
    if (ins.troubleSequences.length)
      lines.push(
        `  Repeated same-club-from-rough: ${ins.troubleSequences.map((t) => `hole ${t.hole} ${t.club} x${t.consecutive}`).join(", ")}`
      );
    return lines.join("\n");
  });

  return `SHOT-LEVEL DATA (Shot Scope Connex — real per-shot strokes gained, RELIABLE, source of truth where present):
${sections.join("\n")}
(Category SG here is summed from per-shot values; the sgTee/sgApproach/sgShort/sgPutting figures in round stats are Shot Scope's own category totals on a different baseline — cite either, but don't treat the difference as a contradiction.)`;
}

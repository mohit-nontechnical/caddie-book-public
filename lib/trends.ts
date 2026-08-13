// ── Trend alerts (deterministic, zero AI cost) ───────────────
// Compares the player's last 5 complete 18-hole rounds against the up-to-10
// rounds before them and flags metrics that moved past a meaningful
// threshold. Pure function over Round[] — no network calls, no model calls.

import { isCompleteRound, type Round } from "./caddie-store";

export interface TrendAlert {
  metric: string;
  direction: "up" | "down";
  /** Whether this movement is good for the player's game (lower score = good, etc). */
  good: boolean;
  headline: string;
  detail: string;
}

const RECENT_WINDOW = 5;
const PREVIOUS_WINDOW = 10;
const MIN_QUALIFYING_ROUNDS = RECENT_WINDOW + 3; // need at least a real "before" sample

// Thresholds a metric's movement must clear to surface an alert.
const THRESHOLD_SCORING_AVG = 2.0; // strokes
const THRESHOLD_DOUBLES = 0.7; // doubles-or-worse per round
const THRESHOLD_BOUNCEBACK_PTS = 10; // percentage points
const THRESHOLD_PARS = 0.7; // pars per round

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

// Par-dependent metrics are messy across import sources: 18Birdies-imported
// rounds carry RoundStats but no per-hole par; OCR/manual rounds carry per-hole
// par but no stats. Use whichever is available; return null (round excluded
// from that metric) when neither is — `?? 0` would fabricate a trend.
const MIN_METRIC_SAMPLE = 3; // per window, else the metric is skipped

function doublesOrWorse(r: Round): number | null {
  if (typeof r.stats?.doubleBogeyOrWorse === "number") return r.stats.doubleBogeyOrWorse;
  const withPar = r.holes.filter((h) => h.score > 0 && h.par > 0);
  if (withPar.length >= 16) return withPar.filter((h) => h.score - h.par >= 2).length;
  return null;
}

function parsInRound(r: Round): number | null {
  if (typeof r.stats?.pars === "number") return r.stats.pars;
  const withPar = r.holes.filter((h) => h.score > 0 && h.par > 0);
  if (withPar.length >= 16) return withPar.filter((h) => h.score === h.par).length;
  return null;
}

function known(rounds: Round[], fn: (r: Round) => number | null): number[] {
  return rounds.map(fn).filter((v): v is number => v != null);
}

/** Bounce-back %: after a hole scored >=7, how often the next hole was <=5. */
function bounceBackPct(rounds: Round[]): number | null {
  let chances = 0;
  let recovered = 0;
  for (const r of rounds) {
    const scores = r.holes.map((h) => h.score);
    for (let i = 0; i < scores.length - 1; i++) {
      const cur = scores[i];
      const next = scores[i + 1];
      if (typeof cur === "number" && cur >= 7 && typeof next === "number" && next > 0) {
        chances++;
        if (next <= 5) recovered++;
      }
    }
  }
  return chances > 0 ? (recovered / chances) * 100 : null;
}

export function computeTrendAlerts(rounds: Round[]): TrendAlert[] {
  const qualifying = rounds.filter(
    (r) => isCompleteRound(r) && (r.stats?.holeCount ?? r.holes.length) >= 18 && r.holes.length >= 18
  );
  if (qualifying.length < MIN_QUALIFYING_ROUNDS) return [];

  const sorted = [...qualifying].sort((a, b) => b.date.localeCompare(a.date)); // newest first
  const recent = sorted.slice(0, RECENT_WINDOW);
  const previous = sorted.slice(RECENT_WINDOW, RECENT_WINDOW + PREVIOUS_WINDOW);
  if (previous.length === 0) return [];

  const alerts: TrendAlert[] = [];
  const nRecent = recent.length;
  const nPrevious = previous.length;

  // ── Scoring average (lower is good) ──────────────────────────
  {
    const recentAvg = avg(recent.map((r) => r.total));
    const prevAvg = avg(previous.map((r) => r.total));
    const delta = recentAvg - prevAvg;
    if (Math.abs(delta) >= THRESHOLD_SCORING_AVG) {
      const down = delta < 0; // scoring average dropping is good
      alerts.push({
        metric: "Scoring average",
        direction: down ? "down" : "up",
        good: down,
        headline: `Scoring average ${down ? "down" : "up"} ${Math.abs(r1(delta))} strokes`,
        detail: `Last ${nRecent} rounds: ${r1(recentAvg)} vs ${r1(prevAvg)} before.`,
      });
    }
  }

  // ── Doubles-or-worse per round (lower is good) ───────────────
  {
    const recentKnown = known(recent, doublesOrWorse);
    const prevKnown = known(previous, doublesOrWorse);
    const recentDoubles = avg(recentKnown);
    const prevDoubles = avg(prevKnown);
    const delta = recentDoubles - prevDoubles;
    if (
      recentKnown.length >= MIN_METRIC_SAMPLE &&
      prevKnown.length >= MIN_METRIC_SAMPLE &&
      Math.abs(delta) >= THRESHOLD_DOUBLES
    ) {
      const down = delta < 0;
      alerts.push({
        metric: "Doubles-or-worse per round",
        direction: down ? "down" : "up",
        good: down,
        headline: `Doubles-or-worse per round ${down ? "down" : "up"} ${Math.abs(r1(delta))}`,
        detail: `Last ${nRecent} rounds: ${r1(recentDoubles)}/round vs ${r1(prevDoubles)}/round before.`,
      });
    }
  }

  // ── Bounce-back % (higher is good) ───────────────────────────
  {
    const recentBB = bounceBackPct(recent);
    const prevBB = bounceBackPct(previous);
    if (recentBB != null && prevBB != null) {
      const delta = recentBB - prevBB;
      if (Math.abs(delta) >= THRESHOLD_BOUNCEBACK_PTS) {
        const up = delta > 0;
        alerts.push({
          metric: "Bounce-back rate",
          direction: up ? "up" : "down",
          good: up,
          headline: `Bounce-back rate ${up ? "up" : "down"} ${Math.abs(Math.round(delta))} pts`,
          detail: `Last ${nRecent} rounds: ${Math.round(recentBB)}% vs ${Math.round(prevBB)}% before.`,
        });
      }
    }
  }

  // ── Pars per round (higher is good) ──────────────────────────
  {
    const recentKnown = known(recent, parsInRound);
    const prevKnown = known(previous, parsInRound);
    const recentPars = avg(recentKnown);
    const prevPars = avg(prevKnown);
    const delta = recentPars - prevPars;
    if (
      recentKnown.length >= MIN_METRIC_SAMPLE &&
      prevKnown.length >= MIN_METRIC_SAMPLE &&
      Math.abs(delta) >= THRESHOLD_PARS
    ) {
      const up = delta > 0;
      alerts.push({
        metric: "Pars per round",
        direction: up ? "up" : "down",
        good: up,
        headline: `Pars per round ${up ? "up" : "down"} ${Math.abs(r1(delta))}`,
        detail: `Last ${nRecent} rounds: ${r1(recentPars)}/round vs ${r1(prevPars)}/round before (${nPrevious} rounds).`,
      });
    }
  }

  return alerts;
}

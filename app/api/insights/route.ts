export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRounds, isCompleteRound, type Round } from "@/lib/caddie-store";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function GET() {
  try {
    const all = await getRounds(200);

    // Only 18-hole complete rounds
    const rounds = all.filter(
      (r) => isCompleteRound(r) && (r.stats?.holeCount ?? r.holes.length) >= 18
    );

    const rounds18 = rounds.length;

    if (rounds18 === 0) {
      return NextResponse.json({
        rounds18: 0,
        avg: null,
        best: null,
        worst: null,
        scoring: { pars: 0, birdies: 0, bogeys: 0, doublesPlus: 0 },
        holeDist: [],
        bigHolePct: 0,
        gapToGoal: { goal: 85, current: null, gap: null, doublesPerRound: 0, strokesIfHalved: 0 },
        frontBack: null,
        trend: [],
        consistency: { stdev: 0, spread: 0 },
        mental: null,
      });
    }

    // Totals
    const totals = rounds.map((r) => r.total);
    const avg = round1(totals.reduce((a, b) => a + b, 0) / totals.length);
    const best = Math.min(...totals);
    const worst = Math.max(...totals);

    // Scoring distribution (from reliable stats fields)
    const avgPars = round1(
      rounds.reduce((s, r) => s + (r.stats?.pars ?? 0), 0) / rounds18
    );
    const avgBirdies = round1(
      rounds.reduce((s, r) => s + (r.stats?.birdies ?? 0) + (r.stats?.eagles ?? 0), 0) / rounds18
    );
    const avgBogeys = round1(
      rounds.reduce((s, r) => s + (r.stats?.bogeys ?? 0), 0) / rounds18
    );
    const avgDoublesPlus = round1(
      rounds.reduce((s, r) => s + (r.stats?.doubleBogeyOrWorse ?? 0), 0) / rounds18
    );

    // Hole-level distribution from holeStrokes
    const strokeCounts: Record<number, number> = {};
    let totalHoles = 0;

    for (const r of rounds) {
      // Use actual hole scores from r.holes array
      const holeScores = r.holes
        .map((h) => h.score)
        .filter((s) => typeof s === "number" && s > 0);

      for (const s of holeScores) {
        const bucket = s >= 9 ? 9 : s;
        strokeCounts[bucket] = (strokeCounts[bucket] ?? 0) + 1;
        totalHoles++;
      }
    }

    const scoreLabels: Array<{ score: string; raw: number }> = [
      { score: "3", raw: 3 },
      { score: "4", raw: 4 },
      { score: "5", raw: 5 },
      { score: "6", raw: 6 },
      { score: "7", raw: 7 },
      { score: "8", raw: 8 },
      { score: "9+", raw: 9 },
    ];

    const holeDist = scoreLabels
      .map(({ score, raw }) => {
        const count = strokeCounts[raw] ?? 0;
        return {
          score,
          count,
          pct: totalHoles > 0 ? round1((count / totalHoles) * 100) : 0,
        };
      })
      .filter((d) => d.count > 0 || d.score === "4" || d.score === "5"); // always include 4 and 5

    // Big hole pct: holes with score >= 7
    const bigHoleCount =
      (strokeCounts[7] ?? 0) + (strokeCounts[8] ?? 0) + (strokeCounts[9] ?? 0);
    const bigHolePct = totalHoles > 0 ? round1((bigHoleCount / totalHoles) * 100) : 0;

    // Gap to goal
    const goal = 85;
    const doublesPerRound = avgDoublesPlus;
    // Each double+ is ~2 over par; halving them saves ~1 stroke each * doublesPerRound
    const strokesIfHalved = round1(doublesPerRound * 0.5 * 2);
    const gapToGoal = {
      goal,
      current: avg,
      gap: round1(avg - goal),
      doublesPerRound,
      strokesIfHalved,
    };

    // Front vs back (rounds with >= 18 holeStrokes in r.holes)
    const roundsWithHoles = rounds.filter((r) => r.holes.length >= 18);
    let frontBack: { front: number; back: number; diff: number; backWorsePct: number } | null = null;
    if (roundsWithHoles.length >= 3) {
      const fronts = roundsWithHoles.map((r) =>
        r.holes.slice(0, 9).reduce((s, h) => s + (h.score || 0), 0)
      );
      const backs = roundsWithHoles.map((r) =>
        r.holes.slice(9, 18).reduce((s, h) => s + (h.score || 0), 0)
      );
      const frontAvg = round1(fronts.reduce((a, b) => a + b, 0) / fronts.length);
      const backAvg = round1(backs.reduce((a, b) => a + b, 0) / backs.length);
      const backWorse = backs.filter((b, i) => b > fronts[i]).length;
      frontBack = {
        front: frontAvg,
        back: backAvg,
        diff: round1(backAvg - frontAvg),
        backWorsePct: round1((backWorse / roundsWithHoles.length) * 100),
      };
    }

    // Trend: chronological (oldest → newest)
    const trend = [...rounds]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date.slice(0, 10), score: r.total }));

    // ── Mental game: season-wide bounce-back / tilt ──────────────
    // After a blow-up hole (score >= 7), did the NEXT hole stay clean (<= 5)?
    // Dropping another shot right after a blow-up is the classic tilt pattern.
    // Computed over every blow-up hole that has a following hole.
    function bouncebackOf(rs: Round[]) {
      let chances = 0;
      let recovered = 0; // next hole <= 5 (bogey-or-better on a par 4)
      let doubledUp = 0; // next hole >= 6 (dropped another shot)
      let nextTotal = 0;
      for (const r of rs) {
        const hs = r.holes.map((h) => h.score);
        for (let i = 0; i < hs.length - 1; i++) {
          if (hs[i] >= 7 && typeof hs[i + 1] === "number" && hs[i + 1] > 0) {
            chances++;
            nextTotal += hs[i + 1];
            if (hs[i + 1] <= 5) recovered++;
            if (hs[i + 1] >= 6) doubledUp++;
          }
        }
      }
      return { chances, recovered, doubledUp, avgNextHole: chances ? round1(nextTotal / chances) : 0 };
    }

    const roundsWithHolesM = rounds.filter((r) => r.holes.length >= 18);
    const bb = bouncebackOf(roundsWithHolesM);
    // Early vs recent halves (chronological) to show whether it's improving
    const chrono = [...roundsWithHolesM].sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(chrono.length / 2);
    const earlyBB = bouncebackOf(chrono.slice(0, mid));
    const recentBB = bouncebackOf(chrono.slice(mid));
    const recoveredPct = bb.chances ? round1((bb.recovered / bb.chances) * 100) : 0;

    const mental =
      bb.chances >= 5
        ? {
            blowUpHoles: bb.chances,
            recovered: bb.recovered,
            recoveredPct, // also the "mental toughness" score 0–100
            doubledUpPct: round1((bb.doubledUp / bb.chances) * 100),
            avgNextHole: bb.avgNextHole,
            tilt: recoveredPct < 50,
            trend: {
              early: earlyBB.chances ? round1((earlyBB.recovered / earlyBB.chances) * 100) : null,
              recent: recentBB.chances ? round1((recentBB.recovered / recentBB.chances) * 100) : null,
            },
          }
        : null;

    // Consistency
    const spread = worst - best;
    const sd = round1(stdev(totals));

    return NextResponse.json({
      rounds18,
      avg,
      best,
      worst,
      scoring: {
        pars: avgPars,
        birdies: avgBirdies,
        bogeys: avgBogeys,
        doublesPlus: avgDoublesPlus,
      },
      holeDist,
      bigHolePct,
      gapToGoal,
      frontBack,
      trend,
      consistency: { stdev: sd, spread },
      mental,
    });
  } catch (e) {
    console.error("[insights]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRounds, getCourseRatingOverrides, isCompleteRound } from "@/lib/caddie-store";
import { seedFor, normCourse } from "@/lib/course-ratings";
import { computeHandicap, equivalentDifferential, type RatedRound } from "@/lib/handicap";

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Courses with par below this are executive / par-3 / pitch-and-putt — their
// scoring isn't comparable to regulation golf, so they're excluded from
// Strokes Gained (they'd otherwise read as huge "losses"). Regulation = 68+.
const REGULATION_PAR_MIN = 68;

// Honest "Strokes Gained: Total" — vs the player's OWN potential (index),
// course-difficulty adjusted. For each round:
//   SG = index − differential
//   (differential already normalizes for course rating + slope)
// Positive SG = played better than your handicap potential that day.
// Scoring data only — no shot-level data required.
export async function GET() {
  try {
    const rounds = await getRounds(200);
    const overrides = await getCourseRatingOverrides();

    const resolve = (course: string) => {
      const norm = normCourse(course);
      const ov = overrides[norm];
      const seed = seedFor(course);
      return {
        rating: ov?.rating ?? seed.rating,
        slope: ov?.slope ?? seed.slope,
        par: ov?.par ?? seed.par,
        estimated: ov ? false : seed.estimated,
      };
    };

    // 18-hole complete rounds only (cleanest, avoids 9-hole doubling noise).
    const eighteen = rounds
      .filter((r) => (r.stats?.holeCount ?? r.holes.length) >= 18 && r.total > 0 && isCompleteRound(r))
      .map((r) => {
        const res = resolve(r.course);
        const holeCount = r.stats?.holeCount ?? r.holes.length;
        return { date: r.date, course: r.course, score: r.total, ...res, holeCount };
      });

    // Index is computed from ALL 18-hole rounds (executive courses make high
    // differentials, which WHS never selects as your best — so they don't
    // corrupt the index). SG analytics then use regulation rounds only.
    const rated: RatedRound[] = eighteen.map((r) => ({
      date: r.date, course: r.course, score: r.score, rating: r.rating, slope: r.slope, estimated: r.estimated, holeCount: r.holeCount,
    }));
    const result = computeHandicap(rated);
    const index = result.index;

    const regulation = eighteen.filter((r) => r.par >= REGULATION_PAR_MIN);
    const excludedExecutive = eighteen.length - regulation.length;
    const excludedCourses = Array.from(
      new Set(eighteen.filter((r) => r.par < REGULATION_PAR_MIN).map((r) => r.course))
    );

    if (index == null || regulation.length === 0) {
      return NextResponse.json({ rounds: 0, index, avgSG: null, potentialGap: null, gainerPct: 0, best: null, worst: null, trend: [], byCourse: [], recent: [], excludedExecutive, excludedCourses });
    }

    // Per-round SG over regulation rounds (newest first; getRounds is date DESC)
    const perRound = regulation.map((r) => {
      const differential = equivalentDifferential(r.score, r.rating, r.slope, r.holeCount);
      return { date: r.date, course: r.course, total: r.score, differential, sg: r1(index - differential) };
    });

    const sgVals = perRound.map((p) => p.sg);
    const avgSG = r1(sgVals.reduce((a, b) => a + b, 0) / sgVals.length);
    const potentialGap = r1(-avgSG); // strokes above potential on a typical round
    const gainers = sgVals.filter((s) => s > 0).length;
    const gainerPct = r1((gainers / sgVals.length) * 100);

    // Best / worst rounds by SG
    const bySG = [...perRound].sort((a, b) => b.sg - a.sg);
    const best = bySG[0];
    const worst = bySG[bySG.length - 1];

    // Chronological SG trend (oldest → newest)
    const trend = [...perRound]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ date: p.date.slice(0, 10), sg: p.sg }));

    // Per-course over/under performance (>= 2 rounds), best SG first
    const byCourseMap = new Map<string, { course: string; sgs: number[]; diffs: number[] }>();
    for (const p of perRound) {
      const cur = byCourseMap.get(p.course) ?? { course: p.course, sgs: [], diffs: [] };
      cur.sgs.push(p.sg);
      cur.diffs.push(p.differential);
      byCourseMap.set(p.course, cur);
    }
    const byCourse = [...byCourseMap.values()]
      .filter((c) => c.sgs.length >= 2)
      .map((c) => ({
        course: c.course,
        rounds: c.sgs.length,
        avgSG: r1(c.sgs.reduce((a, b) => a + b, 0) / c.sgs.length),
        avgDiff: r1(c.diffs.reduce((a, b) => a + b, 0) / c.diffs.length),
      }))
      .sort((a, b) => b.avgSG - a.avgSG);

    const recent = perRound.slice(0, 8);

    return NextResponse.json({
      rounds: perRound.length,
      index,
      avgSG,
      potentialGap,
      gainerPct,
      best,
      worst,
      trend,
      byCourse,
      recent,
      excludedExecutive,
      excludedCourses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

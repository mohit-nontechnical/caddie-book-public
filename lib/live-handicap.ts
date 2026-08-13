// ── Live handicap (server-side) ──────────────────────────────
// Shared by /api/handicap and the AI coach routes so they all agree on the
// player's real index. Builds WHS "rated rounds" from the round store +
// course-rating overrides, then delegates the math to lib/handicap.
import { getRounds, getCourseRatingOverrides, isCompleteRound } from "@/lib/caddie-store";
import type { Round, CourseRatingOverride } from "@/lib/caddie-store";
import { seedFor, normCourse } from "@/lib/course-ratings";
import { computeHandicap, type RatedRound, type HandicapResult } from "@/lib/handicap";

export interface CourseResolution {
  rating: number;
  slope: number;
  par: number;
  estimated: boolean;
}

/** Resolve a course's rating/slope/par: user override first, then seed data. */
export function makeResolver(
  overrides: Record<string, CourseRatingOverride>
): (course: string) => CourseResolution {
  return (course: string) => {
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
}

/**
 * Build the rated-round list that drives the index.
 * 18-hole rounds always count; 9-hole rounds are included via the doubling
 * approximation when `include9` (see lib/handicap.ts). Abandoned/invalid
 * rounds are excluded — an implausible total would corrupt the index since
 * WHS averages the *lowest* differentials.
 */
export function buildRatedRounds(
  rounds: Round[],
  resolve: (course: string) => CourseResolution,
  include9: boolean = true
): RatedRound[] {
  const rated: RatedRound[] = [];
  for (const r of rounds) {
    const holeCount = r.stats?.holeCount ?? r.holes.length;
    if (r.total <= 0 || !isCompleteRound(r)) continue;
    if (holeCount < 18 && (!include9 || holeCount < 9)) continue;
    const res = resolve(r.course);
    rated.push({
      date: r.date,
      course: r.course,
      score: r.total,
      rating: res.rating,
      slope: res.slope,
      estimated: res.estimated,
      holeCount,
    });
  }
  return rated;
}

/** One-call live handicap for server code (coach prompts etc.). */
export async function getLiveHandicap(opts?: {
  rounds?: Round[];
  include9?: boolean;
}): Promise<HandicapResult> {
  const rounds = opts?.rounds ?? (await getRounds(200));
  const overrides = await getCourseRatingOverrides();
  const resolve = makeResolver(overrides);
  return computeHandicap(buildRatedRounds(rounds, resolve, opts?.include9 ?? true));
}

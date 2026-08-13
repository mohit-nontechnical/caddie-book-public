// ── World Handicap System (WHS) engine ───────────────────────
// Computes a Handicap Index from 18-hole (and optionally 9-hole) Score Differentials.
//
// 18-hole Score Differential = (113 / Slope) × (Adjusted Gross Score − Course Rating)
// Handicap Index = average of the lowest N of the most recent 20 differentials,
//   where N (and an adjustment) depends on how many rounds you have.
//
// 9-hole rounds:
//   Real WHS combines two 9-hole scores via an iterative expected-score method.
//   The accepted simple approximation (used here) treats the 9-hole score as
//   representative of a full 18 by doubling it against the 18-hole rating:
//     18-equivalent differential = (113 / slope) × ((2 × score9) − rating18)
//   This is algebraically identical to computing a 9-hole differential with
//   rating9 = rating18/2, then doubling. It slightly overestimates variance on
//   very easy/hard nines but is defensible and widely used.
//
// Caveats for this app's data (18Birdies export):
//  • No per-hole par/handicap, so we can't apply net-double-bogey adjustment —
//    we use gross total as AGS (slightly conservative on blow-up holes).

export interface RatedRound {
  date: string; // ISO
  course: string;
  score: number;
  rating: number;
  slope: number;
  estimated: boolean;
  holeCount: number; // holes actually played: 9 or 18
}

export interface DiffRound extends RatedRound {
  differential: number;
}

/**
 * Compute the 18-hole-equivalent Score Differential for a round.
 * For 9-hole rounds, score is doubled against the full 18-hole rating.
 * For 18-hole rounds this reduces to the standard WHS formula.
 */
export function equivalentDifferential(
  score: number,
  rating: number,
  slope: number,
  holeCount: number
): number {
  if (!slope) return 0;
  const adjScore = holeCount < 18 ? 2 * score : score;
  return Math.round(((113 / slope) * (adjScore - rating)) * 10) / 10;
}

/** Legacy 18-hole-only export — preserved for back-compat. */
export function scoreDifferential(score: number, rating: number, slope: number): number {
  return equivalentDifferential(score, rating, slope, 18);
}

// WHS: differentials used + adjustment, based on count of acceptable scores.
function whsConfig(n: number): { count: number; adj: number } | null {
  if (n < 3) return null;
  if (n === 3) return { count: 1, adj: -2.0 };
  if (n === 4) return { count: 1, adj: -1.0 };
  if (n === 5) return { count: 1, adj: 0 };
  if (n === 6) return { count: 2, adj: -1.0 };
  if (n <= 8) return { count: 2, adj: 0 };
  if (n <= 11) return { count: 3, adj: 0 };
  if (n <= 14) return { count: 4, adj: 0 };
  if (n <= 16) return { count: 5, adj: 0 };
  if (n <= 18) return { count: 6, adj: 0 };
  if (n === 19) return { count: 7, adj: 0 };
  return { count: 8, adj: 0 }; // 20+
}

const MAX_INDEX = 54.0;

/** Index from a list of differentials (any order). Uses the most recent 20. */
export function indexFromDifferentials(diffsNewestFirst: number[]): number | null {
  const recent = diffsNewestFirst.slice(0, 20);
  const cfg = whsConfig(recent.length);
  if (!cfg) return null;
  const lowest = [...recent].sort((a, b) => a - b).slice(0, cfg.count);
  const avg = lowest.reduce((a, b) => a + b, 0) / lowest.length;
  const idx = Math.round((avg + cfg.adj) * 10) / 10;
  return Math.min(idx, MAX_INDEX);
}

export interface HandicapResult {
  index: number | null;
  roundsUsed: number; // total rounds with a score
  rounds18: number;   // count of 18-hole rounds used
  rounds9: number;    // count of 9-hole rounds used
  differentials: DiffRound[]; // newest first
  recent20: DiffRound[];
  trend: { date: string; index: number }[];
  estimatedCourses: string[];
}

/**
 * Compute the index + a rolling trend from rated rounds (18-hole and/or 9-hole).
 * `rated` may be in any order; we sort newest-first internally.
 * 9-hole rounds use the doubling approximation (see module header comment).
 */
export function computeHandicap(rated: RatedRound[]): HandicapResult {
  const sorted = [...rated]
    .filter((r) => r.score > 0 && r.slope > 0)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date)); // newest first

  const diffs: DiffRound[] = sorted.map((r) => ({
    ...r,
    differential: equivalentDifferential(r.score, r.rating, r.slope, r.holeCount),
  }));

  const rounds18 = diffs.filter((d) => d.holeCount >= 18).length;
  const rounds9 = diffs.filter((d) => d.holeCount < 18).length;

  const index = indexFromDifferentials(diffs.map((d) => d.differential));

  // Rolling trend: walk oldest→newest, computing the index at each step.
  const oldestFirst = [...diffs].reverse();
  const trend: { date: string; index: number }[] = [];
  for (let i = 0; i < oldestFirst.length; i++) {
    const window = oldestFirst.slice(0, i + 1).map((d) => d.differential).reverse(); // newest first
    const idx = indexFromDifferentials(window);
    if (idx != null) trend.push({ date: oldestFirst[i].date, index: idx });
  }

  const estimatedCourses = Array.from(
    new Set(diffs.filter((d) => d.estimated).map((d) => d.course))
  );

  return {
    index,
    roundsUsed: diffs.length,
    rounds18,
    rounds9,
    differentials: diffs,
    recent20: diffs.slice(0, 20),
    trend,
    estimatedCourses,
  };
}

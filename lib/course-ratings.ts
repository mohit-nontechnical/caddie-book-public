// ── Course rating/slope seed ─────────────────────────────────
// WHS differentials need each course's Course Rating + Slope + Par.
// The 18Birdies export has none of these, so we seed best-effort values and
// let the user refine them in-app. `estimated: false` = verified via source;
// `estimated: true` = default/guess that should be confirmed.

export interface CourseRating {
  rating: number;
  slope: number;
  par: number;
  estimated: boolean;
}

export const DEFAULT_RATING: CourseRating = { rating: 70.0, slope: 113, par: 72, estimated: true };

// Normalize a course name for matching (case/space/punctuation-insensitive).
export function normCourse(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Verified or best-effort seeds (white/middle tees where known).
const SEED: Record<string, CourseRating> = {
  // Verified via GolfLink/course databases (June 2026):
  "spring valley golf course": { rating: 68.8, slope: 113, par: 70, estimated: false },
  "dublin ranch golf course": { rating: 62.0, slope: 105, par: 63, estimated: false },
  // Best-effort estimates for frequently played courses (confirm in-app):
  "bayonet and black horse": { rating: 71.8, slope: 129, par: 72, estimated: true },
  "tpc harding park": { rating: 71.6, slope: 123, par: 72, estimated: true },
  "sharp park golf course": { rating: 70.1, slope: 121, par: 72, estimated: true },
  "poplar creek golf course": { rating: 69.2, slope: 117, par: 71, estimated: true },
  "baylands golf links": { rating: 70.0, slope: 119, par: 72, estimated: true },
  "deep cliff golf course": { rating: 60.6, slope: 96, par: 60, estimated: true },
};

export function seedFor(courseName: string): CourseRating {
  return SEED[normCourse(courseName)] ?? { ...DEFAULT_RATING };
}

import { NextResponse } from "next/server";
import { getRounds, getCourseRatingOverrides } from "@/lib/caddie-store";
import { normCourse } from "@/lib/course-ratings";
import { computeHandicap } from "@/lib/handicap";
import { makeResolver, buildRatedRounds } from "@/lib/live-handicap";

export const runtime = "nodejs";

// GET → { index, roundsUsed, rounds18, rounds9, recent20, trend, estimatedCourses, courses[] }
// Query param: include9=0|false to exclude 9-hole rounds (default: include them).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw9 = searchParams.get("include9");
    const include9 = raw9 !== "0" && raw9 !== "false";

    const rounds = await getRounds(200);
    const overrides = await getCourseRatingOverrides();
    const resolve = makeResolver(overrides);

    // Rated-round building (18-hole always; 9-hole via doubling approximation
    // when include9) lives in lib/live-handicap so the coach routes and this
    // route always agree on the index.
    const result = computeHandicap(buildRatedRounds(rounds, resolve, include9));

    // Course summary for the ratings editor (all distinct courses played).
    const counts = new Map<string, { name: string; rounds18: number }>();
    for (const r of rounds) {
      const norm = normCourse(r.course);
      const cur = counts.get(norm) ?? { name: r.course, rounds18: 0 };
      if ((r.stats?.holeCount ?? r.holes.length) >= 18) cur.rounds18 += 1;
      counts.set(norm, cur);
    }
    const courses = Array.from(counts.entries())
      .map(([norm, v]) => {
        const res = resolve(v.name);
        return { name: v.name, norm, rounds18: v.rounds18, ...res };
      })
      .sort((a, b) => b.rounds18 - a.rounds18 || a.name.localeCompare(b.name));

    return NextResponse.json({
      index: result.index,
      roundsUsed: result.roundsUsed,
      rounds18: result.rounds18,
      rounds9: result.rounds9,
      recent20: result.recent20,
      trend: result.trend,
      estimatedCourses: result.estimatedCourses,
      courses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRounds, isCompleteRound } from "@/lib/caddie-store";
import { seedFor, normCourse } from "@/lib/course-ratings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rounds = await getRounds(200);

    // ── 18-hole complete rounds ──────────────────────────────
    const complete18 = rounds.filter((r) => {
      if (!isCompleteRound(r)) return false;
      const holes = r.stats?.holeCount ?? r.holes.length;
      return holes >= 18;
    });

    const complete9 = rounds.filter((r) => {
      if (!isCompleteRound(r)) return false;
      const holes = r.stats?.holeCount ?? r.holes.length;
      return holes >= 9 && holes < 18;
    });

    // Overall 18-hole stats
    const totals18 = complete18.map((r) => r.total);
    const scoringAvg18 =
      totals18.length > 0
        ? Math.round((totals18.reduce((a, b) => a + b, 0) / totals18.length) * 10) / 10
        : null;
    const best18 = totals18.length > 0 ? Math.min(...totals18) : null;
    const worst18 = totals18.length > 0 ? Math.max(...totals18) : null;

    const under85 = totals18.filter((t) => t < 85);
    const break85 = {
      count: under85.length,
      total: totals18.length,
      pct: totals18.length > 0 ? Math.round((under85.length / totals18.length) * 100) : 0,
    };

    // Monthly avg (complete 18-hole only, chronological)
    const monthMap: Record<string, number[]> = {};
    for (const r of complete18) {
      const month = r.date.slice(0, 7); // "YYYY-MM"
      if (!monthMap[month]) monthMap[month] = [];
      monthMap[month].push(r.total);
    }
    const monthlyAvg = Object.keys(monthMap)
      .sort()
      .map((month) => {
        const arr = monthMap[month];
        return {
          month,
          avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
        };
      });

    // ── Per-course stats ────────────────────────────────────
    // Group ALL rounds by normalized course name
    const courseMap: Record<
      string,
      {
        name: string;
        norm: string;
        allRounds: typeof rounds;
        rounds18Complete: typeof rounds;
        rounds9Complete: typeof rounds;
      }
    > = {};

    for (const r of rounds) {
      const norm = normCourse(r.course);
      if (!courseMap[norm]) {
        courseMap[norm] = {
          name: r.course,
          norm,
          allRounds: [],
          rounds18Complete: [],
          rounds9Complete: [],
        };
      }
      courseMap[norm].allRounds.push(r);

      if (isCompleteRound(r)) {
        const holes = r.stats?.holeCount ?? r.holes.length;
        if (holes >= 18) courseMap[norm].rounds18Complete.push(r);
        else if (holes >= 9) courseMap[norm].rounds9Complete.push(r);
      }
    }

    const courses = Object.values(courseMap)
      .map((c) => {
        const seed = seedFor(c.name);
        const totals = c.rounds18Complete.map((r) => r.total);
        const avg18 =
          totals.length > 0
            ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
            : null;
        const best18 = totals.length > 0 ? Math.min(...totals) : null;

        // Sort oldest-first for sparkline
        const sorted18 = [...c.rounds18Complete].sort((a, b) => a.date.localeCompare(b.date));
        const scores18 = sorted18.map((r) => r.total);

        // Most recent round across all rounds at this course
        const lastPlayed = c.allRounds.reduce(
          (latest, r) => (r.date > latest ? r.date : latest),
          ""
        );

        return {
          name: c.name,
          norm: c.norm,
          rounds: c.allRounds.length,
          rounds18: c.rounds18Complete.length,
          rounds9: c.rounds9Complete.length,
          avg18,
          best18,
          par: seed.par,
          lastPlayed,
          scores18,
        };
      })
      .sort((a, b) => {
        if (b.rounds !== a.rounds) return b.rounds - a.rounds;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      overall: {
        totalRounds: rounds.length,
        rounds18: complete18.length,
        rounds9: complete9.length,
        scoringAvg18,
        best18,
        worst18,
        break85,
        monthlyAvg,
      },
      courses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRounds, isCompleteRound } from "@/lib/caddie-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rounds = await getRounds(500);

    const summaries = rounds.map((r) => {
      const holeCount = r.stats?.holeCount ?? r.holes.length;
      const front9 = r.holes.slice(0, 9).reduce((a, h) => a + h.score, 0);
      const back9 = holeCount >= 18 ? r.holes.slice(9, 18).reduce((a, h) => a + h.score, 0) : 0;
      const s = r.stats;
      const shotScope =
        s?.source === "shotscope"
          ? {
              shots: s.shots?.length ?? 0,
              putts: s.putts,
              sgTee: s.sgTee,
              sgApproach: s.sgApproach,
              sgShort: s.sgShort,
              sgPutting: s.sgPutting,
            }
          : undefined;
      return {
        id: r.id,
        date: r.date,
        course: r.course,
        total: r.total,
        holeCount,
        front9,
        back9,
        holes: r.holes.map((h) => h.score),
        complete: isCompleteRound(r),
        ...(shotScope ? { shotScope } : {}),
      };
    });

    // Newest-first (getRounds already orders by date DESC, but be explicit)
    summaries.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json(summaries);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

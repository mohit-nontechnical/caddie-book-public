// ── Shot-level detail for one round ──────────────────────────
// GET /api/round-shots?id=<roundId>
// → { id, course, date, holes: HoleShots[], clubs: ClubLine[], insights }
// 404 when the round doesn't exist, 200 with shots:false when the round has
// no shot-level data (18Birdies-sourced rounds).

import { NextRequest, NextResponse } from "next/server";
import { getRounds } from "@/lib/caddie-store";
import {
  analyzeShots,
  clubDispersion,
  clubLabel,
  groupShotsByHole,
  roundRedFlags,
  type Shot,
} from "@/lib/shotscope";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const rounds = await getRounds(500);
    const round = rounds.find((r) => r.id === id);
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

    const shots = round.stats?.shots as Shot[] | undefined;
    if (!Array.isArray(shots) || !shots.length) {
      return NextResponse.json({ id: round.id, course: round.course, date: round.date, shots: false });
    }

    const insights = analyzeShots(shots);
    const puttsByHole = new Map(round.holes.map((h) => [h.hole, h.putts]));

    return NextResponse.json({
      id: round.id,
      course: round.course,
      date: round.date,
      shots: true,
      holes: groupShotsByHole(shots).map((h) => ({
        ...h,
        putts: puttsByHole.get(h.hole) ?? null,
        pin: round.stats?.pins?.[h.hole] ?? null,
        gps: h.shots.some((s) => s.sLat != null),
      })),
      dispersion: clubDispersion(shots, round.stats?.pins).map((c) => ({ ...c, label: clubLabel(c.club) })),
      redFlags: roundRedFlags(round, insights),
      clubs: insights.clubs.map((c) => ({ ...c, label: clubLabel(c.club) })),
      insights: {
        sgByCategory: insights.sgByCategory,
        threePuttHoles: insights.threePuttHoles,
        chunks: insights.chunks,
        troubleSequences: insights.troubleSequences,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

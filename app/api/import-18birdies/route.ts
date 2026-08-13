import { NextRequest, NextResponse } from "next/server";
import { mapArchiveToRounds } from "@/lib/import-18birdies";
import { insertRounds, getRounds } from "@/lib/caddie-store";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST: the 18Birdies "Download Your Account Data" JSON (either the full
// { myData: {...} } archive or an already-unwrapped object).
// → { imported, added, updated, skipped, courses }
export async function POST(req: NextRequest) {
  try {
    const archive = await req.json();
    const { rounds, total, skipped, courses, courseNames } = mapArchiveToRounds(archive);
    if (!total) {
      return NextResponse.json(
        { error: "No rounds found. Make sure this is your 18Birdies account-data JSON." },
        { status: 400 }
      );
    }
    const existing = new Set((await getRounds(1000)).map((r) => r.id));
    const added = rounds.filter((r) => !existing.has(r.id)).length;
    const updated = rounds.length - added;
    const imported = await insertRounds(rounds);
    return NextResponse.json({ imported, added, updated, skipped, courses, courseNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

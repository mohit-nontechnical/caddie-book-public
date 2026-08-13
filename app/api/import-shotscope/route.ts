// ── Shot Scope import API ────────────────────────────────────
// POST { mode: "preview" | "commit",
//        sheetUrl?: string,                      — published Google Sheet link
//        docs?: { name?: string, content: string }[],  — uploaded/pasted CSVs
//        course?: string, date?: string }        — fallback for headerless single-round imports
//
// preview → parse only; commit → upsert rounds (idempotent by id).

import { NextRequest, NextResponse } from "next/server";
import { insertRounds, type Round } from "@/lib/caddie-store";
import { buildRounds, fetchSheetDocs, type CsvDoc } from "@/lib/shotscope-import";

export const runtime = "nodejs";

interface RoundPreview {
  id: string;
  course: string;
  date: string;
  total: number;
  holeCount: number;
  shotCount: number;
  putts?: number;
  sgTee?: number;
  sgApproach?: number;
  sgShort?: number;
  sgPutting?: number;
}

function toPreview(r: Round): RoundPreview {
  return {
    id: r.id,
    course: r.course,
    date: r.date,
    total: r.total,
    holeCount: r.holes.length,
    shotCount: r.stats?.shots?.length ?? 0,
    putts: r.stats?.putts,
    sgTee: r.stats?.sgTee,
    sgApproach: r.stats?.sgApproach,
    sgShort: r.stats?.sgShort,
    sgPutting: r.stats?.sgPutting,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "commit" ? "commit" : "preview";

    const docs: CsvDoc[] = [];
    if (Array.isArray(body?.docs)) {
      for (const d of body.docs.slice(0, 20)) {
        if (typeof d?.content === "string" && d.content.trim()) {
          docs.push({ name: typeof d.name === "string" ? d.name : undefined, content: d.content });
        }
      }
    }
    if (typeof body?.sheetUrl === "string" && body.sheetUrl.trim()) {
      docs.push(...(await fetchSheetDocs(body.sheetUrl.trim())));
    }
    if (!docs.length) {
      return NextResponse.json({ error: "Nothing to import — add CSV files, pasted data, or a sheet link." }, { status: 400 });
    }

    const fallback = {
      course: typeof body?.course === "string" && body.course.trim() ? body.course.trim() : undefined,
      date: typeof body?.date === "string" && body.date.trim() ? body.date.trim() : undefined,
    };

    const { rounds, warnings } = buildRounds(docs, fallback);

    if (mode === "commit") {
      if (!rounds.length) {
        return NextResponse.json({ error: "No importable rounds found.", warnings }, { status: 400 });
      }
      const written = await insertRounds(rounds);
      return NextResponse.json({ written, rounds: rounds.map(toPreview), warnings });
    }

    return NextResponse.json({ rounds: rounds.map(toPreview), warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

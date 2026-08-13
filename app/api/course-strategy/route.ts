export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getRounds, isCompleteRound } from "@/lib/caddie-store";
import { callClaude, parseJsonLoose, MODELS } from "@/lib/openrouter";
import { resolveStyle } from "@/lib/coach-styles";

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface HoleAgg {
  hole: number;
  par: number | null;
  timesPlayed: number;
  totalScore: number;
  totalVsPar: number;
  vsParCount: number;
  doubleOrWorseCount: number;
}

interface HoleStat {
  hole: number;
  par: number | null;
  timesPlayed: number;
  avgScore: number;
  avgVsPar: number | null;
  doubleOrWorseCount: number;
}

interface AiHoleTip {
  hole: number;
  tip: string;
}

interface AiOut {
  gameplan?: string;
  holes?: AiHoleTip[];
}

// POST { course: string, style?: string }
// → { course, roundsAnalyzed, costliestHoles, gameplan, holes: [{ hole, par,
//     timesPlayed, avgScore, avgVsPar, doubleOrWorseCount, costliest, tip }] }
//
// Every numeric field is computed here deterministically from the player's
// own rounds — the AI call only supplies `gameplan` and each hole's `tip`,
// which are grounded in (and merged onto) those same aggregates so the UI
// never has to trust the model for a number.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const course = typeof body?.course === "string" ? body.course.trim() : "";
    if (!course) {
      return NextResponse.json({ error: "Missing 'course'." }, { status: 400 });
    }
    const style = resolveStyle(body?.style);

    const all = await getRounds(500);
    const rounds = all.filter((r) => isCompleteRound(r) && r.course === course);

    if (rounds.length < 2) {
      return NextResponse.json(
        { error: "Play at least 2 rounds here first." },
        { status: 400 }
      );
    }

    // ── Deterministic per-hole aggregates (1-18) ────────────────
    const agg = new Map<number, HoleAgg>();
    for (const r of rounds) {
      for (const h of r.holes) {
        if (!h || typeof h.hole !== "number" || h.hole < 1 || h.hole > 18) continue;
        if (typeof h.score !== "number" || h.score <= 0) continue;
        let a = agg.get(h.hole);
        if (!a) {
          a = { hole: h.hole, par: null, timesPlayed: 0, totalScore: 0, totalVsPar: 0, vsParCount: 0, doubleOrWorseCount: 0 };
          agg.set(h.hole, a);
        }
        a.timesPlayed++;
        a.totalScore += h.score;
        const par = typeof h.par === "number" && h.par > 0 ? h.par : null;
        if (par != null) {
          if (a.par == null) a.par = par;
          const vsPar = h.score - par;
          a.totalVsPar += vsPar;
          a.vsParCount++;
          if (vsPar >= 2) a.doubleOrWorseCount++;
        }
      }
    }

    const holeStats: HoleStat[] = [...agg.values()]
      .sort((a, b) => a.hole - b.hole)
      .map((a) => ({
        hole: a.hole,
        par: a.par,
        timesPlayed: a.timesPlayed,
        avgScore: r1(a.totalScore / a.timesPlayed),
        avgVsPar: a.vsParCount > 0 ? r1(a.totalVsPar / a.vsParCount) : null,
        doubleOrWorseCount: a.doubleOrWorseCount,
      }));

    // Costliest 3 holes: highest avgVsPar, tie-break by doubleOrWorseCount.
    const costliestHoles = holeStats
      .filter((h) => h.avgVsPar != null)
      .sort((a, b) => {
        const d = (b.avgVsPar as number) - (a.avgVsPar as number);
        if (Math.abs(d) > 1e-9) return d;
        return b.doubleOrWorseCount - a.doubleOrWorseCount;
      })
      .slice(0, 3)
      .map((h) => h.hole);

    // ── One AI call: overall gameplan + a damage-control tip per hole ────
    const prompt = `You are "Coach", a golf caddie giving course-specific strategy for "${course}", based on ${rounds.length} real rounds this player has logged there.

Ground every claim ONLY in the aggregated hole-by-hole data below. Never invent a
number, a hazard, or a hole feature that isn't implied by the data.

Focus every tip on DAMAGE CONTROL and COURSE MANAGEMENT — club selection, target lines,
playing away from the score-costing miss, accepting bogey on the hard holes — never swing
technique, which this data can't speak to.

HOLE DATA (hole, par, timesPlayed, avgScore, avgVsPar, doubleOrWorseCount):
${JSON.stringify(holeStats, null, 2)}

The 3 costliest holes (highest avgVsPar): ${costliestHoles.length ? costliestHoles.join(", ") : "none — not enough par data yet"}

Return ONLY valid JSON:
{
  "gameplan": string,      // 2-3 sentences: the overall course strategy
  "holes": [ { "hole": number, "tip": string } ]  // max 2 sentences each, damage-control only
}
Include a tip for every hole listed in HOLE DATA.

${style.voice}
Apply this voice to gameplan and each hole's tip. Never fabricate a number — every
figure you cite must come from HOLE DATA above.`;

    const raw = await callClaude([{ role: "user", content: prompt }], {
      model: MODELS.reasoning,
      json: true,
      maxTokens: 2000,
      temperature: 0.4,
    });
    const parsed = parseJsonLoose<AiOut>(raw);

    const tipByHole = new Map<number, string>();
    if (Array.isArray(parsed.holes)) {
      for (const h of parsed.holes) {
        if (h && typeof h.hole === "number" && typeof h.tip === "string") {
          tipByHole.set(h.hole, h.tip);
        }
      }
    }

    const holes = holeStats.map((h) => ({
      ...h,
      costliest: costliestHoles.includes(h.hole),
      tip: tipByHole.get(h.hole) ?? null,
    }));

    return NextResponse.json({
      course,
      roundsAnalyzed: rounds.length,
      costliestHoles,
      gameplan: typeof parsed.gameplan === "string" ? parsed.gameplan : "",
      holes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  getRounds,
  getSwingAnalyses,
  isCompleteRound,
  type Round,
  type SwingAnalysis,
} from "@/lib/caddie-store";
import { callClaude, MODELS, type ChatMessage } from "@/lib/openrouter";
import { golfer } from "@/lib/caddie-data";
import { resolveStyle } from "@/lib/coach-styles";
import { shotscopePromptBlock } from "@/lib/shotscope";

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Build a compact, trustworthy player-context blob the model can reason over.
// Scoring data only (per-hole scores + 18B scoring counts) — no GIR/putts.
function buildContext(all: Round[], swings: SwingAnalysis[] = []): string {
  const rounds = all.filter(
    (r) => isCompleteRound(r) && (r.stats?.holeCount ?? r.holes.length) >= 18 && r.holes.length >= 18
  );
  const swingReads = swings.slice(0, 8).map((s) => ({
    date: s.date.slice(0, 10),
    club: s.club ?? null,
    observation: s.observation,
    drill: s.drill,
    trend: s.trend ?? null,
    confidence: s.confidence,
    measuredAngles: s.metrics ?? null,
  }));

  const n = rounds.length;
  if (n === 0) {
    return JSON.stringify(
      { note: "No complete 18-hole rounds on record yet.", swingReads },
      null,
      2
    );
  }

  const totals = rounds.map((r) => r.total);
  const avg = r1(totals.reduce((a, b) => a + b, 0) / n);
  const best = Math.min(...totals);
  const worst = Math.max(...totals);
  const doublesPerRound = r1(rounds.reduce((s, r) => s + (r.stats?.doubleBogeyOrWorse ?? 0), 0) / n);
  const parsPerRound = r1(rounds.reduce((s, r) => s + (r.stats?.pars ?? 0), 0) / n);

  // Blow-up + tilt
  let totalHoles = 0, bigHoles = 0, chances = 0, recovered = 0, doubledUp = 0;
  for (const r of rounds) {
    const hs = r.holes.map((h) => h.score);
    for (let i = 0; i < hs.length; i++) {
      if (typeof hs[i] === "number" && hs[i] > 0) { totalHoles++; if (hs[i] >= 7) bigHoles++; }
      if (i < hs.length - 1 && hs[i] >= 7 && typeof hs[i + 1] === "number" && hs[i + 1] > 0) {
        chances++; if (hs[i + 1] <= 5) recovered++; if (hs[i + 1] >= 6) doubledUp++;
      }
    }
  }
  const bigHolePct = totalHoles ? r1((bigHoles / totalHoles) * 100) : 0;
  const recoveredPct = chances ? r1((recovered / chances) * 100) : null;
  const doubledUpPct = chances ? r1((doubledUp / chances) * 100) : null;

  // Front/back
  const fronts = rounds.map((r) => r.holes.slice(0, 9).reduce((s, h) => s + (h.score || 0), 0));
  const backs = rounds.map((r) => r.holes.slice(9, 18).reduce((s, h) => s + (h.score || 0), 0));
  const frontAvg = r1(fronts.reduce((a, b) => a + b, 0) / n);
  const backAvg = r1(backs.reduce((a, b) => a + b, 0) / n);

  // Per-course aggregates (>=2 rounds)
  const byCourse = new Map<string, number[]>();
  for (const r of rounds) {
    const arr = byCourse.get(r.course) ?? [];
    arr.push(r.total);
    byCourse.set(r.course, arr);
  }
  const courses = [...byCourse.entries()]
    .map(([course, scores]) => ({
      course,
      rounds: scores.length,
      avg: r1(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.min(...scores),
    }))
    .sort((a, b) => b.rounds - a.rounds)
    .slice(0, 12);

  // Recent rounds
  const recent = [...rounds]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
    .map((r) => ({ date: r.date.slice(0, 10), course: r.course, total: r.total }));

  return JSON.stringify(
    {
      player: golfer.name,
      goal: golfer.goal,
      roundsAnalyzed: n,
      scoringAvg: avg,
      best,
      worst,
      parsPerRound,
      doublesOrWorsePerRound: doublesPerRound,
      blowUpHolePct: bigHolePct,
      tilt: {
        bounceBackPct: recoveredPct,
        droppedAnotherShotPct: doubledUpPct,
        note: "After a blow-up hole (7+), how often the next hole stayed clean (<=5) vs dropped another shot.",
      },
      frontNineAvg: frontAvg,
      backNineAvg: backAvg,
      perCourse: courses,
      recentRounds: recent,
      swingReads,
    },
    null,
    2
  );
}

// POST { messages: [{role:'user'|'assistant', content:string}] }
// → { reply: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const history: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (!history.length) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 });
    }

    const [all, swings] = await Promise.all([getRounds(300), getSwingAnalyses(8)]);
    const context = buildContext(all, swings);
    const style = resolveStyle(body?.style);

    const system = `You are "Coach", ${golfer.name}'s personal AI golf caddie. Goal: ${golfer.goal}.

You answer questions using ONLY the player's real data below. Rules:
- Ground every claim in the DATA. If the data can't answer something, say so plainly.
- SCORING DATA ONLY for 18Birdies-sourced rounds: their GIR / fairways / putts are unreliable — never cite or reason about them.
- EXCEPTION: the SHOT-LEVEL DATA block (if present) comes from Shot Scope shot tracking and IS reliable — per-club strokes gained, putts, 3-putts, chunks, and lie data there are ground truth. Cite it freely and prefer it when diagnosing where strokes are lost.
- The dominant leak is BLOW-UP HOLES (doubles/triples) and TILT (compounding one bad hole into two). Steer advice toward damage control, course management, and the mental game — not swing technique.
- EXCEPTION: swingReads are real AI video analyses of the player's actual swing. When asked about swing, technique, or drills, cite them (with dates) — they are the only technique data you may use.
- Be concise (2-5 sentences usually), specific, and encouraging. Use real numbers from the data. No markdown headers; short paragraphs or a tight list at most.
- When asked about a specific course, use perCourse. When asked "why" something happens, reason from blow-up rate, tilt, and front/back splits.

PLAYER DATA (the only source of truth):
${context}

${shotscopePromptBlock(all)}

${style.voice}`;

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...history.slice(-12).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String((m as { content?: unknown }).content ?? ""),
      })) as ChatMessage[],
    ];

    const reply = await callClaude(messages, {
      model: MODELS.reasoning,
      maxTokens: 600,
      temperature: 0.5,
    });

    return NextResponse.json({ reply: reply.trim() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

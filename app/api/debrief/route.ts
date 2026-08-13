export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getRounds, isCompleteRound, type Round } from "@/lib/caddie-store";
import { callClaude, MODELS } from "@/lib/openrouter";
import { golfer } from "@/lib/caddie-data";
import { resolveStyle } from "@/lib/coach-styles";
import { analyzeShots, type Shot } from "@/lib/shotscope";

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Per-round debrief: "what cost you strokes in THIS round, and what to do."
// Built only on trustworthy 18Birdies signals (per-hole scores + round scoring
// counts). No per-hole par is assumed. A "blow-up" hole is score >= 7; the
// damage-vs-bogey estimate treats 5 (a par-4 bogey) as a clean target.
//
// GET /api/debrief                       → latest complete round
// GET /api/debrief?roundId=X              → that round
// GET /api/debrief?style=classic|tropicana → voice for coachNote
export async function GET(req: NextRequest) {
  try {
    const roundId = req.nextUrl.searchParams.get("roundId");
    const style = resolveStyle(req.nextUrl.searchParams.get("style"));
    const all = await getRounds(300);

    const complete = all.filter(isCompleteRound);
    const target = roundId
      ? all.find((r) => r.id === roundId)
      : complete.sort((a, b) => b.date.localeCompare(a.date))[0];

    if (!target) {
      return NextResponse.json({ error: "No round found." }, { status: 404 });
    }

    const holeScores = target.holes.map((h) => h.score).filter((s) => typeof s === "number" && s > 0);
    const holeCount = target.stats?.holeCount ?? holeScores.length;
    const front9 = holeScores.slice(0, 9).reduce((a, b) => a + b, 0);
    const back9 = holeCount >= 18 ? holeScores.slice(9, 18).reduce((a, b) => a + b, 0) : 0;

    // Personal baseline = other complete 18-hole rounds (excluding this one)
    const peers = complete.filter(
      (r) => r.id !== target.id && (r.stats?.holeCount ?? r.holes.length) >= 18
    );
    const personalAvg = peers.length
      ? r1(peers.reduce((s, r) => s + r.total, 0) / peers.length)
      : null;
    const best = peers.length ? Math.min(...peers.map((r) => r.total)) : null;
    const vsAvg = personalAvg != null ? r1(target.total - personalAvg) : null;

    // Blow-up holes (score >= 7) and damage vs a clean bogey (5)
    const BOGEY_TARGET = 5;
    const blowUps = target.holes
      .map((h) => ({ hole: h.hole, score: h.score }))
      .filter((h) => h.score >= 7)
      .sort((a, b) => b.score - a.score);
    const blowUpStrokesOverBogey = blowUps.reduce((s, h) => s + Math.max(0, h.score - BOGEY_TARGET), 0);
    const cleanScore = target.total - blowUpStrokesOverBogey;

    // ── Mental game: bounce-back / tilt detector ──────────────────
    // After a blow-up hole, what happened on the NEXT hole? Dropping another
    // shot (next score >= 6) right after a blow-up is the classic tilt pattern.
    let bouncebackChances = 0;
    let bouncebackClean = 0; // next hole was bogey-or-better (<= 5)
    let nextHoleTotal = 0;
    for (let i = 0; i < target.holes.length - 1; i++) {
      if (target.holes[i].score >= 7) {
        const next = target.holes[i + 1].score;
        if (typeof next === "number" && next > 0) {
          bouncebackChances++;
          nextHoleTotal += next;
          if (next <= 5) bouncebackClean++;
        }
      }
    }
    const bounceback =
      bouncebackChances > 0
        ? {
            chances: bouncebackChances,
            recovered: bouncebackClean,
            recoveredPct: r1((bouncebackClean / bouncebackChances) * 100),
            avgNextHole: r1(nextHoleTotal / bouncebackChances),
            tilt: bouncebackClean / bouncebackChances < 0.5, // dropped another shot more often than not
          }
        : null;

    // Round scoring breakdown (reliable 18B aggregates)
    const scoring = {
      pars: (target.stats?.pars ?? 0) + (target.stats?.birdies ?? 0) + (target.stats?.eagles ?? 0),
      birdiesPlus: (target.stats?.birdies ?? 0) + (target.stats?.eagles ?? 0),
      bogeys: target.stats?.bogeys ?? 0,
      doublesPlus: target.stats?.doubleBogeyOrWorse ?? 0,
    };

    // Deterministic headline (works with zero AI / no key)
    let headline: string;
    if (blowUps.length === 0) {
      headline = `Clean card — no blow-up holes. ${target.total} with zero 7s is how you break your average.`;
    } else if (blowUpStrokesOverBogey >= 6) {
      headline = `${blowUps.length} blow-up hole${blowUps.length === 1 ? "" : "s"} cost ~${blowUpStrokesOverBogey} strokes. Bogey those and you shoot ${cleanScore}.`;
    } else {
      headline = `Mostly steady. ${blowUps.length} hole${blowUps.length === 1 ? "" : "s"} got away (~${blowUpStrokesOverBogey} strokes over bogey).`;
    }

    // Optional AI coach note (one specific, encouraging line). Degrades to a
    // deterministic fallback if no key / failure — never blocks the debrief.
    let coachNote = "";
    try {
      if (process.env.OPENROUTER_API_KEY) {
        // Shot-level insights when the round came from Shot Scope shot tracking.
        let shotScope: Record<string, unknown> | null = null;
        if (Array.isArray(target.stats?.shots) && target.stats.shots.length) {
          const ins = analyzeShots(target.stats.shots as Shot[]);
          shotScope = {
            sgByCategory: ins.sgByCategory,
            worstClubsByTotalSG: ins.clubs.slice(0, 3),
            threePuttHoles: ins.threePuttHoles,
            chunkedShots: ins.chunks,
          };
        }
        const facts = {
          course: target.course,
          total: target.total,
          vsYourAvg: vsAvg,
          blowUpHoles: blowUps.map((b) => `#${b.hole}: ${b.score}`),
          strokesLostToBlowUps: blowUpStrokesOverBogey,
          scoreIfBogeyedThose: cleanScore,
          bounceBack: bounceback,
          frontVsBack: holeCount >= 18 ? { front9, back9 } : null,
          ...(shotScope ? { shotScope } : {}),
        };
        const statsRule = shotScope
          ? "The shotScope facts are real shot-tracking data — reliable; lean on them for the takeaway."
          : "No GIR/putts talk (data unreliable).";
        const prompt = `You are "Coach", ${golfer.name}'s AI golf caddie (goal: ${golfer.goal}). ${golfer.name} just logged a round. Using ONLY these facts, write a SINGLE punchy, specific, encouraging sentence (max 30 words) about the one thing to take away — focus on damage control / course management / mental game, not technique. ${statsRule}\n\nFACTS:\n${JSON.stringify(facts, null, 2)}\n\n${style.voice}\n\nReturn only the sentence, no quotes.`;
        const raw = await callClaude([{ role: "user", content: prompt }], {
          model: MODELS.reasoning,
          maxTokens: 120,
          temperature: 0.6,
        });
        coachNote = raw.trim().replace(/^["']|["']$/g, "");
      }
    } catch (e) {
      console.error("[debrief] coach note failed", e);
    }
    if (!coachNote) {
      coachNote = bounceback?.tilt
        ? `After a blow-up you averaged ${bounceback?.avgNextHole} on the next hole — reset your target to bogey and just stop the bleeding.`
        : blowUps.length === 0
          ? "No damage control needed today — bank this and repeat the patience."
          : "Your floor is the leak, not your ceiling. Play your trouble holes to bogey and the average drops fast.";
    }

    return NextResponse.json({
      round: {
        id: target.id,
        course: target.course,
        date: target.date,
        total: target.total,
        holeCount,
        front9,
        back9,
      },
      personalAvg,
      best,
      vsAvg,
      scoring,
      blowUps,
      blowUpCount: blowUps.length,
      blowUpStrokesOverBogey,
      cleanScore,
      bounceback,
      headline,
      coachNote,
    });
  } catch (e) {
    console.error("[debrief]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

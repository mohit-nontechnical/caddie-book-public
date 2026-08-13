export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getRounds, isCompleteRound, type Round } from "@/lib/caddie-store";
import { callClaude, MODELS } from "@/lib/openrouter";
import { golfer } from "@/lib/caddie-data";
import { resolveStyle } from "@/lib/coach-styles";

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface RoutineItem {
  icon: string;
  title: string;
  body: string;
}

// Pre-round mental card: a short "before you tee off" routine, grounded in the
// player's REAL leaks (slow starts, blow-up rate, tilt). Scoring-data only.
// GET /api/preround[?style=classic|tropicana]
export async function GET(req: NextRequest) {
  try {
    const style = resolveStyle(req.nextUrl.searchParams.get("style"));
    const all = await getRounds(300);
    const rounds = all.filter(
      (r) => isCompleteRound(r) && (r.stats?.holeCount ?? r.holes.length) >= 18 && r.holes.length >= 18
    );

    if (rounds.length < 3) {
      // Not enough data — return a generic-but-solid routine.
      return NextResponse.json({
        grounded: false,
        mantra: "Bogey is a good score. Doubles are the enemy.",
        routine: [
          { icon: "🎯", title: "Play to bogey", body: "Par is a bonus, not the target. A clean bogey round is mid-80s — that's the goal." },
          { icon: "⛑️", title: "Take your medicine", body: "In trouble? Wedge out to the fairway. One bad swing, never three." },
          { icon: "🧠", title: "Reset after a blow-up", body: "Made a big number? Stop, one breath, bogey-target the next tee. Don't chase it back." },
        ] as RoutineItem[],
      });
    }

    const n = rounds.length;
    const avg = r1(rounds.reduce((s, r) => s + r.total, 0) / n);
    const goalGap = r1(avg - 85);

    // Per-hole averages (holes 1..18)
    const perHole = Array.from({ length: 18 }, (_, i) => {
      let sum = 0;
      let cnt = 0;
      for (const r of rounds) {
        const sc = r.holes[i]?.score;
        if (typeof sc === "number" && sc > 0) {
          sum += sc;
          cnt++;
        }
      }
      return cnt ? sum / cnt : 0;
    });
    const overallPerHole = perHole.reduce((a, b) => a + b, 0) / 18;
    const openingAvg = (perHole[0] + perHole[1] + perHole[2]) / 3;
    const slowStart = r1(openingAvg - overallPerHole); // strokes/hole over typical on opening 3
    const isSlowStarter = slowStart >= 0.25;

    // Blow-up rate + tilt (bounce-back)
    let totalHoles = 0;
    let bigHoles = 0;
    let chances = 0;
    let recovered = 0;
    let doubledUp = 0;
    for (const r of rounds) {
      const hs = r.holes.map((h) => h.score);
      for (let i = 0; i < hs.length; i++) {
        if (typeof hs[i] === "number" && hs[i] > 0) {
          totalHoles++;
          if (hs[i] >= 7) bigHoles++;
        }
        if (i < hs.length - 1 && hs[i] >= 7 && typeof hs[i + 1] === "number" && hs[i + 1] > 0) {
          chances++;
          if (hs[i + 1] <= 5) recovered++;
          if (hs[i + 1] >= 6) doubledUp++;
        }
      }
    }
    const bigHolePct = totalHoles ? r1((bigHoles / totalHoles) * 100) : 0;
    const doublesPerRound = r1(
      rounds.reduce((s, r) => s + (r.stats?.doubleBogeyOrWorse ?? 0), 0) / n
    );
    const recoveredPct = chances ? r1((recovered / chances) * 100) : null;
    const doubledUpPct = chances ? r1((doubledUp / chances) * 100) : null;
    const tilt = recoveredPct != null && recoveredPct < 50;

    // ── Build a grounded 3-item routine ──────────────────────────
    const routine: RoutineItem[] = [];

    // 1) Score target — always
    const bogeyRound = 90; // par72 + 18
    routine.push({
      icon: "🎯",
      title: "Play to bogey golf",
      body: `Your average is ${avg}. Bogey on every hole is ${bogeyRound} — aim there. Par is a bonus; chasing it is what makes doubles.`,
    });

    // 2) Opening holes (only if slow starter) else trouble rule
    if (isSlowStarter) {
      routine.push({
        icon: "🏁",
        title: "Treat hole 1 like hole 10",
        body: `Your first 3 holes run ~${slowStart} strokes/hole hot. No hero shots early — easy tempo, fairway finder, settle in.`,
      });
    }

    // 3) Trouble rule — always (this is the blow-up leak)
    routine.push({
      icon: "⛑️",
      title: "Take your medicine",
      body: `${bigHolePct}% of your holes become a 7+. The moment you're in trouble, wedge back to the fairway. Bogey from there beats triple every time.`,
    });

    // 4) Reset / tilt — emphasized if tilt detected
    routine.push({
      icon: "🧠",
      title: tilt ? "Stop the bleeding" : "Reset after a blow-up",
      body: tilt
        ? `You drop another shot ${doubledUpPct}% of the time right after a blow-up. After ANY big number: stop, one breath, bogey-target the next tee. One bad hole — not two.`
        : `Made a big number? One breath, reset to a bogey target on the next tee. You already recover well — keep it.`,
    });

    // Optional AI mantra — one short line in the player's context. Degrades gracefully.
    let mantra = tilt
      ? "One bad hole, not two. Bogey is your friend."
      : "Bogey is a good score. Doubles are the enemy.";
    try {
      if (process.env.OPENROUTER_API_KEY) {
        const facts = { avg, goalGap, bigHolePct, doublesPerRound, recoveredPct, doubledUpPct, isSlowStarter, tilt };
        const prompt = `You are "Coach", ${golfer.name}'s golf caddie (goal: ${golfer.goal}). Write ONE short pre-round mantra (max 12 words) ${golfer.name} can repeat on the first tee. Ground it in the dominant leak below — damage control / mental game, never technique. No stat-quoting in the mantra itself; make it punchy and repeatable.\n\nFACTS:\n${JSON.stringify(facts)}\n\n${style.voice}\n\nReturn only the mantra, no quotes.`;
        const raw = await callClaude([{ role: "user", content: prompt }], {
          model: MODELS.reasoning,
          maxTokens: 40,
          temperature: 0.7,
        });
        const cleaned = raw.trim().replace(/^["']|["']$/g, "");
        if (cleaned) mantra = cleaned;
      }
    } catch (e) {
      console.error("[preround] mantra failed", e);
    }

    return NextResponse.json({
      grounded: true,
      stats: { avg, goalGap, bigHolePct, doublesPerRound, recoveredPct, doubledUpPct, isSlowStarter, slowStart, tilt, rounds: n },
      mantra,
      routine,
    });
  } catch (e) {
    console.error("[preround]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

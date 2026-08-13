import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseJsonLoose, MODELS } from "@/lib/openrouter";
import { getRounds, saveGrades, isCompleteRound, savePlan, loadPlan } from "@/lib/caddie-store";
import type { CoachPlan, Round } from "@/lib/caddie-store";
import { slots, golfer } from "@/lib/caddie-data";
import { getLiveHandicap } from "@/lib/live-handicap";
import { resolveStyle } from "@/lib/coach-styles";
import { shotscopePromptBlock, stripShots } from "@/lib/shotscope";

interface CoachOut {
  slotGrades?: { id: string; grade: string }[];
  plan?: { focus: string; actions: string[] };
}

export const runtime = "nodejs";

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// POST { rounds?: Round[], excludePartial?: boolean, newPlan?: boolean }
// → { slotGrades, patterns, focusDrill, weeklyInsight, plan, progress, roundsAnalyzed, excludedCount }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const allRounds = Array.isArray(body?.rounds) && body.rounds.length ? body.rounds : await getRounds(200);
    const excludePartial = body?.excludePartial === true;
    const newPlan = body?.newPlan === true;
    const style = resolveStyle(body?.style);

    // Rounds passed to the model (may exclude partials per toggle)
    const rounds = excludePartial ? allRounds.filter(isCompleteRound) : allRounds;
    const excludedCount = allRounds.length - rounds.length;

    // ── Reliable aggregates (18-hole complete rounds only) ─────────────────
    const complete18 = allRounds.filter((r: Round) => isCompleteRound(r) && (r.stats?.holeCount ?? r.holes.length) >= 18);
    const n = complete18.length;

    let avg = 0;
    let doublesPerRound = 0;
    let parsPerRound = 0;
    let birdiesPerRound = 0;
    let bigHolePct = 0; // % of individual holeStrokes >= 7

    if (n > 0) {
      avg = r1(complete18.reduce((s: number, r: Round) => s + r.total, 0) / n);

      doublesPerRound = r1(
        complete18.reduce((s: number, r: Round) => s + (r.stats?.doubleBogeyOrWorse ?? 0), 0) / n
      );
      parsPerRound = r1(
        complete18.reduce((s: number, r: Round) => s + (r.stats?.pars ?? 0), 0) / n
      );
      birdiesPerRound = r1(
        complete18.reduce((s: number, r: Round) => s + ((r.stats?.birdies ?? 0) + (r.stats?.eagles ?? 0)), 0) / n
      );

      // bigHolePct: holes where individual stroke count >= 7
      let totalHoles = 0;
      let bigHoles = 0;
      for (const r of complete18) {
        for (const h of r.holes) {
          if (h.score != null) {
            totalHoles++;
            if (h.score >= 7) bigHoles++;
          }
        }
      }
      bigHolePct = totalHoles > 0 ? r1((bigHoles / totalHoles) * 100) : 0;
    }

    const gapTo85 = n > 0 ? r1(avg - 85) : null;

    // Live handicap index — never quote the static seed value to the model.
    let liveIndex: number | null = null;
    try {
      liveIndex = (await getLiveHandicap({ rounds: allRounds })).index;
    } catch (e) {
      console.error("coach: live handicap failed, omitting index", e);
    }

    // ── Prompt ─────────────────────────────────────────────────
    const slotSummary = slots.map((s) => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
      trend: s.trend,
      diag: s.diag,
    }));

    const scoringBlock =
      n > 0
        ? `RELIABLE SCORING SIGNALS (last ${n} complete 18-hole rounds):
- Avg score: ${avg} (gap to 85: ${gapTo85 != null && gapTo85 > 0 ? "+" + gapTo85 : gapTo85})
- Doubles/blow-ups per round: ${doublesPerRound}
- Pars per round: ${parsPerRound}
- Birdies+eagles per round: ${birdiesPerRound}
- Hole blow-up rate (score ≥ 7): ${bigHolePct}% of holes played

NOTE: GIR, putts, and fairway stats from 18Birdies-sourced rounds are unreliable — DO NOT
reference them. EXCEPTION: rounds with stats.source "shotscope" carry real shot-tracking
data (stats + the SHOT-LEVEL DATA block below) and ARE reliable — cite them freely.
The dominant leak is BLOW-UP HOLES (doubles/triples). Coach must focus weeklyInsight,
focusDrill, and the plan on DAMAGE CONTROL and COURSE MANAGEMENT strategies to convert
7s and 8s into 5s and 6s (bogey golf is a win on a hard hole).`
        : `No complete 18-hole rounds found — base analysis on bag-slot grades only.
Focus weeklyInsight, focusDrill, and plan on blow-up hole prevention as the most
common amateur leak.`;

    const prompt = `You are "Coach", the AI caddie for ${golfer.name} (${liveIndex != null ? `handicap ${liveIndex.toFixed(1)}` : "handicap not yet rated"}, goal: ${golfer.goal}).
Analyze the player's recent rounds and current bag-slot grades, then surface plain-English patterns.

CURRENT BAG SLOTS:
${JSON.stringify(slotSummary, null, 2)}

${scoringBlock}

${shotscopePromptBlock(allRounds)}

RECENT ROUNDS (for slot-grade context — may be partial/empty):
${JSON.stringify(stripShots(rounds.slice(0, 10)), null, 2)}

Return ONLY valid JSON:
{
  "slotGrades": [ { "id": string, "grade": "A"|"B"|"C"|"D"|"F" } ],
  "patterns": [ { "tag": string, "slot": string, "text": string } ],
  "focusDrill": { "slot": string, "drill": string, "why": string },
  "weeklyInsight": string,
  "plan": {
    "focus": string (one line — the core damage-control focus for the next 4 weeks),
    "actions": string[] (2–4 concrete, mostly on-course-strategy / practice items; be specific)
  }
}
Focus on the biggest stroke leaks. Be specific and encouraging. 3-5 patterns max.
The plan MUST target blow-up hole reduction / damage control as the primary lever.

${style.voice}
Apply this voice ONLY to prose/user-facing text fields (patterns[].text, weeklyInsight,
focusDrill.why, focusDrill.drill, plan.focus, plan.actions[]). Field names, JSON structure,
and slotGrades values (A/B/C/D/F) are UNAFFECTED by voice — never restyle those.`;

    const raw = await callClaude([{ role: "user", content: prompt }], {
      model: MODELS.reasoning,
      json: true,
      maxTokens: 2000,
      temperature: 0.5,
    });

    const parsed = parseJsonLoose<CoachOut>(raw);

    // Persist grades
    try {
      if (parsed.slotGrades?.length) await saveGrades(parsed.slotGrades);
    } catch (e) {
      console.error("coach: failed to persist grades", e);
    }

    // ── Plan persistence logic ──────────────────────────────────
    let activePlan: CoachPlan | null = await loadPlan();

    const modelPlan = parsed.plan;
    if ((!activePlan || newPlan) && modelPlan?.focus) {
      const newCoachPlan: CoachPlan = {
        focus: modelPlan.focus,
        actions: Array.isArray(modelPlan.actions) ? modelPlan.actions : [],
        baselineAvg: avg,
        baselineDoubles: doublesPerRound,
        createdAt: new Date().toISOString(),
      };
      try {
        await savePlan(newCoachPlan);
        activePlan = newCoachPlan;
      } catch (e) {
        console.error("coach: failed to persist plan", e);
      }
    }
    // else: keep existing plan — don't overwrite

    // ── Progress vs baseline ────────────────────────────────────
    let progress: {
      baselineAvg: number;
      currentAvg: number;
      baselineDoubles: number;
      currentDoubles: number;
      deltaDoubles: number;
      status: string;
    } | null = null;

    if (activePlan) {
      const delta = r1(doublesPerRound - activePlan.baselineDoubles);
      let status = "steady";
      if (doublesPerRound < activePlan.baselineDoubles - 0.3) status = "improving";
      else if (doublesPerRound > activePlan.baselineDoubles + 0.3) status = "slipping";
      progress = {
        baselineAvg: activePlan.baselineAvg,
        currentAvg: avg,
        baselineDoubles: activePlan.baselineDoubles,
        currentDoubles: doublesPerRound,
        deltaDoubles: delta,
        status,
      };
    }

    return NextResponse.json({
      ...parsed,
      plan: activePlan
        ? { focus: activePlan.focus, actions: activePlan.actions }
        : undefined,
      progress: progress ?? undefined,
      roundsAnalyzed: rounds.length,
      excludedCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

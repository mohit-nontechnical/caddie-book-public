import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseJsonLoose, visionMessage, MODELS } from "@/lib/openrouter";
import {
  getSwingAnalyses,
  saveSwingAnalysis,
  deleteSwingAnalysis,
  type SwingAnalysis,
} from "@/lib/caddie-store";
import { resolveStyle } from "@/lib/coach-styles";

export const runtime = "nodejs";

const MAX_FRAMES = 8;

// Keep only the compact, known numeric summary fields for persistence —
// never store the raw client payload.
const METRIC_KEYS = [
  "shoulderTurnAtTopDeg",
  "hipTurnAtTopDeg",
  "xFactorAtTopDeg",
  "spineTiltAtAddressDeg",
  "spineTiltAtTopDeg",
  "maxHeadSwayPct",
] as const;

function extractMetrics(pose: unknown): Record<string, number | null> | undefined {
  if (!pose || typeof pose !== "object") return undefined;
  const src = pose as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  let any = false;
  for (const k of METRIC_KEYS) {
    const v = src[k];
    if (typeof v === "number" && isFinite(v)) {
      out[k] = v;
      any = true;
    } else {
      out[k] = null;
    }
  }
  return any ? out : undefined;
}

// GET → { analyses: SwingAnalysis[] }  (Coach's swing memory, newest first)
export async function GET() {
  const analyses = await getSwingAnalyses(20);
  return NextResponse.json({ analyses });
}

// DELETE { id } → remove one analysis from memory
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing 'id'" }, { status: 400 });
    await deleteSwingAnalysis(String(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST { frames: string[] (up to 8 base64 data URLs), club?, context?, source?: "video"|"photos",
//        pose?: PoseSummary (measured client-side via MediaPipe) }
// → SwingAnalysis (persisted — Coach remembers it)
export async function POST(req: NextRequest) {
  try {
    const { frames, club, context, source, pose, style: styleRaw } = await req.json();
    if (!Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: "Missing 'frames' (array of base64 data URLs)" }, { status: 400 });
    }
    const style = resolveStyle(styleRaw);
    const images = (frames as string[])
      .slice(0, MAX_FRAMES)
      .map((f) => (f.startsWith("data:") ? f : `data:image/jpeg;base64,${f}`));

    // Prior reads give the model memory: it can flag recurring faults and progress.
    const prior = await getSwingAnalyses(5);
    const priorBlob = prior.length
      ? JSON.stringify(
          prior.map((p) => ({
            date: p.date.slice(0, 10),
            club: p.club ?? null,
            observation: p.observation,
            drill: p.drill,
            measuredAngles: p.metrics ?? null,
          }))
        )
      : null;

    // Client-measured pose data (MediaPipe) — sanitize to a plain object.
    const poseBlob =
      pose && typeof pose === "object" ? JSON.stringify(pose).slice(0, 4000) : null;

    const prompt = `You are a PGA-level golf coach analyzing ${images.length} sequential frames sampled evenly from one swing${
      club ? ` with a ${club}` : ""
    }${source === "video" ? " (extracted from a video the player uploaded)" : ""}.
${context ? `Context from the player: ${context}. ` : ""}${
      poseBlob
        ? `\nMEASURED BODY POSITIONS (computed from these exact frames by pose estimation; degrees; "top" = top of backswing; xFactor = shoulder turn minus hip turn; headSwayPct = lateral head drift as % of shoulder width; camera-angle caveats apply so treat as approximate):\n${poseBlob}\n`
        : ""
    }${
      priorBlob
        ? `\nPRIOR SWING READS for this player (newest first) — compare against these (including measuredAngles) and note recurring faults or improvement:\n${priorBlob}\n`
        : ""
    }
Identify the single most impactful fault or strength, then prescribe ONE drill.${
      poseBlob
        ? " Ground your observation in the measured numbers where they support what you see — cite 1-2 of them."
        : ""
    }
Return ONLY valid JSON:
{
  "observation": string,            // plain-English, specific, 1-2 sentences
  "drillRecommendation": string,    // name + one-line how-to
  "bagSlotAffected": "driver"|"woods"|"hybrid"|"midiron"|"shortiron"|"wedge"|"approach"|"chip"|"bunker"|"putting"|"mgmt"|"zones"|"pressure"|"consist",
  "confidence": "low"|"medium"|"high",
  "trend": string|null              // ONLY if prior reads exist: 1 sentence on recurrence/progress vs them, else null
}

${style.voice}
Apply this voice ONLY to the prose fields (observation, drillRecommendation, trend).
bagSlotAffected and confidence MUST stay exactly one of the listed enum values — never
restyle or rephrase those.`;

    const raw = await callClaude([visionMessage(prompt, images)], {
      model: MODELS.vision,
      json: true,
      maxTokens: 700,
      temperature: 0.3,
    });

    const parsed = parseJsonLoose<{
      observation?: string;
      drillRecommendation?: string;
      bagSlotAffected?: string;
      confidence?: string;
      trend?: string | null;
    }>(raw);

    if (!parsed?.observation || !parsed?.drillRecommendation) {
      return NextResponse.json({ error: "Model returned an incomplete analysis" }, { status: 502 });
    }

    // Commit to memory — Coach chat and future analyses read this back.
    const analysis: SwingAnalysis = {
      id: `swing_${Date.now()}`,
      date: new Date().toISOString(),
      club: club ? String(club) : undefined,
      observation: String(parsed.observation),
      drill: String(parsed.drillRecommendation),
      bagSlot: String(parsed.bagSlotAffected ?? "consist"),
      confidence: String(parsed.confidence ?? "medium"),
      trend: parsed.trend ? String(parsed.trend) : undefined,
      metrics: extractMetrics(pose),
      frameCount: images.length,
      source: source === "video" ? "video" : "photos",
    };
    await saveSwingAnalysis(analysis);

    return NextResponse.json({
      ...analysis,
      // Back-compat field names the UI already uses:
      drillRecommendation: analysis.drill,
      bagSlotAffected: analysis.bagSlot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

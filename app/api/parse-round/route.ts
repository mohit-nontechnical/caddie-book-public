import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseJsonLoose, visionMessage, MODELS } from "@/lib/openrouter";
import { addRound, type HoleResult } from "@/lib/caddie-store";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

interface ParsedRound {
  course?: string | null;
  slope?: number | null;
  rating?: number | null;
  total?: number;
  holes?: HoleResult[];
}

// POST { image: "data:image/png;base64,..." | base64string }
// → { course, slope, rating, total, holes: [{hole,par,score,fir,gir,putts}] }
export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Missing 'image' (base64 data URL)" }, { status: 400 });
    }
    const dataUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

    const prompt = `You are a golf scorecard OCR engine. Read this scorecard image and extract structured data.
Return ONLY valid JSON with this exact shape:
{
  "course": string | null,
  "slope": number | null,
  "rating": number | null,
  "total": number,
  "holes": [ { "hole": number, "par": number, "score": number, "fir": boolean | null, "gir": boolean, "putts": number } ]
}
Rules:
- "fir" (fairway in regulation) is null for par-3 holes.
- If a field is illegible, make your best estimate and never break the JSON shape.
- "total" is the sum of all hole scores.
- Include every hole you can read (typically 9 or 18).`;

    const raw = await callClaude([visionMessage(prompt, [dataUrl])], {
      model: MODELS.vision,
      json: true,
      maxTokens: 2000,
      temperature: 0,
    });

    const parsed = parseJsonLoose<ParsedRound>(raw);

    // Best-effort persistence — never let a DB hiccup break the parse response.
    let saved = false;
    try {
      await addRound({
        id: randomUUID(),
        course: parsed.course ?? "Unknown course",
        date: new Date().toISOString(),
        total: parsed.total ?? 0,
        slope: parsed.slope ?? undefined,
        rating: parsed.rating ?? undefined,
        holes: parsed.holes ?? [],
      });
      saved = true;
    } catch (e) {
      console.error("parse-round: failed to persist round", e);
    }

    return NextResponse.json({ ...parsed, saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRounds } from "@/lib/caddie-store";
import { computeTrendAlerts } from "@/lib/trends";

// Deterministic trend alerts (no AI call) — last 5 rounds vs the up-to-10
// before them. GET /api/trends → { alerts: TrendAlert[] }
export async function GET() {
  try {
    const rounds = await getRounds(300);
    const alerts = computeTrendAlerts(rounds);
    return NextResponse.json({ alerts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

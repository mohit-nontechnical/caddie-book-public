import { NextResponse } from "next/server";
import { loadGrades } from "@/lib/caddie-store";

export const runtime = "nodejs";

// GET → { grades: { slotId: "A".."F" } } — the latest persisted Coach grades.
export async function GET() {
  const grades = await loadGrades();
  return NextResponse.json({ grades });
}

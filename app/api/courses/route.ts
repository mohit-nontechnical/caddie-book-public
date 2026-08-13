import { NextRequest, NextResponse } from "next/server";
import { setCourseRating } from "@/lib/caddie-store";
import { normCourse } from "@/lib/course-ratings";

export const runtime = "nodejs";

// PUT { name, rating, slope, par } → saves a course rating override.
export async function PUT(req: NextRequest) {
  try {
    const { name, rating, slope, par } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Missing course 'name'" }, { status: 400 });
    }
    const r = Number(rating), s = Number(slope), p = Number(par);
    if (!(r > 0) || !(s > 0) || !(p > 0)) {
      return NextResponse.json({ error: "rating, slope and par must be positive numbers" }, { status: 400 });
    }
    await setCourseRating(normCourse(name), name, { rating: r, slope: s, par: p });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

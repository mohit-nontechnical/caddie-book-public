import { NextResponse } from "next/server";
import { searchCourses, getCourseTees, filterMenTees, NcrdbError } from "@/lib/ncrdb";
import { searchUsgaCourses, usgaCourseById, usgaCourseCount } from "@/lib/usga-courses";

export const runtime = "nodejs";

// ── Local-first course lookup ────────────────────────────────────
// USGA's live per-tee lookup (NCRDB) works from a residential IP but its WAF
// 403s Vercel's IPs, so per-tee lookup is dead in prod. Local-first design:
//
//   ?name=&state=        -> search the local USGA sheet (data/usga-courses.json,
//                            seeded into usga_courses). Instant, no NCRDB call.
//                            Falls back to the old live NCRDB search if the
//                            local table is empty/unavailable.
//   ?candidateId=<local id> (new) -> try NCRDB per-tee for that candidate's
//                            course name; on ANY failure (403/timeout/no
//                            match) fall back to the local row's tips
//                            rating/slope/par, clearly labeled `source: "tips"`.
//   ?courseId=<NCRDB id>  -> unchanged, kept for backward compat.
//
// IMPORTANT: `tips` values are CHAMPIONSHIP/TIPS ratings (one per course,
// hardest tees), not the White/Blue tees the user plays. Never surfaced as
// anything but a labeled, editable fallback — callers must show the "TIPS
// RATING" label and let the user edit before applying.

interface SheetCandidate {
  id: number;
  name: string;
  facility: string;
  city: string;
  state: string;
  tips: { rating: number; slope: number; par: number };
}

async function searchLocalSheet(name: string, state: string | null): Promise<SheetCandidate[] | null> {
  const count = await usgaCourseCount();
  if (count === 0) return null; // signal "unavailable" so caller can fall back to NCRDB
  const rows = await searchUsgaCourses(name, state ?? undefined, 12);
  return rows.map((r) => ({
    id: r.id,
    name: r.course,
    facility: r.facility,
    city: r.city,
    state: r.state,
    tips: { rating: r.rating, slope: r.slope, par: r.par },
  }));
}

/** Best-effort pick of the NCRDB candidate whose name best matches `wanted`. */
function pickBestNameMatch<T extends { courseName: string; fullName: string }>(
  wanted: string,
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
  const target = wanted.trim().toLowerCase();
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const nameLower = (c.courseName || c.fullName || "").toLowerCase();
    let score = 0;
    if (nameLower === target) score = 100;
    else if (nameLower.startsWith(target) || target.startsWith(nameLower)) score = 50;
    else if (nameLower.includes(target) || target.includes(nameLower)) score = 25;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const state = searchParams.get("state");
    const courseIdRaw = searchParams.get("courseId");
    const candidateIdRaw = searchParams.get("candidateId");

    // ── ?candidateId= : local sheet row -> attempt NCRDB per-tee, else tips fallback ──
    if (candidateIdRaw) {
      const candidateId = Number(candidateIdRaw);
      if (!Number.isFinite(candidateId) || candidateId < 0) {
        return NextResponse.json({ error: "Invalid 'candidateId'" }, { status: 400 });
      }
      const row = await usgaCourseById(candidateId);
      if (!row) {
        return NextResponse.json({ error: "Unknown candidateId" }, { status: 404 });
      }

      try {
        const ncrdbState = row.state ? `US-${row.state.trim().toUpperCase()}` : "US-CA";
        const candidates = await searchCourses(row.course || row.facility, ncrdbState);
        const best = pickBestNameMatch(row.course || row.facility, candidates);
        if (!best) throw new NcrdbError("No NCRDB name match for candidate");

        const allTees = await getCourseTees(best.courseID);
        const tees = filterMenTees(allTees).map((t) => ({
          tee: t.tee,
          gender: t.gender,
          par: t.par,
          rating: t.rating,
          slope: t.slope,
          ...(t.yards !== undefined ? { yards: t.yards } : {}),
        }));
        if (tees.length === 0) throw new NcrdbError("NCRDB returned no tees for matched course");

        return NextResponse.json({ tees, source: "ncrdb" });
      } catch {
        // ANY NCRDB failure (403/timeout/no match/no tees) -> tips fallback.
        return NextResponse.json({
          tees: [],
          tips: { rating: row.rating, slope: row.slope, par: row.par },
          source: "tips",
        });
      }
    }

    // ── ?courseId= : legacy direct NCRDB tee lookup (backward compat) ──
    if (courseIdRaw) {
      const courseId = Number(courseIdRaw);
      if (!Number.isFinite(courseId) || courseId <= 0) {
        return NextResponse.json({ error: "Invalid 'courseId'" }, { status: 400 });
      }
      const allTees = await getCourseTees(courseId);
      const tees = filterMenTees(allTees).map((t) => ({
        tee: t.tee,
        gender: t.gender,
        par: t.par,
        rating: t.rating,
        slope: t.slope,
        ...(t.yards !== undefined ? { yards: t.yards } : {}),
      }));
      return NextResponse.json({ tees, source: "ncrdb" });
    }

    // ── ?name=&state= : local-first candidate search ──
    if (name) {
      const local = await searchLocalSheet(name, state);
      if (local !== null) {
        return NextResponse.json({ candidates: local, source: "sheet" });
      }
      // Local table empty/unavailable -> fall back to the old live NCRDB search.
      const ncrdbState = state ?? "US-CA";
      const candidates = await searchCourses(name, ncrdbState);
      return NextResponse.json({
        candidates: candidates.map((c) => ({
          courseID: c.courseID,
          name: c.courseName || c.fullName || c.facilityName,
          city: c.city,
          state: c.state,
        })),
        source: "ncrdb",
      });
    }

    return NextResponse.json({ error: "Provide 'name', 'candidateId', or 'courseId'" }, { status: 400 });
  } catch (err) {
    if (err instanceof NcrdbError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

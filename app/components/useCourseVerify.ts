import { useCallback, useEffect, useRef, useState } from "react";

// ── Post-import course-rating verification ─────────────────────
// Headless hook shared by mobile (UploadView) and desktop (DesktopRounds'
// ImportModal). Given the distinct course names touched by an import, finds
// the subset whose rating is still "estimated" (per /api/handicap), and
// drives a per-course USGA lookup -> tee pick -> apply flow reusing the same
// NCRDB endpoints and 9-hole doubling rule as HandicapPanel.tsx /
// DesktopProfile.tsx's CourseEditRow.
//
// Design: everything here degrades to "do nothing" on failure — a USGA
// outage, a malformed /api/handicap response, etc. must never surface as an
// import failure. Callers just see an empty `pending` list and move on.

export interface UsgaCandidate {
  /** Local sheet row id (candidateId) — always present when source is "sheet". */
  id?: number;
  /** NCRDB courseID — present only for the legacy live-NCRDB fallback path. */
  courseID?: number;
  name: string;
  facility?: string;
  city: string;
  state: string;
  /** Championship/tips rating from the local USGA sheet — a labeled, editable fallback only. */
  tips?: { rating: number; slope: number; par: number };
}

export interface UsgaTee {
  tee: string;
  gender: "M" | "F";
  par: number;
  rating: number;
  slope: number;
  yards?: number;
  usual: boolean;
}

export type CourseVerifyStatus =
  | "loading" // fetching candidates for this course
  | "no-match" // USGA search returned zero candidates
  | "error" // a fetch failed
  | "candidates" // candidate list ready, awaiting a pick
  | "loading-tees" // fetching tees for a chosen candidate
  | "tees" // tee list ready, awaiting a pick
  | "tips" // no per-tee data available — editable tips-rating fallback shown
  | "done" // rating applied
  | "skipped"; // user skipped this course

export interface CourseVerifyItem {
  /** Original course name exactly as stored in rounds/course-rating rows. */
  courseName: string;
  status: CourseVerifyStatus;
  candidates: UsgaCandidate[];
  tees: UsgaTee[];
  /** Present when status === "tips": the labeled fallback rating to show (editable) before apply. */
  tips: { rating: number; slope: number; par: number } | null;
  error: string | null;
}

const USGA_9HOLE_PAR_THRESHOLD = 40;

// "White", "Blue", or combos that start with either (e.g. "White/Blue Combo")
// sort first and carry usual: true — matches the user's stated preference.
function isUsualTee(name: string): boolean {
  const t = name.trim().toLowerCase();
  return t.startsWith("white") || t.startsWith("blue");
}

function orderTees(raw: { tee: string; gender: "M" | "F"; par: number; rating: number; slope: number; yards?: number }[]): UsgaTee[] {
  const withUsual: UsgaTee[] = raw.map((t) => ({ ...t, usual: isUsualTee(t.tee) }));
  return withUsual.sort((a, b) => {
    if (a.usual !== b.usual) return a.usual ? -1 : 1;
    return b.rating - a.rating; // descending rating within each group
  });
}

// Build a reasonable-but-simple search query from a stored course name:
// strip parenthetical suffixes like "(9)" / "(Presidio)" and keep the first
// few significant words. (Mirrors HandicapPanel.tsx's cleanCourseQuery.)
function cleanCourseQuery(name: string): string {
  const noParens = name.replace(/\([^)]*\)/g, " ").trim();
  const words = noParens.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.max(3, Math.min(words.length, 4))).join(" ");
}

interface HandicapCourseRow {
  name: string;
  norm: string;
  estimated: boolean;
}

interface ApplyArgs {
  par: number;
  rating: number;
  slope: number;
}

export function useCourseVerify() {
  const [items, setItems] = useState<CourseVerifyItem[]>([]);
  const [ready, setReady] = useState(false);
  const runToken = useRef(0);

  const patch = useCallback((courseName: string, patchFn: (item: CourseVerifyItem) => CourseVerifyItem) => {
    setItems((prev) => prev.map((it) => (it.courseName === courseName ? patchFn(it) : it)));
  }, []);

  // Kick off verification for a fresh batch of course names from an import
  // result. Intersects with /api/handicap's estimated courses, then
  // auto-runs a USGA lookup for each one needing verification.
  const start = useCallback(async (courseNames: string[]) => {
    const token = ++runToken.current;
    setReady(false);
    setItems([]);
    if (!courseNames || courseNames.length === 0) {
      setReady(true);
      return;
    }

    let needsVerify: string[] = [];
    try {
      const res = await fetch("/api/handicap");
      const data = await res.json();
      if (token !== runToken.current) return;
      const rows: HandicapCourseRow[] = Array.isArray(data?.courses) ? data.courses : [];
      const estimatedNames = new Set(
        rows.filter((r) => r.estimated).map((r) => r.name)
      );
      needsVerify = courseNames.filter((c) => estimatedNames.has(c));
    } catch {
      // USGA/handicap outage: degrade to "nothing needs verification" rather
      // than blocking or erroring the import flow.
      needsVerify = [];
    }

    if (token !== runToken.current) return;

    if (needsVerify.length === 0) {
      setReady(true);
      return;
    }

    setItems(
      needsVerify.map((courseName) => ({
        courseName,
        status: "loading" as CourseVerifyStatus,
        candidates: [],
        tees: [],
        tips: null,
        error: null,
      }))
    );
    setReady(true);

    // Fire off lookups in parallel; each is independent and failure-isolated.
    for (const courseName of needsVerify) {
      (async () => {
        try {
          const q = cleanCourseQuery(courseName);
          const res = await fetch(`/api/course-lookup?name=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (token !== runToken.current) return;
          if (!res.ok || data.error) throw new Error(data.error || "Lookup failed");
          const candidates: UsgaCandidate[] = data.candidates ?? [];
          patch(courseName, (it) => ({
            ...it,
            candidates,
            status: candidates.length === 0 ? "no-match" : "candidates",
          }));
        } catch (err) {
          if (token !== runToken.current) return;
          patch(courseName, (it) => ({
            ...it,
            status: "error",
            error: err instanceof Error ? err.message : "Lookup failed",
          }));
        }
      })();
    }
  }, [patch]);

  // Picks a candidate: local-sheet candidates (has `id`) go through
  // ?candidateId= (which attempts live NCRDB per-tee, falling back to the
  // sheet's labeled tips rating on any NCRDB failure). Legacy live-NCRDB
  // candidates (has `courseID`, no `id` — only reached if the local sheet was
  // empty/unavailable) go through the old ?courseId= path directly.
  const pickCandidate = useCallback(
    async (courseName: string, candidate: UsgaCandidate) => {
      patch(courseName, (it) => ({ ...it, status: "loading-tees", error: null }));
      try {
        const url =
          candidate.id !== undefined
            ? `/api/course-lookup?candidateId=${candidate.id}`
            : `/api/course-lookup?courseId=${candidate.courseID}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Tee lookup failed");

        if (data.source === "tips") {
          patch(courseName, (it) => ({
            ...it,
            tees: [],
            tips: data.tips ?? null,
            status: "tips",
            error: null,
          }));
          return;
        }

        const tees = orderTees(data.tees ?? []);
        patch(courseName, (it) => ({
          ...it,
          tees,
          status: tees.length === 0 ? "error" : "tees",
          error: tees.length === 0 ? "No tees found for this course." : null,
        }));
      } catch (err) {
        patch(courseName, (it) => ({
          ...it,
          status: "error",
          error: err instanceof Error ? err.message : "Tee lookup failed",
        }));
      }
    },
    [patch]
  );

  // Applies a chosen tee's rating to the ORIGINAL course name as stored,
  // doubling par/rating for 9-hole tees (par <= 40) per the app's convention
  // (see HandicapPanel.tsx / DesktopProfile.tsx's CourseEditRow).
  const apply = useCallback(
    async (courseName: string, tee: UsgaTee) => {
      const is9 = tee.par <= USGA_9HOLE_PAR_THRESHOLD;
      const args: ApplyArgs = {
        par: is9 ? tee.par * 2 : tee.par,
        rating: is9 ? Math.round(tee.rating * 2 * 10) / 10 : tee.rating,
        slope: tee.slope,
      };
      try {
        const res = await fetch("/api/courses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: courseName, rating: args.rating, slope: args.slope, par: args.par }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error || "Save failed");
        patch(courseName, (it) => ({ ...it, status: "done", error: null }));
        return true;
      } catch (err) {
        patch(courseName, (it) => ({
          ...it,
          status: "error",
          error: err instanceof Error ? err.message : "Save failed",
        }));
        return false;
      }
    },
    [patch]
  );

  // Applies user-edited tips-fallback values (never auto-applies the raw
  // tips numbers — the caller collects edited rating/slope/par from the UI
  // first). Same 9-hole doubling rule as `apply`.
  const applyTips = useCallback(
    async (courseName: string, edited: ApplyArgs) => {
      const is9 = edited.par <= USGA_9HOLE_PAR_THRESHOLD;
      const args: ApplyArgs = {
        par: is9 ? edited.par * 2 : edited.par,
        rating: is9 ? Math.round(edited.rating * 2 * 10) / 10 : edited.rating,
        slope: edited.slope,
      };
      try {
        const res = await fetch("/api/courses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: courseName, rating: args.rating, slope: args.slope, par: args.par }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) throw new Error(data?.error || "Save failed");
        patch(courseName, (it) => ({ ...it, status: "done", error: null }));
        return true;
      } catch (err) {
        patch(courseName, (it) => ({
          ...it,
          status: "error",
          error: err instanceof Error ? err.message : "Save failed",
        }));
        return false;
      }
    },
    [patch]
  );

  const skip = useCallback(
    (courseName: string) => {
      patch(courseName, (it) => ({ ...it, status: "skipped" }));
    },
    [patch]
  );

  const skipAll = useCallback(() => {
    setItems((prev) => prev.map((it) => (it.status === "done" ? it : { ...it, status: "skipped" })));
  }, []);

  const retry = useCallback(
    (courseName: string) => {
      patch(courseName, (it) => ({ ...it, status: "loading", error: null, candidates: [], tees: [], tips: null }));
      (async () => {
        try {
          const q = cleanCourseQuery(courseName);
          const res = await fetch(`/api/course-lookup?name=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || "Lookup failed");
          const candidates: UsgaCandidate[] = data.candidates ?? [];
          patch(courseName, (it) => ({
            ...it,
            candidates,
            status: candidates.length === 0 ? "no-match" : "candidates",
          }));
        } catch (err) {
          patch(courseName, (it) => ({
            ...it,
            status: "error",
            error: err instanceof Error ? err.message : "Lookup failed",
          }));
        }
      })();
    },
    [patch]
  );

  const pending = items.filter((it) => it.status !== "skipped" && it.status !== "done");
  const remaining = items.filter((it) => it.status !== "skipped" && it.status !== "done").length;
  const allResolved = ready && items.length > 0 && remaining === 0;
  const hasWork = ready && items.length > 0;

  return {
    items,
    pending,
    ready,
    hasWork,
    remaining,
    allResolved,
    start,
    pickCandidate,
    apply,
    applyTips,
    skip,
    skipAll,
    retry,
  };
}

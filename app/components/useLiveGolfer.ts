"use client";

// Live golfer header stats for the mobile front page (Cover + BagView).
// Replaces the static `golfer` seed object from lib/caddie-data with data
// from the same API routes the desktop dashboard uses:
//   /api/handicap?include9=1  -> index + rolling trend points
//   /api/rounds               -> newest-first round list (last-5, round count)
import { useEffect, useState } from "react";
import type { RoundSummary } from "./types";

interface HandicapPayload {
  index: number | null;
  trend?: { date: string; index: number }[];
  error?: string;
}

export interface LiveGolfer {
  loading: boolean;
  /** Handicap index, formatted to one decimal — null until loaded / no rated rounds. */
  index: string | null;
  /** Signed index delta over the last handful of rounds, e.g. "-0.8". Null if not enough data. */
  delta: string | null;
  /** Negative delta = improving (lower handicap). */
  deltaDir: "up" | "down" | "flat" | null;
  /** Totals of the 5 most recent complete 18-hole rounds, newest first. */
  lastFive: number[];
  /** All logged rounds, any length. */
  totalRounds: number;
  /** Most-played course — the live stand-in for "home course". */
  homeCourse: string | null;
}

const EMPTY: LiveGolfer = { loading: true, index: null, delta: null, deltaDir: null, lastFive: [], totalRounds: 0, homeCourse: null };

export function useLiveGolfer(): LiveGolfer {
  const [state, setState] = useState<LiveGolfer>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const handicap = fetch("/api/handicap?include9=1")
      .then((r) => r.json() as Promise<HandicapPayload>)
      .catch(() => null);
    const rounds = fetch("/api/rounds")
      .then((r) => r.json() as Promise<RoundSummary[] | { error: string }>)
      .catch(() => null);

    Promise.all([handicap, rounds]).then(([h, rs]) => {
      if (cancelled) return;

      const index = typeof h?.index === "number" ? h.index.toFixed(1) : null;

      // Delta = current index vs. the index ~5 rated rounds ago.
      let delta: string | null = null;
      let deltaDir: LiveGolfer["deltaDir"] = null;
      const trend = h?.trend ?? [];
      if (trend.length >= 2) {
        const last = trend[trend.length - 1].index;
        const prev = trend[Math.max(0, trend.length - 6)].index;
        const d = last - prev;
        delta = (d > 0 ? "+" : "") + d.toFixed(1);
        deltaDir = Math.abs(d) < 0.05 ? "flat" : d < 0 ? "up" : "down"; // up arrow = good = improving
      }

      const list = Array.isArray(rs) ? rs : [];
      const lastFive = list
        .filter((r) => r.complete && r.holeCount >= 18)
        .slice(0, 5)
        .map((r) => r.total);

      // Home course = most-played course on record.
      const counts = new Map<string, number>();
      for (const r of list) counts.set(r.course, (counts.get(r.course) ?? 0) + 1);
      const homeCourse = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      setState({ loading: false, index, delta, deltaDir, lastFive, totalRounds: list.length, homeCourse });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

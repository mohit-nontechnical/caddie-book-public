"use client";

import React, { useState, useEffect } from "react";
import { hexA } from "@/lib/caddie-data";
import { Sparkline } from "./primitives";
import { RoundsView } from "./RoundsView";
import { CourseMap } from "./CourseMap";
import type { RoundSummary } from "./types";

// ── Types matching /api/stats response ───────────────────────
interface MonthlyAvg {
  month: string;
  avg: number;
}

interface CourseData {
  name: string;
  norm: string;
  rounds: number;
  rounds18: number;
  rounds9: number;
  avg18: number | null;
  best18: number | null;
  par: number;
  lastPlayed: string;
  scores18: number[];
}

interface StatsResponse {
  overall: {
    totalRounds: number;
    rounds18: number;
    rounds9: number;
    scoringAvg18: number | null;
    best18: number | null;
    worst18: number | null;
    break85: { count: number; total: number; pct: number };
    monthlyAvg: MonthlyAvg[];
  };
  courses: CourseData[];
}

// Invert scores so improvement (lower score) trends UP in the sparkline.
function invertScores(scores: number[]): number[] {
  return scores.map((s) => 120 - s);
}

function fmtVsPar(avg18: number | null, par: number): string {
  if (avg18 == null) return "—";
  const diff = avg18 - par;
  return (diff >= 0 ? "+" : "") + diff.toFixed(1);
}

type Segment = "rounds" | "courses" | "map";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "rounds", label: "Rounds" },
  { key: "courses", label: "Courses" },
  { key: "map", label: "Map" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

interface Props {
  onOpenRound: (r: RoundSummary) => void;
  onOpenCourse: (c: string) => void;
}

export const CourseBook = ({ onOpenRound, onOpenCourse }: Props) => {
  const [segment, setSegment] = useState<Segment>("courses");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json as StatsResponse);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const overall = data?.overall;

  // Sort courses: ones with avg18 first (lowest avg18 best), then rest by rounds desc
  const courses = [...(data?.courses ?? [])].sort((a, b) => {
    if (a.avg18 !== null && b.avg18 !== null) return a.avg18 - b.avg18;
    if (a.avg18 !== null) return -1;
    if (b.avg18 !== null) return 1;
    return b.rounds - a.rounds;
  });

  const totalRounds = overall?.totalRounds ?? 0;

  // Monthly avg sparkline — invert so lower score trends up
  const monthlyInverted =
    overall?.monthlyAvg && overall.monthlyAvg.length > 1
      ? invertScores(overall.monthlyAvg.map((m) => m.avg))
      : null;

  return (
    <div style={{ paddingBottom: 28 }}>
      {/* ── Header ── */}
      <div style={{ padding: "6px 16px 14px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>
          THE COURSE BOOK
        </div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>
          Your courses
        </h1>
      </div>

      {/* ── Segmented control ── */}
      <div style={{ padding: "0 16px 18px" }}>
        <div style={{
          display: "flex",
          background: hexA("#FFFFFF", 0.06),
          borderRadius: 12,
          padding: 3,
          gap: 2,
        }}>
          {SEGMENTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSegment(key)}
              className="sc-press"
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 500,
                transition: "background 0.15s, color 0.15s",
                background: segment === key ? "var(--gold)" : "transparent",
                color: segment === key ? "#1A1200" : "var(--cream-3)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rounds segment ── */}
      {segment === "rounds" && (
        <RoundsView onOpenRound={onOpenRound} />
      )}

      {/* ── Map segment ── */}
      {segment === "map" && (
        <CourseMap onOpenCourse={onOpenCourse} />
      )}

      {/* ── Courses segment ── */}
      {segment === "courses" && (
        <div style={{ padding: "0 16px" }}>
          {/* Subtitle */}
          <p style={{ margin: "0 0 14px", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>
            {loading
              ? "Loading your round data…"
              : error
              ? "Stats unavailable — check connection."
              : `${totalRounds} rounds tracked across ${courses.length} course${courses.length !== 1 ? "s" : ""}.`}
          </p>

          {/* Loading shimmer */}
          {loading && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "22px 18px", marginBottom: 12, opacity: 0.6 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", letterSpacing: "0.12em" }}>LOADING STATS…</div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ background: hexA("#C05C5C", 0.1), border: "1px solid " + hexA("#C05C5C", 0.3), borderRadius: 14, padding: "14px 16px", marginBottom: 14, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>
              {error}
            </div>
          )}

          {/* Trends summary card */}
          {!loading && !error && overall && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "16px 16px 14px", marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", marginBottom: 10 }}>
                TRENDS
              </div>

              {/* Scoring avg + sparkline row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: "0 0 auto" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 500, color: "var(--cream)", lineHeight: 1 }}>
                    {overall.scoringAvg18 != null ? overall.scoringAvg18.toFixed(1) : "—"}
                  </div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-3)", marginTop: 4 }}>
                    scoring avg · 18 holes
                  </div>
                </div>
                {monthlyInverted && monthlyInverted.length >= 2 && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Sparkline data={monthlyInverted} color="var(--good)" w={160} h={34} sw={2.2} />
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--cream-3)", letterSpacing: "0.1em", marginTop: 4, textAlign: "right" }}>
                      {overall.monthlyAvg[0].month} → {overall.monthlyAvg[overall.monthlyAvg.length - 1].month}
                    </div>
                  </div>
                )}
              </div>

              {/* 3-stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  ["Rounds", overall.totalRounds, ""],
                  ["Best 18", overall.best18 != null ? overall.best18 : "—", ""],
                  ["Break 85", overall.break85.count + "/" + overall.break85.total, ""],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ background: hexA("#FFFFFF", 0.04), borderRadius: 10, padding: "9px 10px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--cream)", fontWeight: 500 }}>
                      {String(value)}
                    </div>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--cream-3)", marginTop: 3 }}>
                      {String(label)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Break 85 progress line */}
              {overall.break85.total > 0 && (
                <div style={{ marginTop: 10, fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", lineHeight: 1.4 }}>
                  <span style={{ color: overall.break85.count > 0 ? "var(--good)" : "var(--cream-3)" }}>
                    {overall.break85.count}
                  </span>
                  {" "}of {overall.break85.total} rounds under 85
                  {overall.break85.pct > 0 && (
                    <span style={{ marginLeft: 5, color: "var(--gold)" }}>({overall.break85.pct}%)</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Course cards */}
          {!loading && !error && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {courses.map((c, idx) => {
                const hasSparkline = c.scores18.length >= 3;
                const invertedScores = hasSparkline ? invertScores(c.scores18) : [];
                const vsPar = fmtVsPar(c.avg18, c.par);
                const vsParPositive = c.avg18 != null && c.avg18 - c.par > 0;
                // Only top-3 among courses that have avg18
                const rankIdx = c.avg18 !== null ? courses.filter(x => x.avg18 !== null).indexOf(c) : -1;
                const medal = rankIdx >= 0 && rankIdx < 3 ? MEDALS[rankIdx] : null;

                return (
                  <button
                    key={c.norm}
                    onClick={() => onOpenCourse(c.name)}
                    className="sc-tile"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: 18,
                      overflow: "hidden",
                      padding: 0,
                    }}
                  >
                    {/* Map/Sparkline header */}
                    <div style={{ height: 110, background: "linear-gradient(160deg, #1B4D3E 0%, #0F2D1A 60%, #0A1A0E)", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 24px)" }} />
                      {hasSparkline ? (
                        <div style={{ position: "absolute", inset: "16px 16px 28px" }}>
                          <Sparkline data={invertedScores} color="var(--good)" w={320} h={66} sw={2.2} />
                        </div>
                      ) : (
                        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 361 110" preserveAspectRatio="xMidYMid slice">
                          <path d="M40 90 Q80 30 140 50 Q180 65 220 40 Q260 20 310 55 Q330 68 340 85" fill="none" stroke={hexA("#4CAF82", 0.5)} strokeWidth="12" strokeLinecap="round" />
                          <path d="M40 90 Q80 30 140 50 Q180 65 220 40 Q260 20 310 55 Q330 68 340 85" fill="none" stroke={hexA("#4CAF82", 0.9)} strokeWidth="3" strokeLinecap="round" strokeDasharray="8 6" />
                          <circle cx="40" cy="90" r="5" fill="var(--gold)" />
                          <circle cx="340" cy="85" r="4" fill="#4CAF82" />
                        </svg>
                      )}
                      <div style={{ position: "absolute", top: 10, left: 14, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}>
                          {hasSparkline ? "SCORE TREND" : "MAP VIEW"}
                        </span>
                        {medal && (
                          <span style={{ fontSize: 14, lineHeight: 1 }}>{medal}</span>
                        )}
                      </div>
                      <div style={{ position: "absolute", bottom: 10, right: 14, display: "flex", gap: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--gold)", background: hexA("#F0C040", 0.15), padding: "3px 8px", borderRadius: 6 }}>
                          Par {c.par}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--cream-3)", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: 6 }}>
                          {c.rounds} round{c.rounds !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "14px 16px 15px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--cream)" }}>{c.name}</div>
                          <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 2 }}>
                            Par {c.par} · {c.rounds18 > 0 ? `${c.rounds18} 18-hole` : c.rounds9 > 0 ? `${c.rounds9} 9-hole` : `${c.rounds} total`}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--cream)", fontWeight: 500 }}>
                            {c.avg18 != null ? c.avg18.toFixed(1) : "—"}
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--cream-3)", letterSpacing: "0.1em" }}>AVG</div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                        {[
                          ["Rounds", c.rounds, false],
                          ["Best", c.best18 != null ? c.best18 : "—", false],
                          ["vs Par", vsPar, vsParPositive],
                        ].map(([label, value, isOver], j) => (
                          <div key={j} style={{ background: hexA("#FFFFFF", 0.04), borderRadius: 10, padding: "9px 10px" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: isOver ? "var(--bad)" : "var(--cream)", fontWeight: 500 }}>
                              {String(value)}
                            </div>
                            <div style={{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--cream-3)", marginTop: 3 }}>
                              {String(label)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}

              {courses.length === 0 && !loading && (
                <div style={{ padding: "28px 0", textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream-3)" }}>
                  No rounds recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

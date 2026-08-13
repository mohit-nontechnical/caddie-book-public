"use client";

import React, { useState, useEffect } from "react";
import { SLabel } from "./primitives";
import { FeedView } from "./FeedView";
import { StrokesGained } from "./StrokesGained";
import { ScoreTrendChart, ScoreDistChart } from "./ChartsLazy";
import { hexA } from "@/lib/caddie-data";
import type { Slot } from "@/lib/caddie-data";

interface HoleDist {
  score: string;
  count: number;
  pct: number;
}

interface InsightsData {
  rounds18: number;
  avg: number | null;
  best: number | null;
  worst: number | null;
  scoring: { pars: number; birdies: number; bogeys: number; doublesPlus: number };
  holeDist: HoleDist[];
  bigHolePct: number;
  gapToGoal: {
    goal: number;
    current: number | null;
    gap: number | null;
    doublesPerRound: number;
    strokesIfHalved: number;
  };
  frontBack: { front: number; back: number; diff: number; backWorsePct: number } | null;
  trend: { date: string; score: number }[];
  consistency: { stdev: number; spread: number };
  mental: {
    blowUpHoles: number;
    recovered: number;
    recoveredPct: number;
    doubledUpPct: number;
    avgNextHole: number;
    tilt: boolean;
    trend: { early: number | null; recent: number | null };
  } | null;
}

function fmt1(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(1);
}

function frontBackCaption(fb: InsightsData["frontBack"]): string {
  if (!fb) return "";
  const absDiff = Math.abs(fb.diff);
  if (absDiff < 1.5) return "Your two nines are basically even — no late-round fade.";
  if (fb.diff > 0) return `Your back nine is leaking ${fmt1(fb.diff)} strokes on average — the late-round fade is real.`;
  return `Your front nine costs you ${fmt1(-fb.diff)} strokes on average — you warm up slowly but finish strong.`;
}

export const InsightsView = ({ onOpenSlot, onOpenChat }: { onOpenSlot: (s: Slot) => void; onOpenChat?: () => void }) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json as InsightsData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load insights"))
      .finally(() => setLoading(false));
  }, []);

  // ── Loading / error ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ padding: "6px 0 18px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>INSIGHTS</div>
          <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Where your strokes go</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ borderRadius: 16, background: "var(--panel)", border: "1px solid var(--line)", padding: "18px 16px", height: 88, opacity: 0.5 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ padding: "6px 0 18px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>INSIGHTS</div>
          <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Where your strokes go</h1>
        </div>
        <div style={{ borderRadius: 14, border: "1px solid " + hexA("#C05C5C", 0.4), background: hexA("#C05C5C", 0.08), padding: "14px 16px", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", lineHeight: 1.45 }}>
          {error}
        </div>
      </div>
    );
  }

  if (!data || data.rounds18 === 0) {
    return (
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ padding: "6px 0 18px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>INSIGHTS</div>
          <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Where your strokes go</h1>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.45 }}>Upload a complete 18-hole round to unlock analytics.</p>
        </div>
        <FeedView onOpenSlot={onOpenSlot} />
      </div>
    );
  }

  const { rounds18, avg, best, worst, holeDist, bigHolePct, gapToGoal, frontBack, trend, consistency, mental } = data;

  const trendBest = best ?? 0;
  const trendWorst = worst ?? 0;

  return (
    <div style={{ padding: "0 16px 28px" }}>

      {/* ── Header ── */}
      <div style={{ padding: "6px 0 20px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>INSIGHTS</div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Where your strokes go</h1>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>
          Built from your {rounds18} scored rounds — the numbers that are actually reliable.
        </p>
      </div>

      {/* ── Ask Coach ── */}
      {onOpenChat && (
        <button onClick={onOpenChat} className="sc-press" style={{ width: "100%", marginBottom: 14, cursor: "pointer", borderRadius: 16, padding: "13px 16px", border: "1px solid " + hexA("#F0C040", 0.4), background: "linear-gradient(160deg, " + hexA("#F0C040", 0.1) + ", transparent), var(--panel)", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: hexA("#F0C040", 0.16), display: "grid", placeItems: "center", fontSize: 17 }}>💬</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>Ask Coach anything</span>
            <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 1 }}>&ldquo;Why do I blow up after a bad hole?&rdquo;</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cream-3)" }}>›</span>
        </button>
      )}

      {/* ── HERO: Blow-up holes ── */}
      <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "16px 16px 18px", overflow: "hidden" }}>
        <SLabel>Blow-up holes</SLabel>
        <p style={{ margin: "0 0 14px", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--cream)", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
          <span style={{ color: "var(--bad)" }}>{fmt1(bigHolePct)}%</span> of your holes are a 7 or worse.
        </p>

        {/* Distribution chart (interactive) */}
        <div data-noswipe style={{ margin: "0 -6px" }}>
          <ScoreDistChart data={holeDist} />
        </div>

        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", lineHeight: 1.45 }}>
          Tap a bar for the count. Turning those 7s into 5s and 6s is your fastest path to Break 85.
        </p>
      </section>

      {/* ── GAP TO GOAL ── */}
      <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "16px 16px 18px" }}>
        <SLabel>Gap to goal</SLabel>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: "var(--cream)", lineHeight: 1 }}>{fmt1(avg)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 3 }}>CURRENT AVG</div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--cream-3)", paddingBottom: 6 }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>85</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 3 }}>GOAL</div>
          </div>
          {gapToGoal.gap != null && (
            <>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--cream-3)", paddingBottom: 6 }}>=</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: gapToGoal.gap <= 0 ? "var(--good)" : "var(--bad)", lineHeight: 1 }}>
                  {gapToGoal.gap > 0 ? "+" : ""}{fmt1(gapToGoal.gap)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 3 }}>GAP</div>
              </div>
            </>
          )}
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", lineHeight: 1.5, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <span style={{ color: "var(--cream)", fontWeight: 600 }}>{fmt1(gapToGoal.doublesPerRound)} doubles-or-worse</span> per round — halving them saves <span style={{ color: "var(--gold)", fontWeight: 600 }}>~{gapToGoal.strokesIfHalved} strokes</span>.
        </p>
      </section>

      {/* ── STROKES GAINED ── */}
      <StrokesGained />

      {/* ── TREND ── */}
      {trend.length >= 3 && (
        <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "16px 16px 18px" }}>
          <SLabel>Score trend</SLabel>
          <div data-noswipe style={{ margin: "4px -6px 0" }}>
            <ScoreTrendChart data={trend} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--good)" }}>Best {trendBest}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--cream-3)" }}>{trend.length} rounds</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--bad)" }}>Worst {trendWorst}</span>
          </div>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", lineHeight: 1.4 }}>Tap a point for that round. Axis is flipped so up = a better (lower) score.</p>
        </section>
      )}

      {/* ── FRONT vs BACK ── */}
      {frontBack && (
        <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "16px 16px 18px" }}>
          <SLabel>Front vs. back nine</SLabel>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, borderRadius: 12, background: hexA("#F0C040", 0.08), padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--cream)", lineHeight: 1 }}>{fmt1(frontBack.front)}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 4 }}>FRONT</div>
            </div>
            <div style={{ flex: 1, borderRadius: 12, background: frontBack.diff > 1.5 ? hexA("#C05C5C", 0.1) : hexA("#F0C040", 0.08), padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: frontBack.diff > 1.5 ? "var(--bad)" : "var(--cream)", lineHeight: 1 }}>{fmt1(frontBack.back)}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 4 }}>BACK</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 48 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: Math.abs(frontBack.diff) < 1.5 ? "var(--cream-3)" : frontBack.diff > 0 ? "var(--bad)" : "var(--good)", lineHeight: 1 }}>
                  {frontBack.diff > 0 ? "+" : ""}{fmt1(frontBack.diff)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color: "var(--cream-3)", marginTop: 3 }}>DIFF</div>
              </div>
            </div>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", lineHeight: 1.45 }}>
            {frontBackCaption(frontBack)}
          </p>
        </section>
      )}

      {/* ── MENTAL GAME / TILT ── */}
      {mental && (() => {
        const score = mental.recoveredPct;
        const scoreColor = score < 50 ? "#C05C5C" : score >= 60 ? "#4CAF82" : "#F0C040";
        const { early, recent } = mental.trend;
        const delta = early != null && recent != null ? Math.round((recent - early) * 10) / 10 : null;
        return (
          <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid " + hexA(scoreColor, 0.35), padding: "16px 16px 18px" }}>
            <SLabel>Mental game · bounce-back</SLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "6px 0 12px" }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{Math.round(score)}<span style={{ fontSize: 20 }}>%</span></div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 4 }}>RECOVERED</div>
              </div>
              <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", lineHeight: 1.5 }}>
                After your <b style={{ color: "var(--cream)" }}>{mental.blowUpHoles} blow-up holes</b>, you kept the next hole clean (bogey or better) <b style={{ color: scoreColor }}>{mental.recovered}</b> times — and dropped another shot <b style={{ color: "var(--bad)" }}>{Math.round(mental.doubledUpPct)}%</b> of the time.
              </p>
            </div>
            {delta != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)" }}>Early {early}%</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--cream-3)" }}>→</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)" }}>Recent {recent}%</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: delta >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {delta > 0 ? "+" : ""}{delta} {delta >= 3 ? "↑ tougher" : delta <= -3 ? "↓ slipping" : "steady"}
                </span>
              </div>
            )}
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", lineHeight: 1.45 }}>
              {mental.tilt
                ? "One bad hole is becoming two. After a blow-up, reset to a bogey target and just stop the bleeding — that alone is worth strokes."
                : "Solid recovery instinct. Protecting the hole after a blow-up is the cheapest scoring you'll find."}
            </p>
          </section>
        );
      })()}

      {/* ── CONSISTENCY ── */}
      <section style={{ marginBottom: 22, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "16px 16px 18px" }}>
        <SLabel>Consistency</SLabel>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, borderRadius: 12, background: hexA("#F0C040", 0.08), padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--cream)", lineHeight: 1 }}>±{fmt1(consistency.stdev)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 4 }}>STD DEV</div>
          </div>
          <div style={{ flex: 1, borderRadius: 12, background: hexA("#F0C040", 0.08), padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--cream)", lineHeight: 1 }}>{consistency.spread}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 4 }}>SPREAD</div>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", lineHeight: 1.45 }}>
          Lower = more repeatable. Spread is {trendBest}–{trendWorst} across all rounds.
        </p>
      </section>

      {/* ── Coach (FeedView) ── */}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 4, marginTop: 4 }}>
        <FeedView onOpenSlot={onOpenSlot} />
      </div>

    </div>
  );
};

"use client";

// Caddie Book desktop — Insights page, wired to real API data.
// Ported from docs/design/caddie-pages-insights.jsx (InsightsPage). The design
// leaned on demo data (docs/design/caddie-data.js) for a per-hole blow-up map,
// a "gap to goal" strokes-lost breakdown by shot category, front/back split,
// consistency, and per-course strokes-gained diverging bars. This version
// replaces every one of those with data computed from the real API routes:
//   /api/insights          -> gapToGoal, frontBack, consistency, mental (tilt)
//   /api/strokes-gained    -> byCourse (over/under-performance vs potential)
//   /api/rounds            -> per-hole scores, used to build the blow-up hole
//                             map and the per-round blow-up sparkline
//
// Adaptations vs the design (see inline notes at each card):
//  - No per-hole par exists anywhere in the API, so "blow-up" uses the same
//    absolute-score convention already established by /api/insights and
//    /api/debrief: a blow-up hole is a raw score of 7 or worse (not vs-par
//    doubles). This keeps the page honest and consistent with the rest of
//    the app instead of inventing a par model.
//  - The design's "Gap to goal" card broke strokes down by shot category
//    (approach, driver, bunker, etc.) — that requires shot-level/strokes-
//    gained-by-category data our APIs don't have, so that breakdown is
//    omitted. The gap-to-goal hero (avg -> 85 -> gap) and the doubles-per-
//    round framing that /api/insights actually returns are kept instead.
//  - The design's per-course chart used a fabricated "avg" per course; the
//    real equivalent is /api/strokes-gained's byCourse, which is honestly
//    labeled "strokes gained vs. your potential" (positive = played BETTER
//    than potential that day) rather than "vs the 100.1 average."
//  - Mental game / tilt deep-dive is added as its own card (not in the
//    design's masonry) per spec, since the Dashboard already surfaces a
//    summary version and this page is the deep dive.
import React, { useEffect, useMemo, useState } from "react";
import { CBCard, CBCardTitle, CBPageHead, hexA } from "./DesktopUI";
import { IconInsights } from "./DesktopIcons";
import type { InsightsResponse, RoundListItem, StrokesGainedResponse } from "./types";

interface LoadState<T> {
  data: T | null;
  loading: boolean;
}

function useJson<T>(url: string): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true });
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ data: d as T, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

const skeletonStyle: React.CSSProperties = {
  background: "var(--paper-dim, rgba(11,61,46,0.06))",
  borderRadius: 10,
  animation: "cbSkeleton 1.4s ease-in-out infinite",
};

function Skeleton({ height, style }: { height: number; style?: React.CSSProperties }) {
  return <div style={{ ...skeletonStyle, height, ...style }} />;
}

function fmt1(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(1);
}

const brk: React.CSSProperties = { breakInside: "avoid", marginBottom: 16 };

// ── Local helper: diverging bar row (design's window.DivergingBar, ported) ──
interface DivergingItem {
  label: string;
  value: number;
}

const DivergingBar: React.FC<{ items: DivergingItem[]; rowH?: number; goodColor?: string; badColor?: string }> = ({
  items,
  rowH = 26,
  goodColor = "#3E8F63",
  badColor = "#B0433D",
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const maxAbs = Math.max(...items.map((it) => Math.abs(it.value)), 1);
  if (!items.length) {
    return (
      <div style={{ padding: "18px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
        Not enough rounds at any one course yet.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => {
        const pos = it.value >= 0;
        const w = (Math.abs(it.value) / maxAbs) * 50;
        const c = pos ? goodColor : badColor;
        const on = hover === i;
        return (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ display: "grid", gridTemplateColumns: "128px 1fr 42px", alignItems: "center", gap: 8, height: rowH, cursor: "default" }}
          >
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11.5,
                color: on ? "#22321f" : "rgba(34,49,36,0.7)",
                textAlign: "right",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: on ? 600 : 400,
              }}
            >
              {it.label}
            </div>
            <div style={{ position: "relative", height: "100%" }}>
              <div style={{ position: "absolute", left: "50%", top: 3, bottom: 3, width: 1, background: "rgba(11,61,46,0.18)" }} />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: rowH - 12,
                  borderRadius: 4,
                  background: on ? c : hexA(c, 0.6),
                  transition: "background 0.15s",
                  ...(pos ? { left: "50%", width: w + "%" } : { right: "50%", width: w + "%" }),
                }}
              />
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: c, textAlign: "right", fontWeight: 500 }}>
              {pos ? "+" : ""}
              {it.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BigNum: React.FC<{ n: React.ReactNode; label: string; color?: string }> = ({ n, label, color }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: color || "#1B2A1D", lineHeight: 1 }}>{n}</div>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "0.12em", color: "rgba(34,49,36,0.5)", marginTop: 5 }}>{label}</div>
  </div>
);

const NineBar: React.FC<{ label: string; v: number; max: number; min: number; color: string }> = ({ label, v, max, min, color }) => (
  <div style={{ flex: 1, textAlign: "center" }}>
    <div style={{ height: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{
          width: "70%",
          height: Math.max(20, ((v - min) / Math.max(1, max - min)) * 100) + "%",
          background: hexA(color, 0.75),
          borderRadius: "8px 8px 3px 3px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 7,
        }}
      >
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: "#F6F1E6" }}>{fmt1(v)}</span>
      </div>
    </div>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.12em", color: "rgba(34,49,36,0.5)", marginTop: 8 }}>{label}</div>
  </div>
);

export const DesktopInsights: React.FC = () => {
  const insights = useJson<InsightsResponse>("/api/insights");
  const sg = useJson<StrokesGainedResponse>("/api/strokes-gained");
  const rounds = useJson<RoundListItem[]>("/api/rounds");

  const anyLoading = insights.loading || sg.loading || rounds.loading;
  const hasData = (insights.data?.rounds18 ?? 0) > 0;

  // ── Per-course strokes gained (diverging bars), extremes only (design showed
  // top 6 + bottom 6; we show up to 6 + 6 but gracefully degrade to whatever
  // exists). byCourse only includes courses with >= 2 rounds (API-enforced).
  const sgItems = useMemo<DivergingItem[]>(() => {
    const list = sg.data?.byCourse ?? [];
    const sorted = [...list].sort((a, b) => b.avgSG - a.avgSG);
    const picked = sorted.length > 12 ? [...sorted.slice(0, 6), ...sorted.slice(-6)] : sorted;
    return picked.map((c) => ({ label: c.course, value: c.avgSG }));
  }, [sg.data]);
  const toughest = sg.data?.byCourse.length ? [...sg.data.byCourse].sort((a, b) => a.avgSG - b.avgSG)[0] : null;
  const comfiest = sg.data?.byCourse.length ? [...sg.data.byCourse].sort((a, b) => b.avgSG - a.avgSG)[0] : null;

  // ── Blow-up hole map + per-round blow-up counts, computed client-side from
  // /api/rounds hole arrays (no such per-hole aggregate exists server-side).
  // Blow-up = raw score >= 7, matching the app-wide convention (see
  // /api/insights and /api/debrief) since no per-hole par is available.
  const roundsComplete18 = useMemo(
    () => (rounds.data ?? []).filter((r) => r.complete && r.holeCount >= 18 && r.holes.length >= 18),
    [rounds.data]
  );

  const blowByHole = useMemo(() => {
    const counts = Array(18).fill(0);
    const plays = Array(18).fill(0);
    roundsComplete18.forEach((r) => {
      r.holes.slice(0, 18).forEach((score, i) => {
        if (typeof score === "number" && score > 0) {
          plays[i]++;
          if (score >= 7) counts[i]++;
        }
      });
    });
    return counts.map((c, i) => ({ hole: i + 1, rate: plays[i] > 0 ? c / plays[i] : 0, plays: plays[i] }));
  }, [roundsComplete18]);

  const topBlowHoles = useMemo(() => {
    return [...blowByHole]
      .filter((h) => h.plays > 0 && h.rate > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map((h) => h.hole);
  }, [blowByHole]);

  // per-round blow-up counts (chronological), for the Consistency sparkline
  const roundsChrono = useMemo(() => [...roundsComplete18].sort((a, b) => a.date.localeCompare(b.date)), [roundsComplete18]);
  const perRoundBlowups = useMemo(
    () => roundsChrono.map((r) => ({ id: r.id, course: r.course, blowups: r.holes.slice(0, 18).filter((s) => s >= 7).length })),
    [roundsChrono]
  );
  const avgBlowupsPerRound = perRoundBlowups.length
    ? perRoundBlowups.reduce((a, b) => a + b.blowups, 0) / perRoundBlowups.length
    : null;
  const earlyHalf = perRoundBlowups.slice(0, Math.floor(perRoundBlowups.length / 2));
  const recentHalf = perRoundBlowups.slice(Math.floor(perRoundBlowups.length / 2));
  const earlyAvg = earlyHalf.length ? earlyHalf.reduce((a, b) => a + b.blowups, 0) / earlyHalf.length : null;
  const recentAvg = recentHalf.length ? recentHalf.reduce((a, b) => a + b.blowups, 0) / recentHalf.length : null;

  const gapToGoal = insights.data?.gapToGoal;
  const frontBack = insights.data?.frontBack;
  const consistency = insights.data?.consistency;
  const mental = insights.data?.mental;
  const avg = insights.data?.avg;

  return (
    <div>
      <CBPageHead
        eyebrow="WHAT THE NUMBERS SAY"
        title="Insights"
        sub="Every card is a pattern Caddie Book found across your season. The ones in red are where the strokes are hiding."
      />

      {anyLoading ? (
        <div style={{ columnCount: 2, columnGap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={230} style={brk} />
          ))}
        </div>
      ) : !hasData ? (
        <CBCard>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(199,162,75,0.14)", display: "grid", placeItems: "center" }}>
              <IconInsights size={22} stroke="var(--gold-ink)" />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "#1B2A1D" }}>No patterns yet</div>
            <p style={{ margin: 0, maxWidth: 420, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "rgba(34,49,36,0.6)", lineHeight: 1.5 }}>
              Import a complete 18-hole round to unlock strokes-gained by course, blow-up hole maps, gap-to-goal, and front/back splits.
            </p>
          </div>
        </CBCard>
      ) : (
        <div style={{ columnCount: 2, columnGap: 16 }}>
          {/* Strokes gained per course */}
          <CBCard style={brk} pad={20}>
            <CBCardTitle sub="Strokes vs. your potential (index) · green = you play it better than your handicap suggests">
              Where you over &amp; under-perform
            </CBCardTitle>
            {sgItems.length ? (
              <>
                <DivergingBar items={sgItems} rowH={25} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--line)",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11.5,
                    color: "rgba(34,49,36,0.6)",
                  }}
                >
                  <span>
                    Toughest: <b style={{ color: "#B0433D" }}>{toughest?.course ?? "—"}</b>
                  </span>
                  <span>
                    Comfiest: <b style={{ color: "#3E8F63" }}>{comfiest?.course ?? "—"}</b>
                  </span>
                </div>
              </>
            ) : (
              <div style={{ padding: "18px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
                Play at least 2 rounds at the same course to see over/under-performance.
              </div>
            )}
            {!!sg.data?.excludedExecutive && sg.data.excludedExecutive > 0 && (
              <p style={{ margin: "13px 0 0", fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: "rgba(34,49,36,0.55)", lineHeight: 1.45 }}>
                {sg.data.excludedExecutive} executive / par-3 round{sg.data.excludedExecutive === 1 ? "" : "s"} excluded — short courses
                aren&apos;t comparable to regulation golf
                {sg.data.excludedCourses?.length ? ` (${sg.data.excludedCourses.join(", ")})` : ""}.
              </p>
            )}
          </CBCard>

          {/* Blow-up hole map */}
          <CBCard style={brk} pad={20}>
            <CBCardTitle sub="How often each hole produces a 7 or worse">Blow-up hole map</CBCardTitle>
            {blowByHole.some((h) => h.plays > 0) ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 5 }}>
                  {blowByHole.map((h) => {
                    const a = Math.min(1, h.rate * 1.3);
                    return (
                      <div
                        key={h.hole}
                        title={`Hole ${h.hole} · ${Math.round(h.rate * 100)}% blow-up`}
                        style={{
                          aspectRatio: "1",
                          borderRadius: 7,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                          background: h.plays > 0 ? hexA("#B0433D", 0.08 + a * 0.72) : "rgba(11,61,46,0.05)",
                          border: "1px solid " + hexA("#B0433D", h.plays > 0 ? 0.2 : 0.08),
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: 11,
                            fontWeight: 500,
                            color: a > 0.45 ? "#F6F1E6" : "#8A3A35",
                          }}
                        >
                          {h.hole}
                        </span>
                        <span
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: 8,
                            color: a > 0.45 ? "rgba(246,241,230,0.8)" : "rgba(138,58,53,0.7)",
                          }}
                        >
                          {h.plays > 0 ? Math.round(h.rate * 100) + "%" : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: "13px 0 0", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.62)", lineHeight: 1.5 }}>
                  {topBlowHoles.length > 0 ? (
                    <>
                      Your toughest holes are <b>{topBlowHoles.map((h) => "#" + h).join(", ")}</b> — that&apos;s where the blow-ups cluster.
                    </>
                  ) : (
                    "No blow-up holes yet — keep logging rounds to find the pattern."
                  )}
                </p>
              </>
            ) : (
              <div style={{ padding: "18px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
                Log complete 18-hole rounds to build the blow-up map.
              </div>
            )}
          </CBCard>

          {/* Gap to goal */}
          <CBCard style={brk} pad={20}>
            <CBCardTitle
              sub={gapToGoal?.gap != null ? `${fmt1(gapToGoal.gap)} strokes between your average and breaking 85` : "Not enough rounds yet"}
            >
              Gap to goal · Break {gapToGoal?.goal ?? 85}
            </CBCardTitle>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 16 }}>
              <BigNum n={fmt1(avg)} label="YOUR AVG" />
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: "repeating-linear-gradient(90deg, rgba(11,61,46,0.25) 0 5px, transparent 5px 10px)",
                  marginBottom: 14,
                }}
              />
              <BigNum n={gapToGoal?.goal ?? 85} label="THE GOAL" color="#3E8F63" />
            </div>
            {gapToGoal?.doublesPerRound != null ? (
              <div
                style={{
                  padding: "13px 14px",
                  background: hexA("#C0912F", 0.09),
                  border: "1px solid " + hexA("#C0912F", 0.22),
                  borderRadius: 12,
                }}
              >
                <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "#22321f", lineHeight: 1.5 }}>
                  You card <b>{fmt1(gapToGoal.doublesPerRound)} doubles-or-worse</b> per round. Halving that saves roughly{" "}
                  <b style={{ color: "var(--gold-ink)" }}>{fmt1(gapToGoal.strokesIfHalved)} strokes</b> — most of the gap to 85.
                </p>
              </div>
            ) : (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>Log a few more rounds to see the breakdown.</div>
            )}
          </CBCard>

          {/* Front vs back */}
          <CBCard style={brk} pad={20}>
            <CBCardTitle sub="Average strokes per nine">Front nine vs. back nine</CBCardTitle>
            {frontBack ? (
              <>
                <div style={{ display: "flex", gap: 14 }}>
                  <NineBar
                    label="FRONT"
                    v={frontBack.front}
                    max={Math.max(frontBack.front, frontBack.back) + 5}
                    min={Math.min(frontBack.front, frontBack.back) - 15}
                    color="#6E9A46"
                  />
                  <NineBar
                    label="BACK"
                    v={frontBack.back}
                    max={Math.max(frontBack.front, frontBack.back) + 5}
                    min={Math.min(frontBack.front, frontBack.back) - 15}
                    color="#C0742F"
                  />
                </div>
                <p style={{ margin: "14px 0 0", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.62)", lineHeight: 1.5 }}>
                  {Math.abs(frontBack.diff) < 1.5 ? (
                    <>Your two nines are basically even — <b>{fmt1(Math.abs(frontBack.diff))}-stroke</b> difference, no real fade.</>
                  ) : frontBack.diff > 0 ? (
                    <>
                      A <b>{fmt1(frontBack.diff)}-stroke</b> back-nine fade — the back nine is where you leak strokes, {frontBack.backWorsePct}% of
                      rounds.
                    </>
                  ) : (
                    <>
                      You warm up slowly — front nine costs you <b>{fmt1(-frontBack.diff)} strokes</b> vs. the back.
                    </>
                  )}
                </p>
              </>
            ) : (
              <div style={{ padding: "18px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
                Need at least 3 complete 18-hole rounds to compare nines.
              </div>
            )}
          </CBCard>

          {/* Consistency */}
          <CBCard style={brk} pad={20}>
            <CBCardTitle sub="Blow-up holes (7+) per round, this season">Consistency</CBCardTitle>
            {avgBlowupsPerRound != null ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, color: "#C0742F" }}>{fmt1(avgBlowupsPerRound)}</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(34,49,36,0.6)" }}>blow-ups per round</span>
                </div>
                <div style={{ display: "flex", gap: 3, marginTop: 14 }}>
                  {perRoundBlowups.map((r) => (
                    <div
                      key={r.id}
                      title={`${r.course}: ${r.blowups}`}
                      style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 46 }}
                    >
                      <div
                        style={{
                          height: (Math.min(r.blowups, 9) / 9) * 46 + "px",
                          background: r.blowups >= 6 ? "#B0433D" : r.blowups >= 4 ? "#C0742F" : "#6E9A46",
                          borderRadius: 3,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  ))}
                </div>
                {earlyAvg != null && recentAvg != null && (
                  <p style={{ margin: "13px 0 0", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.62)", lineHeight: 1.5 }}>
                    {recentAvg <= earlyAvg ? (
                      <>
                        Trending down from <b>{fmt1(earlyAvg)}</b> early in the season to <b>{fmt1(recentAvg)}</b> recently. Fewer disasters is the
                        fastest path to {gapToGoal?.goal ?? 85}.
                      </>
                    ) : (
                      <>
                        Up from <b>{fmt1(earlyAvg)}</b> early in the season to <b>{fmt1(recentAvg)}</b> recently — worth a look at what changed.
                      </>
                    )}
                  </p>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "#1B2A1D" }}>
                      ±{fmt1(consistency?.stdev)}
                    </div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.55)", marginTop: 3 }}>STD DEV</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 500, color: "#1B2A1D" }}>{consistency?.spread ?? "—"}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.55)", marginTop: 3 }}>SPREAD</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "18px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
                Log complete 18-hole rounds to see your blow-up consistency.
              </div>
            )}
          </CBCard>

          {/* Mental game / tilt deep dive */}
          <CBCard style={brk} pad={20}>
            <CBCardTitle sub="After a blow-up hole (score 7+), what happens next">Mental game · bounce-back</CBCardTitle>
            {mental ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 44,
                      fontWeight: 600,
                      color: mental.tilt ? "#B0433D" : "#3E8F63",
                    }}
                  >
                    {Math.round(mental.recoveredPct)}%
                  </span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(34,49,36,0.6)" }}>recovered next hole</span>
                </div>
                <p style={{ margin: "10px 0 0", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.62)", lineHeight: 1.5 }}>
                  Across <b>{mental.blowUpHoles} blow-up holes</b>, you kept the next hole clean (bogey or better){" "}
                  <b style={{ color: "#3E8F63" }}>{mental.recovered}</b> times, and doubled up again{" "}
                  <b style={{ color: "#B0433D" }}>{Math.round(mental.doubledUpPct)}%</b> of the time — averaging{" "}
                  <b>{fmt1(mental.avgNextHole)}</b> on the hole right after.
                </p>
                {mental.trend.early != null && mental.trend.recent != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(34,49,36,0.55)" }}>Early {mental.trend.early}%</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "rgba(34,49,36,0.4)" }}>&rarr;</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(34,49,36,0.55)" }}>Recent {mental.trend.recent}%</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        color: mental.trend.recent >= mental.trend.early ? "#3E8F63" : "#B0433D",
                      }}
                    >
                      {mental.trend.recent >= mental.trend.early ? "up" : "down"}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    marginTop: 14,
                    padding: "13px 14px",
                    background: hexA(mental.tilt ? "#B0433D" : "#3E8F63", 0.08),
                    border: "1px solid " + hexA(mental.tilt ? "#B0433D" : "#3E8F63", 0.22),
                    borderRadius: 12,
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12.5,
                    color: "#22321f",
                    lineHeight: 1.5,
                  }}
                >
                  {mental.tilt
                    ? "One bad hole is becoming two. After a blow-up, reset to a bogey target and just stop the bleeding — that alone is worth strokes."
                    : "Solid recovery instinct. Protecting the hole after a blow-up is the cheapest scoring you'll find."}
                </div>
              </>
            ) : (
              <div style={{ padding: "18px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
                Log at least 5 blow-up holes (back to back with a following hole) to unlock your bounce-back rate.
              </div>
            )}
          </CBCard>
        </div>
      )}
    </div>
  );
};

export default DesktopInsights;

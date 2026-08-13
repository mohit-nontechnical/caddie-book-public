"use client";

// Caddie Book desktop — Dashboard page, wired to real API data.
// Ported from docs/design/caddie-dashboard.jsx. Every number that was demo
// data in the design (window.CB.golfer, window.CB.rounds, etc.) is replaced
// with data fetched from the real API routes:
//   /api/stats            -> season overview, break-85 progress, scoring avg
//   /api/handicap         -> handicap index (18 + 9 hole)
//   /api/rounds           -> per-round list, used for the score trend chart
//   /api/strokes-gained   -> strokes-gained-vs-potential trend
//   /api/debrief          -> latest round debrief (hero card + coach note)
//   /api/insights         -> season-wide `mental` (bounce-back) block
import React, { useEffect, useMemo, useState } from "react";
import { CBCard, CBCardTitle, CBPageHead, CBSegmented, hexA } from "./DesktopUI";
import { DesktopBarChart, DesktopGauge, DesktopHoleStrip, DesktopLineChart } from "./DesktopCharts";
import { CBTrend, IconImport, IconSpark } from "./DesktopIcons";
import { getCoachStyle } from "../useCoachStyle";
import type {
  DebriefResponse,
  HandicapResponse,
  InsightsResponse,
  RoundListItem,
  StatsResponse,
  StrokesGainedResponse,
} from "./types";

interface DesktopDashboardProps {
  onOpenRound?: (roundId: string) => void;
}

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

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({ onOpenRound }) => {
  // The design's toggle implied two distinct index numbers (an "18-hole" one
  // and a "9-hole" one). The real API instead exposes a single index that can
  // include or exclude 9-hole rounds via ?include9=. "18" = 18-hole rounds
  // only (include9=0); "9" (labelled the same as the design) = the blended
  // index that also folds in 9-hole rounds (include9=1, the default).
  const [idxMode, setIdxMode] = useState<"18" | "9">("18");

  const stats = useJson<StatsResponse>("/api/stats");
  const handicap = useJson<HandicapResponse>(idxMode === "18" ? "/api/handicap?include9=0" : "/api/handicap?include9=1");
  const rounds = useJson<RoundListItem[]>("/api/rounds");
  const sg = useJson<StrokesGainedResponse>("/api/strokes-gained");
  const debrief = useJson<DebriefResponse>(`/api/debrief?style=${encodeURIComponent(getCoachStyle())}`);
  const insights = useJson<InsightsResponse>("/api/insights");

  const anyLoading = stats.loading || handicap.loading || rounds.loading;

  const overall = stats.data?.overall;
  const break85 = overall?.break85;
  const roundsChrono = useMemo(() => {
    const list = rounds.data ?? [];
    // /api/rounds returns newest-first; the chart wants oldest -> newest.
    return [...list].filter((r) => r.complete).sort((a, b) => a.date.localeCompare(b.date));
  }, [rounds.data]);

  const scoreLabels = roundsChrono.map((r) =>
    new Date(r.date + (r.date.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
  const scoreSeries = [{ name: "Score", color: "#0B3D2E", data: roundsChrono.map((r) => r.total), fmt: (v: number) => String(v) }];

  const sgTrend = sg.data?.trend ?? [];
  const sgLabels = sgTrend.map((p) => new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  const sgSeries = [{ name: "Strokes left", color: "#C0912F", data: sgTrend.map((p) => -p.sg), fmt: (v: number) => v.toFixed(1) + " str" }];

  // Scoring distribution bars, built from insights.holeDist (score buckets).
  const distBars = useMemo(() => {
    const dist = insights.data?.holeDist ?? [];
    const byScore = new Map(dist.map((d) => [d.score, d.count]));
    const birdiePlus = [...byScore.entries()].filter(([k]) => Number(k) <= 3).reduce((a, [, c]) => a + c, 0);
    const par = byScore.get("4") ?? 0;
    // Distribution buckets are approximate (API groups by raw stroke count,
    // not by relation to par), so label generically.
    return [
      { key: "3 or less", n: birdiePlus, color: "#3E8F63" },
      { key: "4", n: par, color: "#6E9A46" },
      { key: "5", n: byScore.get("5") ?? 0, color: "#C0912F" },
      { key: "6", n: byScore.get("6") ?? 0, color: "#C0742F" },
      { key: "7+", n: (byScore.get("7") ?? 0) + (byScore.get("8") ?? 0) + (byScore.get("9+") ?? 0), color: "#B0433D" },
    ];
  }, [insights.data]);
  const distTotal = distBars.reduce((a, b) => a + b.n, 0);

  const latest = debrief.data?.round;
  const bounceback = debrief.data?.bounceback;
  const mental = insights.data?.mental;

  const index18 = typeof handicap.data?.index === "number" ? handicap.data.index.toFixed(1) : null;
  const scoreAvg18 = overall?.scoringAvg18 != null ? overall.scoringAvg18.toFixed(1) : null;
  const best18 = overall?.best18 ?? null;
  const totalRounds = overall?.totalRounds ?? 0;
  const courseCount = stats.data?.courses.length ?? 0;

  const damageOverBogey = debrief.data?.blowUpStrokesOverBogey ?? 0;
  const blowHoles = (debrief.data?.blowUps ?? []).map((b) => b.hole);
  const blowupCount = debrief.data?.blowUpCount ?? 0;

  return (
    <div>
      <CBPageHead
        eyebrow="THE SEASON SO FAR"
        title="Good morning."
        sub={
          totalRounds > 0
            ? `${totalRounds} round${totalRounds === 1 ? "" : "s"} in the book.${
                scoreAvg18 ? ` Your season average is ${scoreAvg18}.` : ""
              }${break85 && break85.total > 0 ? ` You've broken 85 ${break85.count} of ${break85.total} times.` : ""}`
            : "Import your first round to see your season take shape."
        }
        right={
          <button className="cb-btn-ghost" style={ghostBtn}>
            <IconImport size={16} stroke="currentColor" />
            Import 18Birdies
          </button>
        }
      />

      {/* hero stats */}
      {anyLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={98} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
          <HeroStat
            label="INDEX"
            value={index18 ?? "—"}
            sub={handicap.data?.trend === "down" ? "Trending down this season" : idxMode === "18" ? "18-hole rounds only" : "includes 9-hole rounds"}
            subColor="#3E8F63"
            accentRule
          >
            <CBSegmented options={[{ value: "18", label: "18" }, { value: "9", label: "+9" }]} value={idxMode} onChange={(v) => setIdxMode(v as "18" | "9")} />
          </HeroStat>
          <HeroStat label="SCORE AVG" value={scoreAvg18 ?? "—"} sub="per 18 holes" />
          <HeroStat label="BEST" value={best18 ?? "—"} sub={latest ? `${latest.course}` : undefined} subColor="#3E8F63" />
          <HeroStat label="ROUNDS" value={totalRounds || "—"} sub={courseCount ? `across ${courseCount} courses` : undefined} />
          <HeroStat
            label="BREAK 85"
            value={break85 ? break85.count : "—"}
            unit={break85 ? "/ " + break85.total : undefined}
            sub={break85 && break85.total > break85.count ? `${break85.total - break85.count} attempts, still chasing` : undefined}
          >
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--gold-ink)", fontWeight: 600 }}>GOAL</span>
          </HeroStat>
        </div>
      )}

      {/* two charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <CBCard>
          <CBCardTitle
            sub="Every logged round, oldest to newest — lower is better"
            right={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "rgba(34,49,36,0.5)" }}>LAST {roundsChrono.length}</span>}
          >
            Score trend
          </CBCardTitle>
          {rounds.loading ? <Skeleton height={224} /> : <DesktopLineChart series={scoreSeries} labels={scoreLabels} height={224} />}
        </CBCard>
        <CBCard>
          <CBCardTitle
            sub="Strokes you're leaving on the table vs. your potential"
            right={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "#C0912F" }}>{sg.data?.avgSG != null ? (sg.data.avgSG >= 0 ? "▲ GAINING" : "▼ TRENDING DOWN") : ""}</span>}
          >
            Strokes gained vs. potential
          </CBCardTitle>
          {sg.loading ? <Skeleton height={224} /> : <DesktopLineChart series={sgSeries} labels={sgLabels} height={224} yMinPad={1} yMaxPad={1.5} />}
        </CBCard>
      </div>

      {/* distribution */}
      <CBCard style={{ marginBottom: 16 }}>
        <CBCardTitle
          sub={`Where all ${distTotal} holes this season landed`}
          right={
            distTotal > 0 ? (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "rgba(34,49,36,0.5)" }}>
                PARS & BETTER: {Math.round(((distBars[0]?.n ?? 0) + (distBars[1]?.n ?? 0)) / distTotal * 100)}%
              </span>
            ) : null
          }
        >
          Scoring distribution
        </CBCardTitle>
        {insights.loading ? <Skeleton height={186} /> : <DesktopBarChart bars={distBars} total={distTotal} height={186} />}
      </CBCard>

      {/* debrief + mental */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        {/* debrief */}
        <CBCard onClick={() => latest && onOpenRound?.(latest.id)} hover style={{ cursor: latest ? "pointer" : "default" }}>
          {debrief.loading ? (
            <Skeleton height={280} />
          ) : latest ? (
            <>
              <CBCardTitle
                sub={`${latest.course} · ${new Date(latest.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                right={
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: "#1B2A1D", lineHeight: 1 }}>{latest.total}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(34,49,36,0.5)", marginTop: 2 }}>
                      {latest.holeCount} holes
                    </div>
                  </div>
                }
              >
                Latest round debrief
              </CBCardTitle>

              {(() => {
                const holes = rounds.data?.find((r) => r.id === latest.id)?.holes ?? [];
                // The debrief/rounds routes don't return per-hole par, so the
                // strip shades by absolute score (bogey-golf baseline) — see
                // DesktopCharts' DesktopHoleStrip for the exact thresholds.
                // The raw scores rendered are always the real ones.
                return holes.length > 0 ? (
                  <DesktopHoleStrip round={{ holes }} cellH={38} />
                ) : (
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)", padding: "8px 0" }}>
                    Hole-by-hole scores aren&apos;t available for this round.
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: 20, margin: "18px 0 0", padding: "14px 0 0", borderTop: "1px solid var(--line)" }}>
                <DebriefStat n={blowupCount} label="blow-up holes" color="#B0433D" />
                <DebriefStat n={"+" + damageOverBogey} label="strokes over bogey" color="#C0742F" />
                <DebriefStat n={blowHoles.length ? "#" + blowHoles.join(", #") : "—"} label="the damage holes" small />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 11,
                  marginTop: 16,
                  background: hexA("#C0912F", 0.09),
                  border: "1px solid " + hexA("#C0912F", 0.22),
                  borderRadius: 12,
                  padding: "13px 14px",
                }}
              >
                <IconSpark size={17} stroke="var(--gold-ink)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: "0.13em", color: "var(--gold-ink)", marginBottom: 5 }}>COACH&apos;S NOTE</div>
                  <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#22321f", lineHeight: 1.5 }}>
                    {debrief.data?.coachNote || debrief.data?.headline || "Log a few more rounds and your coach's note will show up here."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <EmptyDebrief />
          )}
        </CBCard>

        {/* mental game — the emotional hook */}
        <div
          style={{
            background: "linear-gradient(165deg, #0C4030, #08301F)",
            border: "1px solid rgba(199,162,75,0.3)",
            borderRadius: 16,
            padding: 22,
            color: "#F2ECDC",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(110% 70% at 100% 0%, rgba(199,162,75,0.14), transparent 55%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: "var(--gold)" }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.16em", color: "var(--gold)" }}>MENTAL GAME</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.05, marginBottom: 2 }}>
              The toughness score
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(242,236,220,0.68)", lineHeight: 1.4 }}>
              How you respond the hole after a blow-up.
            </div>

            {insights.loading ? (
              <Skeleton height={118} style={{ margin: "18px 0 4px", background: "rgba(242,236,220,0.08)" }} />
            ) : mental ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 18, margin: "18px 0 4px" }}>
                  <DesktopGauge value={mental.recoveredPct} color="var(--gold)" track="rgba(242,236,220,0.14)" size={118} />
                  <div style={{ flex: 1 }}>
                    <Legend color="#C7A24B" n={mental.recoveredPct + "%"} label="Recovered — bogey or better" />
                    <Legend color="rgba(176,67,61,0.85)" n={mental.doubledUpPct + "%"} label="Doubled-up again" />
                    {mental.trend.early != null && mental.trend.recent != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: mental.trend.recent >= mental.trend.early ? "#8FD3AC" : "#E0A9A3" }}>
                        <CBTrend dir={mental.trend.recent >= mental.trend.early ? "up" : "down"} size={9} goodColor="#8FD3AC" badColor="#E0A9A3" />
                        <span>
                          {mental.trend.recent >= mental.trend.early ? "Up" : "Down"} from {mental.trend.early}% earlier this season
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 14,
                    padding: "13px 14px",
                    background: "rgba(242,236,220,0.06)",
                    border: "1px solid rgba(242,236,220,0.1)",
                    borderRadius: 12,
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12.5,
                    color: "rgba(242,236,220,0.82)",
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}
                >
                  {mental.tilt
                    ? "You're doubling up more often than you're recovering — the fastest fix isn't your swing, it's the next tee shot after a bad hole."
                    : "You're grinding harder after mistakes than the average round suggests. That's the number that breaks 85 — not your swing."}
                </div>
              </>
            ) : (
              <div
                style={{
                  marginTop: 18,
                  padding: "13px 14px",
                  background: "rgba(242,236,220,0.06)",
                  border: "1px solid rgba(242,236,220,0.1)",
                  borderRadius: 12,
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 12.5,
                  color: "rgba(242,236,220,0.72)",
                  lineHeight: 1.5,
                }}
              >
                Log a few more complete 18-hole rounds and your bounce-back rate will show up here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface HeroStatProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: string;
  subColor?: string;
  children?: React.ReactNode;
  accentRule?: boolean;
}

const HeroStat: React.FC<HeroStatProps> = ({ label, value, unit, sub, subColor, children, accentRule }) => (
  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "15px 17px", position: "relative", overflow: "hidden" }}>
    {accentRule && <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: "var(--gold)" }} />}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: "0.13em", color: "rgba(34,49,36,0.55)" }}>{label}</div>
      {children}
    </div>
    {value != null && (
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 9 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 500, color: "#1B2A1D", letterSpacing: "-0.02em" }}>{value}</span>
        {unit && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "rgba(34,49,36,0.5)" }}>{unit}</span>}
      </div>
    )}
    {sub && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: subColor || "rgba(34,49,36,0.5)", marginTop: 4 }}>{sub}</div>}
  </div>
);

const DebriefStat: React.FC<{ n: React.ReactNode; label: string; color?: string; small?: boolean }> = ({ n, label, color, small }) => (
  <div>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: small ? 15 : 24, fontWeight: 500, color: color || "#1B2A1D", lineHeight: 1 }}>{n}</div>
    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.55)", marginTop: 5 }}>{label}</div>
  </div>
);

const Legend: React.FC<{ color: string; n: string; label: string }> = ({ color, n, label }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 7 }}>
    <span style={{ width: 8, height: 8, borderRadius: 8, background: color, flexShrink: 0, transform: "translateY(1px)" }} />
    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 500, color: "#F2ECDC", minWidth: 46 }}>{n}</span>
    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: "rgba(242,236,220,0.62)", lineHeight: 1.25 }}>{label}</span>
  </div>
);

const EmptyDebrief: React.FC = () => (
  <div style={{ padding: "24px 4px", textAlign: "center" }}>
    <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "#1B2A1D", marginBottom: 6 }}>No rounds yet</div>
    <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(34,49,36,0.6)", lineHeight: 1.5 }}>
      Import your 18Birdies rounds to see a debrief of your latest round here.
    </p>
  </div>
);

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--ink)",
  color: "#F2ECDC",
  border: "none",
  borderRadius: 11,
  padding: "10px 16px",
  cursor: "pointer",
  fontFamily: "'DM Sans',sans-serif",
  fontSize: 13,
  fontWeight: 600,
};

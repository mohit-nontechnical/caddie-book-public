import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { SLabel } from "./primitives";
import { SGTrendChart } from "./ChartsLazy";

interface CourseSG { course: string; rounds: number; avgSG: number; avgDiff: number }
interface RoundSG { date: string; course: string; total: number; differential: number; sg: number }
interface SGData {
  rounds: number;
  index: number | null;
  avgSG: number | null;
  potentialGap: number | null;
  gainerPct: number;
  best: RoundSG | null;
  worst: RoundSG | null;
  trend: { date: string; sg: number }[];
  byCourse: CourseSG[];
  excludedExecutive?: number;
  excludedCourses?: string[];
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function sgStr(n: number): string {
  return (n > 0 ? "+" : "") + n.toFixed(1);
}

export function StrokesGained() {
  const [data, setData] = useState<SGData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/strokes-gained")
      .then((r) => r.json())
      .then((j) => { if (alive) { if (j.error || j.index == null) setErr(true); else setData(j); } })
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, []);

  if (err) return null;
  if (!data) {
    return <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "18px 16px", height: 100, opacity: 0.5 }} />;
  }

  const { index, potentialGap, gainerPct, best, worst, trend, byCourse } = data;
  // Diverging bars: scale by the largest absolute course-SG
  const maxAbs = Math.max(1, ...byCourse.map((c) => Math.abs(c.avgSG)));

  return (
    <section style={{ marginBottom: 14, borderRadius: 18, background: "var(--panel)", border: "1px solid var(--line)", padding: "16px 16px 18px" }}>
      <SLabel>Strokes gained · vs your potential</SLabel>

      {/* Hero: potential + gap */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, margin: "8px 0 6px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>{index?.toFixed(1)}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 4 }}>POTENTIAL</div>
        </div>
        <p style={{ margin: 0, flex: 1, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.45 }}>
          On a typical round you play <b style={{ color: "var(--bad)" }}>{potentialGap}</b> strokes above your potential. You beat it just <b style={{ color: "var(--cream)" }}>{Math.round(gainerPct)}%</b> of the time — that gap is your blow-up upside.
        </p>
      </div>

      {/* SG trend (interactive) */}
      {trend.length >= 3 && (
        <div data-noswipe style={{ margin: "6px -6px 0" }}>
          <SGTrendChart data={trend} />
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-3)", margin: "0 6px" }}>Per-round strokes gained — higher is better. Tap a point for the round. {trend.length} rounds.</div>
        </div>
      )}

      {/* Best / worst */}
      {best && worst && (
        <div style={{ display: "flex", gap: 10, margin: "12px 0 6px" }}>
          <div style={{ flex: 1, borderRadius: 12, background: hexA("#4CAF82", 0.1), border: "1px solid " + hexA("#4CAF82", 0.3), padding: "10px 12px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--good)" }}>{sgStr(best.sg)}</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{best.total} · {best.course}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--cream-3)", marginTop: 1 }}>BEST · {fmtDate(best.date)}</div>
          </div>
          <div style={{ flex: 1, borderRadius: 12, background: hexA("#C05C5C", 0.1), border: "1px solid " + hexA("#C05C5C", 0.3), padding: "10px 12px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--bad)" }}>{sgStr(worst.sg)}</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{worst.total} · {worst.course}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--cream-3)", marginTop: 1 }}>WORST · {fmtDate(worst.date)}</div>
          </div>
        </div>
      )}

      {/* Per-course over/under performance (diverging bars) */}
      {byCourse.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", textTransform: "uppercase", marginBottom: 10 }}>Where you over / under-perform</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {byCourse.map((c) => {
              const pos = c.avgSG >= 0;
              const w = (Math.abs(c.avgSG) / maxAbs) * 50; // % of half-width
              return (
                <div key={c.course} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: "0 0 38%", minWidth: 0, fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.course}</span>
                  <div style={{ flex: 1, position: "relative", height: 16 }}>
                    {/* center line */}
                    <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line)" }} />
                    <div style={{ position: "absolute", top: 2, height: 12, borderRadius: 3, background: pos ? "var(--good)" : "var(--bad)", ...(pos ? { left: "50%", width: w + "%" } : { right: "50%", width: w + "%" }) }} />
                  </div>
                  <span style={{ flex: "0 0 42px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: pos ? "var(--good)" : "var(--bad)" }}>{sgStr(c.avgSG)}</span>
                </div>
              );
            })}
          </div>
          <p style={{ margin: "11px 0 0", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", lineHeight: 1.45 }}>
            Strokes gained per round vs each course&apos;s difficulty — not raw score. Green = you handle it better than its rating suggests.
          </p>
        </div>
      )}

      {!!data.excludedExecutive && data.excludedExecutive > 0 && (
        <p style={{ margin: "12px 0 0", fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-3)", lineHeight: 1.4, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          {data.excludedExecutive} executive / par-3 round{data.excludedExecutive === 1 ? "" : "s"} excluded — short courses aren&apos;t comparable to regulation golf{data.excludedCourses?.length ? ` (${data.excludedCourses.join(", ")})` : ""}.
        </p>
      )}
    </section>
  );
}

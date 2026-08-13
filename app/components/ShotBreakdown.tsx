"use client";

// ── Shot-by-shot trace + club report card (mobile shell) ─────
// Rendered on round detail for shot-tracked rounds. Fetches
// /api/round-shots and shows every shot as a chip colored by
// strokes gained, plus a per-club report card for the round.

import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { ShotHoleMap } from "./ShotHoleMap";

interface ShotRow {
  seq: number;
  club: string;
  lie: string;
  dist: number;
  distUnit: string;
  rem: number | null;
  remUnit: string | null;
  sg: number;
  sLat?: number;
  sLng?: number;
  eLat?: number;
  eLng?: number;
}

interface HoleRow {
  hole: number;
  par: number;
  strokes: number;
  sg: number;
  putts: number | null;
  pin: [number, number] | null;
  gps: boolean;
  shots: ShotRow[];
}

interface ClubRow {
  club: string;
  label: string;
  shots: number;
  totalSG: number;
  avgSG: number;
}

interface DispersionRow {
  club: string;
  label: string;
  attempts: number;
  avgDistYds: number | null;
  landed: { fairway: number; green: number; rough: number; holed: number; other: number };
  accuracyPct: number | null;
  avgOffsetYds: number | null;
  biasYds: number | null;
  leftPct: number | null;
  rightPct: number | null;
  offsetsYds: number[];
}

interface RedFlagMetric {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: "%" | "per 18" | "SG";
  direction: "higher" | "lower";
  status: "red" | "watch" | "good";
}

interface RedFlags {
  metrics: RedFlagMetric[];
  redCount: number;
  watchCount: number;
  weakestArea?: string;
  weakestAreaSg?: number;
  weakestHole?: string;
  weakestHoleSg?: number;
}

interface ShotsResponse {
  shots: boolean;
  holes?: HoleRow[];
  clubs?: ClubRow[];
  dispersion?: DispersionRow[];
  redFlags?: RedFlags;
  error?: string;
}

function sgTint(sg: number): { bg: string; border: string; color: string } {
  if (sg <= -0.5) return { bg: hexA("#C05C5C", 0.28), border: hexA("#C05C5C", 0.5), color: "var(--cream)" };
  if (sg <= -0.15) return { bg: hexA("#C05C5C", 0.12), border: hexA("#C05C5C", 0.3), color: "var(--cream-2)" };
  if (sg >= 0.3) return { bg: hexA("#4CAF82", 0.26), border: hexA("#4CAF82", 0.5), color: "var(--cream)" };
  if (sg >= 0.1) return { bg: hexA("#4CAF82", 0.12), border: hexA("#4CAF82", 0.3), color: "var(--cream-2)" };
  return { bg: hexA("#FFFFFF", 0.05), border: "var(--line)", color: "var(--cream-2)" };
}

export function gradeFor(avgSG: number, shots: number): { grade: string; color: string } {
  if (shots < 2) return { grade: "–", color: "var(--cream-3)" };
  if (avgSG >= 0.05) return { grade: "A", color: "#4CAF82" };
  if (avgSG >= -0.1) return { grade: "B", color: "#8FBC6F" };
  if (avgSG >= -0.25) return { grade: "C", color: "#D9A441" };
  if (avgSG >= -0.4) return { grade: "D", color: "#CE8147" };
  return { grade: "F", color: "#C05C5C" };
}

const secTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.16em",
  color: "var(--cream-3)",
  marginBottom: 12,
};

function fmtDist(v: number, unit: string | null): string {
  return `${v}${unit === "ft" ? "ft" : "y"}`;
}

function fmtSg(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

function flagValue(m: RedFlagMetric): string {
  if (m.unit === "%") return `${Math.round(m.value)}%`;
  if (m.unit === "SG") return fmtSg(m.value);
  return m.value.toFixed(1);
}

const RedFlagsCard = ({ data }: { data: RedFlags }) => {
  const visible = data.metrics.filter((m) => m.status !== "good").slice(0, 6);
  const statusColor = (status: RedFlagMetric["status"]) => status === "red" ? "#C05C5C" : status === "watch" ? "#D9A441" : "#4CAF82";
  return (
    <div style={{ padding: "0 16px", marginTop: 16 }}>
      <div style={{ background: `linear-gradient(145deg, ${hexA("#C05C5C", 0.13)}, var(--panel) 48%)`, border: "1px solid " + hexA("#C05C5C", 0.28), borderRadius: 18, padding: "15px 14px 14px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 13 }}>
          <div>
            <div style={secTitle}>ROUND DIAGNOSTIC</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--cream)", lineHeight: 1.05 }}>
              {data.redCount ? `${data.redCount} red flag${data.redCount === 1 ? "" : "s"}` : "No major leaks"}
            </div>
          </div>
          <div style={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", background: hexA(data.redCount ? "#C05C5C" : "#4CAF82", 0.16), border: "1px solid " + hexA(data.redCount ? "#C05C5C" : "#4CAF82", 0.35), fontFamily: "var(--font-display)", fontSize: 22, color: data.redCount ? "var(--bad)" : "var(--good)" }}>
            {data.redCount}
          </div>
        </div>
        {(data.weakestArea || data.weakestHole) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {data.weakestArea && <div style={{ padding: "10px 11px", borderRadius: 12, background: hexA("#000000", 0.12) }}><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--cream-3)", marginBottom: 4 }}>BIGGEST LEAK</div><div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--cream)" }}>{data.weakestArea}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--bad)", marginTop: 2 }}>SG {data.weakestAreaSg == null ? "—" : fmtSg(data.weakestAreaSg)}</div></div>}
            {data.weakestHole && <div style={{ padding: "10px 11px", borderRadius: 12, background: hexA("#000000", 0.12) }}><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--cream-3)", marginBottom: 4 }}>COSTLIEST HOLE</div><div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--cream)" }}>{data.weakestHole}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--bad)", marginTop: 2 }}>SG {data.weakestHoleSg == null ? "—" : fmtSg(data.weakestHoleSg)}</div></div>}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 }}>
          {visible.map((m) => {
            const color = statusColor(m.status);
            return <div key={m.key} style={{ padding: "9px 10px", borderRadius: 11, background: hexA(color, 0.08), border: "1px solid " + hexA(color, 0.2) }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 5, alignItems: "baseline" }}><span style={{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--cream-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color }}>{flagValue(m)}</span></div>
              <div style={{ height: 3, background: hexA("#FFFFFF", 0.06), borderRadius: 2, marginTop: 7, position: "relative" }}><div style={{ position: "absolute", inset: 0, width: `${Math.min(100, 34 + Math.abs(m.value - m.target) / Math.max(Math.abs(m.target), 1) * 45)}%`, background: color, borderRadius: 2, opacity: 0.75 }} /></div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--cream-3)", marginTop: 5 }}>TARGET {m.target}{m.unit === "%" ? "%" : m.unit === "SG" ? " SG" : " / 18"}</div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
};

export const ShotBreakdown = ({ roundId }: { roundId: string }) => {
  const [data, setData] = useState<ShotsResponse | null>(null);
  const [error, setError] = useState(false);
  const [openHole, setOpenHole] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/round-shots?id=${encodeURIComponent(roundId)}`)
      .then((r) => r.json())
      .then((j) => { if (live) setData(j); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [roundId]);

  if (error || data?.error) return null;
  if (!data) {
    return (
      <div style={{ padding: "0 16px", marginTop: 16 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "16px", opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", color: "var(--cream-3)" }}>
          LOADING SHOTS…
        </div>
      </div>
    );
  }
  if (!data.shots || !data.holes) return null;

  return (
    <>
      {data.redFlags && <RedFlagsCard data={data.redFlags} />}
      {/* Shot-by-shot trace */}
      <div style={{ padding: "0 16px", marginTop: 16 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "14px 14px 6px" }}>
          <div style={secTitle}>SHOT BY SHOT</div>
          {data.holes.map((h) => {
            const diff = h.strokes - h.par;
            const scoreColor = diff >= 2 ? "var(--bad)" : diff <= 0 ? "var(--good)" : "var(--cream-2)";
            const open = openHole === h.hole;
            return (
              <div key={h.hole} style={{ padding: "10px 0 12px", borderTop: "1px solid var(--line)" }}>
                <button
                  onClick={() => setOpenHole(open ? null : h.hole)}
                  style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, background: "none", border: "none", padding: 0, cursor: h.gps ? "pointer" : "default", textAlign: "left" }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--cream-3)" }}>
                    <span style={{ color: "var(--cream)", fontWeight: 600, fontSize: 13 }}>{h.hole}</span>
                    {" · PAR "}{h.par}
                    {h.gps && (
                      <span style={{ marginLeft: 8, color: open ? "var(--gold)" : "var(--cream-3)", fontSize: 10 }}>
                        {open ? "▾ MAP" : "▸ MAP"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                    <span style={{ color: scoreColor, fontWeight: 600 }}>
                      {h.strokes} ({diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff})
                    </span>
                    <span style={{ color: h.sg < -0.4 ? "var(--bad)" : h.sg > 0.2 ? "var(--good)" : "var(--cream-3)", marginLeft: 8 }}>
                      SG {fmtSg(h.sg)}
                    </span>
                  </div>
                </button>
                {open && h.gps && (
                  <div style={{ marginBottom: 10 }}>
                    <ShotHoleMap shots={h.shots} pin={h.pin} height={240} />
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {h.shots.map((s) => {
                    const t = sgTint(s.sg);
                    return (
                      <span
                        key={s.seq}
                        title={`Shot ${s.seq}: ${s.club} from ${s.lie}, ${fmtDist(s.dist, s.distUnit)}${s.rem == null ? ", holed" : ` → ${fmtDist(s.rem, s.remUnit)} left`} · SG ${fmtSg(s.sg)}`}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          padding: "5px 8px",
                          borderRadius: 8,
                          background: t.bg,
                          border: "1px solid " + t.border,
                          color: t.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.club} · {s.lie === "Green" ? fmtDist(s.dist, s.distUnit) : `${s.lie.toLowerCase()} ${fmtDist(s.dist, s.distUnit)}`}
                        {s.rem == null ? " ⛳" : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Club report card */}
      {data.clubs && data.clubs.length > 0 && (
        <div style={{ padding: "0 16px", marginTop: 16 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "14px 14px 8px" }}>
            <div style={secTitle}>CLUB REPORT CARD · THIS ROUND</div>
            {data.clubs.map((c) => {
              const g = gradeFor(c.avgSG, c.shots);
              const barW = Math.min(100, Math.abs(c.totalSG) * 24);
              return (
                <div key={c.club} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ flex: "0 0 96px", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--cream)" }}>
                    {c.label}
                  </div>
                  <div style={{ flex: "0 0 52px", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--cream-3)" }}>
                    {c.shots} shot{c.shots === 1 ? "" : "s"}
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: hexA("#FFFFFF", 0.05), overflow: "hidden", display: "flex", justifyContent: c.totalSG < 0 ? "flex-end" : "flex-start" }}>
                      <div style={{ width: `${barW}%`, height: "100%", borderRadius: 3, background: c.totalSG < 0 ? hexA("#C05C5C", 0.75) : hexA("#4CAF82", 0.75) }} />
                    </div>
                    <div style={{ flex: "0 0 46px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: c.totalSG < 0 ? "var(--bad)" : "var(--good)" }}>
                      {fmtSg(c.totalSG)}
                    </div>
                  </div>
                  <div style={{ flex: "0 0 26px", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: g.color }}>
                    {g.grade}
                  </div>
                </div>
              );
            })}
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--cream-3)", padding: "8px 0 6px", lineHeight: 1.4 }}>
              Total strokes gained vs a 20-handicap baseline. Grades need 2+ shots.
            </div>
          </div>
        </div>
      )}

      {/* Dispersion */}
      {data.dispersion && data.dispersion.length > 0 && (
        <div style={{ padding: "0 16px", marginTop: 16 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "14px 14px 8px" }}>
            <div style={secTitle}>DISPERSION · WHERE SHOTS FINISHED</div>
            {data.dispersion.filter((d) => d.attempts >= 2).map((d) => {
              const seg = (n: number, color: string, label: string) =>
                n > 0 ? (
                  <div key={label} title={`${label}: ${n}`} style={{ flex: n, height: 7, background: color }} />
                ) : null;
              return (
                <div key={d.club} style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--cream)" }}>
                      {d.label}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cream-3)", marginLeft: 8 }}>
                        {d.attempts} shots{d.avgDistYds ? ` · avg ${d.avgDistYds}y` : ""}
                      </span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--cream-2)" }}>
                      {d.accuracyPct != null ? `${d.accuracyPct}% on target` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2, borderRadius: 4, overflow: "hidden", marginBottom: 5 }}>
                    {seg(d.landed.fairway, hexA("#4CAF82", 0.8), "fairway")}
                    {seg(d.landed.green, hexA("#4CAF82", 0.5), "green")}
                    {seg(d.landed.holed, "#F0C040", "holed")}
                    {seg(d.landed.rough, hexA("#C05C5C", 0.65), "rough")}
                    {seg(d.landed.other, hexA("#FFFFFF", 0.15), "other")}
                  </div>
                  {d.avgOffsetYds != null && (
                    <div style={{ position: "relative", height: 30, margin: "8px 2px 5px", borderRadius: 15, background: `linear-gradient(90deg, ${hexA("#C05C5C", 0.13)}, ${hexA("#4CAF82", 0.13)} 50%, ${hexA("#C05C5C", 0.13)})`, border: "1px solid " + hexA("#FFFFFF", 0.07), overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: "50%", top: 3, bottom: 3, width: 1, background: hexA("#F0C040", 0.65) }} />
                      {(d.offsetsYds ?? []).map((offset, i) => {
                        const span = Math.max(15, ...(d.offsetsYds ?? []).map((v) => Math.abs(v)));
                        const left = 50 + (offset / span) * 43;
                        return <span key={i} title={`${offset > 0 ? "+" : ""}${offset}y`} style={{ position: "absolute", left: `${left}%`, top: 7 + (i % 3) * 5, width: 6, height: 6, borderRadius: "50%", transform: "translateX(-50%)", background: offset < 0 ? "#D9A441" : "#C05C5C", border: "1px solid " + hexA("#FFFFFF", 0.45), boxShadow: `0 0 0 2px ${hexA("#000000", 0.12)}` }} />;
                      })}
                      <span style={{ position: "absolute", left: 6, bottom: 2, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--cream-3)" }}>L</span><span style={{ position: "absolute", right: 6, bottom: 2, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--cream-3)" }}>R</span>
                    </div>
                  )}
                  {d.avgOffsetYds != null && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cream-3)" }}>
                      miss {d.avgOffsetYds}y avg ·{" "}
                      {d.biasYds != null && Math.abs(d.biasYds) >= 3
                        ? `${Math.abs(d.biasYds)}y ${d.biasYds < 0 ? "LEFT" : "RIGHT"} bias`
                        : "no strong bias"}
                      {d.leftPct != null ? ` · L${d.leftPct}% / R${d.rightPct}%` : ""}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 12, padding: "9px 0 7px", fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--cream-3)" }}>
              <span><span style={{ color: "#4CAF82" }}>■</span> fairway/green</span>
              <span><span style={{ color: "#F0C040" }}>■</span> holed</span>
              <span><span style={{ color: "#C05C5C" }}>■</span> rough</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { getCoachStyle } from "./useCoachStyle";

interface DebriefData {
  round: { id: string; course: string; date: string; total: number; holeCount: number; front9: number; back9: number };
  personalAvg: number | null;
  best: number | null;
  vsAvg: number | null;
  scoring: { pars: number; birdiesPlus: number; bogeys: number; doublesPlus: number };
  blowUps: { hole: number; score: number }[];
  blowUpCount: number;
  blowUpStrokesOverBogey: number;
  cleanScore: number;
  bounceback: { chances: number; recovered: number; recoveredPct: number; avgNextHole: number; tilt: boolean } | null;
  headline: string;
  coachNote: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Per-round debrief card. Pass a roundId to debrief a specific round, or omit
// for the latest complete round. Renders nothing until data loads.
export function RoundDebrief({ roundId, onOpenCoach }: { roundId?: string; onOpenCoach?: () => void }) {
  const [data, setData] = useState<DebriefData | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    const styleParam = `style=${encodeURIComponent(getCoachStyle())}`;
    const url = roundId ? `/api/debrief?roundId=${encodeURIComponent(roundId)}&${styleParam}` : `/api/debrief?${styleParam}`;
    fetch(url)
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Debrief failed");
        if (alive) setData(j);
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Debrief failed"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [roundId]);

  if (loading) {
    return (
      <div style={{ borderRadius: 18, border: "1px solid var(--line)", background: "var(--panel)", padding: "20px", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)" }}>
        Reading your round…
      </div>
    );
  }
  if (err || !data) {
    return null; // fail silently — debrief is a bonus, never blocks the flow
  }

  const { round, vsAvg, personalAvg, blowUps, blowUpStrokesOverBogey, cleanScore, bounceback, headline, coachNote, scoring } = data;
  const beatAvg = vsAvg != null && vsAvg < 0;
  const accent = beatAvg ? "#4CAF82" : blowUps.length === 0 ? "#4CAF82" : "#F0C040";

  return (
    <div data-noswipe style={{ borderRadius: 20, overflow: "hidden", border: "1px solid " + hexA(accent, 0.4), background: "linear-gradient(160deg, " + hexA(accent, 0.1) + ", transparent), var(--panel)" }}>
      {/* Header */}
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--cream-3)", textTransform: "uppercase" }}>Round debrief</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--cream)", lineHeight: 1 }}>{round.total}</span>
          {vsAvg != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: beatAvg ? "var(--good)" : "var(--cream-2)", background: hexA(beatAvg ? "#4CAF82" : "#FFFFFF", beatAvg ? 0.14 : 0.06), padding: "3px 9px", borderRadius: 999 }}>
              {vsAvg <= 0 ? vsAvg : "+" + vsAvg} vs your {personalAvg} avg
            </span>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", marginTop: 5 }}>
          {round.course} · {fmtDate(round.date)}{round.holeCount >= 18 ? ` · ${round.front9}/${round.back9}` : ` · ${round.holeCount}h`}
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: "14px 18px 4px" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--cream)", lineHeight: 1.45 }}>{headline}</p>
      </div>

      {/* Scoring chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 18px 4px" }}>
        {[
          ["Pars+", scoring.pars, "#4CAF82"],
          ["Bogeys", scoring.bogeys, "#C9B870"],
          ["Doubles+", scoring.doublesPlus, "#C05C5C"],
        ].map(([label, n, c]) => (
          <span key={label as string} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-2)", background: hexA(c as string, 0.12), border: "1px solid " + hexA(c as string, 0.3), padding: "4px 10px", borderRadius: 999 }}>
            {n as number} {label as string}
          </span>
        ))}
      </div>

      {/* Blow-up holes */}
      {blowUps.length > 0 && (
        <div style={{ padding: "12px 18px 4px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", textTransform: "uppercase", marginBottom: 8 }}>Where it got away</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {blowUps.map((b) => (
              <span key={b.hole} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--bad)", background: hexA("#C05C5C", 0.13), padding: "5px 11px", borderRadius: 999 }}>
                #{b.hole} · {b.score}
              </span>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.45 }}>
            Played to bogey, those become <b style={{ color: "var(--cream)" }}>{cleanScore}</b> (−{blowUpStrokesOverBogey}).
          </p>
        </div>
      )}

      {/* Mental game / bounce-back */}
      {bounceback && (
        <div style={{ margin: "12px 18px 4px", padding: "12px 14px", borderRadius: 14, background: hexA(bounceback.tilt ? "#C05C5C" : "#4CAF82", 0.08), border: "1px solid " + hexA(bounceback.tilt ? "#C05C5C" : "#4CAF82", 0.3) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>{bounceback.tilt ? "🧠" : "💪"}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 700, color: "var(--cream)" }}>
              {bounceback.tilt ? "Tilt watch" : "Bounce-back"}
            </span>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.45 }}>
            After your blow-up holes you recovered (bogey or better) on <b style={{ color: "var(--cream)" }}>{bounceback.recovered}/{bounceback.chances}</b> — avg {bounceback.avgNextHole} on the next hole.
            {bounceback.tilt ? " One bad hole is becoming two. Reset to bogey-target and breathe." : " Good — you stopped the bleeding."}
          </p>
        </div>
      )}

      {/* Coach note */}
      <div style={{ margin: "12px 18px", padding: "13px 14px", borderRadius: 14, background: hexA("#F0C040", 0.08), border: "1px solid " + hexA("#F0C040", 0.28) }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.18em", color: "var(--gold)", textTransform: "uppercase", marginBottom: 5 }}>Coach</div>
        <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream)", lineHeight: 1.5, fontStyle: "italic" }}>{coachNote}</p>
      </div>

      {onOpenCoach && (
        <button onClick={onOpenCoach} className="sc-press" style={{ margin: "0 18px 16px", width: "calc(100% - 36px)", borderRadius: 12, padding: "12px", cursor: "pointer", border: "none", background: "var(--gold)", color: "#0F2016", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 700 }}>
          See full Coach analysis →
        </button>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { slots, patterns as seedPatterns, gradeColor, hexA, Slot, Pattern } from "@/lib/caddie-data";
import { IconSpark } from "./icons";
import { useGrades } from "./GradesContext";
import { useLiveGolfer } from "./useLiveGolfer";
import { useCoachStyle } from "./useCoachStyle";
import { TrendAlertsList } from "./TrendAlerts";
import type { TrendAlert } from "@/lib/trends";

const PatternCard = ({ pattern, onOpen, compact }: { pattern: Pattern; onOpen: () => void; compact?: boolean }) => {
  const { gradeFor } = useGrades();
  const slot = slots.find((s) => s.id === pattern.slot) ?? slots[0];
  const grade = gradeFor(slot.id, slot.grade);
  const c = gradeColor(grade);
  return (
    <button onClick={onOpen} className="sc-tile" style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "block", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: compact ? "13px 14px" : "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: c }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--cream)", fontWeight: 500, whiteSpace: "nowrap" }}>{pattern.tag.toUpperCase()}</span>
        </span>
        {!compact && <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-3)", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8 }}>{pattern.date}</span>}
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: compact ? 13 : 14, color: "var(--cream-2)", lineHeight: 1.5 }}>{pattern.text}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(c, 0.18), fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600, color: c }}>{grade}</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>{slot.name}</span>
      </div>
    </button>
  );
};

interface CoachResult {
  slotGrades?: { id: string; grade: string }[];
  patterns?: { tag: string; slot: string; text: string }[];
  weeklyInsight?: string;
  focusDrill?: { slot: string; drill: string; why: string };
  roundsAnalyzed?: number;
  excludedCount?: number;
  plan?: { focus: string; actions: string[] };
  progress?: {
    baselineAvg: number;
    currentAvg: number;
    baselineDoubles: number;
    currentDoubles: number;
    deltaDoubles: number;
    status: string;
  };
}

const EXCLUDE_KEY = "caddie:excludePartial";

export const FeedView = ({ onOpenSlot }: { onOpenSlot: (s: Slot) => void }) => {
  const { applyGrades, hasOverrides, reset } = useGrades();
  const live = useLiveGolfer();
  const [loading, setLoading] = useState(false);
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState(0);
  const [excludePartial, setExcludePartial] = useState(false);
  const [style] = useCoachStyle();
  const [trendAlerts, setTrendAlerts] = useState<TrendAlert[]>([]);

  useEffect(() => {
    try {
      setExcludePartial(localStorage.getItem(EXCLUDE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/trends")
      .then((r) => r.json())
      .then((j) => {
        if (alive && Array.isArray(j?.alerts)) setTrendAlerts(j.alerts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function toggleExclude() {
    setExcludePartial((v) => {
      const next = !v;
      try {
        localStorage.setItem(EXCLUDE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function ingest(data: CoachResult) {
    setCoach(data);
    if (data.slotGrades?.length) {
      applyGrades(data.slotGrades);
      setUpdated(data.slotGrades.length);
    }
  }

  async function reAnalyze(opts?: { newPlan?: boolean }) {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludePartial, newPlan: opts?.newPlan === true, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Coach analysis failed");
      ingest(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Keyless demo so the live grade-update flow is observable without OpenRouter.
  function runDemo() {
    setErr("");
    setLoading(true);
    setTimeout(() => {
      ingest({
        slotGrades: [
          { id: "bunker", grade: "D" },
          { id: "approach", grade: "C" },
          { id: "driver", grade: "C" },
          { id: "chip", grade: "B" },
        ],
        weeklyInsight:
          "Three weeks of the Splash drill is paying off — bunkers climbed F→D and your approach play steadied. Driver tempo is the next unlock.",
        patterns: [
          { tag: "Bunker turnaround", slot: "bunker", text: "Sand saves doubled since you started grooving a fixed entry point. Keep the Splash reps in your warm-up." },
          { tag: "Approach steadying", slot: "approach", text: "100–150 GIR is trending up. The Window drill is working — stay on the start-line discipline." },
        ],
        plan: {
          focus: "Cut doubles from 3.2 to under 2 per round through disciplined damage control",
          actions: [
            "When in trouble, always aim for the widest part of the fairway — never hero shots",
            "On a par 4/5 after a penalty or miss, accept bogey: lay up to your best yardage",
            "Practice 30-yard pitch-and-run from rough to simulate escape shots (10 min pre-round)",
            "Before each tee shot, identify the no-go zone (OB, water) and aim away from it first",
          ],
        },
        progress: {
          baselineAvg: 94.2,
          currentAvg: 92.8,
          baselineDoubles: 3.2,
          currentDoubles: 2.7,
          deltaDoubles: -0.5,
          status: "improving",
        },
      });
      setLoading(false);
    }, 1400);
  }

  // AI patterns (if available) take precedence over seed patterns.
  const aiPatterns: Pattern[] = (coach?.patterns ?? []).map((p, i) => ({
    id: "ai" + i,
    date: "Fresh from Coach",
    tag: p.tag,
    slot: p.slot,
    text: p.text,
  }));
  const shown = aiPatterns.length ? aiPatterns : seedPatterns;

  return (
    <div style={{ padding: "0 16px 28px" }}>
      <div style={{ padding: "6px 0 18px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>PATTERN FEED</div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>What Coach noticed</h1>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>
          {(() => {
            // Prefer the count Coach actually analyzed; fall back to live round count.
            const n = coach?.roundsAnalyzed ?? (live.loading ? null : live.totalRounds);
            return n ? `Plain-English insights after your last ${n} rounds.` : "Plain-English insights from your rounds.";
          })()}
        </p>
      </div>

      {trendAlerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", margin: "0 2px 9px", textTransform: "uppercase" }}>Trends</div>
          <TrendAlertsList alerts={trendAlerts} />
        </div>
      )}

      <button onClick={toggleExclude} className="sc-press" style={{ width: "100%", marginBottom: 12, borderRadius: 12, padding: "11px 13px", cursor: "pointer", border: "1px solid var(--line)", background: "var(--panel)", display: "flex", alignItems: "center", gap: 11, textAlign: "left" }}>
        <span style={{ width: 38, height: 22, borderRadius: 999, background: excludePartial ? "var(--gold)" : "rgba(255,255,255,0.12)", position: "relative", flexShrink: 0, transition: "background 0.15s ease" }}>
          <span style={{ position: "absolute", top: 2, left: excludePartial ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left 0.15s ease" }} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>Complete rounds only</span>
          <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 1 }}>Skip partial / abandoned rounds (&lt;9 holes) when grading</span>
        </span>
      </button>

      <button onClick={() => { void reAnalyze(); }} disabled={loading} className="sc-press" style={{ width: "100%", marginBottom: 16, borderRadius: 14, padding: "13px", cursor: loading ? "default" : "pointer", border: "none", background: loading ? "var(--panel)" : "var(--gold)", color: loading ? "var(--cream-2)" : "#0F2016", fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <IconSpark size={16} stroke={loading ? "var(--gold)" : "#0F2016"} />
        {loading ? "Coach is reviewing your rounds…" : coach ? "Re-run Coach analysis" : "Ask Coach to analyze my rounds"}
      </button>

      {!coach && !loading && (
        <button onClick={runDemo} className="sc-press" style={{ width: "100%", marginTop: -6, marginBottom: 16, borderRadius: 12, padding: "11px", cursor: "pointer", border: "1px solid var(--line)", background: "transparent", color: "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500 }}>
          Try a demo analysis (updates bag grades, no key)
        </button>
      )}

      {updated > 0 && (
        <div style={{ marginBottom: 16, borderRadius: 14, border: "1px solid " + hexA("#4CAF82", 0.4), background: hexA("#4CAF82", 0.1), padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--good)", fontSize: 16 }}>✓</span>
          <span style={{ flex: 1, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>{updated} bag {updated === 1 ? "grade" : "grades"} updated live{coach?.roundsAnalyzed != null ? ` from ${coach.roundsAnalyzed} rounds` : ""}{coach?.excludedCount ? ` (${coach.excludedCount} partial skipped)` : ""} — check The Bag.</span>
          {hasOverrides && (
            <button onClick={() => { reset(); setUpdated(0); setCoach(null); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}>Reset</button>
          )}
        </div>
      )}

      {err && (
        <div style={{ marginBottom: 14, borderRadius: 14, border: "1px solid " + hexA("#C05C5C", 0.4), background: hexA("#C05C5C", 0.08), padding: "12px 14px", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.45 }}>
          {err}
        </div>
      )}

      {coach?.weeklyInsight && (
        <div style={{ marginBottom: 16, borderRadius: 16, border: "1px solid " + hexA("#F0C040", 0.4), background: "linear-gradient(160deg, " + hexA("#F0C040", 0.12) + ", transparent 65%), var(--panel)", padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <IconSpark size={15} stroke="var(--gold)" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--gold)" }}>THIS WEEK&apos;S READ</span>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream-2)", lineHeight: 1.5 }}>{coach.weeklyInsight}</p>
        </div>
      )}

      {coach?.plan && (
        <div style={{ marginBottom: 16, borderRadius: 16, border: "1px solid " + hexA("#F0C040", 0.55), background: "linear-gradient(150deg, " + hexA("#F0C040", 0.1) + " 0%, transparent 70%), var(--panel)", padding: "15px 16px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--gold)" }}>YOUR PLAN</span>
            <button
              onClick={() => { void reAnalyze({ newPlan: true }); }}
              disabled={loading}
              style={{ background: "transparent", border: "none", cursor: loading ? "default" : "pointer", color: "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 11, textDecoration: "underline", padding: 0, lineHeight: 1 }}
            >
              Set a new plan
            </button>
          </div>

          {/* Focus line */}
          <p style={{ margin: "0 0 12px", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--cream)", lineHeight: 1.4 }}>{coach.plan.focus}</p>

          {/* Action checklist */}
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
            {coach.plan.actions.map((a, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "var(--gold)", fontFamily: "var(--font-ui)", fontSize: 12, marginTop: 2, flexShrink: 0 }}>▸</span>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", lineHeight: 1.45 }}>{a}</span>
              </li>
            ))}
          </ul>

          {/* Progress line */}
          {coach.progress && (
            <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid " + hexA("#F0C040", 0.2), display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>
                Doubles/round:{" "}
                <span style={{ color: "var(--cream)", fontWeight: 600 }}>{coach.progress.baselineDoubles}</span>
                {" → "}
                <span style={{ color: "var(--cream)", fontWeight: 600 }}>{coach.progress.currentDoubles}</span>
              </span>
              <span style={{
                display: "inline-block",
                padding: "3px 9px",
                borderRadius: 999,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                background: coach.progress.status === "improving"
                  ? hexA("#4CAF82", 0.2)
                  : coach.progress.status === "slipping"
                  ? hexA("#C05C5C", 0.2)
                  : hexA("#F0C040", 0.15),
                color: coach.progress.status === "improving"
                  ? "var(--good)"
                  : coach.progress.status === "slipping"
                  ? "var(--bad)"
                  : "var(--cream-3)",
              }}>
                {coach.progress.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map((p) => {
          const slot = slots.find((s) => s.id === p.slot) ?? slots[0];
          return <PatternCard key={p.id} pattern={p} onOpen={() => onOpenSlot(slot)} />;
        })}
      </div>
    </div>
  );
};

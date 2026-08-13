import React from "react";
import { slots, gradeColor, hexA, Slot, Drill } from "@/lib/caddie-data";
import { Back } from "./primitives";
import { IconClock, IconPlay, IconSpark } from "./icons";
import { useGrades } from "./GradesContext";

export const DrillView = ({
  drill,
  onBack,
  onOpenSlot,
  done,
  onToggleDone,
}: {
  drill: Drill;
  onBack: () => void;
  onOpenSlot: (s: Slot) => void;
  done: boolean;
  onToggleDone: () => void;
}) => {
  const { gradeFor } = useGrades();
  const slot = slots.find((s) => s.id === drill.slot);
  const grade = slot ? gradeFor(slot.id, slot.grade) : "C";
  const c = gradeColor(grade);
  return (
    <div style={{ paddingBottom: 30 }}>
      <Back onBack={onBack} label="Back" />
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--gold)" }}>DRILL · {drill.diff.toUpperCase()}</div>
        <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--cream)", lineHeight: 1.02, letterSpacing: "-0.015em" }}>{drill.name}</h1>
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--cream-2)", lineHeight: 1.45 }}>{drill.fixes}</p>

        <div style={{ display: "flex", gap: 8, marginTop: 15 }}>
          {slot && (
            <button onClick={() => onOpenSlot(slot)} className="sc-press" style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 12px 6px 7px", cursor: "pointer" }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", background: hexA(c, 0.18), fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: c }}>{grade}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream)", fontWeight: 500 }}>{slot.name}</span>
            </button>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>
            <IconClock size={15} stroke="var(--cream-3)" />{drill.dur}
          </span>
        </div>

        <div style={{ marginTop: 16, position: "relative", borderRadius: 16, overflow: "hidden", height: 164, border: "1px solid var(--line)", background: "linear-gradient(160deg, #1B4D3E, #0F2016)" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 20px)" }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ width: 54, height: 54, borderRadius: 999, background: "var(--gold)", display: "grid", placeItems: "center", margin: "0 auto", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.6)" }}>
                <IconPlay size={22} stroke="#0F2016" />
              </span>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--cream-3)", marginTop: 11 }}>WATCH · 0:48</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)" }}>HOW TO DO IT</div>
        <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
          {drill.steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: hexA("#F0C040", 0.13), color: "var(--gold)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--cream-2)", lineHeight: 1.45 }}>{s}</span>
            </li>
          ))}
        </ol>

        <div style={{ marginTop: 20, borderRadius: 16, border: "1px solid var(--line)", background: "var(--panel)", padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            <IconSpark size={15} stroke="var(--gold)" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--gold)", whiteSpace: "nowrap" }}>WHY COACH PICKED THIS</span>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream-2)", lineHeight: 1.5 }}>{drill.why}</p>
        </div>

        <button onClick={onToggleDone} className="sc-press" style={{ marginTop: 16, width: "100%", borderRadius: 14, padding: "15px", cursor: "pointer", border: done ? "1px solid " + hexA("#4CAF82", 0.5) : "none", background: done ? "var(--panel)" : "var(--gold)", color: done ? "var(--good)" : "#0F2016", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {done ? "✓ Logged for this week" : "Mark drill complete"}
        </button>
      </div>
    </div>
  );
};

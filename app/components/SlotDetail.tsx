import React from "react";
import { drills, gradeColor, hexA, Slot, Drill } from "@/lib/caddie-data";
import { Trend, Sparkline, SLabel, Back } from "./primitives";
import { IconTarget, IconChevron } from "./icons";
import { useGrades } from "./GradesContext";

const DrillRow = ({ drill, onOpen }: { drill: Drill; onOpen: (d: Drill) => void }) => (
  <button onClick={() => onOpen(drill)} className="sc-tile" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 15, padding: "13px 14px" }}>
    <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: hexA("#F0C040", 0.14) }}>
      <IconTarget size={20} stroke="var(--gold)" />
    </span>
    <span style={{ flex: 1 }}>
      <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 600, color: "var(--cream)" }}>{drill.name}</span>
      <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 2 }}>{drill.dur} · {drill.diff}</span>
    </span>
    <IconChevron size={18} stroke="var(--cream-3)" />
  </button>
);

export const SlotDetail = ({ slot, onBack, onOpenDrill }: { slot: Slot; onBack: () => void; onOpenDrill: (d: Drill) => void }) => {
  const { gradeFor } = useGrades();
  const grade = gradeFor(slot.id, slot.grade);
  const c = gradeColor(grade);
  const drill = drills[slot.drill];
  return (
    <div style={{ paddingBottom: 28 }}>
      <Back onBack={onBack} label="The Bag" />
      <div style={{ padding: "0 16px" }}>
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", padding: "18px 18px 20px", border: "1px solid " + hexA(c, 0.4), background: "linear-gradient(160deg, " + hexA(c, 0.16) + ", " + hexA(c, 0.03) + " 65%), var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ maxWidth: 210 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)" }}>{slot.section} SLOT</div>
              <h1 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 600, color: "var(--cream)", lineHeight: 1.04, letterSpacing: "-0.01em" }}>{slot.name}</h1>
              {slot.club && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--gold)", marginTop: 5, letterSpacing: "0.06em" }}>{slot.club}</div>}
              <p style={{ margin: "9px 0 0", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream-2)", lineHeight: 1.4 }}>{slot.diag}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 58, lineHeight: 0.78, color: c, fontWeight: 600 }}>{grade}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cream-3)" }}>
                <Trend dir={slot.trend} size={8} />{slot.trend === "up" ? "RISING" : slot.trend === "down" ? "SLIPPING" : "STEADY"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px", marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
          {(slot.stats ?? []).map(([label, val, unit], i) => (
            <div key={i} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 11px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: "var(--cream)" }}>{val}</span>
                {unit && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)" }}>{unit}</span>}
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-3)", marginTop: 6, lineHeight: 1.2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px", marginTop: 11 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>Trend · last 5 rounds</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--cream-3)", whiteSpace: "nowrap" }}>grade pts</span>
          </div>
          <Sparkline data={slot.spark} color={c} w={330} h={56} sw={2.4} />
        </div>
      </div>

      <div style={{ padding: "0 16px", marginTop: 11 }}>
        <SLabel>Assigned drill</SLabel>
        {drill && <DrillRow drill={drill} onOpen={onOpenDrill} />}
      </div>
    </div>
  );
};

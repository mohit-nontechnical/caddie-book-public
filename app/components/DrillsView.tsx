import React from "react";
import { drills, slots, gradeColor, hexA, Slot, Drill } from "@/lib/caddie-data";
import { IconClock, IconSpark, IconTarget } from "./icons";
import { useGrades } from "./GradesContext";

export const DrillsView = ({ onOpenDrill }: { onOpenDrill: (d: Drill) => void; onOpenSlot?: (s: Slot) => void }) => {
  const { gradeFor } = useGrades();
  const list = Object.values(drills);
  const focusDrill = drills["window"] ?? list[0];
  return (
    <div style={{ padding: "0 16px 28px" }}>
      <div style={{ padding: "6px 0 18px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>DRILL LIBRARY</div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>One rep at a time</h1>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>Each drill feeds one bag slot. Coach pins the right one to your weakest week.</p>
      </div>

      {focusDrill && <div onClick={() => onOpenDrill(focusDrill)} className="sc-press" style={{ cursor: "pointer", position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid " + hexA("#F0C040", 0.45), background: "linear-gradient(160deg, " + hexA("#F0C040", 0.16) + ", transparent 65%), var(--panel)", padding: "18px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
          <IconSpark size={15} stroke="var(--gold)" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.16em", color: "var(--gold)", whiteSpace: "nowrap" }}>DRILL OF THE WEEK</span>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 25, fontWeight: 600, color: "var(--cream)", lineHeight: 1.05 }}>{focusDrill.name}</div>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", lineHeight: 1.4, maxWidth: 250 }}>{focusDrill.fixes}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><IconClock size={14} stroke="var(--cream-3)" />{focusDrill.dur}</span>
          <span>·</span>
          <span>Feeds Approach 100–150</span>
        </div>
      </div>}

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", margin: "0 2px 11px" }}>ALL DRILLS · {list.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {list.map((d) => {
          const slot = slots.find((s) => s.id === d.slot);
          const grade = slot ? gradeFor(slot.id, slot.grade) : "C";
          const c = gradeColor(grade);
          return (
            <button key={d.id} onClick={() => onOpenDrill(d)} className="sc-tile" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 15, padding: "13px 14px" }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: hexA("#F0C040", 0.13) }}>
                <IconTarget size={20} stroke="var(--gold)" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 600, color: "var(--cream)" }}>{d.name}</span>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 2 }}>{d.dur} · {d.diff}</span>
              </span>
              <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: hexA(c, 0.16), fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: c }}>{grade}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

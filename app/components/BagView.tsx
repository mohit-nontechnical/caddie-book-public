import React from "react";
import { slots, drills, gradeColor, hexA, Slot, Drill } from "@/lib/caddie-data";
import { Trend } from "./primitives";
import { IconTarget, IconChevron } from "./icons";
import { useGrades } from "./GradesContext";
import { PreRoundCard } from "./PreRoundCard";
import { useLiveGolfer } from "./useLiveGolfer";

// ── Grade tile ───────────────────────────────────────────────
const Tile = ({ slot, intensity, onOpen }: { slot: Slot; intensity: string; onOpen: (s: Slot) => void }) => {
  const { gradeFor } = useGrades();
  const grade = gradeFor(slot.id, slot.grade);
  const c = gradeColor(grade);
  const tint = intensity === "bold" ? 0.22 : 0.12;
  return (
    <button onClick={() => onOpen(slot)} className="sc-tile" style={{ position: "relative", textAlign: "left", border: "1px solid var(--line)", borderRadius: 16, padding: "12px 13px 13px", cursor: "pointer", background: `linear-gradient(150deg, ${hexA(c, tint)}, ${hexA(c, tint * 0.25)}), var(--panel)`, display: "flex", flexDirection: "column", gap: 12, minHeight: 92 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 0.9, fontWeight: 600, color: c, letterSpacing: "-0.01em" }}>{grade}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}><Trend dir={slot.trend} /></span>
      </div>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{slot.name}</div>
      {slot.focus && <span style={{ position: "absolute", top: 10, right: 11, width: 6, height: 6, borderRadius: 9, background: "var(--gold)", boxShadow: "0 0 0 3px " + hexA("#F0C040", 0.2) }} />}
    </button>
  );
};

// ── List row ─────────────────────────────────────────────────
const ListRow = ({ slot, onOpen }: { slot: Slot; onOpen: (s: Slot) => void }) => {
  const { gradeFor } = useGrades();
  const grade = gradeFor(slot.id, slot.grade);
  const c = gradeColor(grade);
  return (
    <button onClick={() => onOpen(slot)} className="sc-tile" style={{ display: "flex", alignItems: "center", gap: 13, textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 13px", background: "linear-gradient(90deg, " + hexA(c, 0.1) + ", transparent 40%), var(--panel)" }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: hexA(c, 0.16), border: "1px solid " + hexA(c, 0.3) }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: c }}>{grade}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>{slot.name}</span>
        <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{slot.diag}</span>
      </span>
      <Trend dir={slot.trend} />
    </button>
  );
};

// ── Focus card ───────────────────────────────────────────────
const FocusCard = ({ slot, drill, onOpenSlot, onOpenDrill }: { slot: Slot; drill: Drill; onOpenSlot: (s: Slot) => void; onOpenDrill: (d: Drill) => void }) => {
  const { gradeFor } = useGrades();
  const grade = gradeFor(slot.id, slot.grade);
  const c = gradeColor(grade);
  return (
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", border: "1px solid " + hexA("#F0C040", 0.45), background: "linear-gradient(160deg, " + hexA("#F0C040", 0.12) + ", " + hexA("#F0C040", 0.03) + " 60%), var(--panel)", boxShadow: "0 12px 32px -16px rgba(0,0,0,0.7)" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 100% 0%, " + hexA("#F0C040", 0.09) + ", transparent 55%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", padding: "15px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13 }}>
          <span style={{ width: 5, height: 5, borderRadius: 6, background: "var(--gold)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", color: "var(--gold)", fontWeight: 500, whiteSpace: "nowrap" }}>FOCUS THIS WEEK</span>
        </div>
        <div onClick={() => onOpenSlot(slot)} style={{ cursor: "pointer", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.04, color: "var(--cream)", fontWeight: 600, letterSpacing: "-0.01em" }}>{slot.name}</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", marginTop: 6, lineHeight: 1.35 }}>{slot.diag}</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 46, lineHeight: 0.8, color: c, fontWeight: 600 }}>{grade}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--cream-3)", marginTop: 6 }}>GRADE</div>
          </div>
        </div>
        <button onClick={() => onOpenDrill(drill)} style={{ marginTop: 15, width: "100%", display: "flex", alignItems: "center", gap: 11, background: "var(--gold)", border: "none", borderRadius: 13, padding: "11px 13px", cursor: "pointer" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(15,32,22,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <IconTarget size={17} stroke="#0F2016" sw={1.9} />
          </span>
          <span style={{ textAlign: "left", flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(15,32,22,0.6)", fontWeight: 600 }}>ASSIGNED DRILL</span>
            <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 700, color: "#0F2016", marginTop: 1 }}>{drill.name}</span>
          </span>
          <IconChevron size={18} stroke="#0F2016" sw={2.2} />
        </button>
      </div>
    </div>
  );
};

const SECTIONS = [
  { key: "POWER", label: "Power", sub: "Tee to green" },
  { key: "SCORING", label: "Scoring", sub: "Inside 150" },
  { key: "MENTAL", label: "Mental", sub: "Between the ears" },
];

export const BagView = ({
  layout,
  heatmap,
  onOpenSlot,
  onOpenDrill,
  onUpload,
}: {
  layout: string;
  heatmap: string;
  onOpenSlot: (s: Slot) => void;
  onOpenDrill: (d: Drill) => void;
  onUpload: () => void;
}) => {
  const focus = slots.find((s) => s.focus);
  const cols = layout === "list" ? 1 : 2;
  const live = useLiveGolfer();
  return (
    <div style={{ padding: "0 16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0 16px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>CADDIE BOOK</div>
          <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>The Bag · Mo</h1>
        </div>
        <button onClick={onUpload} className="sc-press" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999, padding: "7px 8px 7px 13px", cursor: "pointer" }}>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: hexA("#F0C040", 0.16), display: "grid", placeItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gold)", fontSize: 13 }}>MO</span>
          </span>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 14px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "var(--cream-3)" }}>HANDICAP INDEX</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--cream)" }}>{live.index ?? (live.loading ? "…" : "—")}</span>
            {live.delta && live.deltaDir && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--font-mono)", fontSize: 11, color: live.deltaDir === "up" ? "var(--good)" : live.deltaDir === "down" ? "var(--bad)" : "var(--cream-3)" }}>
                <Trend dir={live.deltaDir} size={8} />{live.delta}
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "11px 14px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "var(--cream-3)" }}>LAST 5 ROUNDS</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--cream-2)", letterSpacing: "0.05em" }}>
              {live.lastFive.length > 0 ? live.lastFive.join("  ") : live.loading ? "…" : "No rounds yet"}
            </span>
          </div>
        </div>
      </div>

      <PreRoundCard />

      {focus && drills[focus.drill] && (
        <FocusCard slot={focus} drill={drills[focus.drill]} onOpenSlot={onOpenSlot} onOpenDrill={onOpenDrill} />
      )}

      {SECTIONS.map((sec) => (
        <div key={sec.key} style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11, padding: "0 2px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "var(--cream)", textTransform: "uppercase" }}>{sec.label}</h2>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)" }}>{sec.sub}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>
            {slots.filter((s) => s.section === sec.key).map((s) =>
              layout === "list" ? <ListRow key={s.id} slot={s} onOpen={onOpenSlot} /> : <Tile key={s.id} slot={s} intensity={heatmap} onOpen={onOpenSlot} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

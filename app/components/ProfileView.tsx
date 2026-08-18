import React, { useState } from "react";
import { golfer, slots, gradeColor, hexA } from "@/lib/caddie-data";
import { SLabel } from "./primitives";
import { IconChevron } from "./icons";
import { useGrades } from "./GradesContext";
import { HandicapPanel } from "./HandicapPanel";
import { useLiveGolfer } from "./useLiveGolfer";
import { useShareCard } from "./useShareCard";

const SETTINGS: { label: string; detail: string }[] = [
  {
    label: "Connected apps",
    detail: "Import your rounds from 18Birdies on the Upload tab. More integrations coming.",
  },
  {
    label: "Goal: Break 85",
    detail: "Your current target. Coach builds your plan around it.",
  },
  {
    label: "Coaching tone",
    detail: "Coach speaks plain and direct. Tunable tones are coming.",
  },
  {
    label: "Notifications",
    detail: "Round reminders and weekly insights are coming soon.",
  },
];

export const ProfileView = () => {
  const { gradeFor } = useGrades();
  const live = useLiveGolfer();
  const card = useShareCard();
  const [openSetting, setOpenSetting] = useState<number | null>(null);
  const gpaMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const gpa = (slots.reduce((a, s) => a + gpaMap[gradeFor(s.id, s.grade)], 0) / slots.length).toFixed(2);
  return (
    <div style={{ padding: "0 16px 28px" }}>
      <div style={{ padding: "10px 0 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 58, height: 58, borderRadius: 18, background: "linear-gradient(135deg, #1B4D3E, #0F2016)", border: "1px solid " + hexA("#F0C040", 0.3), display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>MO</span>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--cream)" }}>{golfer.name}</h1>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", marginTop: 2 }}>
            {live.loading
              ? "…"
              : [live.homeCourse, live.totalRounds > 0 ? `${live.totalRounds} round${live.totalRounds === 1 ? "" : "s"} tracked` : "No rounds yet"]
                  .filter(Boolean)
                  .join(" · ")}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginTop: 4, letterSpacing: "0.06em" }}>GOAL: {golfer.goal}</div>
        </div>
      </div>

      <button
        onClick={card.share}
        disabled={card.busy}
        className="sc-press"
        style={{ width: "100%", marginBottom: 18, cursor: card.busy ? "default" : "pointer", background: "var(--gold)", color: "#0F2016", border: "none", borderRadius: 14, padding: "13px 16px", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, opacity: card.busy ? 0.6 : 1 }}
      >
        {card.busy ? "Building your card…" : "Share my player card"}
      </button>
      {card.error && (
        <div style={{ marginTop: -10, marginBottom: 18, fontFamily: "var(--font-ui)", fontSize: 12, color: "#C05C5C" }}>{card.error}</div>
      )}

      <HandicapPanel />

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "15px 16px", marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "var(--cream-3)" }}>BAG GPA</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, color: "var(--cream)", marginTop: 5 }}>{gpa}</div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 3 }}>across {slots.length} slots</div>
      </div>

      <SLabel>Your bag</SLabel>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", marginBottom: 18 }}>
        {[["TaylorMade Qi10 LS", "Driver", "D"], ["Titleist TSR", "3-Wood", "C"], ["4-Hybrid (Old Faithful)", "Hybrid", "B"], ["Mizuno Irons (5–PW)", "Irons", "C"], ["Cleveland + Gap", "Wedges", "C"], ["Odyssey White Hot OG", "Putter", "B"]].map(([name, type, grade], i, arr) => {
          const c = gradeColor(grade);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none", gap: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: hexA(c, 0.15), fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: c, flexShrink: 0 }}>{grade}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)" }}>{name}</span>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 1 }}>{type}</span>
              </span>
            </div>
          );
        })}
      </div>

      <SLabel>Settings</SLabel>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
        {SETTINGS.map((setting, i, arr) => {
          const isOpen = openSetting === i;
          return (
            <div key={i} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
              <button
                onClick={() => setOpenSetting(isOpen ? null : i)}
                className="sc-press"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ flex: 1, fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--cream)" }}>{setting.label}</span>
                <span style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
                  <IconChevron size={16} stroke="var(--cream-3)" />
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 16px 14px", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.5 }}>
                  {setting.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

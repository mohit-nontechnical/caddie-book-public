import React, { useEffect, useRef, useState } from "react";
import { COACH_STYLES, type CoachStyleId } from "@/lib/coach-styles";

// ── Coach voice style picker ──────────────────────────────────
// Shared presentational dropdown for switching the AI voice (Classic /
// Jimmy Tropicana / …). Reused by both mobile (CoachChat.tsx, dark Augusta
// theme) and desktop (DesktopCoach.tsx, parchment theme) via the `theme`
// prop — same behavior/data (lib/coach-styles.ts), different color tokens
// to match each surface, same pattern as CourseVerifyCard.tsx.

export type CoachStylePickerTheme = "dark" | "parchment";

interface Tokens {
  fontUi: string;
  text: string;
  text3: string;
  line: string;
  panel: string;
  panelAlt: string;
}

const DARK: Tokens = {
  fontUi: "var(--font-ui)",
  text: "var(--cream)",
  text3: "var(--cream-3)",
  line: "var(--line)",
  panel: "var(--panel)",
  panelAlt: "rgba(255,255,255,0.06)",
};

const PARCHMENT: Tokens = {
  fontUi: "'DM Sans',sans-serif",
  text: "#1B2A1D",
  text3: "rgba(34,49,36,0.55)",
  line: "var(--line)",
  panel: "var(--paper)",
  panelAlt: "rgba(11,61,46,0.05)",
};

export interface CoachStylePickerProps {
  theme: CoachStylePickerTheme;
  value: CoachStyleId;
  onChange: (id: CoachStyleId) => void;
}

export const CoachStylePicker: React.FC<CoachStylePickerProps> = ({ theme, value, onChange }) => {
  const t = theme === "dark" ? DARK : PARCHMENT;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = COACH_STYLES[value];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={current.tagline}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          background: t.panelAlt,
          border: "1px solid " + t.line,
          borderRadius: 999,
          padding: "6px 10px 6px 9px",
          fontFamily: t.fontUi,
          fontSize: 12,
          fontWeight: 600,
          color: t.text,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{current.emoji}</span>
        <span style={{ whiteSpace: "nowrap" }}>{current.label}</span>
        <span style={{ fontSize: 9, color: t.text3, marginLeft: 1 }}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 40,
            minWidth: 220,
            background: t.panel,
            border: "1px solid " + t.line,
            borderRadius: 12,
            boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {Object.values(COACH_STYLES).map((s) => {
            const on = s.id === value;
            return (
              <button
                key={s.id}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "none",
                  background: on ? t.panelAlt : "transparent",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1.3, flexShrink: 0 }}>{s.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: t.fontUi, fontSize: 12.5, fontWeight: 700, color: t.text }}>
                    {s.label}
                    {on ? " ✓" : ""}
                  </span>
                  <span style={{ display: "block", fontFamily: t.fontUi, fontSize: 11, color: t.text3, marginTop: 1, lineHeight: 1.3 }}>
                    {s.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

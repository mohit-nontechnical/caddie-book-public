// Caddie Book desktop — shared UI primitives.
// Ported from docs/design/caddie-ui.jsx into typed React components.
import React from "react";

export type Grade = "A" | "B" | "C" | "D" | "F";

export function hexA(hex: string, a: number): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function gradeColor(g: string): string {
  return (
    ({ A: "#3E8F63", B: "#6E9A46", C: "#C0912F", D: "#C0742F", F: "#B0433D" } as Record<string, string>)[g] ||
    "#C0912F"
  );
}

// vsPar (score relative to par for a hole) -> theme color
export function scoreColor(vsPar: number): string {
  if (vsPar <= -1) return "#3E8F63";
  if (vsPar === 0) return "#6E9A46";
  if (vsPar === 1) return "#8A7A52";
  if (vsPar === 2) return "#C0742F";
  return "#B0433D";
}

interface CardProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
  onClick?: () => void;
  className?: string;
  hover?: boolean;
}

export const CBCard: React.FC<CardProps> = ({ children, style, pad = 20, onClick, className, hover }) => (
  <div
    onClick={onClick}
    className={(className || "") + (hover ? " cb-hovercard" : "")}
    style={{
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      boxShadow: "0 1px 2px rgba(11,61,46,0.04)",
      padding: pad,
      ...style,
    }}
  >
    {children}
  </div>
);

interface PageHeadProps {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}

export const CBPageHead: React.FC<PageHeadProps> = ({ eyebrow, title, sub, right }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22, flexWrap: "wrap" }}>
    <div>
      {eyebrow && (
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--gold-ink)" }}>{eyebrow}</div>
      )}
      <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600, color: "#1B2A1D", letterSpacing: "-0.015em", lineHeight: 1.02 }}>
        {title}
      </h1>
      {sub && (
        <p style={{ margin: "8px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(34,49,36,0.6)", maxWidth: 560, lineHeight: 1.45 }}>
          {sub}
        </p>
      )}
    </div>
    {right}
  </div>
);

export const CBSectionLabel: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.16em", color: "rgba(34,49,36,0.5)", textTransform: "uppercase", ...style }}>
    {children}
  </div>
);

interface CardTitleProps {
  children?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}

export const CBCardTitle: React.FC<CardTitleProps> = ({ children, sub, right }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "#1B2A1D", letterSpacing: "-0.01em" }}>{children}</div>
      {sub && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(34,49,36,0.55)", marginTop: 3 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

export const CBGradePill: React.FC<{ grade: Grade | string; size?: number }> = ({ grade, size = 22 }) => {
  const c = gradeColor(grade);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        display: "grid",
        placeItems: "center",
        background: hexA(c, 0.16),
        border: "1px solid " + hexA(c, 0.32),
        fontFamily: "var(--font-display)",
        fontSize: size * 0.6,
        fontWeight: 600,
        color: c,
      }}
    >
      {grade}
    </span>
  );
};

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
}

export const CBSegmented: React.FC<SegmentedProps> = ({ options, value, onChange, size = "sm" }) => {
  const sm = size === "sm";
  return (
    <div style={{ display: "inline-flex", padding: 2, borderRadius: 9, background: "rgba(11,61,46,0.07)", border: "1px solid var(--line)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 7,
              padding: sm ? "4px 11px" : "6px 14px",
              background: on ? "var(--paper)" : "transparent",
              color: on ? "#1B2A1D" : "rgba(34,49,36,0.55)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: sm ? 12 : 13,
              fontWeight: on ? 600 : 500,
              boxShadow: on ? "0 1px 2px rgba(11,61,46,0.12)" : "none",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

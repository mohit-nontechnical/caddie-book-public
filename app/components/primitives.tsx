import React from "react";

// ── Trend arrow ──────────────────────────────────────────────
export const Trend = ({ dir, size = 9 }: { dir: string; size?: number }) => {
  if (dir === "flat")
    return (
      <span style={{ display: "inline-flex", alignItems: "center", color: "var(--cream-3)", fontSize: size + 3, lineHeight: 1 }}>→</span>
    );
  const up = dir === "up";
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ display: "block" }}>
      <path d={up ? "M5 1 9 8 1 8z" : "M5 9 1 2 9 2z"} fill={up ? "var(--good)" : "var(--bad)"} />
    </svg>
  );
};

// ── Sparkline ────────────────────────────────────────────────
export const Sparkline = ({
  data,
  color,
  w = 80,
  h = 26,
  sw = 2,
  dot = true,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
  sw?: number;
  dot?: boolean;
}) => {
  if (data.length === 0) return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} />;
  const min = Math.min(...data) - 4,
    max = Math.max(...data) + 4;
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? (w - 4) / 2 + 2 : (i / (data.length - 1)) * (w - 4) + 2;
    const y = h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
    return [x, y] as [number, number];
  });
  const dPath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <path d={dPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {dot && <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />}
    </svg>
  );
};

// ── Section label ────────────────────────────────────────────
export const SLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--cream-3)", margin: "0 2px 9px", textTransform: "uppercase" }}>
    {children}
  </div>
);

// ── Back button ──────────────────────────────────────────────
import { IconArrowL } from "./icons";
export const Back = ({ onBack, label }: { onBack: () => void; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 16px 14px" }}>
    <button onClick={onBack} className="sc-press" style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", color: "var(--cream-2)", padding: "4px 8px 4px 0", marginLeft: -2 }}>
      <IconArrowL size={20} stroke="var(--cream-2)" sw={2} />
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500 }}>{label}</span>
    </button>
  </div>
);

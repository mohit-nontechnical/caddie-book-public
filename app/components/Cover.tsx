"use client";

import React from "react";
import { DeviceFrame } from "./DeviceFrame";
import { useLiveGolfer } from "./useLiveGolfer";

export function Cover({ onEnter }: { onEnter: () => void }) {
  const live = useLiveGolfer();
  const statLine = live.loading
    ? " " // keep the line height while loading, no stale numbers
    : [
        live.index ? `HANDICAP ${live.index}` : null,
        live.totalRounds > 0 ? `${live.totalRounds} ROUND${live.totalRounds === 1 ? "" : "S"}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "NO ROUNDS YET";
  return (
    <DeviceFrame dark>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(170deg, #1B4D3E 0%, #0A1A0E 60%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 88, height: 88, borderRadius: 24, background: "linear-gradient(145deg, #1B4D3E, #0F2016)", border: "1px solid rgba(240,192,64,0.35)", display: "grid", placeItems: "center", marginBottom: 28, boxShadow: "0 16px 40px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(240,192,64,0.15)" }}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <path d="M26 8C26 8 14 18 14 28C14 34.6 19.4 40 26 40C32.6 40 38 34.6 38 28C38 18 26 8 26 8Z" stroke="#F0C040" strokeWidth="1.5" fill="rgba(240,192,64,0.08)" />
            <path d="M26 16C26 16 20 22 20 28C20 31.3 22.7 34 26 34C29.3 34 32 31.3 32 28C32 22 26 16 26 16Z" fill="rgba(240,192,64,0.15)" stroke="#F0C040" strokeWidth="1" />
            <line x1="26" y1="34" x2="26" y2="44" stroke="#F0C040" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="44" x2="32" y2="44" stroke="#F0C040" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="26" cy="8" r="2" fill="#F0C040" />
          </svg>
        </div>

        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: "0.28em", color: "rgba(240,192,64,0.6)", marginBottom: 10, textTransform: "uppercase" }}>Est. 2025</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 600, color: "#FFFFFF", letterSpacing: "-0.02em", lineHeight: 0.95, textAlign: "center" }}>Caddie<br />Book</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontStyle: "italic", color: "rgba(240,192,64,0.85)", marginTop: 8, letterSpacing: "0.04em" }}>by Mo</div>

        <div style={{ width: 160, height: 1, background: "linear-gradient(90deg, transparent, rgba(240,192,64,0.4), transparent)", margin: "28px 0" }} />

        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em", marginBottom: 32, textAlign: "center", lineHeight: 1.5, padding: "0 32px" }}>Your AI caddie. Learns your game.<br />Finds what&apos;s costing you strokes.</div>

        <button onClick={onEnter} style={{ background: "#F0C040", border: "none", borderRadius: 16, padding: "14px 40px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 700, color: "#0F2016", letterSpacing: "-0.01em", boxShadow: "0 8px 24px -8px rgba(240,192,64,0.5)" }}>
          Open My Bag
        </button>

        <div style={{ marginTop: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", minHeight: 13, whiteSpace: "pre" }}>{statLine}</div>
      </div>
    </DeviceFrame>
  );
}

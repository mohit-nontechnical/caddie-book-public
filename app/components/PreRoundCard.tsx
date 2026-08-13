import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { getCoachStyle } from "./useCoachStyle";

interface RoutineItem {
  icon: string;
  title: string;
  body: string;
}
interface PreRoundData {
  grounded: boolean;
  mantra: string;
  routine: RoutineItem[];
  stats?: { tilt: boolean; isSlowStarter: boolean };
}

// "Before you tee off" mental card. Collapsed by default to a single mantra
// line; tap to expand the full grounded routine. Lives at the top of the home
// tab. Renders nothing on error (it's a bonus, never blocks the bag).
export function PreRoundCard() {
  const [data, setData] = useState<PreRoundData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/preround?style=${encodeURIComponent(getCoachStyle())}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j && !j.error) setData(j);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data) return null;

  return (
    <div style={{ marginBottom: 18, borderRadius: 18, overflow: "hidden", border: "1px solid " + hexA("#1B4D3E", 0.9), background: "linear-gradient(160deg, " + hexA("#1B4D3E", 0.45) + ", " + hexA("#0A1A0E", 0.2) + "), var(--panel)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="sc-press"
        style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", border: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
      >
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: hexA("#F0C040", 0.14), display: "grid", placeItems: "center", fontSize: 18 }}>⛳️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.18em", color: "var(--gold)", textTransform: "uppercase" }}>Before you tee off</span>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--cream)", marginTop: 2, lineHeight: 1.2 }}>{data.mantra}</span>
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }}>›</span>
      </button>

      {open && (
        <div style={{ padding: "2px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {data.routine.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 11, padding: "11px 13px", borderRadius: 13, background: "var(--panel)", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1.2 }}>{item.icon}</span>
              <span>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 700, color: "var(--cream)" }}>{item.title}</span>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", marginTop: 3, lineHeight: 1.45 }}>{item.body}</span>
              </span>
            </div>
          ))}
          {!data.grounded && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", padding: "0 2px" }}>Import a few rounds to make this routine personal to your game.</span>
          )}
        </div>
      )}
    </div>
  );
}

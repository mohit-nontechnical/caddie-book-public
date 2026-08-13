"use client";

// Caddie Book desktop — sidebar nav, crest, and pinned handicap index.
// Ported from docs/design/caddie-shell.jsx (CBSidebar). The handicap index
// is fetched live from /api/handicap instead of the design's static demo value.
import React, { useEffect, useState } from "react";
import { Crest, IconDash, IconRounds, IconInsights, IconCourses, IconBag, IconCoach, IconUser } from "./DesktopIcons";
import type { DesktopRoute } from "./DesktopShell";
import type { HandicapResponse } from "./types";

const NAV: { key: DesktopRoute; label: string; Icon: React.FC<{ size?: number; stroke?: string; sw?: number }> }[] = [
  { key: "dashboard", label: "Dashboard", Icon: IconDash },
  { key: "rounds", label: "Rounds", Icon: IconRounds },
  { key: "insights", label: "Insights", Icon: IconInsights },
  { key: "courses", label: "Courses", Icon: IconCourses },
  { key: "bag", label: "Bag & Drills", Icon: IconBag },
  { key: "coach", label: "Coach", Icon: IconCoach },
  { key: "profile", label: "Profile", Icon: IconUser },
];

interface DesktopSidebarProps {
  route: DesktopRoute;
  onRoute: (route: DesktopRoute) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ route, onRoute }) => {
  const [index, setIndex] = useState<string | null>(null);
  // No profile-name endpoint exists yet; keep a stable generic label rather
  // than guessing at a shape the API doesn't provide.
  const name = "Golfer";
  const initials = "GB";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/handicap")
      .then((r) => r.json())
      .then((d: HandicapResponse) => {
        if (cancelled) return;
        if (typeof d.index === "number") setIndex(d.index.toFixed(1));
      })
      .catch(() => {
        /* leave index null → renders a placeholder dash */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      style={{
        width: 236,
        flexShrink: 0,
        background: "linear-gradient(180deg, #0C4030, #08301F)",
        borderRight: "1px solid rgba(199,162,75,0.16)",
        display: "flex",
        flexDirection: "column",
        color: "#F2ECDC",
        position: "relative",
      }}
    >
      {/* crest + wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 20px 20px" }}>
        <Crest size={40} />
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1 }}>Caddie Book</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.22em", color: "rgba(199,162,75,0.85)", marginTop: 4 }}>
            EST. AFTER THE ROUND
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(242,236,220,0.10)", margin: "0 16px 10px" }} />

      {/* nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px", flex: 1 }}>
        {NAV.map((it) => {
          const on = route === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onRoute(it.key)}
              className="cb-nav"
              data-on={on ? 1 : 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                background: on ? "rgba(199,162,75,0.16)" : "transparent",
                color: on ? "#F6EFDD" : "rgba(242,236,220,0.68)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13.5,
                fontWeight: on ? 600 : 500,
                position: "relative",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {on && <span style={{ position: "absolute", left: -12, top: 8, bottom: 8, width: 3, borderRadius: 3, background: "var(--gold)" }} />}
              <it.Icon size={19} stroke={on ? "var(--gold)" : "rgba(242,236,220,0.6)"} sw={on ? 1.9 : 1.7} />
              {it.label}
            </button>
          );
        })}
      </nav>

      {/* handicap pinned bottom */}
      <div style={{ padding: "14px 16px 18px" }}>
        <div style={{ height: 1, background: "rgba(242,236,220,0.10)", marginBottom: 14 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              flexShrink: 0,
              background: "rgba(199,162,75,0.18)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--gold)",
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#F2ECDC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: "rgba(242,236,220,0.55)", marginTop: 2 }}>
              Index {index ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

"use client";

// Caddie Book desktop shell — composition root for the >=1024px experience.
// Ported from docs/design/caddie-book-desktop.html's App() + the parchment
// theme vars. No passcode screen, no demo/empty mode, no TweaksPanel (the
// accent is locked to gold). Wired to real API data throughout — see the
// per-page components for their own fetches.
import React, { useEffect, useState } from "react";
import { DesktopSidebar } from "./DesktopSidebar";
import { DesktopCoachChat, DesktopCoachRail, useDesktopCoach } from "./DesktopCoach";
import { DesktopDashboard } from "./DesktopDashboard";
import { DesktopRounds } from "./DesktopRounds";
import { DesktopInsights } from "./DesktopInsights";
import { DesktopCourses } from "./DesktopCourses";
import { DesktopBag } from "./DesktopBag";
import { DesktopProfile } from "./DesktopProfile";
import { CBPageHead } from "./DesktopUI";

export type DesktopRoute = "dashboard" | "rounds" | "insights" | "courses" | "bag" | "coach" | "profile";

const ROUTE_TITLE: Record<DesktopRoute, string> = {
  dashboard: "Dashboard",
  rounds: "Rounds",
  insights: "Insights",
  courses: "Courses",
  bag: "Bag & Drills",
  coach: "Coach",
  profile: "Profile",
};

// Real current date, formatted like the design's "SUN · JUL 5" mock.
function todayLabel(): string {
  const d = new Date();
  const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${dow} · ${mon} ${d.getDate()}`;
}

const THEME_VARS: React.CSSProperties = {
  ["--bg" as string]: "#E7DEC9",
  ["--paper" as string]: "#F8F3E9",
  ["--paper-dim" as string]: "#F1E9D8",
  ["--panel" as string]: "#EFE7D5",
  ["--ink" as string]: "#0B3D2E",
  ["--gold" as string]: "#C7A24B",
  ["--gold-ink" as string]: "#96742B",
  ["--line" as string]: "rgba(11,61,46,0.12)",
  ["--line-strong" as string]: "rgba(11,61,46,0.22)",
  ["--font-display" as string]: "'Playfair Display', Georgia, serif",
};

// Global CSS the design relies on (scrollbars, hover rules, view-transition
// keyframes, Leaflet theming). Scoped by class names that only appear inside
// the desktop shell, so this does not affect the mobile app below 1024px.
const DESKTOP_GLOBAL_CSS = `
  .cb-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
  .cb-scroll::-webkit-scrollbar-thumb { background: rgba(11,61,46,0.18); border-radius: 6px; border: 2px solid transparent; background-clip: content-box; }
  .cb-scroll::-webkit-scrollbar-thumb:hover { background: rgba(11,61,46,0.3); background-clip: content-box; }
  .cb-scroll::-webkit-scrollbar-track { background: transparent; }
  .cb-scroll { scrollbar-width: thin; scrollbar-color: rgba(11,61,46,0.18) transparent; }

  .cb-nav:hover[data-on="0"] { background: rgba(242,236,220,0.06) !important; color: #F2ECDC !important; }
  .cb-row:hover { background: rgba(199,162,75,0.06) !important; }
  .cb-hovercard { transition: transform 0.14s cubic-bezier(.2,.8,.3,1), box-shadow 0.14s, border-color 0.14s; }
  .cb-hovercard:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -16px rgba(11,61,46,0.4) !important; border-color: rgba(199,162,75,0.4) !important; }
  .cb-chip:hover { border-color: var(--gold) !important; background: rgba(199,162,75,0.08) !important; }
  .cb-key:hover { background: rgba(242,236,220,0.11) !important; }
  .cb-send:hover:not(:disabled) { filter: brightness(1.15); }
  .cb-icon-btn:hover { background: rgba(11,61,46,0.07) !important; }
  .cb-btn-ghost:hover, .cb-back:hover { filter: brightness(1.06); opacity: 0.9; }
  .cb-drop:hover { border-color: var(--gold) !important; background: rgba(199,162,75,0.08) !important; }

  @keyframes cbBlink { 0%,80%,100% { opacity: 0.25; } 40% { opacity: 1; } }
  @keyframes cbShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  @keyframes cbView { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes cbSkeleton { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
  .cb-view { animation: cbView 0.32s cubic-bezier(.2,.8,.3,1) both; }
  @media (prefers-reduced-motion: reduce) { .cb-view { animation: none; } }

  /* Leaflet theming (Courses page map) */
  .leaflet-container { background: #E4EAE2 !important; font-family: 'DM Sans', sans-serif !important; }
  .leaflet-tooltip { background: #0B3D2E !important; color: #F2ECDC !important; border: 1px solid rgba(199,162,75,0.4) !important; border-radius: 8px !important; box-shadow: 0 6px 18px -8px rgba(0,0,0,0.5) !important; font-size: 11.5px !important; padding: 6px 9px !important; }
  .leaflet-tooltip-top:before { border-top-color: #0B3D2E !important; }
  .leaflet-bar a { color: #0B3D2E !important; }
`;

// Additively injects the Playfair Display / DM Sans / DM Mono Google Fonts
// used by the desktop shell, without touching the mobile fonts (Cormorant
// Garamond / Inter / IBM Plex Mono) registered in app/layout.tsx. Guards
// against duplicate injection if DesktopShell remounts.
const DESKTOP_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap";
const DESKTOP_FONT_ID = "cb-desktop-fonts";

function useDesktopFonts() {
  useEffect(() => {
    if (document.getElementById(DESKTOP_FONT_ID)) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect";
    pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    const link = document.createElement("link");
    link.id = DESKTOP_FONT_ID;
    link.rel = "stylesheet";
    link.href = DESKTOP_FONT_HREF;
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }, []);
}

export function DesktopShell() {
  useDesktopFonts();
  const [route, setRoute] = useState<DesktopRoute>("dashboard");
  const [railOpen, setRailOpen] = useState(true);
  const { messages, busy, send, style, setStyle } = useDesktopCoach();

  const goRoute = (r: DesktopRoute) => setRoute(r);

  const chat = (
    <DesktopCoachChat
      messages={messages}
      busy={busy}
      onSend={send}
      variant={route === "coach" ? "page" : "rail"}
      style={style}
      onStyleChange={setStyle}
    />
  );

  let content: React.ReactNode;
  if (route === "dashboard") content = <DesktopDashboard onOpenRound={() => goRoute("rounds")} />;
  else if (route === "rounds") content = <DesktopRounds />;
  else if (route === "insights") content = <DesktopInsights />;
  else if (route === "courses") content = <DesktopCourses />;
  else if (route === "bag") content = <DesktopBag />;
  else if (route === "profile") content = <DesktopProfile />;
  else content = null; // coach: full-page chat rendered below, not in the scroll area

  const isCoachPage = route === "coach";

  return (
    // position:fixed + inset:0 so the shell always fills the real viewport
    // regardless of the mobile page's `.cb-stage` padding/centering rules
    // (those only apply visually below 1024px anyway, but this keeps the
    // desktop shell fully independent of that layout).
    <div
      style={{ ...THEME_VARS, position: "fixed", inset: 0, overflowX: "auto", overflowY: "hidden", background: "var(--bg)" }}
      className="cb-scroll"
    >
      <style dangerouslySetInnerHTML={{ __html: DESKTOP_GLOBAL_CSS }} />
      <div style={{ display: "flex", height: "100%", minWidth: 1280, background: "var(--bg)", overflow: "hidden" }}>
        <DesktopSidebar route={route} onRoute={goRoute} />

        {/* main */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {/* top bar */}
          <div
            style={{
              height: 54,
              flexShrink: 0,
              borderBottom: "1px solid var(--line)",
              background: "var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "rgba(34,49,36,0.55)",
              }}
            >
              <span style={{ color: "rgba(34,49,36,0.4)" }}>CADDIE BOOK</span>
              <span style={{ color: "rgba(34,49,36,0.3)" }}>/</span>
              <span style={{ color: "#1B2A1D", fontWeight: 500 }}>{ROUTE_TITLE[route]}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(34,49,36,0.45)" }}>{todayLabel()}</span>
            </div>
          </div>

          {/* content */}
          {isCoachPage ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "26px 32px 8px" }}>
                <CBPageHead
                  eyebrow="ALWAYS ONE CLICK AWAY"
                  title="Your Coach"
                  sub="Grounded in every round you've logged. Ask anything — it quotes your own numbers back."
                />
              </div>
              <div className="cb-scroll" style={{ flex: 1, minHeight: 0, padding: "0 32px 20px" }}>
                <div key="coach" className="cb-view" style={{ height: "100%", maxWidth: 780, margin: "0 auto" }}>
                  {chat}
                </div>
              </div>
            </div>
          ) : (
            <div className="cb-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "26px 32px 40px" }}>
              <div key={route} className="cb-view" style={{ maxWidth: 1160, margin: "0 auto", height: route === "courses" ? "100%" : "auto" }}>
                {content}
              </div>
            </div>
          )}
        </main>

        {/* coach rail (hidden on the full coach page) */}
        {!isCoachPage && (
          <DesktopCoachRail open={railOpen} onToggle={() => setRailOpen(!railOpen)} chat={chat} style={style} onStyleChange={setStyle} />
        )}
      </div>
    </div>
  );
}

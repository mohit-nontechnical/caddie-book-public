import React, { useState } from "react";
import { hexA } from "@/lib/caddie-data";
import type { CoachStyleId } from "@/lib/coach-styles";

// ── Caddie Strategy card ──────────────────────────────────────
// Shared presentational + data-fetching component for the per-course
// strategy card (POST /api/course-strategy). Reused by both mobile
// (CourseDetail.tsx, dark Augusta theme) and desktop (DesktopCourses.tsx's
// per-course detail panel, parchment theme) via the `theme` prop — same
// behavior, different color tokens, same pattern as CourseVerifyCard.tsx.

export type CourseStrategyTheme = "dark" | "parchment";

interface Tokens {
  fontUi: string;
  fontMono: string;
  fontDisplay: string;
  text: string;
  text2: string;
  text3: string;
  line: string;
  panel: string;
  panelAlt: string;
  gold: string;
  bad: string;
  pressClass: string;
}

const DARK: Tokens = {
  fontUi: "var(--font-ui)",
  fontMono: "var(--font-mono)",
  fontDisplay: "var(--font-display)",
  text: "var(--cream)",
  text2: "var(--cream-2)",
  text3: "var(--cream-3)",
  line: "var(--line)",
  panel: "var(--panel)",
  panelAlt: "rgba(255,255,255,0.05)",
  gold: "var(--gold)",
  bad: "var(--bad)",
  pressClass: "sc-press",
};

const PARCHMENT: Tokens = {
  fontUi: "'DM Sans',sans-serif",
  fontMono: "'DM Mono',monospace",
  fontDisplay: "var(--font-display)",
  text: "#1B2A1D",
  text2: "#1B2A1D",
  text3: "rgba(34,49,36,0.55)",
  line: "var(--line)",
  panel: "var(--paper)",
  panelAlt: "rgba(11,61,46,0.05)",
  gold: "var(--gold)",
  bad: "#B0433D",
  pressClass: "cb-chip",
};

interface HoleStrategy {
  hole: number;
  par: number | null;
  timesPlayed: number;
  avgScore: number;
  avgVsPar: number | null;
  doubleOrWorseCount: number;
  costliest: boolean;
  tip: string | null;
}

interface StrategyData {
  course: string;
  roundsAnalyzed: number;
  costliestHoles: number[];
  gameplan: string;
  holes: HoleStrategy[];
}

export interface CourseStrategyCardProps {
  theme: CourseStrategyTheme;
  course: string;
  style: CoachStyleId;
}

export const CourseStrategyCard: React.FC<CourseStrategyCardProps> = ({ theme, course, style }) => {
  const t = theme === "dark" ? DARK : PARCHMENT;
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<StrategyData | null>(null);
  const [err, setErr] = useState("");

  async function generate() {
    setStatus("loading");
    setErr("");
    try {
      const res = await fetch("/api/course-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, style }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Couldn't build a strategy for this course.");
      setData(json as StrategyData);
      setStatus("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div style={{ marginTop: 14, background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: status === "done" && data ? "1px solid " + t.line : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 600, color: t.text }}>Caddie Strategy</div>
          <div style={{ fontFamily: t.fontUi, fontSize: 11.5, color: t.text3, marginTop: 2, lineHeight: 1.4 }}>
            Hole-by-hole damage control for {course}, from your real rounds here.
          </div>
        </div>
        {status !== "loading" && (
          <button
            onClick={generate}
            className={t.pressClass}
            style={{
              flexShrink: 0,
              cursor: "pointer",
              border: "none",
              borderRadius: 10,
              padding: "9px 14px",
              background: t.gold,
              color: "#0F2016",
              fontFamily: t.fontUi,
              fontSize: 12.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {status === "done" ? "Regenerate" : "Generate"}
          </button>
        )}
      </div>

      {status === "loading" && (
        <div style={{ padding: "22px 16px", fontFamily: t.fontUi, fontSize: 12.5, color: t.text3, textAlign: "center" }}>
          Reading your rounds at {course}…
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: "14px 16px", fontFamily: t.fontUi, fontSize: 12.5, color: t.bad, lineHeight: 1.5 }}>{err}</div>
      )}

      {status === "done" && data && (
        <div style={{ padding: "14px 16px 16px" }}>
          {data.gameplan && (
            <p style={{ margin: "0 0 14px", fontFamily: t.fontUi, fontSize: 13, color: t.text2, lineHeight: 1.5, fontStyle: "italic" }}>
              {data.gameplan}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {data.holes.map((h) => (
              <div
                key={h.hole}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "9px 11px",
                  borderRadius: 10,
                  background: h.costliest ? hexA("#C05C5C", 0.1) : t.panelAlt,
                  border: "1px solid " + (h.costliest ? hexA("#C05C5C", 0.35) : t.line),
                }}
              >
                <div style={{ flexShrink: 0, width: 44, textAlign: "center" }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, color: h.costliest ? t.bad : t.text }}>#{h.hole}</div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.text3, marginTop: 1 }}>PAR {h.par ?? "—"}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.text3 }}>
                    AVG {h.avgScore.toFixed(1)}
                    {h.avgVsPar != null ? ` (${h.avgVsPar > 0 ? "+" : ""}${h.avgVsPar.toFixed(1)} vs par)` : ""} ·{" "}
                    {h.doubleOrWorseCount} double{h.doubleOrWorseCount === 1 ? "" : "s"}+
                  </div>
                  {h.tip && <p style={{ margin: "4px 0 0", fontFamily: t.fontUi, fontSize: 12.5, color: t.text, lineHeight: 1.4 }}>{h.tip}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

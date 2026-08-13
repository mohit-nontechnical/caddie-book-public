import React, { useState } from "react";
import { hexA } from "@/lib/caddie-data";
import type { CourseVerifyItem, UsgaCandidate, UsgaTee } from "./useCourseVerify";

// ── Post-import course-rating verification card ─────────────────
// Shared presentational component for the inline "Verify course ratings"
// step shown after a successful 18Birdies import (added > 0) touches a
// course whose rating is still estimated. Reused by both mobile
// (UploadView.tsx, dark Augusta theme) and desktop
// (DesktopRounds.tsx's ImportModal, parchment theme) via the `theme` prop —
// same behavior, different color tokens/fonts to match each surface's
// existing CourseEditRow conventions.

export type CourseVerifyTheme = "dark" | "parchment";

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
  goldInk: string;
  good: string;
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
  goldInk: "var(--gold)",
  good: "var(--good)",
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
  goldInk: "var(--gold-ink)",
  good: "#3E8F63",
  bad: "#B0433D",
  pressClass: "cb-chip",
};

function CandidateList({ t, candidates, onPick }: { t: Tokens; candidates: UsgaCandidate[]; onPick: (cand: UsgaCandidate) => void }) {
  if (candidates.length === 0) {
    return <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.text3 }}>Not in USGA DB.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {candidates.map((cand) => (
        <button
          key={cand.id ?? cand.courseID}
          onClick={() => onPick(cand)}
          className={t.pressClass}
          style={{ textAlign: "left", background: t.panelAlt, border: "1px solid " + t.line, borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
        >
          <div style={{ fontFamily: t.fontUi, fontSize: 12.5, fontWeight: 600, color: t.text }}>{cand.name}</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.text3 }}>{[cand.city, cand.state].filter(Boolean).join(", ")}</div>
        </button>
      ))}
    </div>
  );
}

// ── Tips-rating editable fallback (source: "tips") ───────────────
// Shown when neither the local sheet nor a live NCRDB match could supply a
// per-tee (White/Blue) rating. The championship/tips rating is prefilled but
// MUST be visibly labeled and left editable — never applied silently.
function TipsFallback({
  t,
  tips,
  onApply,
}: {
  t: Tokens;
  tips: { rating: number; slope: number; par: number };
  onApply: (edited: { rating: number; slope: number; par: number }) => void;
}) {
  const [rating, setRating] = useState(String(tips.rating));
  const [slope, setSlope] = useState(String(tips.slope));
  const [par, setPar] = useState(String(tips.par));

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: t.panelAlt,
    border: "1px solid " + t.line,
    borderRadius: 8,
    padding: "7px 8px",
    color: t.text,
    fontFamily: t.fontMono,
    fontSize: 13,
    textAlign: "center",
  };

  return (
    <div>
      <div
        style={{
          display: "inline-block",
          fontFamily: t.fontMono,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: t.goldInk,
          background: hexA("#C0912F", 0.14),
          padding: "3px 7px",
          borderRadius: 5,
          marginBottom: 7,
        }}
      >
        TIPS RATING — adjust if you played forward
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 7, alignItems: "end" }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: t.fontMono, fontSize: 8.5, letterSpacing: "0.1em", color: t.text3, marginBottom: 3 }}>RATING</span>
          <input style={inputStyle} value={rating} inputMode="decimal" onChange={(e) => setRating(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: t.fontMono, fontSize: 8.5, letterSpacing: "0.1em", color: t.text3, marginBottom: 3 }}>SLOPE</span>
          <input style={inputStyle} value={slope} inputMode="numeric" onChange={(e) => setSlope(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: t.fontMono, fontSize: 8.5, letterSpacing: "0.1em", color: t.text3, marginBottom: 3 }}>PAR</span>
          <input style={inputStyle} value={par} inputMode="numeric" onChange={(e) => setPar(e.target.value)} />
        </label>
        <button
          onClick={() => onApply({ rating: Number(rating) || tips.rating, slope: Number(slope) || tips.slope, par: Number(par) || tips.par })}
          className={t.pressClass}
          style={{ borderRadius: 8, padding: "8px 12px", cursor: "pointer", border: "none", background: t.gold, color: "#0F2016", fontFamily: t.fontUi, fontSize: 12, fontWeight: 700 }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function TeeList({ t, tees, onPick }: { t: Tokens; tees: UsgaTee[]; onPick: (tee: UsgaTee) => void }) {
  if (tees.length === 0) {
    return <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.text3 }}>No tees found for this course.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {tees.map((tee, i) => (
        <button
          key={i}
          onClick={() => onPick(tee)}
          className={t.pressClass}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", background: t.panelAlt, border: "1px solid " + t.line, borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontFamily: t.fontUi, fontSize: 12.5, fontWeight: 600, color: t.text }}>{tee.tee}</span>
            {tee.usual && (
              <span
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: t.goldInk,
                  background: hexA("#C0912F", 0.14),
                  padding: "2px 6px",
                  borderRadius: 5,
                }}
              >
                YOUR USUAL
              </span>
            )}
          </span>
          <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.text3, flexShrink: 0 }}>
            Par {tee.par} · {tee.rating.toFixed(1)}/{tee.slope}
          </span>
        </button>
      ))}
    </div>
  );
}

function CourseRow({
  t,
  item,
  onPickCandidate,
  onPickTee,
  onApplyTips,
  onSkip,
  onRetry,
}: {
  t: Tokens;
  item: CourseVerifyItem;
  onPickCandidate: (courseName: string, candidate: UsgaCandidate) => void;
  onPickTee: (courseName: string, tee: UsgaTee) => void;
  onApplyTips: (courseName: string, edited: { rating: number; slope: number; par: number }) => void;
  onSkip: (courseName: string) => void;
  onRetry: (courseName: string) => void;
}) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid " + t.line }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: t.fontUi,
            fontSize: 13.5,
            fontWeight: 600,
            color: t.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.courseName}
        </span>
        {item.status === "done" && (
          <span style={{ color: t.good, fontSize: 15, flexShrink: 0 }}>✓</span>
        )}
        {item.status !== "done" && (
          <button
            onClick={() => onSkip(item.courseName)}
            className={t.pressClass}
            style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", fontFamily: t.fontUi, fontSize: 11, color: t.text3, padding: "2px 4px" }}
          >
            Skip
          </button>
        )}
      </div>

      {item.status === "loading" && (
        <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.text3 }}>Searching USGA…</div>
      )}
      {item.status === "loading-tees" && (
        <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.text3 }}>Loading tees…</div>
      )}
      {item.status === "no-match" && (
        <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.text3 }}>Not in USGA DB — you can enter Rating/Slope/Par manually in Course ratings.</div>
      )}
      {item.status === "error" && (
        <div>
          <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.bad, marginBottom: 6 }}>{item.error || "Something went wrong."}</div>
          <button
            onClick={() => onRetry(item.courseName)}
            className={t.pressClass}
            style={{ background: "transparent", border: "1px solid " + t.line, borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontFamily: t.fontUi, fontSize: 11.5, color: t.text2 }}
          >
            Retry
          </button>
        </div>
      )}
      {item.status === "candidates" && (
        <CandidateList t={t} candidates={item.candidates} onPick={(cand) => onPickCandidate(item.courseName, cand)} />
      )}
      {item.status === "tees" && (
        <TeeList t={t} tees={item.tees} onPick={(tee) => onPickTee(item.courseName, tee)} />
      )}
      {item.status === "tips" && item.tips && (
        <TipsFallback t={t} tips={item.tips} onApply={(edited) => onApplyTips(item.courseName, edited)} />
      )}
      {item.status === "done" && (
        <div style={{ fontFamily: t.fontUi, fontSize: 12, color: t.good }}>Rating applied.</div>
      )}
    </div>
  );
}

export interface CourseVerifyCardProps {
  theme: CourseVerifyTheme;
  items: CourseVerifyItem[];
  onPickCandidate: (courseName: string, candidate: UsgaCandidate) => void;
  onPickTee: (courseName: string, tee: UsgaTee) => void;
  onApplyTips: (courseName: string, edited: { rating: number; slope: number; par: number }) => void;
  onSkip: (courseName: string) => void;
  onSkipAll: () => void;
  onRetry: (courseName: string) => void;
}

export const CourseVerifyCard: React.FC<CourseVerifyCardProps> = ({ theme, items, onPickCandidate, onPickTee, onApplyTips, onSkip, onSkipAll, onRetry }) => {
  const t = theme === "dark" ? DARK : PARCHMENT;
  if (items.length === 0) return null;

  const remaining = items.filter((it) => it.status !== "skipped" && it.status !== "done").length;

  return (
    <div style={{ marginTop: 14, background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid " + t.line, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 600, color: t.text }}>Verify course ratings</div>
          <div style={{ fontFamily: t.fontUi, fontSize: 11.5, color: t.text3, marginTop: 2 }}>
            {remaining > 0
              ? `${remaining} course${remaining === 1 ? "" : "s"} use estimated ratings — confirm the tee you play.`
              : "All set."}
          </div>
        </div>
        {remaining > 0 && (
          <button
            onClick={onSkipAll}
            className={t.pressClass}
            style={{ flexShrink: 0, background: "transparent", border: "1px solid " + t.line, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontFamily: t.fontUi, fontSize: 11.5, color: t.text3 }}
          >
            Skip all
          </button>
        )}
      </div>
      {items.map((item) => (
        <CourseRow
          key={item.courseName}
          t={t}
          item={item}
          onPickCandidate={onPickCandidate}
          onPickTee={onPickTee}
          onApplyTips={onApplyTips}
          onSkip={onSkip}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
};

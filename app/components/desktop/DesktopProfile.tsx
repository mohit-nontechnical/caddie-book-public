"use client";

// Caddie Book desktop — Profile page, wired to real data.
// Ported from docs/design/caddie-states.jsx's ProfilePage, but rebuilt around
// the real mobile functionality (ProfileView.tsx / HandicapPanel.tsx /
// useHandicap.ts) instead of demo window.CB data:
//   /api/handicap  -> handicap index (18/9-hole toggle), per-round
//                     differentials (recent20), course rating rows
//   /api/stats     -> rounds tracked, season scoring average, best round
//   /api/courses   -> PUT to save a course rating override (same as
//                     HandicapPanel's CourseEditRow)
// include-9 toggle persists to the same localStorage key mobile uses
// (caddie:include9) so the two surfaces stay in sync.
//
// Omitted per spec: passcode/logout (middleware handles auth), demo-mode
// switch, tweaks panel. The design's "Connected apps / Coaching tone /
// Notifications / Units" settings rows are decorative copy in the design
// with no backing data — kept as informational static rows (no fake
// toggles), same restraint mobile's ProfileView takes for its SETTINGS list.
//
// Self-contained: only imports from DesktopUI / DesktopIcons / DesktopCharts,
// lib/caddie-data, and GradesContext (as instructed).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CBCard, CBCardTitle, CBPageHead, CBSectionLabel, gradeColor, hexA } from "./DesktopUI";
import { IconChevron, IconChevronD } from "./DesktopIcons";
import { DesktopLineChart } from "./DesktopCharts";
import { useGrades } from "../GradesContext";
import { golfer, slots } from "@/lib/caddie-data";
import { useShareCard } from "../useShareCard";
import type { HandicapCourseRow, HandicapResponse, StatsResponse } from "./types";

const INCLUDE9_KEY = "caddie:include9";

interface LoadState<T> {
  data: T | null;
  loading: boolean;
}

function useJson<T>(url: string): LoadState<T> & { reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: true }));
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ data: d as T, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

const skeletonStyle: React.CSSProperties = {
  background: "var(--paper-dim, rgba(11,61,46,0.06))",
  borderRadius: 10,
  animation: "cbSkeleton 1.4s ease-in-out infinite",
};

function Skeleton({ height, style }: { height: number; style?: React.CSSProperties }) {
  return <div style={{ ...skeletonStyle, height, ...style }} />;
}

// Per-round differential row shape returned in HandicapResponse.recent20
// (see lib/handicap.ts's RatedRound -> recent20 mapping, consumed as
// DiffRow by mobile's useHandicap.ts). Typed locally since types.ts leaves
// recent20 as unknown[].
interface DiffRow {
  date: string;
  course: string;
  score: number;
  rating: number;
  slope: number;
  differential: number;
  estimated: boolean;
  holeCount: number;
}

export const DesktopProfile: React.FC = () => {
  const { gradeFor } = useGrades();
  const [include9, setInclude9] = useState(true);
  const [showCourses, setShowCourses] = useState(false);
  const [openSetting, setOpenSetting] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(INCLUDE9_KEY);
      if (stored !== null) setInclude9(stored !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleInclude9() {
    setInclude9((v) => {
      const next = !v;
      try {
        localStorage.setItem(INCLUDE9_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const handicap = useJson<HandicapResponse>(`/api/handicap?include9=${include9 ? 1 : 0}`);
  const stats = useJson<StatsResponse>("/api/stats");
  const card = useShareCard();

  const anyLoading = handicap.loading || stats.loading;

  const index = typeof handicap.data?.index === "number" ? handicap.data.index : null;
  const overall = stats.data?.overall;
  const totalRounds = overall?.totalRounds ?? 0;
  const scoreAvg = overall?.scoringAvg18 != null ? overall.scoringAvg18.toFixed(1) : null;
  const best18 = overall?.best18 ?? null;

  const bagGpa = useMemo(() => {
    const m: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    return (slots.reduce((a, s) => a + m[gradeFor(s.id, s.grade)], 0) / slots.length).toFixed(2);
  }, [gradeFor]);

  // Index trend: recent20 differentials (WHS uses lower = better; invert for
  // a "up is good" line, mirroring HandicapPanel's `60 - t.index` inversion).
  const recent20 = (handicap.data?.recent20 as DiffRow[] | undefined) ?? [];
  const trendChrono = useMemo(() => [...recent20].reverse(), [recent20]);
  const trendData = trendChrono.map((r) => 40 - r.differential);
  // Dates may be date-only ("2026-07-10") or full ISO timestamps — only pad date-only ones.
  const trendLabels = trendChrono.map((r) => new Date(r.date + (r.date.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" }));

  // types.ts declares estimatedCourses as a count (number), but the real
  // /api/handicap route returns the estimated course *names* (string[]) —
  // see lib/handicap.ts's ComputeHandicapResult. Read it defensively so this
  // keeps working regardless of which shape is actually on the wire.
  const estimatedCoursesRaw = handicap.data?.estimatedCourses as number | string[] | undefined;
  const estCount = Array.isArray(estimatedCoursesRaw) ? estimatedCoursesRaw.length : estimatedCoursesRaw ?? 0;
  const courses: HandicapCourseRow[] = handicap.data?.courses ?? [];

  // Home course = most-played course (stats courses are the full history;
  // handicap courses are sorted by 18-hole rounds as a fallback).
  const homeCourse =
    [...(stats.data?.courses ?? [])].sort((a, b) => b.rounds - a.rounds)[0]?.name ??
    courses[0]?.name ??
    null;

  return (
    <div style={{ maxWidth: 860 }}>
      <CBPageHead eyebrow="THE PLAYER" title="Profile" sub="Your handicap, your bag, and the settings behind the grades." />

      {/* golfer header */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
        <span
          style={{
            width: 66,
            height: 66,
            borderRadius: 18,
            background: hexA("#C0912F", 0.16),
            border: "1px solid " + hexA("#C0912F", 0.3),
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--gold-ink)",
          }}
        >
          {golfer.initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "#1B2A1D" }}>{golfer.name}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: "rgba(34,49,36,0.6)", marginTop: 3 }}>
            {homeCourse ?? (anyLoading ? "…" : "No rounds yet")}
            {totalRounds > 0 ? ` · ${totalRounds} round${totalRounds === 1 ? "" : "s"} tracked` : ""}
          </div>
        </div>
        <button
          onClick={card.share}
          disabled={card.busy}
          title={card.error || "Download a shareable player-profile image"}
          style={{
            flexShrink: 0,
            cursor: card.busy ? "default" : "pointer",
            background: "var(--ink)",
            color: "#F2ECDC",
            border: "none",
            borderRadius: 12,
            padding: "11px 18px",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13,
            fontWeight: 600,
            opacity: card.busy ? 0.6 : 1,
          }}
        >
          {card.busy ? "Building…" : "Share my card"}
        </button>
      </div>

      {/* hero stats */}
      {anyLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={90} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Stat big={index != null ? index.toFixed(1) : "—"} label="HANDICAP INDEX" sub={include9 ? "includes 9-hole rounds" : "18-hole rounds only"} />
          <Stat big={bagGpa} label="BAG GPA" sub="across 14 slots" />
          <Stat big={best18 ?? "—"} label="BEST ROUND" sub={scoreAvg ? `season avg ${scoreAvg}` : undefined} subColor="#3E8F63" />
        </div>
      )}

      {/* index trend */}
      <CBCard style={{ marginBottom: 16 }}>
        <CBCardTitle sub="Differential per round, most recent rounds">Index trend</CBCardTitle>
        {handicap.loading ? (
          <Skeleton height={64} />
        ) : trendData.length > 1 ? (
          <DesktopLineChart series={[{ name: "Trend", color: "#3E8F63", data: trendData }]} labels={trendLabels} height={64} />
        ) : (
          <div style={{ height: 64, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(34,49,36,0.45)" }}>
            Log a few more rounds to see your index trend.
          </div>
        )}
      </CBCard>

      {/* handicap settings */}
      <CBSectionLabel style={{ margin: "4px 0 10px" }}>Handicap settings</CBSectionLabel>
      <CBCard style={{ marginBottom: 16 }} pad={0}>
        <button
          onClick={toggleInclude9}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span
            style={{
              width: 38,
              height: 22,
              borderRadius: 999,
              background: include9 ? "var(--gold)" : "rgba(34,49,36,0.18)",
              position: "relative",
              flexShrink: 0,
              transition: "background 0.15s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: include9 ? 18 : 2,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#fff",
                transition: "left 0.15s ease",
              }}
            />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: "#1B2A1D" }}>
              Include 9-hole rounds
            </span>
            <span style={{ display: "block", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(34,49,36,0.55)", marginTop: 2 }}>
              Uses the WHS doubling approximation for 9-hole differentials
            </span>
          </span>
        </button>

        {estCount > 0 && (
          <div
            style={{
              margin: "14px 18px 0",
              padding: "10px 12px",
              borderRadius: 11,
              background: hexA("#C0912F", 0.1),
              border: "1px solid " + hexA("#C0912F", 0.3),
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12,
              color: "#22321f",
              lineHeight: 1.4,
            }}
          >
            {estCount} course{estCount === 1 ? "" : "s"} use estimated ratings. Refine them below for a more accurate index.
          </div>
        )}

        <button
          onClick={() => setShowCourses((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: "14px 18px",
          }}
        >
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: "#1B2A1D" }}>
            Manage course ratings {courses.length ? `· ${courses.length}` : ""}
          </span>
          <IconChevronD size={16} stroke="rgba(34,49,36,0.5)" style={{ transform: showCourses ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>

        {showCourses && (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {handicap.loading ? (
              <div style={{ padding: 18 }}>
                <Skeleton height={120} />
              </div>
            ) : courses.length ? (
              courses.map((c) => <CourseEditRow key={c.norm} c={c} onSaved={handicap.reload} />)
            ) : (
              <div style={{ padding: "14px 18px", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.55)" }}>
                No courses yet — import a few rounds to start editing ratings.
              </div>
            )}
          </div>
        )}
      </CBCard>

      {/* per-round differentials */}
      {recent20.length > 0 && (
        <>
          <CBSectionLabel style={{ margin: "4px 0 10px" }}>Recent differentials</CBSectionLabel>
          <CBCard style={{ marginBottom: 16 }} pad={0}>
            {recent20.slice(0, 10).map((r, i, arr) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(34,49,36,0.5)", width: 76, flexShrink: 0 }}>
                  {new Date(r.date + (r.date.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: "#1B2A1D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.course}
                  {r.estimated && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 9,
                        color: "var(--gold-ink)",
                        background: hexA("#C0912F", 0.14),
                        padding: "2px 6px",
                        borderRadius: 5,
                      }}
                    >
                      EST
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "rgba(34,49,36,0.6)", flexShrink: 0 }}>{r.score}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color: "#1B2A1D", width: 50, textAlign: "right", flexShrink: 0 }}>
                  {r.differential.toFixed(1)}
                </span>
              </div>
            ))}
          </CBCard>
        </>
      )}

      {/* settings (informational — no backing toggles exist for these yet) */}
      <CBSectionLabel style={{ margin: "4px 0 10px" }}>Settings</CBSectionLabel>
      <CBCard pad={0}>
        {SETTINGS.map((s, i, arr) => {
          const isOpen = openSetting === i;
          return (
            <div key={i} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none" }}>
              <button
                onClick={() => setOpenSetting(isOpen ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#1B2A1D" }}>{s.label}</span>
                <IconChevron
                  size={16}
                  stroke="rgba(34,49,36,0.4)"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
                />
              </button>
              {isOpen && (
                <div style={{ padding: "0 18px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.6)", lineHeight: 1.5 }}>
                  {s.detail}
                </div>
              )}
            </div>
          );
        })}
      </CBCard>
    </div>
  );
};

const SETTINGS: { label: string; detail: string }[] = [
  { label: "Connected apps · 18Birdies", detail: "Import your rounds from the dashboard's Import button. More integrations coming." },
  { label: "Goal: Break 85", detail: "Your current target. Coach builds your plan around it." },
  { label: "Coaching tone", detail: "Coach speaks plain and direct. Tunable tones are coming." },
  { label: "Notifications", detail: "Round reminders and weekly insights are coming soon." },
];

const Stat: React.FC<{ big: React.ReactNode; label: string; sub?: string; subColor?: string }> = ({ big, label, sub, subColor }) => (
  <CBCard pad={16}>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(34,49,36,0.5)" }}>{label}</div>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 30, fontWeight: 500, color: "#1B2A1D", marginTop: 6 }}>{big}</div>
    {sub && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: subColor || "rgba(34,49,36,0.5)", marginTop: 3 }}>{sub}</div>}
  </CBCard>
);

// ── USGA auto-fill types (mirrors app/api/course-lookup response shapes) ──
interface UsgaCandidate {
  /** Local sheet row id — present when candidates came from the local USGA sheet (source: "sheet"). */
  id?: number;
  /** Legacy live-NCRDB id — present only when the local sheet was empty/unavailable. */
  courseID?: number;
  name: string;
  facility?: string;
  city: string;
  state: string;
}

interface UsgaTee {
  tee: string;
  gender: "M" | "F";
  par: number;
  rating: number;
  slope: number;
  yards?: number;
}

interface UsgaTips {
  rating: number;
  slope: number;
  par: number;
}

type UsgaStep = "idle" | "loading-candidates" | "candidates" | "loading-tees" | "tees" | "tips" | "error";

// Build a reasonable-but-simple search query from a stored course name:
// strip parenthetical suffixes like "(9)" and keep the first few significant words.
function cleanCourseQuery(name: string): string {
  const noParens = name.replace(/\([^)]*\)/g, " ").trim();
  const words = noParens.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.max(3, Math.min(words.length, 4))).join(" ");
}

const USGA_9HOLE_PAR_THRESHOLD = 40;

const CourseEditRow: React.FC<{ c: HandicapCourseRow; onSaved: () => void }> = ({ c, onSaved }) => {
  const [rating, setRating] = useState(String(c.rating));
  const [slope, setSlope] = useState(String(c.slope));
  const [par, setPar] = useState(String(c.par));
  const [saving, setSaving] = useState(false);
  const dirty = rating !== String(c.rating) || slope !== String(c.slope) || par !== String(c.par);

  const [usgaOpen, setUsgaOpen] = useState(false);
  const [usgaStep, setUsgaStep] = useState<UsgaStep>("idle");
  const [usgaError, setUsgaError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<UsgaCandidate[]>([]);
  const [tees, setTees] = useState<UsgaTee[]>([]);
  const [tips, setTips] = useState<UsgaTips | null>(null);
  const [tipsRating, setTipsRating] = useState("");
  const [tipsSlope, setTipsSlope] = useState("");
  const [tipsPar, setTipsPar] = useState("");
  const [nineHoleNote, setNineHoleNote] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, rating: Number(rating), slope: Number(slope), par: Number(par) }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function startUsgaLookup() {
    setUsgaOpen(true);
    setUsgaStep("loading-candidates");
    setUsgaError(null);
    setCandidates([]);
    setTees([]);
    setTips(null);
    setNineHoleNote(false);
    try {
      const q = cleanCourseQuery(c.name);
      const res = await fetch(`/api/course-lookup?name=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Lookup failed");
      setCandidates(data.candidates ?? []);
      setUsgaStep("candidates");
    } catch (err) {
      setUsgaError(err instanceof Error ? err.message : "Lookup failed");
      setUsgaStep("error");
    }
  }

  // Local-sheet candidates (have `id`) go through ?candidateId=, which
  // attempts a live NCRDB per-tee match and falls back to the sheet's
  // labeled tips rating on ANY NCRDB failure. Legacy live-NCRDB candidates
  // (only reached if the local sheet was empty/unavailable) use ?courseId=.
  async function pickCandidate(cand: UsgaCandidate) {
    setUsgaStep("loading-tees");
    setUsgaError(null);
    try {
      const url = cand.id !== undefined ? `/api/course-lookup?candidateId=${cand.id}` : `/api/course-lookup?courseId=${cand.courseID}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Tee lookup failed");
      if (data.source === "tips" && data.tips) {
        setTips(data.tips);
        setTipsRating(String(data.tips.rating));
        setTipsSlope(String(data.tips.slope));
        setTipsPar(String(data.tips.par));
        setUsgaStep("tips");
        return;
      }
      setTees(data.tees ?? []);
      setUsgaStep("tees");
    } catch (err) {
      setUsgaError(err instanceof Error ? err.message : "Tee lookup failed");
      setUsgaStep("error");
    }
  }

  function pickTee(t: UsgaTee) {
    // This app stores 9-hole courses on an 18-hole basis (rating & par
    // doubled, slope kept as-is). A par this low means the NCRDB tee is a
    // 9-hole rating, so double par + rating before filling.
    const is9 = t.par <= USGA_9HOLE_PAR_THRESHOLD;
    setPar(String(is9 ? t.par * 2 : t.par));
    setRating(String(is9 ? Math.round(t.rating * 2 * 10) / 10 : t.rating));
    setSlope(String(t.slope));
    setNineHoleNote(is9);
    setUsgaOpen(false);
    setUsgaStep("idle");
  }

  // Applies the user-EDITED tips values (never the raw tips numbers
  // silently) — same 9-hole doubling rule as pickTee.
  function applyTips() {
    const r = Number(tipsRating), s = Number(tipsSlope), p = Number(tipsPar);
    if (!(r > 0) || !(s > 0) || !(p > 0)) return;
    const is9 = p <= USGA_9HOLE_PAR_THRESHOLD;
    setPar(String(is9 ? p * 2 : p));
    setRating(String(is9 ? Math.round(r * 2 * 10) / 10 : r));
    setSlope(String(s));
    setNineHoleNote(is9);
    setUsgaOpen(false);
    setUsgaStep("idle");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(11,61,46,0.05)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "7px 8px",
    color: "#1B2A1D",
    fontFamily: "'DM Mono',monospace",
    fontSize: 13,
    textAlign: "center",
  };

  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#1B2A1D",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {c.name}
        </span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(34,49,36,0.5)" }}>{c.rounds18} rnd</span>
        {c.estimated && (
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--gold-ink)", background: hexA("#C0912F", 0.14), padding: "2px 6px", borderRadius: 5 }}>
            EST
          </span>
        )}
        <button
          onClick={startUsgaLookup}
          className="cb-chip"
          style={{
            flexShrink: 0,
            borderRadius: 6,
            padding: "3px 7px",
            cursor: "pointer",
            border: "1px solid " + hexA("#C0912F", 0.35),
            background: hexA("#C0912F", 0.1),
            color: "var(--gold-ink)",
            fontFamily: "'DM Mono',monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          USGA
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 7, alignItems: "end" }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.5)", marginBottom: 3 }}>RATING</span>
          <input style={inputStyle} value={rating} inputMode="decimal" onChange={(e) => setRating(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.5)", marginBottom: 3 }}>SLOPE</span>
          <input style={inputStyle} value={slope} inputMode="numeric" onChange={(e) => setSlope(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.5)", marginBottom: 3 }}>PAR</span>
          <input style={inputStyle} value={par} inputMode="numeric" onChange={(e) => setPar(e.target.value)} />
        </label>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            borderRadius: 8,
            padding: "8px 12px",
            cursor: dirty && !saving ? "pointer" : "default",
            border: "none",
            background: dirty ? "var(--gold)" : "rgba(11,61,46,0.08)",
            color: dirty ? "var(--gold-ink)" : "rgba(34,49,36,0.4)",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {saving ? "…" : "Save"}
        </button>
      </div>

      {nineHoleNote && (
        <div style={{ marginTop: 7, fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: "var(--gold-ink)" }}>
          (9-hole ×2) — rating &amp; par doubled, slope kept as-is
        </div>
      )}

      {usgaOpen && (
        <div style={{ marginTop: 10, padding: "10px 11px", borderRadius: 10, background: "rgba(11,61,46,0.04)", border: "1px solid var(--line)" }}>
          {usgaStep === "loading-candidates" && (
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(34,49,36,0.55)" }}>Searching USGA…</div>
          )}
          {usgaStep === "loading-tees" && (
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(34,49,36,0.55)" }}>Loading tees…</div>
          )}
          {usgaStep === "error" && (
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#B0433D" }}>{usgaError || "Something went wrong."}</div>
          )}
          {usgaStep === "candidates" && (
            candidates.length === 0 ? (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(34,49,36,0.55)" }}>Not in USGA DB.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {candidates.map((cand) => (
                  <button
                    key={cand.id ?? cand.courseID}
                    onClick={() => pickCandidate(cand)}
                    className="cb-chip"
                    style={{ textAlign: "left", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                  >
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600, color: "#1B2A1D" }}>{cand.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(34,49,36,0.5)" }}>{[cand.city, cand.state].filter(Boolean).join(", ")}</div>
                  </button>
                ))}
              </div>
            )
          )}
          {usgaStep === "tips" && tips && (
            <div>
              <div
                style={{
                  display: "inline-block",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--gold-ink)",
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
                  <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.5)", marginBottom: 3 }}>RATING</span>
                  <input style={inputStyle} value={tipsRating} inputMode="decimal" onChange={(e) => setTipsRating(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.5)", marginBottom: 3 }}>SLOPE</span>
                  <input style={inputStyle} value={tipsSlope} inputMode="numeric" onChange={(e) => setTipsSlope(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.5)", marginBottom: 3 }}>PAR</span>
                  <input style={inputStyle} value={tipsPar} inputMode="numeric" onChange={(e) => setTipsPar(e.target.value)} />
                </label>
                <button
                  onClick={applyTips}
                  className="cb-chip"
                  style={{ borderRadius: 8, padding: "8px 12px", cursor: "pointer", border: "none", background: "var(--gold)", color: "var(--gold-ink)", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700 }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
          {usgaStep === "tees" && (
            tees.length === 0 ? (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(34,49,36,0.55)" }}>No tees found for this course.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {tees.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => pickTee(t)}
                    className="cb-chip"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                  >
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600, color: "#1B2A1D" }}>{t.tee}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(34,49,36,0.55)" }}>Par {t.par} · {t.rating.toFixed(1)}/{t.slope}</span>
                  </button>
                ))}
              </div>
            )
          )}
          <button
            onClick={() => { setUsgaOpen(false); setUsgaStep("idle"); }}
            style={{ marginTop: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.55)", padding: 0 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default DesktopProfile;

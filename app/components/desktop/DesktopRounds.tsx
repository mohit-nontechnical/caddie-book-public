"use client";

// Caddie Book desktop — Rounds page, wired to real API data.
// Ported from docs/design/caddie-pages-rounds.jsx (RoundsPage, RoundDetail,
// ImportModal). Self-contained: only imports from DesktopUI / DesktopIcons /
// DesktopCharts / types, and manages its own internal view state (list vs.
// detail) since DesktopShell renders <DesktopRounds /> with no props.
//
// Data sources:
//   /api/rounds              -> the sortable rounds table + hole-by-hole strip
//   /api/handicap?include9=1 -> recent20 differentials, matched to a round by
//                                date + course, to fill the design's "Diff" column
//   /api/debrief?roundId=X   -> the per-round debrief (headline, blow-ups, coach note)
//   /api/import-18birdies    -> POST the raw 18Birdies export JSON (same contract
//                                as app/components/UploadView.tsx's handleImport)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CBCard, CBCardTitle, CBPageHead, hexA } from "./DesktopUI";
import { DesktopHoleStrip } from "./DesktopCharts";
import { IconArrowL, IconCheck, IconClose, IconFlag, IconImport, IconRounds } from "./DesktopIcons";
import type { DebriefResponse, HandicapResponse, RoundListItem } from "./types";
import { CourseVerifyCard } from "../CourseVerifyCard";
import { ShotHoleMap } from "../ShotHoleMap";
import { useCourseVerify } from "../useCourseVerify";
import { getCoachStyle } from "../useCoachStyle";

// ── data loading ──────────────────────────────────────────
interface LoadState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

function useJson<T>(url: string | null): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: !!url, error: false });
  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: false });
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ data: d as T, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

const skeletonStyle: React.CSSProperties = {
  background: "var(--paper-dim, rgba(11,61,46,0.06))",
  borderRadius: 10,
  animation: "cbSkeleton 1.4s ease-in-out infinite",
};

function Skeleton({ height, style }: { height: number; style?: React.CSSProperties }) {
  return <div style={{ ...skeletonStyle, height, ...style }} />;
}

// ── local helpers ──────────────────────────────────────────
function fmtDateShort(iso: string): string {
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
function fmtDateLong(iso: string): string {
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function countBlowUps(holes: number[]): number {
  return holes.filter((h) => h >= 7).length;
}

type SortKey = "date" | "course" | "holeCount" | "total" | "diff" | "blowups";
type SortDir = "asc" | "desc";

// ── Blow-up chip (design-faithful) ──────────────────────────
const BlowChip: React.FC<{ n: number }> = ({ n }) => {
  const c = n >= 6 ? "#B0433D" : n >= 4 ? "#C0742F" : n > 0 ? "#6E9A46" : "rgba(34,49,36,0.35)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: hexA(c, 0.13),
        border: "1px solid " + hexA(c, 0.28),
        borderRadius: 999,
        padding: "3px 10px 3px 8px",
        fontFamily: "'DM Mono',monospace",
        fontSize: 11.5,
        fontWeight: 500,
        color: c,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 5, background: c }} />
      {n}
    </span>
  );
};

// ── Rounds table ─────────────────────────────────────────────
interface RoundsTableRow extends RoundListItem {
  blowups: number;
  diff: number | null;
}

interface RoundsTableProps {
  onOpenRound: (id: string) => void;
  onImport: () => void;
}

const RoundsTable: React.FC<RoundsTableProps> = ({ onOpenRound, onImport }) => {
  const rounds = useJson<RoundListItem[]>("/api/rounds");
  const handicap = useJson<HandicapResponse>("/api/handicap?include9=1");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<SortDir>("desc");

  // The design shows a "Diff" (differential) column. Our /api/rounds items
  // don't carry a differential, but /api/handicap's recent20 does — keyed by
  // date + course rather than round id. Match on that pair to backfill it;
  // if handicap data isn't available (e.g. no rated rounds yet) the column is
  // omitted cleanly rather than showing fake data.
  const diffByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of handicap.data?.recent20 ?? []) {
      const rec = d as { date: string; course: string; differential: number };
      m.set(rec.date + "|" + rec.course, rec.differential);
    }
    return m;
  }, [handicap.data]);
  const hasDiff = diffByKey.size > 0;

  const rows: RoundsTableRow[] = useMemo(() => {
    const list = rounds.data ?? [];
    return list.map((r) => ({
      ...r,
      blowups: countBlowUps(r.holes),
      diff: diffByKey.get(r.date + "|" + r.course) ?? null,
    }));
  }, [rounds.data, diffByKey]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "date":
          av = a.date;
          bv = b.date;
          break;
        case "course":
          av = a.course;
          bv = b.course;
          break;
        case "holeCount":
          av = a.holeCount;
          bv = b.holeCount;
          break;
        case "total":
          av = a.total;
          bv = b.total;
          break;
        case "diff":
          av = a.diff ?? -Infinity;
          bv = b.diff ?? -Infinity;
          break;
        case "blowups":
          av = a.blowups;
          bv = b.blowups;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return dir === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [rows, sortKey, dir]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  const cols: { key: SortKey; label: string; w: string; align: "left" | "center" }[] = [
    { key: "date", label: "Date", w: "14%", align: "left" },
    { key: "course", label: "Course", w: hasDiff ? "27%" : "34%", align: "left" },
    { key: "holeCount", label: "Holes", w: "9%", align: "center" },
    { key: "total", label: "Score", w: "11%", align: "center" },
    ...(hasDiff ? [{ key: "diff" as SortKey, label: "Diff", w: "11%", align: "center" as const }] : []),
    { key: "blowups", label: "Blow-ups", w: "13%", align: "center" },
  ];

  const totalRounds = rounds.data?.length ?? 0;
  const best = useMemo(() => {
    const totals = (rounds.data ?? []).filter((r) => r.complete).map((r) => r.total);
    return totals.length ? Math.min(...totals) : null;
  }, [rounds.data]);

  return (
    <div>
      <CBPageHead
        eyebrow="THE RECORD"
        title="Rounds"
        sub={
          totalRounds > 0
            ? `All ${totalRounds} round${totalRounds === 1 ? "" : "s"} this season. Click any row for the hole-by-hole card and its debrief.`
            : "Import your 18Birdies rounds to start building your record."
        }
        right={
          <button onClick={onImport} className="cb-btn-ghost" style={importBtnStyle}>
            <IconImport size={16} stroke="#F2ECDC" />
            Import 18Birdies export (JSON)
          </button>
        }
      />

      {rounds.loading ? (
        <CBCard pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: 20 }}>
            <Skeleton height={320} />
          </div>
        </CBCard>
      ) : rounds.error ? (
        <CBCard>
          <EmptyState title="Rounds unavailable" body="Something went wrong loading your rounds. Try refreshing." />
        </CBCard>
      ) : totalRounds === 0 ? (
        <CBCard>
          <EmptyState
            icon
            title="No rounds yet"
            body="Import your 18Birdies export to see every round, sortable by score, date, and blow-ups."
          />
        </CBCard>
      ) : (
        <CBCard pad={0} style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              padding: "13px 20px",
              borderBottom: "1px solid var(--line)",
              background: "rgba(11,61,46,0.03)",
            }}
          >
            {cols.map((c) => (
              <button
                key={c.key}
                onClick={() => setSort(c.key)}
                style={{
                  width: c.w,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  justifyContent: c.align === "center" ? "center" : "flex-start",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: sortKey === c.key ? "#1B2A1D" : "rgba(34,49,36,0.5)",
                  fontWeight: sortKey === c.key ? 700 : 400,
                }}
              >
                {c.label}
                {sortKey === c.key && (
                  <span style={{ fontSize: 8, transform: dir === "asc" ? "rotate(180deg)" : "none" }}>&#9660;</span>
                )}
              </button>
            ))}
          </div>
          {sorted.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenRound(r.id)}
              className="cb-row"
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "13px 20px",
                border: "none",
                borderBottom: "1px solid var(--line)",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ width: "14%", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(34,49,36,0.7)" }}>
                {fmtDateShort(r.date)}
              </span>
              <span style={{ width: cols[1].w, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 7,
                    background: r.complete ? "#3E8F63" : "#C0912F",
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#1B2A1D",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.course || "Unknown course"}
                </span>
              </span>
              <span
                style={{
                  width: "9%",
                  textAlign: "center",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 12.5,
                  color: "rgba(34,49,36,0.6)",
                }}
              >
                {r.holeCount}
              </span>
              <span
                style={{
                  width: "11%",
                  textAlign: "center",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 16,
                  fontWeight: 500,
                  color: best != null && r.total === best ? "#3E8F63" : "#1B2A1D",
                }}
              >
                {r.total}
              </span>
              {hasDiff && (
                <span
                  style={{
                    width: "11%",
                    textAlign: "center",
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 12.5,
                    color: "rgba(34,49,36,0.6)",
                  }}
                >
                  {r.diff != null ? r.diff.toFixed(1) : "—"}
                </span>
              )}
              <span style={{ width: "13%", display: "flex", justifyContent: "center" }}>
                <BlowChip n={r.blowups} />
              </span>
            </button>
          ))}
        </CBCard>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ title: string; body: string; icon?: boolean }> = ({ title, body, icon }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", textAlign: "center" }}>
    {icon && (
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(199,162,75,0.14)", display: "grid", placeItems: "center" }}>
        <IconRounds size={22} stroke="var(--gold-ink)" />
      </div>
    )}
    <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "#1B2A1D" }}>{title}</div>
    <p style={{ margin: 0, maxWidth: 420, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "rgba(34,49,36,0.6)", lineHeight: 1.5 }}>
      {body}
    </p>
  </div>
);

// ── Shot-by-shot + club report card (Shot Scope rounds) ─────
interface ShotRow {
  seq: number;
  club: string;
  lie: string;
  dist: number;
  distUnit: string;
  rem: number | null;
  remUnit: string | null;
  sg: number;
}
interface HoleShotsRow {
  hole: number;
  par: number;
  strokes: number;
  sg: number;
  pin: [number, number] | null;
  gps: boolean;
  shots: (ShotRow & { sLat?: number; sLng?: number; eLat?: number; eLng?: number })[];
}
interface ClubRow {
  club: string;
  label: string;
  shots: number;
  totalSG: number;
  avgSG: number;
}
interface DispersionRow {
  club: string;
  label: string;
  attempts: number;
  avgDistYds: number | null;
  landed: { fairway: number; green: number; rough: number; holed: number; other: number };
  accuracyPct: number | null;
  avgOffsetYds: number | null;
  biasYds: number | null;
  leftPct: number | null;
  rightPct: number | null;
  offsetsYds: number[];
}
interface RedFlagMetricRow {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: "%" | "per 18" | "SG";
  direction: "higher" | "lower";
  status: "red" | "watch" | "good";
}
interface RedFlagsRow {
  metrics: RedFlagMetricRow[];
  redCount: number;
  watchCount: number;
  weakestArea?: string;
  weakestAreaSg?: number;
  weakestHole?: string;
  weakestHoleSg?: number;
}
interface RoundShotsResponse {
  shots: boolean;
  holes?: HoleShotsRow[];
  clubs?: ClubRow[];
  dispersion?: DispersionRow[];
  redFlags?: RedFlagsRow;
}

function dGradeFor(avgSG: number, shots: number): { grade: string; color: string } {
  if (shots < 2) return { grade: "–", color: "rgba(34,49,36,0.4)" };
  if (avgSG >= 0.05) return { grade: "A", color: "#3E7A47" };
  if (avgSG >= -0.1) return { grade: "B", color: "#6E9A46" };
  if (avgSG >= -0.25) return { grade: "C", color: "#C0742F" };
  if (avgSG >= -0.4) return { grade: "D", color: "#B0602F" };
  return { grade: "F", color: "#B0433D" };
}

function dSgChip(sg: number): { bg: string; border: string; color: string } {
  if (sg <= -0.5) return { bg: "rgba(176,67,61,0.16)", border: "rgba(176,67,61,0.4)", color: "#8A2F2A" };
  if (sg <= -0.15) return { bg: "rgba(176,67,61,0.07)", border: "rgba(176,67,61,0.22)", color: "#7A4540" };
  if (sg >= 0.3) return { bg: "rgba(62,122,71,0.16)", border: "rgba(62,122,71,0.4)", color: "#2C5A33" };
  if (sg >= 0.1) return { bg: "rgba(62,122,71,0.08)", border: "rgba(62,122,71,0.22)", color: "#3E6A45" };
  return { bg: "rgba(34,49,36,0.04)", border: "rgba(34,49,36,0.12)", color: "rgba(34,49,36,0.65)" };
}

const dSg = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
const dDist = (v: number, u: string | null) => `${v}${u === "ft" ? "ft" : "y"}`;
const dFlagValue = (m: RedFlagMetricRow) => m.unit === "%" ? `${Math.round(m.value)}%` : m.unit === "SG" ? dSg(m.value) : m.value.toFixed(1);

const ShotDetailSection: React.FC<{ roundId: string }> = ({ roundId }) => {
  const data = useJson<RoundShotsResponse>(`/api/round-shots?id=${encodeURIComponent(roundId)}`);
  const [openHole, setOpenHole] = useState<number | null>(null);
  if (data.error || (data.data && !data.data.shots)) return null;
  const holes = data.data?.holes ?? [];
  const clubs = data.data?.clubs ?? [];
  const dispersion = (data.data?.dispersion ?? []).filter((d) => d.attempts >= 2);
  const redFlags = data.data?.redFlags;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
      {redFlags && (
        <div style={{ gridColumn: "1 / -1", borderRadius: 18, padding: 18, background: "linear-gradient(120deg, rgba(176,67,61,0.10), rgba(255,255,255,0.72) 48%, rgba(199,162,75,0.07))", border: "1px solid rgba(176,67,61,0.18)", boxShadow: "0 10px 30px rgba(43,54,45,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 20, alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(34,49,36,0.5)", textTransform: "uppercase", marginBottom: 8 }}>Round diagnostic</div><div style={{ fontFamily: "var(--font-display)", fontSize: 29, lineHeight: 1, color: "#223124" }}>{redFlags.redCount ? `${redFlags.redCount} red flag${redFlags.redCount === 1 ? "" : "s"}` : "Clean card"}</div><div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "rgba(34,49,36,0.56)", marginTop: 7 }}>{redFlags.watchCount} more metric{redFlags.watchCount === 1 ? "" : "s"} to watch</div></div>
              {(redFlags.weakestArea || redFlags.weakestHole) && <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(34,49,36,0.1)" }}>{redFlags.weakestArea && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#223124", marginBottom: 5 }}><span style={{ color: "rgba(34,49,36,0.48)" }}>Biggest leak · </span><b>{redFlags.weakestArea}</b> <span style={{ fontFamily: "'DM Mono',monospace", color: "#B0433D" }}>{redFlags.weakestAreaSg == null ? "" : dSg(redFlags.weakestAreaSg)}</span></div>}{redFlags.weakestHole && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#223124" }}><span style={{ color: "rgba(34,49,36,0.48)" }}>Costliest hole · </span><b>{redFlags.weakestHole}</b> <span style={{ fontFamily: "'DM Mono',monospace", color: "#B0433D" }}>{redFlags.weakestHoleSg == null ? "" : dSg(redFlags.weakestHoleSg)}</span></div>}</div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {redFlags.metrics.filter((m) => m.status !== "good").slice(0, 6).map((m) => { const color = m.status === "red" ? "#B0433D" : "#C0742F"; return <div key={m.key} style={{ borderRadius: 12, padding: "10px 11px", background: m.status === "red" ? "rgba(176,67,61,0.07)" : "rgba(192,116,47,0.06)", border: `1px solid ${m.status === "red" ? "rgba(176,67,61,0.16)" : "rgba(192,116,47,0.14)"}` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}><span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.66)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span><b style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color }}>{dFlagValue(m)}</b></div><div style={{ height: 4, borderRadius: 2, background: "rgba(34,49,36,0.07)", marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, 34 + Math.abs(m.value - m.target) / Math.max(Math.abs(m.target), 1) * 45)}%`, background: color, opacity: 0.76 }} /></div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, color: "rgba(34,49,36,0.4)", marginTop: 5 }}>TARGET {m.target}{m.unit === "%" ? "%" : m.unit === "SG" ? " SG" : " / 18"}</div></div>; })}
            </div>
          </div>
        </div>
      )}
      <CBCard>
        <CBCardTitle sub="Every tracked shot — colored by strokes gained">Shot by shot</CBCardTitle>
        {data.loading ? (
          <Skeleton height={220} />
        ) : (
          holes.map((h) => {
            const diff = h.strokes - h.par;
            const scoreColor = diff >= 2 ? "#B0433D" : diff <= 0 ? "#3E7A47" : "#223124";
            const open = openHole === h.hole;
            return (
              <div key={h.hole} style={{ padding: "10px 0", borderTop: "1px solid rgba(34,49,36,0.1)" }}>
                <button
                  onClick={() => setOpenHole(open ? null : h.hole)}
                  style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7, background: "none", border: "none", padding: 0, cursor: h.gps ? "pointer" : "default", textAlign: "left" }}
                >
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.08em", color: "rgba(34,49,36,0.55)" }}>
                    <span style={{ color: "#1B2A1D", fontWeight: 600, fontSize: 13 }}>{h.hole}</span> · PAR {h.par}
                    {h.gps && (
                      <span style={{ marginLeft: 8, color: open ? "#8A7A52" : "rgba(34,49,36,0.4)", fontSize: 10 }}>
                        {open ? "▾ MAP" : "▸ MAP"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5 }}>
                    <span style={{ color: scoreColor, fontWeight: 600 }}>
                      {h.strokes} ({diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff})
                    </span>
                    <span style={{ color: h.sg < -0.4 ? "#B0433D" : h.sg > 0.2 ? "#3E7A47" : "rgba(34,49,36,0.5)", marginLeft: 8 }}>
                      SG {dSg(h.sg)}
                    </span>
                  </div>
                </button>
                {open && h.gps && (
                  <div style={{ marginBottom: 9 }}>
                    <ShotHoleMap shots={h.shots} pin={h.pin} height={300} />
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {h.shots.map((s) => {
                    const t = dSgChip(s.sg);
                    return (
                      <span
                        key={s.seq}
                        title={`Shot ${s.seq}: ${s.club} from ${s.lie}, ${dDist(s.dist, s.distUnit)}${s.rem == null ? ", holed" : ` → ${dDist(s.rem, s.remUnit)} left`} · SG ${dSg(s.sg)}`}
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 10.5,
                          padding: "4px 8px",
                          borderRadius: 8,
                          background: t.bg,
                          border: "1px solid " + t.border,
                          color: t.color,
                          whiteSpace: "nowrap",
                          cursor: "default",
                        }}
                      >
                        {s.club} · {s.lie === "Green" ? dDist(s.dist, s.distUnit) : `${s.lie.toLowerCase()} ${dDist(s.dist, s.distUnit)}`}
                        {s.rem == null ? " ⛳" : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CBCard>

      <CBCard>
        <CBCardTitle sub="Strokes gained per club vs a 20-handicap baseline">Club report card</CBCardTitle>
        {data.loading ? (
          <Skeleton height={220} />
        ) : (
          <>
            {clubs.map((c) => {
              const g = dGradeFor(c.avgSG, c.shots);
              const barW = Math.min(100, Math.abs(c.totalSG) * 24);
              return (
                <div key={c.club} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid rgba(34,49,36,0.08)" }}>
                  <div style={{ flex: "0 0 92px", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600, color: "#223124", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.label}
                  </div>
                  <div style={{ flex: "0 0 18px", fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "rgba(34,49,36,0.5)", textAlign: "right" }}>
                    {c.shots}
                  </div>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(34,49,36,0.07)", overflow: "hidden", display: "flex", justifyContent: c.totalSG < 0 ? "flex-end" : "flex-start" }}>
                    <div style={{ width: `${barW}%`, height: "100%", borderRadius: 3, background: c.totalSG < 0 ? "#B0433D" : "#3E7A47" }} />
                  </div>
                  <div style={{ flex: "0 0 44px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11, color: c.totalSG < 0 ? "#B0433D" : "#3E7A47" }}>
                    {dSg(c.totalSG)}
                  </div>
                  <div style={{ flex: "0 0 22px", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: g.color }}>
                    {g.grade}
                  </div>
                </div>
              );
            })}
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: "rgba(34,49,36,0.45)", paddingTop: 8, lineHeight: 1.4 }}>
              Shots column = attempts this round. Grades need 2+ shots.
            </div>

            {dispersion.length > 0 && (
              <>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(34,49,36,0.5)", textTransform: "uppercase", margin: "18px 0 4px" }}>
                  Dispersion — where shots finished
                </div>
                {dispersion.map((d) => (
                  <div key={d.club} style={{ padding: "8px 0", borderTop: "1px solid rgba(34,49,36,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "#223124" }}>
                        {d.label}
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(34,49,36,0.5)", marginLeft: 7 }}>
                          {d.attempts}{d.avgDistYds ? ` · ${d.avgDistYds}y` : ""}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(34,49,36,0.6)" }}>
                        {d.accuracyPct != null ? `${d.accuracyPct}% on target` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 2, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                      {d.landed.fairway > 0 && <div style={{ flex: d.landed.fairway, height: 6, background: "#3E7A47" }} />}
                      {d.landed.green > 0 && <div style={{ flex: d.landed.green, height: 6, background: "#6E9A46" }} />}
                      {d.landed.holed > 0 && <div style={{ flex: d.landed.holed, height: 6, background: "#C7A24B" }} />}
                      {d.landed.rough > 0 && <div style={{ flex: d.landed.rough, height: 6, background: "#B0433D" }} />}
                      {d.landed.other > 0 && <div style={{ flex: d.landed.other, height: 6, background: "rgba(34,49,36,0.2)" }} />}
                    </div>
                    {d.avgOffsetYds != null && (
                      <div style={{ position: "relative", height: 26, margin: "7px 1px 5px", borderRadius: 13, background: "linear-gradient(90deg, rgba(176,67,61,0.08), rgba(62,122,71,0.10) 50%, rgba(176,67,61,0.08))", border: "1px solid rgba(34,49,36,0.07)", overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: "50%", top: 3, bottom: 3, width: 1, background: "rgba(199,162,75,0.8)" }} />
                        {(d.offsetsYds ?? []).map((offset, i) => { const span = Math.max(15, ...(d.offsetsYds ?? []).map((v) => Math.abs(v))); return <span key={i} title={`${offset > 0 ? "+" : ""}${offset}y`} style={{ position: "absolute", left: `${50 + (offset / span) * 43}%`, top: 6 + (i % 3) * 4, width: 5, height: 5, borderRadius: "50%", transform: "translateX(-50%)", background: offset < 0 ? "#C0742F" : "#B0433D", border: "1px solid rgba(255,255,255,0.75)" }} />; })}
                        <span style={{ position: "absolute", left: 5, bottom: 1, fontFamily: "'DM Mono',monospace", fontSize: 7.5, color: "rgba(34,49,36,0.35)" }}>L</span><span style={{ position: "absolute", right: 5, bottom: 1, fontFamily: "'DM Mono',monospace", fontSize: 7.5, color: "rgba(34,49,36,0.35)" }}>R</span>
                      </div>
                    )}
                    {d.avgOffsetYds != null && (
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: "rgba(34,49,36,0.5)" }}>
                        miss {d.avgOffsetYds}y avg ·{" "}
                        {d.biasYds != null && Math.abs(d.biasYds) >= 3
                          ? `${Math.abs(d.biasYds)}y ${d.biasYds < 0 ? "left" : "right"} bias`
                          : "no strong bias"}
                        {d.leftPct != null ? ` · L${d.leftPct}% / R${d.rightPct}%` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </CBCard>
    </div>
  );
};

// ── Round detail (scorecard + debrief) ──────────────────────
interface RoundDetailViewProps {
  roundId: string;
  onBack: () => void;
}

const RoundDetailView: React.FC<RoundDetailViewProps> = ({ roundId, onBack }) => {
  const rounds = useJson<RoundListItem[]>("/api/rounds");
  const debrief = useJson<DebriefResponse>(`/api/debrief?roundId=${encodeURIComponent(roundId)}&style=${encodeURIComponent(getCoachStyle())}`);

  const round = useMemo(() => (rounds.data ?? []).find((r) => r.id === roundId) ?? null, [rounds.data, roundId]);

  const loading = rounds.loading || debrief.loading;

  if (!loading && !round) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <CBCard>
          <EmptyState title="Round not found" body="This round may have been removed. Go back and pick another one." />
        </CBCard>
      </div>
    );
  }

  const holes = round?.holes ?? [];
  const front = holes.slice(0, 9);
  const back = holes.slice(9);
  const out = front.reduce((a, b) => a + b, 0);
  const inn = back.reduce((a, b) => a + b, 0);

  const d = debrief.data;
  const blowUps = d?.blowUps ?? [];
  const blowUpCount = d?.blowUpCount ?? countBlowUps(holes);
  const damage = d?.blowUpStrokesOverBogey ?? 0;
  const worstHole = blowUps.length ? [...blowUps].sort((a, b) => b.score - a.score)[0] : null;

  return (
    <div>
      <BackButton onBack={onBack} />

      {loading || !round ? (
        <Skeleton height={60} style={{ marginBottom: 22 }} />
      ) : (
        <CBPageHead
          eyebrow={fmtDateLong(round.date).toUpperCase()}
          title={round.course || "Unknown course"}
          sub={`${round.holeCount} holes${round.complete ? "" : " · incomplete"}${round.shotScope ? ` · ${round.shotScope.shots} shots tracked (Shot Scope)` : ""}`}
          right={
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 46, fontWeight: 600, color: "#1B2A1D", lineHeight: 0.9 }}>
                {round.total}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "rgba(34,49,36,0.55)", marginTop: 4 }}>
                {round.holeCount >= 18 ? `FRONT ${round.front9} · BACK ${round.back9}` : `TOTAL ${round.total}`}
              </div>
            </div>
          }
        />
      )}

      {!loading && round?.shotScope && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {(
            [
              ["Tee shots", round.shotScope.sgTee],
              ["Approaches", round.shotScope.sgApproach],
              ["Short game", round.shotScope.sgShort],
              ["Putting", round.shotScope.sgPutting],
            ] as [string, number | undefined][]
          ).map(([lbl, v]) => {
            const has = typeof v === "number" && !Number.isNaN(v);
            const color = !has ? "rgba(34,49,36,0.45)" : (v as number) > 0 ? "#3E7A47" : (v as number) < 0 ? "#B0433D" : "#223124";
            return (
              <div key={lbl} style={{ background: "#FDFBF5", border: "1px solid rgba(34,49,36,0.12)", borderRadius: 14, padding: "13px 16px" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.12em", color: "rgba(34,49,36,0.5)", textTransform: "uppercase", marginBottom: 6 }}>
                  {lbl}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color, lineHeight: 1 }}>
                  {has ? `${(v as number) > 0 ? "+" : ""}${(v as number).toFixed(2)}` : "—"}
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: "rgba(34,49,36,0.45)", marginTop: 4 }}>
                  strokes gained
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* scorecard */}
        <CBCard>
          <CBCardTitle sub="Colored by absolute score — blow-ups (7+) filled solid">Scorecard</CBCardTitle>
          {loading ? (
            <Skeleton height={200} />
          ) : holes.length === 0 ? (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)", padding: "8px 0" }}>
              Hole-by-hole scores aren&apos;t available for this round.
            </div>
          ) : (
            <>
              {front.length > 0 && (
                <>
                  <NineStrip label="OUT" holes={front} startAt={0} total={out} />
                  {back.length > 0 && <div style={{ height: 16 }} />}
                </>
              )}
              {back.length > 0 && <NineStrip label="IN" holes={back} startAt={9} total={inn} />}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 26,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                }}
              >
                {back.length > 0 && <TotBox label="OUT" v={out} />}
                {back.length > 0 && <TotBox label="IN" v={inn} />}
                <TotBox label="TOTAL" v={round?.total ?? out + inn} big />
              </div>
            </>
          )}
        </CBCard>

        {/* debrief */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CBCard>
            <CBCardTitle>The debrief</CBCardTitle>
            {debrief.loading ? (
              <Skeleton height={100} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MiniStat n={blowUpCount} label="blow-up holes" color="#B0433D" />
                <MiniStat n={"+" + damage} label="strokes over bogey" color="#C0742F" />
                <MiniStat
                  n={worstHole ? "#" + worstHole.hole : "—"}
                  label={worstHole ? `worst hole (${worstHole.score})` : "no blow-ups"}
                  color="#C0742F"
                />
                <MiniStat n={d?.scoring?.bogeys ?? "—"} label="bogeys" color="#8A7A52" />
              </div>
            )}
          </CBCard>
          <div
            style={{
              background: "linear-gradient(165deg,#0C4030,#08301F)",
              borderRadius: 16,
              border: "1px solid rgba(199,162,75,0.28)",
              padding: 20,
              color: "#F2ECDC",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <IconFlag size={16} stroke="var(--gold)" />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.14em", color: "var(--gold)" }}>
                COACH READ THIS ROUND
              </span>
            </div>
            {debrief.loading ? (
              <Skeleton height={54} style={{ background: "rgba(242,236,220,0.08)" }} />
            ) : (
              <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: "rgba(242,236,220,0.9)" }}>
                {d?.coachNote || d?.headline || "Log a few more rounds and your coach's note will show up here."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shot-by-shot + club report card (Shot Scope rounds) */}
      {!loading && round?.shotScope && <ShotDetailSection roundId={round.id} />}
    </div>
  );
};

const BackButton: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <button
    onClick={onBack}
    className="cb-back"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "rgba(34,49,36,0.65)",
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 13.5,
      fontWeight: 500,
      padding: "4px 8px 4px 0",
      marginBottom: 14,
    }}
  >
    <IconArrowL size={18} stroke="currentColor" sw={2} /> All rounds
  </button>
);

// Design-faithful "Nine" scorecard strip, adapted to color by absolute score
// (no per-hole par in the API) instead of vs-par, matching DesktopHoleStrip's
// convention (blow-up = score >= 7).
const NineStrip: React.FC<{ label: string; holes: number[]; startAt: number; total: number }> = ({ label, holes, startAt, total }) => (
  <div>
    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
      <HeadCell w={30}>HOLE</HeadCell>
      {holes.map((_, i) => (
        <HeadCell key={i}>{startAt + i + 1}</HeadCell>
      ))}
      <HeadCell w={38}>{label}</HeadCell>
    </div>
    <div style={{ display: "flex", gap: 4 }}>
      <div style={{ width: 30, flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        <DesktopHoleStrip round={{ holes }} cellH={34} showNums={false} />
      </div>
      <div
        style={{
          width: 38,
          flexShrink: 0,
          height: 34,
          borderRadius: 7,
          display: "grid",
          placeItems: "center",
          background: "rgba(11,61,46,0.06)",
          fontFamily: "'DM Mono',monospace",
          fontSize: 14,
          fontWeight: 600,
          color: "#1B2A1D",
        }}
      >
        {total}
      </div>
    </div>
  </div>
);

const HeadCell: React.FC<{ children: React.ReactNode; w?: number }> = ({ children, w }) => (
  <div
    style={{
      flex: w ? "0 0 " + w + "px" : 1,
      width: w,
      textAlign: "center",
      fontFamily: "'DM Mono',monospace",
      fontSize: 10,
      letterSpacing: "0.06em",
      color: "rgba(34,49,36,0.45)",
    }}
  >
    {children}
  </div>
);

const TotBox: React.FC<{ label: string; v: number; big?: boolean }> = ({ label, v, big }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(34,49,36,0.5)" }}>{label}</div>
    <div style={{ fontFamily: "var(--font-display)", fontSize: big ? 30 : 22, fontWeight: 600, color: "#1B2A1D", marginTop: 3 }}>{v}</div>
  </div>
);

const MiniStat: React.FC<{ n: React.ReactNode; label: string; color?: string }> = ({ n, label, color }) => (
  <div style={{ background: "rgba(11,61,46,0.03)", border: "1px solid var(--line)", borderRadius: 12, padding: "13px 14px" }}>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, color: color || "#1B2A1D", lineHeight: 1 }}>{n}</div>
    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.55)", marginTop: 6 }}>{label}</div>
  </div>
);

// ── Import modal ─────────────────────────────────────────────
type ImportStage = "drop" | "importing" | "done" | "error";

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const [stage, setStage] = useState<ImportStage>("drop");
  const [result, setResult] = useState<{ added: number; updated: number; courses: number } | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const courseVerify = useCourseVerify();

  // Same request contract as app/components/UploadView.tsx's handleImport:
  // read the file as text, JSON.parse it, POST the raw archive object to
  // /api/import-18birdies, and read back { added, updated, courses, courseNames }.
  const handleFile = useCallback(
    async (file: File) => {
      setStage("importing");
      setErrMsg("");
      try {
        const text = await file.text();
        const archive = JSON.parse(text);
        const res = await fetch("/api/import-18birdies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(archive),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Import failed");
        const { added, updated, courses, courseNames } = data as {
          added: number;
          updated: number;
          courses: number;
          courseNames?: string[];
        };
        setResult({ added, updated, courses });
        setStage("done");
        onImported();
        if (added > 0) {
          // Non-blocking: a USGA outage here never affects the import result
          // already applied above (rounds/refresh flow proceeds unchanged).
          courseVerify.start(courseNames ?? []);
        }
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : "Could not read that file");
        setStage("error");
      }
    },
    [onImported, courseVerify]
  );

  return (
    <div onClick={onClose} style={overlayStyle}>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          background: "var(--paper)",
          borderRadius: 18,
          border: "1px solid var(--line)",
          boxShadow: "0 30px 80px -20px rgba(6,30,20,0.6)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "#1B2A1D" }}>
            Import from 18Birdies
          </div>
          <button onClick={onClose} className="cb-icon-btn" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, borderRadius: 8 }}>
            <IconClose size={19} stroke="rgba(34,49,36,0.5)" />
          </button>
        </div>
        <div style={{ padding: 22 }}>
          {stage === "drop" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                className="cb-drop"
                style={{
                  cursor: "pointer",
                  borderRadius: 14,
                  border: "1.5px dashed " + hexA("#C0912F", 0.5),
                  background: hexA("#C0912F", 0.05),
                  padding: "34px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: hexA("#C0912F", 0.14),
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 14px",
                  }}
                >
                  <IconImport size={26} stroke="var(--gold-ink)" />
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "#1B2A1D" }}>
                  Drop your <span style={{ fontFamily: "'DM Mono',monospace" }}>export.json</span>
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.55)", marginTop: 5 }}>
                  Profile → Settings → Account → Download Your Account Data, in the 18Birdies app
                </div>
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 12,
                  color: "rgba(34,49,36,0.5)",
                  marginTop: 14,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                This is the primary way rounds enter Caddie Book. Re-importing later only adds new rounds — nothing is duplicated.
              </div>
            </>
          )}
          {stage === "importing" && (
            <div style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600, color: "#1B2A1D" }}>
                  Reading 18Birdies export…
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 7, background: "rgba(11,61,46,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: "60%",
                    background: "var(--gold)",
                    borderRadius: 7,
                    animation: "cbSkeleton 1.1s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}
          {stage === "done" && result && (
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  background: hexA("#3E8F63", 0.16),
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 12px",
                }}
              >
                <IconCheck size={26} stroke="#3E8F63" sw={2.2} />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "#1B2A1D" }}>
                {result.added > 0 ? `${result.added} round${result.added === 1 ? "" : "s"} imported` : "You're all caught up"}
              </div>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(34,49,36,0.6)", margin: "8px 0 18px", lineHeight: 1.5 }}>
                {result.added > 0
                  ? `${result.updated} already up to date · ${result.courses} courses. Your bag grades and insights are up to date.`
                  : "No new rounds since your last export."}
              </p>

              {courseVerify.hasWork && (
                <div style={{ textAlign: "left" }}>
                  <CourseVerifyCard
                    theme="parchment"
                    items={courseVerify.items}
                    onPickCandidate={courseVerify.pickCandidate}
                    onPickTee={(courseName, tee) => courseVerify.apply(courseName, tee)}
                    onApplyTips={(courseName, edited) => courseVerify.applyTips(courseName, edited)}
                    onSkip={courseVerify.skip}
                    onSkipAll={courseVerify.skipAll}
                    onRetry={courseVerify.retry}
                  />
                </div>
              )}

              <button onClick={onClose} style={{ ...importBtnStyle, width: "100%", justifyContent: "center", marginTop: courseVerify.hasWork ? 16 : 0 }}>
                See your rounds
              </button>
            </div>
          )}
          {stage === "error" && (
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  background: hexA("#B0433D", 0.16),
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 12px",
                }}
              >
                <IconClose size={24} stroke="#B0433D" sw={2.2} />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "#1B2A1D" }}>Couldn&apos;t import that file</div>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "rgba(34,49,36,0.6)", margin: "8px 0 18px", lineHeight: 1.5 }}>
                {errMsg || "Make sure this is your 18Birdies account-data JSON export."}
              </p>
              <button onClick={() => setStage("drop")} style={{ ...importBtnStyle, width: "100%", justifyContent: "center" }}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6,26,18,0.55)",
  backdropFilter: "blur(3px)",
  display: "grid",
  placeItems: "center",
  zIndex: 100,
  padding: 20,
};

const importBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--ink)",
  color: "#F2ECDC",
  border: "none",
  borderRadius: 11,
  padding: "10px 16px",
  cursor: "pointer",
  fontFamily: "'DM Sans',sans-serif",
  fontSize: 13,
  fontWeight: 600,
};

// ── Top-level page: owns list/detail routing + import modal ────
type View = { name: "list" } | { name: "detail"; roundId: string };

export const DesktopRounds: React.FC = () => {
  const [view, setView] = useState<View>({ name: "list" });
  const [showImport, setShowImport] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleImported = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  return (
    <div key={refreshTick}>
      {view.name === "list" ? (
        <RoundsTable onOpenRound={(id) => setView({ name: "detail", roundId: id })} onImport={() => setShowImport(true)} />
      ) : (
        <RoundDetailView roundId={view.roundId} onBack={() => setView({ name: "list" })} />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
};

export default DesktopRounds;

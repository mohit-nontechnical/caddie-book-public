"use client";

// Caddie Book desktop — Courses page, wired to real data.
// Ported from docs/design/caddie-pages-courses.jsx: a ranked course list on
// the left (name, city, rounds, scoring avg, rating/slope, strokes-gained-ish
// over/under performance) and a Leaflet map on the right with pins for every
// played course, synced selection between list <-> map, plus a per-course
// rounds detail panel.
//
// Data joins (three independent API routes + one static geo table):
//   /api/stats            -> per-course rounds/avg18/best18 (app/api/stats/route.ts)
//   /api/handicap         -> per-course rating/slope (app/api/handicap/route.ts, `courses[]`)
//   /api/strokes-gained   -> per-course avgSG (over/under performance vs. potential)
//   lib/course-geo.ts     -> lat/lng lookup via geoFor(name), keyed by normCourse()
//   /api/rounds           -> filtered by course name for the detail panel's round list
//
// Leaflet pattern: copied faithfully from app/components/CourseMap.tsx — the
// `leaflet` package is ONLY ever imported via `await import("leaflet")` inside
// a useEffect. A top-level `import leaflet` breaks the Next build because
// Leaflet touches `window` at module-eval time. Only `leaflet/dist/leaflet.css`
// is safe to import at the top (pure CSS, no JS execution).
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet"; // type-only import — erased at build, no runtime `window` access
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CBCard, CBPageHead } from "./DesktopUI";
import { IconCourses } from "./DesktopIcons";
import type { HandicapResponse, RoundListItem, StatsResponse, StrokesGainedResponse } from "./types";
import { geoFor } from "@/lib/course-geo";
import { normCourse } from "@/lib/course-ratings";
import { CourseStrategyCard } from "../CourseStrategyCard";
import { useCoachStyle } from "../useCoachStyle";

// ── data loading (same useJson pattern as DesktopDashboard) ──────────────
interface LoadState<T> {
  data: T | null;
  loading: boolean;
}

function useJson<T>(url: string): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true });
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

// ── joined course row ─────────────────────────────────────────────────────
interface CourseRow {
  id: string; // normCourse(name), stable key
  name: string;
  city: string | null;
  rounds: number;
  avg: number | null; // avg18 from /api/stats
  best: number | null;
  rating: number | null;
  slope: number | null;
  estimated: boolean;
  sg: number | null; // avgSG from /api/strokes-gained byCourse (>= 2 rounds only there)
  lat: number | null;
  lng: number | null;
}

// City isn't tracked anywhere in the real data model (unlike the design's
// demo data, which has a `city` field baked in) — course names in this app's
// store are plain strings like "Shoreline Golf Links". We don't fabricate a
// city, so the list gracefully omits it when unknown.
function cityFromName(): string | null {
  return null;
}

// pin/rank color, ported from the design's pinColor() — buckets on
// strokes-gained-style "sg" (positive = losing strokes vs. your average).
function sgColor(sg: number | null): string {
  if (sg == null) return "#8A7A52"; // neutral/unknown — not enough rounds for SG yet
  if (sg <= -3) return "#B0433D";
  if (sg < 0) return "#C0742F";
  if (sg < 3) return "#C0912F";
  return "#3E8F63";
}

type SortKey = "avg" | "rounds" | "sg" | "name";

export const DesktopCourses: React.FC = () => {
  const stats = useJson<StatsResponse>("/api/stats");
  const handicap = useJson<HandicapResponse>("/api/handicap");
  const sg = useJson<StrokesGainedResponse>("/api/strokes-gained");
  const rounds = useJson<RoundListItem[]>("/api/rounds");
  const [coachStyle] = useCoachStyle();

  const anyLoading = stats.loading || handicap.loading || sg.loading;

  // ── join the three sources + static geo table ──────────────────────────
  const courses: CourseRow[] = useMemo(() => {
    const statsCourses = stats.data?.courses ?? [];
    const ratingByNorm = new Map((handicap.data?.courses ?? []).map((c) => [c.norm, c]));
    const sgByNorm = new Map((sg.data?.byCourse ?? []).map((c) => [normCourse(c.course), c]));

    return statsCourses
      .filter((c) => c.rounds18 > 0) // only courses with at least one complete 18-hole round belong on this page
      .map((c) => {
        const rating = ratingByNorm.get(c.norm);
        const sgRow = sgByNorm.get(c.norm);
        const coords = geoFor(c.name);
        return {
          id: c.norm,
          name: c.name,
          city: cityFromName(),
          rounds: c.rounds,
          avg: c.avg18,
          best: c.best18,
          rating: rating?.rating ?? null,
          slope: rating?.slope ?? null,
          estimated: rating?.estimated ?? true,
          sg: sgRow?.avgSG ?? null,
          lat: coords ? coords[0] : null,
          lng: coords ? coords[1] : null,
        };
      });
  }, [stats.data, handicap.data, sg.data]);

  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const ranked = useMemo(() => {
    const list = [...courses];
    list.sort((a, b) => {
      if (sortKey === "avg") return (a.avg ?? 999) - (b.avg ?? 999);
      if (sortKey === "rounds") return b.rounds - a.rounds;
      if (sortKey === "sg") return (b.sg ?? -999) - (a.sg ?? -999);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [courses, sortKey]);

  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    // default-select the top-ranked course once data lands, without
    // clobbering a selection the user already made.
    if (!sel && ranked.length > 0) setSel(ranked[0].id);
  }, [ranked, sel]);

  const selC = ranked.find((c) => c.id === sel) ?? null;

  const mappable = useMemo(() => courses.filter((c) => c.lat != null && c.lng != null), [courses]);
  const unmapped = useMemo(() => courses.filter((c) => c.lat == null || c.lng == null), [courses]);

  const selRoundsForCourse = useMemo(() => {
    if (!selC || !rounds.data) return [];
    return rounds.data.filter((r) => normCourse(r.course) === selC.id).sort((a, b) => b.date.localeCompare(a.date));
  }, [selC, rounds.data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 560 }}>
      <CBPageHead
        eyebrow="THE PORTFOLIO"
        title="Courses"
        sub={
          courses.length > 0
            ? `All ${courses.length} course${courses.length === 1 ? "" : "s"} you've played, ranked by how you score them.`
            : "Import rounds to see every course you've played, ranked and mapped."
        }
      />

      {anyLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
          <Skeleton height={420} />
          <Skeleton height={420} />
        </div>
      ) : courses.length === 0 ? (
        <CBCard>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(199,162,75,0.14)", display: "grid", placeItems: "center" }}>
              <IconCourses size={22} stroke="var(--gold-ink)" />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "#1B2A1D" }}>No courses yet</div>
            <p style={{ margin: 0, maxWidth: 420, fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "rgba(34,49,36,0.6)", lineHeight: 1.5 }}>
              Import your 18Birdies rounds to see every course you&apos;ve played, ranked by scoring average and mapped out.
            </p>
          </div>
        </CBCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
          {/* ranked list */}
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingRight: 4 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(34,49,36,0.5)" }}>
                RANKED BY
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {(
                  [
                    ["avg", "AVG"],
                    ["rounds", "ROUNDS"],
                    ["sg", "SG"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key)}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 7,
                      padding: "4px 9px",
                      background: sortKey === key ? "var(--paper)" : "transparent",
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: sortKey === key ? "#1B2A1D" : "rgba(34,49,36,0.45)",
                      boxShadow: sortKey === key ? "0 1px 2px rgba(11,61,46,0.12)" : "none",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="cb-scroll"
              style={{
                overflowY: "auto",
                minHeight: 0,
                flex: 1,
                paddingRight: 4,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {ranked.map((c, i) => {
                const on = c.id === sel;
                const col = sgColor(c.sg);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSel(c.id)}
                    className="cb-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 13,
                      textAlign: "left",
                      cursor: "pointer",
                      width: "100%",
                      background: on ? "var(--paper)" : "var(--paper-dim)",
                      borderRadius: 13,
                      padding: "12px 14px",
                      border: "1px solid " + (on ? "var(--gold)" : "var(--line)"),
                      boxShadow: on ? "0 4px 14px -8px rgba(11,61,46,0.4)" : "none",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "rgba(34,49,36,0.4)", width: 20, flexShrink: 0 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ width: 9, height: 9, borderRadius: 9, background: col, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontFamily: "'DM Sans',sans-serif",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#1B2A1D",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.name}
                      </span>
                      <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "rgba(34,49,36,0.5)", marginTop: 2 }}>
                        {c.rating != null && c.slope != null ? `${c.rating.toFixed(1)} / ${c.slope}` : "rating unknown"} · {c.rounds} rd
                        {c.lat == null && " · unmapped"}
                      </span>
                    </span>
                    <span style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 17, fontWeight: 500, color: "#1B2A1D" }}>
                        {c.avg != null ? c.avg.toFixed(1) : "—"}
                      </span>
                      <span style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 10, color: col, marginTop: 1 }}>
                        {c.sg == null ? "n/a" : (c.sg > 0 ? "+" : "") + c.sg.toFixed(1)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* map */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
            <CoursesMapPane courses={mappable} selectedId={sel} onSelect={setSel} selC={selC} />
            {unmapped.length > 0 && (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(34,49,36,0.5)" }}>
                {unmapped.length} course{unmapped.length === 1 ? "" : "s"} not shown on the map (no coordinates on file):{" "}
                {unmapped.map((c) => c.name).join(", ")}
              </div>
            )}

            {/* per-course rounds detail panel */}
            {selC && (
              <CBCard style={{ flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "#1B2A1D" }}>{selC.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "rgba(34,49,36,0.5)", marginTop: 3 }}>
                      {selRoundsForCourse.length} logged round{selRoundsForCourse.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                {rounds.loading ? (
                  <Skeleton height={80} />
                ) : selRoundsForCourse.length === 0 ? (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.5)" }}>
                    No individual round records found for this course.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 168, overflowY: "auto" }} className="cb-scroll">
                    {selRoundsForCourse.map((r) => (
                      <div
                        key={r.id}
                        className="cb-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: 9,
                          border: "1px solid var(--line)",
                        }}
                      >
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: "rgba(34,49,36,0.75)" }}>
                          {new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {!r.complete && (
                            <span style={{ marginLeft: 8, fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: "rgba(34,49,36,0.4)" }}>incomplete</span>
                          )}
                        </span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: "#1B2A1D" }}>{r.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CBCard>
            )}

            {selC && <CourseStrategyCard theme="parchment" course={selC.name} style={coachStyle} />}
          </div>
        </div>
      )}
    </div>
  );
};

// ── map pane ───────────────────────────────────────────────────────────
interface MapCourse {
  id: string;
  name: string;
  city: string | null;
  rounds: number;
  avg: number | null;
  sg: number | null;
  lat: number | null;
  lng: number | null;
}

interface CoursesMapPaneProps {
  courses: MapCourse[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selC: CourseRow | null;
}

const CoursesMapPane: React.FC<CoursesMapPaneProps> = ({ courses, selectedId, onSelect, selC }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Record<string, Leaflet.CircleMarker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Init the map once, lazily importing Leaflet client-side only — this is
  // the exact pattern from app/components/CourseMap.tsx. A top-level
  // `import leaflet` breaks the Next build with "window is not defined"
  // because Leaflet touches `window`/`document` at module-eval time.
  useEffect(() => {
    if (courses.length === 0) return;
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el || mapRef.current) return;

      const map = L.map(el, { zoomControl: true, scrollWheelZoom: true, attributionControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      const latlngs: Leaflet.LatLng[] = [];
      const markers: Record<string, Leaflet.CircleMarker> = {};

      for (const c of courses) {
        if (c.lat == null || c.lng == null) continue;
        const ll = L.latLng(c.lat, c.lng);
        latlngs.push(ll);
        const col = sgColor(c.sg);
        const m = L.circleMarker(ll, {
          radius: 6 + Math.min(6, c.rounds),
          color: "#fff",
          weight: 1.5,
          fillColor: col,
          fillOpacity: 0.9,
        }).addTo(map);
        const avgLabel = c.avg != null ? `${c.avg.toFixed(1)} avg` : "avg n/a";
        m.bindTooltip(`<b>${c.name}</b><br>${avgLabel} · ${c.rounds} round${c.rounds === 1 ? "" : "s"}`, {
          direction: "top",
          offset: [0, -4],
        });
        m.on("click", () => onSelectRef.current(c.id));
        markers[c.id] = m;
      }
      markersRef.current = markers;

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 11);
      } else if (latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
      } else {
        map.setView([37.55, -122.15], 9);
      }
      setTimeout(() => map.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  // fly to selected + emphasise pin, synced from list clicks.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const c = courses.find((x) => x.id === selectedId);
    const marker = markersRef.current[selectedId];
    if (c && c.lat != null && c.lng != null) {
      map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
    }
    Object.entries(markersRef.current).forEach(([id, m]) => {
      m.setStyle({
        weight: id === selectedId ? 3.5 : 1.5,
        color: id === selectedId ? "#0B3D2E" : "#fff",
        fillOpacity: id === selectedId ? 1 : 0.85,
      });
    });
    if (marker) marker.bringToFront();
  }, [selectedId, courses]);

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", flex: 1, minHeight: 420 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {courses.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "var(--panel)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "rgba(34,49,36,0.5)",
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          No mapped courses yet — coordinates aren&apos;t on file for the courses you&apos;ve played.
        </div>
      )}

      {/* selected course overlay card */}
      {selC && (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            zIndex: 500,
            width: 260,
            background: "var(--paper)",
            borderRadius: 13,
            border: "1px solid var(--line)",
            boxShadow: "0 12px 30px -12px rgba(6,30,20,0.5)",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "#1B2A1D", lineHeight: 1.1 }}>{selC.name}</div>
          {selC.city && (
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: "rgba(34,49,36,0.55)", marginTop: 2 }}>{selC.city}</div>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <Ov n={selC.avg != null ? selC.avg.toFixed(1) : "—"} label="AVG" />
            <Ov n={selC.rating != null ? selC.rating.toFixed(1) : "—"} label="RATING" />
            <Ov n={selC.slope ?? "—"} label="SLOPE" />
            <Ov n={selC.rounds} label="ROUNDS" />
          </div>
        </div>
      )}

      {/* legend */}
      <div
        style={{
          position: "absolute",
          right: 14,
          top: 14,
          zIndex: 500,
          background: "var(--paper)",
          borderRadius: 10,
          border: "1px solid var(--line)",
          padding: "9px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {(
          [
            ["#3E8F63", "Play well"],
            ["#C0912F", "Neutral"],
            ["#B0433D", "Struggle"],
          ] as [string, string][]
        ).map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: c }} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: "rgba(34,49,36,0.65)" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Ov: React.FC<{ n: React.ReactNode; label: string }> = ({ n, label }) => (
  <div>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 500, color: "#1B2A1D" }}>{n}</div>
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(34,49,36,0.45)", marginTop: 2 }}>{label}</div>
  </div>
);

export default DesktopCourses;

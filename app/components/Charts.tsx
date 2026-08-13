"use client";

// Interactive charts built on Victory. Loaded lazily (ssr:false) by consumers
// via next/dynamic so Victory stays out of the initial bundle and never runs at
// prerender. Colors are explicit hex (SVG inline styles don't inherit CSS vars).
//
// Reliability notes (learned the hard way — these crashed the Insights tab):
//  • NO VictoryVoronoiContainer. Voronoi over categorical/string x (the bar
//    chart) throws, and the shared container coupled all three charts. Tooltips
//    now live directly on the data marks (scatter points / bars), which Victory
//    wires up automatically when labelComponent is a VictoryTooltip.
//  • NO function-accessor baseline line (`y={() => 0}`). Use explicit 2-point data.
//  • NO `invertAxis` (not a real Victory prop). Score axis shows real numbers.
import React from "react";
import {
  VictoryChart,
  VictoryArea,
  VictoryLine,
  VictoryScatter,
  VictoryAxis,
  VictoryBar,
  VictoryTooltip,
} from "victory";

const GOLD = "#F0C040";
const BAD = "#C05C5C";
const GOOD = "#4CAF82";
const GRID = "rgba(255,255,255,0.07)";
const TEXT = "#8d948d";

const axisStyle = {
  axis: { stroke: GRID },
  tickLabels: { fill: TEXT, fontSize: 8, fontFamily: "IBM Plex Mono, monospace", padding: 4 },
  grid: { stroke: "transparent" },
} as const;

const flyout = {
  flyoutStyle: { fill: "#10231a", stroke: "rgba(240,192,64,0.5)" },
  style: { fill: "#F4F1E8", fontSize: 9, fontFamily: "Inter, sans-serif" },
  cornerRadius: 6,
  flyoutPadding: { top: 5, bottom: 5, left: 9, right: 9 },
  constrainToVisibleArea: true,
} as const;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Strokes-gained per-round trend (line + area, zero baseline) ──
export function SGTrendChart({ data }: { data: { date: string; sg: number }[] }) {
  if (!data || data.length === 0) return null;
  const pts = data.map((d, i) => ({ x: i + 1, y: d.sg, label: `${fmtDate(d.date)} · SG ${d.sg > 0 ? "+" : ""}${d.sg}` }));
  return (
    <VictoryChart height={150} padding={{ top: 12, bottom: 22, left: 30, right: 12 }} domainPadding={{ y: 10 }}>
      <VictoryAxis dependentAxis style={axisStyle} />
      <VictoryAxis style={{ ...axisStyle, tickLabels: { fill: "transparent" } }} />
      <VictoryLine data={[{ x: 1, y: 0 }, { x: pts.length, y: 0 }]} style={{ data: { stroke: GRID, strokeWidth: 1, strokeDasharray: "3,3" } }} />
      <VictoryArea data={pts} interpolation="monotoneX" style={{ data: { fill: "rgba(240,192,64,0.12)", stroke: GOLD, strokeWidth: 2 } }} />
      <VictoryScatter
        data={pts}
        size={3}
        style={{ data: { fill: ({ datum }) => ((datum as { y: number }).y >= 0 ? GOOD : BAD) } }}
        labels={({ datum }) => (datum as { label: string }).label}
        labelComponent={<VictoryTooltip {...flyout} />}
      />
    </VictoryChart>
  );
}

// ── Score trend (line). Real-number axis — a dropping line = improving. ──
export function ScoreTrendChart({ data }: { data: { date: string; score: number }[] }) {
  if (!data || data.length === 0) return null;
  const pts = data.map((d, i) => ({ x: i + 1, y: d.score, label: `${fmtDate(d.date)} · ${d.score}` }));
  return (
    <VictoryChart height={150} padding={{ top: 12, bottom: 22, left: 32, right: 12 }} domainPadding={{ y: 12 }}>
      <VictoryAxis dependentAxis style={axisStyle} />
      <VictoryAxis style={{ ...axisStyle, tickLabels: { fill: "transparent" } }} />
      <VictoryLine data={pts} interpolation="monotoneX" style={{ data: { stroke: GOLD, strokeWidth: 2 } }} />
      <VictoryScatter
        data={pts}
        size={2.8}
        style={{ data: { fill: GOLD } }}
        labels={({ datum }) => (datum as { label: string }).label}
        labelComponent={<VictoryTooltip {...flyout} />}
      />
    </VictoryChart>
  );
}

// ── Scoring distribution (bars). 7+ shown in red. Tooltips live on the bars. ──
export function ScoreDistChart({ data }: { data: { score: string; pct: number; count: number }[] }) {
  if (!data || data.length === 0) return null;
  const bars = data.map((d) => ({
    x: d.score,
    y: d.pct,
    fill: d.score === "7" || d.score === "8" || d.score === "9+" ? BAD : GOLD,
    label: `${d.score}: ${d.count} holes · ${d.pct}%`,
  }));
  return (
    <VictoryChart height={160} padding={{ top: 12, bottom: 26, left: 32, right: 12 }} domainPadding={{ x: 16 }}>
      <VictoryAxis dependentAxis tickFormat={(t: number) => `${t}%`} style={axisStyle} />
      <VictoryAxis style={axisStyle} />
      <VictoryBar
        data={bars}
        cornerRadius={3}
        barRatio={0.85}
        style={{ data: { fill: ({ datum }) => (datum as { fill: string }).fill } }}
        labels={({ datum }) => (datum as { label: string }).label}
        labelComponent={<VictoryTooltip {...flyout} />}
      />
    </VictoryChart>
  );
}

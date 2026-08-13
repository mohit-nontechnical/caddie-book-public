"use client";

// Lazy, prerender-safe, crash-isolated entry points for the Victory charts.
//  • next/dynamic ssr:false → Victory stays out of the initial bundle and the
//    server render (Victory is browser-only).
//  • Each chart is wrapped in an error boundary so a chart failure renders a
//    small fallback instead of crashing the whole Insights tab (which it did).
import React from "react";
import dynamic from "next/dynamic";

const skeleton = (h: number) => () => (
  <div style={{ height: h, borderRadius: 10, background: "rgba(255,255,255,0.04)", animation: "scShimmer 1.4s ease-in-out infinite" }} />
);

class ChartBoundary extends React.Component<{ height: number; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[chart] render failed", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ height: this.props.height, borderRadius: 10, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontFamily: "Inter, sans-serif", fontSize: 11.5, color: "var(--cream-3)" }}>
          Chart unavailable
        </div>
      );
    }
    return this.props.children;
  }
}

const LazySG = dynamic(() => import("./Charts").then((m) => m.SGTrendChart), { ssr: false, loading: skeleton(150) });
const LazyScoreTrend = dynamic(() => import("./Charts").then((m) => m.ScoreTrendChart), { ssr: false, loading: skeleton(150) });
const LazyScoreDist = dynamic(() => import("./Charts").then((m) => m.ScoreDistChart), { ssr: false, loading: skeleton(160) });

export function SGTrendChart(props: { data: { date: string; sg: number }[] }) {
  return (
    <ChartBoundary height={150}>
      <LazySG {...props} />
    </ChartBoundary>
  );
}
export function ScoreTrendChart(props: { data: { date: string; score: number }[] }) {
  return (
    <ChartBoundary height={150}>
      <LazyScoreTrend {...props} />
    </ChartBoundary>
  );
}
export function ScoreDistChart(props: { data: { score: string; pct: number; count: number }[] }) {
  return (
    <ChartBoundary height={160}>
      <LazyScoreDist {...props} />
    </ChartBoundary>
  );
}

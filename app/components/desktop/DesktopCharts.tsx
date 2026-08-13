"use client";

// Caddie Book desktop — pure-SVG chart components (no chart libs).
// Ported/adapted from docs/design/caddie-charts.jsx. Each exported chart is
// wrapped in a small class-based error boundary (pattern copied from
// app/components/ChartsLazy.tsx) so a render failure shows a "Chart
// unavailable" fallback instead of crashing the dashboard.
import React, { useLayoutEffect, useRef, useState } from "react";
import { hexA } from "./DesktopUI";

class ChartBoundary extends React.Component<{ height: number; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[desktop-chart] render failed", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div
          style={{
            height: this.props.height,
            borderRadius: 10,
            border: "1px solid var(--line)",
            display: "grid",
            placeItems: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11.5,
            color: "rgba(34,49,36,0.5)",
          }}
        >
          Chart unavailable
        </div>
      );
    }
    return this.props.children;
  }
}

// measure a container's width (fills responsive cards)
function useMeasure(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface ChartSeries {
  name: string;
  color: string;
  data: number[];
  fmt?: (v: number) => string;
}

interface LineChartInnerProps {
  series: ChartSeries[];
  labels: string[];
  height?: number;
  yMinPad?: number;
  yMaxPad?: number;
}

const LineChartInner: React.FC<LineChartInnerProps> = ({ series, labels, height = 240, yMinPad = 3, yMaxPad = 3 }) => {
  const [wrapRef, W] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 34,
    padR = 14,
    padT = 14,
    padB = 26;
  const H = height;
  const innerW = Math.max(10, W - padL - padR);
  const innerH = H - padT - padB;
  const n = labels.length;

  const all = series.flatMap((s) => s.data);
  let lo = (all.length ? Math.min(...all) : 0) - yMinPad;
  let hi = (all.length ? Math.max(...all) : 1) + yMaxPad;
  if (lo === hi) hi = lo + 1;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;

  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => lo + (i / ticks) * (hi - lo));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - mx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  const line = (s: ChartSeries) => s.data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const area = (s: ChartSeries) =>
    `${line(s)} L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const showTip = hover != null && W > 0;
  const tipX = showTip ? x(hover as number) : 0;
  const tipLeft = Math.min(Math.max(tipX, 70), W - 70);

  if (n === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(34,49,36,0.45)" }}>
        No rounds logged yet.
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={"lg" + i + "-" + s.name.replace(/\W/g, "")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="rgba(11,61,46,0.09)" strokeWidth="1" />
            <text x={padL - 7} y={y(v) + 3.5} textAnchor="end" fontFamily="'DM Mono', monospace" fontSize="9.5" fill="rgba(34,49,36,0.5)">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <g key={i}>
            {series.length === 1 && <path d={area(s)} fill={`url(#lg${i}-${s.name.replace(/\W/g, "")})`} />}
            <path d={line(s)} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        {labels.map((lb, i) => {
          const every = Math.ceil(n / 8);
          if (i % every !== 0 && i !== n - 1) return null;
          return (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontFamily="'DM Mono', monospace" fontSize="9.5" fill="rgba(34,49,36,0.5)">
              {lb}
            </text>
          );
        })}
        {showTip && (
          <g>
            <line x1={tipX} x2={tipX} y1={padT} y2={padT + innerH} stroke="rgba(11,61,46,0.28)" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s, i) => (
              <circle key={i} cx={tipX} cy={y(s.data[hover as number])} r={4.5} fill="#F6F1E6" stroke={s.color} strokeWidth="2.4" />
            ))}
          </g>
        )}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {showTip && (
        <div
          style={{
            position: "absolute",
            top: 6,
            left: tipLeft,
            transform: "translateX(-50%)",
            background: "#0B3D2E",
            color: "#F2ECDC",
            borderRadius: 10,
            padding: "7px 10px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11.5,
            pointerEvents: "none",
            boxShadow: "0 8px 22px -10px rgba(0,0,0,0.55)",
            whiteSpace: "nowrap",
            zIndex: 3,
            border: "1px solid rgba(199,162,75,0.35)",
          }}
        >
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: "0.08em", color: "rgba(242,236,220,0.6)", marginBottom: 4 }}>
            {labels[hover as number]}
          </div>
          {series.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: i ? 3 : 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: s.color, flexShrink: 0 }} />
              <span style={{ opacity: 0.8 }}>{s.name}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", marginLeft: "auto", fontWeight: 500 }}>
                {s.fmt ? s.fmt(s.data[hover as number]) : s.data[hover as number]}
              </span>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div style={{ display: "flex", gap: 16, marginTop: 8, paddingLeft: padL }}>
          {series.map((s, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: "rgba(34,49,36,0.7)" }}>
              <span style={{ width: 12, height: 3, borderRadius: 3, background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const DesktopLineChart: React.FC<LineChartInnerProps> = (props) => (
  <ChartBoundary height={props.height ?? 240}>
    <LineChartInner {...props} />
  </ChartBoundary>
);

export interface BarDatum {
  key: string;
  n: number;
  color: string;
}

interface BarChartInnerProps {
  bars: BarDatum[];
  total: number;
  height?: number;
}

const BarChartInner: React.FC<BarChartInnerProps> = ({ bars, total, height = 190 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.n));
  if (!bars.length || total === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(34,49,36,0.45)" }}>
        No holes logged yet.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height, padding: "0 4px" }}>
      {bars.map((b, i) => {
        const pct = total > 0 ? Math.round((b.n / total) * 100) : 0;
        const barH = (b.n / max) * (height - 46);
        const on = hover === i;
        return (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 8, cursor: "default" }}
          >
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: on ? b.color : "rgba(34,49,36,0.85)", transition: "color 0.15s" }}>
              {pct}
              <span style={{ fontSize: 9.5, opacity: 0.6 }}>%</span>
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: 54,
                height: Math.max(4, barH),
                borderRadius: "7px 7px 3px 3px",
                background: on ? b.color : hexA(b.color, 0.62),
                transition: "height 0.4s cubic-bezier(.2,.8,.3,1), background 0.15s",
                boxShadow: on ? `0 6px 18px -8px ${hexA(b.color, 0.7)}` : "none",
              }}
            />
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(34,49,36,0.8)" }}>{b.key}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: "rgba(34,49,36,0.45)", marginTop: -4 }}>{b.n}</div>
          </div>
        );
      })}
    </div>
  );
};

export const DesktopBarChart: React.FC<BarChartInnerProps> = (props) => (
  <ChartBoundary height={props.height ?? 190}>
    <BarChartInner {...props} />
  </ChartBoundary>
);

interface GaugeProps {
  value: number;
  size?: number;
  color?: string;
  track?: string;
}

const GaugeInner: React.FC<GaugeProps> = ({ value, size = 132, color = "#C0912F", track = "rgba(11,61,46,0.12)" }) => {
  const r = size / 2 - 10,
    cx = size / 2,
    cy = size / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / 100));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth="9" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.2,.8,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 27, fontWeight: 500, color: "#22321f", lineHeight: 1 }}>
          {value}
          <span style={{ fontSize: 14, opacity: 0.55 }}>%</span>
        </div>
      </div>
    </div>
  );
};

export const DesktopGauge: React.FC<GaugeProps> = (props) => (
  <ChartBoundary height={props.size ?? 132}>
    <GaugeInner {...props} />
  </ChartBoundary>
);

// ── Mini hole-by-hole strip ─────────────────────────────
// The real API (app/api/rounds, app/api/debrief) only carries raw per-hole
// strokes — no per-hole par — so unlike the design's vs-par coloring, this
// colors by absolute score against a bogey-golf baseline (5), matching the
// "blow-up = score >= 7" definition already used by /api/debrief.
interface HoleStripRound {
  holes: number[];
}

interface HoleStripProps {
  round: HoleStripRound;
  cellH?: number;
  showNums?: boolean;
}

function scoreColorAbs(score: number): string {
  if (score <= 3) return "#3E8F63";
  if (score === 4) return "#6E9A46";
  if (score === 5) return "#8A7A52";
  if (score === 6) return "#C0742F";
  return "#B0433D";
}

const HoleStripInner: React.FC<HoleStripProps> = ({ round, cellH = 40, showNums = true }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (!round.holes.length) {
    return (
      <div style={{ height: cellH, display: "grid", placeItems: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(34,49,36,0.45)" }}>
        No hole-by-hole data.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {round.holes.map((h, i) => {
          const c = scoreColorAbs(h);
          const blow = h >= 7;
          const on = hover === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              title={`Hole ${i + 1} · ${h}`}
              style={{
                flex: 1,
                position: "relative",
                height: cellH,
                borderRadius: 5,
                cursor: "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: hexA(c, blow ? 0.9 : 0.16),
                border: blow ? "none" : "1px solid " + hexA(c, 0.3),
                outline: on ? "2px solid " + hexA(c, 0.6) : "none",
                outlineOffset: 1,
                transition: "outline 0.1s",
              }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: blow ? "#F6F1E6" : c }}>{h}</span>
              {i === 8 && <span style={{ position: "absolute", right: -3, top: 4, bottom: 4, width: 1, background: "rgba(11,61,46,0.25)" }} />}
            </div>
          );
        })}
      </div>
      {showNums && (
        <div style={{ display: "flex", gap: 3 }}>
          {round.holes.map((_, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: "rgba(34,49,36,0.4)" }}>
              {i + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DesktopHoleStrip: React.FC<HoleStripProps> = (props) => (
  <ChartBoundary height={props.cellH ?? 40}>
    <HoleStripInner {...props} />
  </ChartBoundary>
);

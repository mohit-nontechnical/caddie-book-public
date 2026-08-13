// Caddie Book — chart components (interactive). Attaches to window.
(function () {
  const { useState, useRef, useEffect, useLayoutEffect } = React;
  const hexA = window.CB.hexA;

  // measure a container's width (fills responsive cards)
  function useMeasure() {
    const ref = useRef(null);
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

  // ── Sparkline ───────────────────────────────────────────
  const Sparkline = ({ data, color, w = 80, h = 26, sw = 2, dot = true }) => {
    const min = Math.min(...data) - 4, max = Math.max(...data) + 4;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
      return [x, y];
    });
    const dPath = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    return (
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <path d={dPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        {dot && <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />}
      </svg>
    );
  };

  // ── Interactive Line Chart ──────────────────────────────
  // series: [{ name, color, data:[..], fmt?:(v)=>str }]  labels: [str..]
  const LineChart = ({ series, labels, height = 240, yMinPad = 3, yMaxPad = 3, invertGood, sub }) => {
    const [wrapRef, W] = useMeasure();
    const [hover, setHover] = useState(null); // index
    const padL = 34, padR = 14, padT = 14, padB = 26;
    const H = height;
    const innerW = Math.max(10, W - padL - padR);
    const innerH = H - padT - padB;
    const n = labels.length;

    const all = series.flatMap((s) => s.data);
    let lo = Math.min(...all) - yMinPad, hi = Math.max(...all) + yMaxPad;
    if (lo === hi) hi = lo + 1;
    const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;

    // y gridlines
    const ticks = 4;
    const gridVals = Array.from({ length: ticks + 1 }, (_, i) => lo + (i / ticks) * (hi - lo));

    const onMove = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - r.left;
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - mx); if (d < bd) { bd = d; best = i; } }
      setHover(best);
    };

    const line = (s) => s.data.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const area = (s) => `${line(s)} L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

    const showTip = hover != null && W > 0;
    const tipX = showTip ? x(hover) : 0;
    const tipLeft = Math.min(Math.max(tipX, 70), W - 70);

    return (
      <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={'lg' + i + '-' + s.name.replace(/\W/g, '')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {/* grid */}
          {gridVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="rgba(11,61,46,0.09)" strokeWidth="1" />
              <text x={padL - 7} y={y(v) + 3.5} textAnchor="end" fontFamily="'DM Mono', monospace" fontSize="9.5" fill="rgba(34,49,36,0.5)">{Math.round(v)}</text>
            </g>
          ))}
          {/* areas + lines */}
          {series.map((s, i) => (
            <g key={i}>
              {series.length === 1 && <path d={area(s)} fill={`url(#lg${i}-${s.name.replace(/\W/g, '')})`} />}
              <path d={line(s)} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {/* x labels (sparse) */}
          {labels.map((lb, i) => {
            const every = Math.ceil(n / 8);
            if (i % every !== 0 && i !== n - 1) return null;
            return <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontFamily="'DM Mono', monospace" fontSize="9.5" fill="rgba(34,49,36,0.5)">{lb}</text>;
          })}
          {/* crosshair */}
          {showTip && (
            <g>
              <line x1={tipX} x2={tipX} y1={padT} y2={padT + innerH} stroke="rgba(11,61,46,0.28)" strokeWidth="1" strokeDasharray="3 3" />
              {series.map((s, i) => (
                <circle key={i} cx={tipX} cy={y(s.data[hover])} r={4.5} fill="#F6F1E6" stroke={s.color} strokeWidth="2.4" />
              ))}
            </g>
          )}
          <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent"
            onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
        {showTip && (
          <div style={{
            position: 'absolute', top: 6, left: tipLeft, transform: 'translateX(-50%)',
            background: '#0B3D2E', color: '#F2ECDC', borderRadius: 10, padding: '7px 10px',
            fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, pointerEvents: 'none',
            boxShadow: '0 8px 22px -10px rgba(0,0,0,0.55)', whiteSpace: 'nowrap', zIndex: 3,
            border: '1px solid rgba(199,162,75,0.35)',
          }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: '0.08em', color: 'rgba(242,236,220,0.6)', marginBottom: 4 }}>{labels[hover]}</div>
            {series.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: i ? 3 : 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: 7, background: s.color, flexShrink: 0 }} />
                <span style={{ opacity: 0.8 }}>{s.name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", marginLeft: 'auto', fontWeight: 500 }}>{s.fmt ? s.fmt(s.data[hover]) : s.data[hover]}</span>
              </div>
            ))}
          </div>
        )}
        {/* legend */}
        {series.length > 1 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingLeft: padL }}>
            {series.map((s, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: 'rgba(34,49,36,0.7)' }}>
                <span style={{ width: 12, height: 3, borderRadius: 3, background: s.color }} />{s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Distribution Bar Chart ──────────────────────────────
  const BarChart = ({ bars, total, height = 190 }) => {
    const [hover, setHover] = useState(null);
    const max = Math.max(...bars.map((b) => b.n));
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height, padding: '0 4px' }}>
        {bars.map((b, i) => {
          const pct = Math.round((b.n / total) * 100);
          const barH = (b.n / max) * (height - 46);
          const on = hover === i;
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, cursor: 'default' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: on ? b.color : 'rgba(34,49,36,0.85)', transition: 'color 0.15s' }}>
                {pct}<span style={{ fontSize: 9.5, opacity: 0.6 }}>%</span>
              </div>
              <div style={{ width: '100%', maxWidth: 54, height: Math.max(4, barH), borderRadius: '7px 7px 3px 3px',
                background: on ? b.color : hexA(b.color, 0.62), transition: 'height 0.4s cubic-bezier(.2,.8,.3,1), background 0.15s',
                boxShadow: on ? `0 6px 18px -8px ${hexA(b.color, 0.7)}` : 'none' }} />
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: 'rgba(34,49,36,0.8)' }}>{b.key}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: 'rgba(34,49,36,0.45)', marginTop: -4 }}>{b.n}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Diverging Bar (strokes gained per course) ───────────
  const DivergingBar = ({ items, goodColor = '#3E8F63', badColor = '#B0433D', rowH = 26 }) => {
    // item: { label, value }  positive value = good (gains strokes)
    const [hover, setHover] = useState(null);
    const maxAbs = Math.max(...items.map((it) => Math.abs(it.value)), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => {
          const pos = it.value >= 0;
          const w = (Math.abs(it.value) / maxAbs) * 50; // percent of half-width
          const c = pos ? goodColor : badColor;
          const on = hover === i;
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ display: 'grid', gridTemplateColumns: '128px 1fr 42px', alignItems: 'center', gap: 8, height: rowH, cursor: 'default' }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: on ? '#22321f' : 'rgba(34,49,36,0.7)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: on ? 600 : 400 }}>{it.label}</div>
              <div style={{ position: 'relative', height: '100%' }}>
                <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 1, background: 'rgba(11,61,46,0.18)' }} />
                <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: rowH - 12, borderRadius: 4,
                  background: on ? c : hexA(c, 0.6), transition: 'background 0.15s',
                  ...(pos ? { left: '50%', width: w + '%' } : { right: '50%', width: w + '%' }) }} />
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: c, textAlign: 'right', fontWeight: 500 }}>{pos ? '+' : ''}{it.value}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Bounce-back gauge (donut arc) ───────────────────────
  const Gauge = ({ value, size = 132, color = '#C0912F', track = 'rgba(11,61,46,0.12)', label, sub }) => {
    const r = size / 2 - 10, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, value / 100));
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth="9" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.2,.8,.3,1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 27, fontWeight: 500, color: '#22321f', lineHeight: 1 }}>{value}<span style={{ fontSize: 14, opacity: 0.55 }}>%</span></div>
          {label && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: 'rgba(34,49,36,0.55)', marginTop: 4 }}>{label}</div>}
        </div>
      </div>
    );
  };

  // ── Mini hole-by-hole strip ─────────────────────────────
  const HoleStrip = ({ round, cellH = 40, showNums = true }) => {
    const scoreColor = window.CB.scoreColor;
    const [hover, setHover] = useState(null);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {round.holes.map((h, i) => {
            const v = round.vs[i];
            const c = scoreColor(v);
            const blow = v >= 2;
            const on = hover === i;
            return (
              <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                title={`Hole ${i + 1} · par ${round.pars[i]} · ${h}`}
                style={{ flex: 1, position: 'relative', height: cellH, borderRadius: 5, cursor: 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hexA(c, blow ? 0.9 : 0.16),
                  border: blow ? 'none' : '1px solid ' + hexA(c, 0.3),
                  outline: on ? '2px solid ' + hexA(c, 0.6) : 'none', outlineOffset: 1,
                  transition: 'outline 0.1s' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: blow ? '#F6F1E6' : c }}>{h}</span>
                {i === 8 && <span style={{ position: 'absolute', right: -3, top: 4, bottom: 4, width: 1, background: 'rgba(11,61,46,0.25)' }} />}
              </div>
            );
          })}
        </div>
        {showNums && (
          <div style={{ display: 'flex', gap: 3 }}>
            {round.holes.map((h, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: 'rgba(34,49,36,0.4)' }}>{i + 1}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  Object.assign(window, { CBMeasure: useMeasure, Sparkline, LineChart, BarChart, DivergingBar, Gauge, HoleStrip });
})();

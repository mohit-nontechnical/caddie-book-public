// Caddie Book — Insights page. Attaches to window.
(function () {
  const CB = window.CB;
  const Card = window.CBCard, CardTitle = window.CBCardTitle;

  // aggregate blow-ups by hole number across the season
  const blowByHole = (() => {
    const counts = Array(18).fill(0), plays = Array(18).fill(0);
    CB.rounds.forEach((r) => r.vs.forEach((v, i) => { plays[i]++; if (v >= 2) counts[i]++; }));
    return counts.map((c, i) => ({ hole: i + 1, rate: c / plays[i], par: CB.rounds[0].pars[i] }));
  })();

  // strokes lost by category (gap to goal breakdown)
  const gapItems = [
    { label: 'Approach 100–150', v: 3.4, color: '#B0433D' },
    { label: 'Driver / off the tee', v: 3.1, color: '#C0742F' },
    { label: 'Long irons 190+', v: 2.9, color: '#C0742F' },
    { label: 'Bunker play', v: 2.1, color: '#C0912F' },
    { label: 'Wedge distance', v: 1.9, color: '#C0912F' },
    { label: 'Everything else', v: 3.6, color: '#8A7A52' },
  ];

  const InsightsPage = () => {
    // sg per course — extremes
    const sorted = [...CB.courses].sort((a, b) => b.sg - a.sg);
    const sgItems = [...sorted.slice(0, 6), ...sorted.slice(-6)].map((c) => ({ label: c.name, value: c.sg }));
    const fb = CB.insights.frontBack;
    const gapTotal = parseFloat(CB.golfer.scoreAvg18) - CB.golfer.breakGoal.target;

    return (
      <div>
        <window.CBPageHead eyebrow="WHAT THE NUMBERS SAY" title="Insights"
          sub="Every card is a pattern Caddie Book found across your season. The ones in red are where the strokes are hiding." />

        <div style={{ columnCount: 2, columnGap: 16 }}>
          {/* SG per course */}
          <Card style={brk} className="cb-ins">
            <CardTitle sub="Strokes vs. your 100.1 average · green = you play it better">Where you over & under-perform</CardTitle>
            <window.DivergingBar items={sgItems} rowH={25} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(34,49,36,0.6)' }}>
              <span>Toughest: <b style={{ color: '#B0433D' }}>Coyote Creek</b></span>
              <span>Comfiest: <b style={{ color: '#3E8F63' }}>Rancho del Pueblo</b></span>
            </div>
          </Card>

          {/* Blow-up hole map */}
          <Card style={brk} className="cb-ins">
            <CardTitle sub="How often each hole becomes a double or worse">Blow-up hole map</CardTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 5 }}>
              {blowByHole.map((h) => {
                const a = Math.min(1, h.rate * 1.3);
                return (
                  <div key={h.hole} title={`Hole ${h.hole} · ${Math.round(h.rate * 100)}% blow-up`} style={{
                    aspectRatio: '1', borderRadius: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    background: CB.hexA('#B0433D', 0.08 + a * 0.72), border: '1px solid ' + CB.hexA('#B0433D', 0.2) }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 500, color: a > 0.45 ? '#F6F1E6' : '#8A3A35' }}>{h.hole}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, color: a > 0.45 ? 'rgba(246,241,230,0.8)' : 'rgba(138,58,53,0.7)' }}>{Math.round(h.rate * 100)}%</span>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: '13px 0 0', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.62)', lineHeight: 1.5 }}>
              Your long par-4s bite hardest — <b>8, 12 and 4</b> account for a third of your season's damage.
            </p>
          </Card>

          {/* Gap to goal */}
          <Card style={brk} className="cb-ins">
            <CardTitle sub={`${gapTotal.toFixed(1)} strokes between your average and breaking 85`}>Gap to goal · Break 85</CardTitle>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
              <BigNum n={CB.golfer.scoreAvg18} label="YOUR AVG" />
              <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, rgba(11,61,46,0.25) 0 5px, transparent 5px 10px)', marginBottom: 14 }} />
              <BigNum n="85" label="THE GOAL" color="#3E8F63" />
            </div>
            {gapItems.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 34px', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(34,49,36,0.72)', textAlign: 'right' }}>{it.label}</span>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(11,61,46,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (it.v / 3.6 * 100) + '%', background: it.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: it.color, textAlign: 'right' }}>{it.v}</span>
              </div>
            ))}
          </Card>

          {/* Front vs back */}
          <Card style={brk} className="cb-ins">
            <CardTitle sub="Average strokes per nine">Front nine vs. back nine</CardTitle>
            <div style={{ display: 'flex', gap: 14 }}>
              <NineBar label="FRONT" v={fb.front} max={55} color="#6E9A46" />
              <NineBar label="BACK" v={fb.back} max={55} color="#C0742F" />
            </div>
            <p style={{ margin: '14px 0 0', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.62)', lineHeight: 1.5 }}>
              A <b>0.5-stroke</b> back-nine fade — smaller than most golfers your index. Late putts, not stamina.
            </p>
          </Card>

          {/* Consistency */}
          <Card style={brk} className="cb-ins">
            <CardTitle sub="Blow-up holes per round, this season">Consistency</CardTitle>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, color: '#C0742F' }}>4.4</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(34,49,36,0.6)' }}>blow-ups per round</span>
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 14 }}>
              {CB.rounds.map((r) => (
                <div key={r.id} title={`${r.courseName}: ${r.blowups}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 46 }}>
                  <div style={{ height: (r.blowups / 9 * 46) + 'px', background: r.blowups >= 6 ? '#B0433D' : r.blowups >= 4 ? '#C0742F' : '#6E9A46', borderRadius: 3, opacity: 0.85 }} />
                </div>
              ))}
            </div>
            <p style={{ margin: '13px 0 0', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.62)', lineHeight: 1.5 }}>
              Trending down from 5.6 early in the season. Fewer disasters is the fastest path to 85.
            </p>
          </Card>
        </div>
      </div>
    );
  };

  const brk = { breakInside: 'avoid', marginBottom: 16 };
  const BigNum = ({ n, label, color }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: color || '#1B2A1D', lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: '0.12em', color: 'rgba(34,49,36,0.5)', marginTop: 5 }}>{label}</div>
    </div>
  );
  const NineBar = ({ label, v, max, color }) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ height: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ width: '70%', height: ((v - 40) / (max - 40) * 100) + '%', minHeight: 20, background: CB.hexA(color, 0.75), borderRadius: '8px 8px 3px 3px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 7 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: '#F6F1E6' }}>{v}</span>
        </div>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: 'rgba(34,49,36,0.5)', marginTop: 8 }}>{label}</div>
    </div>
  );

  Object.assign(window, { InsightsPage });
})();

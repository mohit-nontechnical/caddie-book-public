// Caddie Book — Dashboard page. Attaches to window.
(function () {
  const { useState } = React;
  const CB = window.CB;
  const Card = window.CBCard, CardTitle = window.CBCardTitle, Segmented = window.CBSegmented;

  const HeroStat = ({ label, value, unit, sub, subColor, span, children, accentRule }) => (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 14, padding: '15px 17px', position: 'relative', overflow: 'hidden' }}>
      {accentRule && <div style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: 'var(--gold)' }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: '0.13em', color: 'rgba(34,49,36,0.55)' }}>{label}</div>
        {children}
      </div>
      {value != null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 9 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, fontWeight: 500, color: '#1B2A1D', letterSpacing: '-0.02em' }}>{value}</span>
          {unit && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: 'rgba(34,49,36,0.5)' }}>{unit}</span>}
        </div>
      )}
      {sub && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: subColor || 'rgba(34,49,36,0.5)', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const Dashboard = ({ onRoute, onOpenRound, onImport }) => {
    const [idxMode, setIdxMode] = useState('18');
    const g = CB.golfer;
    const r = CB.rounds;
    const latest = CB.latest;

    const scoreLabels = r.map((x) => x.dateShort);
    const scoreSeries = [{ name: 'Score', color: '#0B3D2E', data: r.map((x) => x.score), fmt: (v) => v }];
    const sgSeries = [{ name: 'Strokes left', color: '#C0912F', data: CB.sgTrend, fmt: (v) => v + ' str' }];

    const bounce = g.bounce;
    const damage = latest.vs.filter((v) => v >= 2).reduce((a, v) => a + (v - 1), 0); // strokes over bogey on blow-ups
    const blowHoles = latest.vs.map((v, i) => (v >= 2 ? i + 1 : null)).filter((x) => x);

    return (
      <div>
        <window.CBPageHead
          eyebrow="THE SEASON SO FAR"
          title={`Good morning, ${g.name.split(' ')[0]}.`}
          sub={`${g.rounds} rounds in the book. Your season average is ${g.scoreAvg18}, and you're two clean rounds away from breaking 85 for real.`}
          right={<button onClick={onImport} className="cb-btn-ghost" style={ghostBtn}><window.IconImport size={16} stroke="currentColor" />Import 18Birdies</button>}
        />

        {/* hero stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
          <HeroStat span={3} label="INDEX" value={idxMode === '18' ? g.index : g.index9}
            sub={idxMode === '18' ? '↓ 1.8 this season' : '9-hole equivalent'} subColor="#3E8F63" accentRule
          >
            <Segmented options={[{ value: '18', label: '18' }, { value: '9', label: '9' }]} value={idxMode} onChange={setIdxMode} />
          </HeroStat>
          <HeroStat span={2} label="SCORE AVG" value={idxMode === '18' ? g.scoreAvg18 : g.scoreAvg9} sub={idxMode === '18' ? 'per 18 holes' : 'per 9 holes'} />
          <HeroStat span={2} label="BEST" value={g.best} sub="Deep Cliff · Mar 29" subColor="#3E8F63" />
          <HeroStat span={2} label="ROUNDS" value={g.rounds} sub="across 31 courses" />
          <HeroStat span={3} label="BREAK 85" value={g.breakGoal.done} unit={'/ ' + g.breakGoal.total}
            sub={`${g.breakGoal.total - g.breakGoal.done} attempts, still chasing`}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'var(--gold-ink)', fontWeight: 600 }}>GOAL</span>
          </HeroStat>
        </div>

        {/* two charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card>
            <CardTitle sub="Every logged round, oldest to newest — lower is better"
              right={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'rgba(34,49,36,0.5)' }}>LAST {r.length}</span>}>Score trend</CardTitle>
            <window.LineChart series={scoreSeries} labels={scoreLabels} height={224} />
          </Card>
          <Card>
            <CardTitle sub="Strokes you're leaving on the table vs. your potential"
              right={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: '#C0912F' }}>▼ TRENDING DOWN</span>}>Strokes gained vs. potential</CardTitle>
            <window.LineChart series={sgSeries} labels={scoreLabels} height={224} yMinPad={1} yMaxPad={1.5} />
          </Card>
        </div>

        {/* distribution */}
        <Card style={{ marginBottom: 16 }}>
          <CardTitle sub={`Where all ${CB.distribution.total} holes this season landed`}
            right={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'rgba(34,49,36,0.5)' }}>PARS & BETTER: {Math.round((CB.distribution.bars[0].n + CB.distribution.bars[1].n) / CB.distribution.total * 100)}%</span>}>Scoring distribution</CardTitle>
          <window.BarChart bars={CB.distribution.bars} total={CB.distribution.total} height={186} />
        </Card>

        {/* debrief + mental */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }}>
          {/* debrief */}
          <Card onClick={() => onOpenRound(latest)} hover style={{ cursor: 'pointer' }}>
            <CardTitle sub={`${latest.courseName} · ${latest.dateLong}`}
              right={<div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: '#1B2A1D', lineHeight: 1 }}>{latest.score}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'rgba(34,49,36,0.5)', marginTop: 2 }}>+{latest.toPar} · {latest.diff} DIFF</div>
              </div>}>Latest round debrief</CardTitle>

            <window.HoleStrip round={latest} cellH={38} />

            <div style={{ display: 'flex', gap: 20, margin: '18px 0 0', padding: '14px 0 0', borderTop: '1px solid var(--line)' }}>
              <DebriefStat n={latest.blowups} label="blow-up holes" color="#B0433D" />
              <DebriefStat n={'+' + damage} label="strokes over bogey" color="#C0742F" />
              <DebriefStat n={'#' + blowHoles.join(', #')} label="the damage holes" small />
            </div>

            <div style={{ display: 'flex', gap: 11, marginTop: 16, background: CB.hexA('#C0912F', 0.09), border: '1px solid ' + CB.hexA('#C0912F', 0.22), borderRadius: 12, padding: '13px 14px' }}>
              <window.IconSpark size={17} stroke="var(--gold-ink)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '0.13em', color: 'var(--gold-ink)', marginBottom: 5 }}>COACH'S NOTE</div>
                <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: '#22321f', lineHeight: 1.5 }}>{CB.debriefNote}</p>
              </div>
            </div>
          </Card>

          {/* mental game — the emotional hook */}
          <div style={{ background: 'linear-gradient(165deg, #0C4030, #08301F)', border: '1px solid rgba(199,162,75,0.3)', borderRadius: 16,
            padding: 22, color: '#F2ECDC', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 100% 0%, rgba(199,162,75,0.14), transparent 55%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--gold)' }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.16em', color: 'var(--gold)' }}>MENTAL GAME</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.05, marginBottom: 2 }}>The toughness score</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(242,236,220,0.68)', lineHeight: 1.4 }}>How you respond the hole after a blow-up.</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '18px 0 4px' }}>
                <window.Gauge value={bounce.recovered} color="var(--gold)" track="rgba(242,236,220,0.14)" size={118} />
                <div style={{ flex: 1 }}>
                  <Legend color="#C7A24B" n={bounce.recovered + '%'} label="Recovered — bogey or better" />
                  <Legend color="rgba(176,67,61,0.85)" n={bounce.doubleUp + '%'} label="Doubled-up again" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#8FD3AC' }}>
                    <window.CBTrend dir="up" size={9} goodColor="#8FD3AC" />
                    <span>Up from 38% last season</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, padding: '13px 14px', background: 'rgba(242,236,220,0.06)', border: '1px solid rgba(242,236,220,0.1)', borderRadius: 12,
                fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(242,236,220,0.82)', lineHeight: 1.5, fontStyle: 'italic' }}>
                “You're grinding harder after mistakes than you were a year ago. That's the number that breaks 85 — not your swing.”
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DebriefStat = ({ n, label, color, small }) => (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: small ? 15 : 24, fontWeight: 500, color: color || '#1B2A1D', lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'rgba(34,49,36,0.55)', marginTop: 5 }}>{label}</div>
    </div>
  );

  const Legend = ({ color, n, label }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color, flexShrink: 0, transform: 'translateY(1px)' }} />
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 500, color: '#F2ECDC', minWidth: 46 }}>{n}</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(242,236,220,0.62)', lineHeight: 1.25 }}>{label}</span>
    </div>
  );

  const ghostBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: '#F2ECDC',
    border: 'none', borderRadius: 11, padding: '10px 16px', cursor: 'pointer',
    fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
  };

  Object.assign(window, { Dashboard });
})();

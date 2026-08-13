// Caddie Book — Rounds table, Import modal, Round scorecard detail. Attaches to window.
(function () {
  const { useState } = React;
  const CB = window.CB;
  const Card = window.CBCard;

  // ── Rounds table ────────────────────────────────────────
  const RoundsPage = ({ onOpenRound, onImport }) => {
    const [sortKey, setSortKey] = useState('date');
    const [dir, setDir] = useState('desc');

    const cols = [
      { key: 'date', label: 'Date', w: '15%', align: 'left' },
      { key: 'courseName', label: 'Course', w: '30%', align: 'left' },
      { key: 'holesN', label: 'Holes', w: '9%', align: 'center' },
      { key: 'score', label: 'Score', w: '11%', align: 'center' },
      { key: 'toPar', label: 'To par', w: '11%', align: 'center' },
      { key: 'diff', label: 'Diff', w: '11%', align: 'center' },
      { key: 'blowups', label: 'Blow-ups', w: '13%', align: 'center' },
    ];
    const sorted = [...CB.rounds].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'date') { av = a.idx; bv = b.idx; }
      if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === 'asc' ? av - bv : bv - av;
    });
    const setSort = (k) => { if (k === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setDir('desc'); } };

    return (
      <div>
        <window.CBPageHead eyebrow="THE RECORD" title="Rounds"
          sub={`All ${CB.rounds.length} rounds this season. Click any row for the hole-by-hole card and its debrief.`}
          right={<button onClick={onImport} style={importBtn}><window.IconImport size={16} stroke="#F2ECDC" />Import 18Birdies export (JSON)</button>} />

        <Card pad={0} style={{ overflow: 'hidden' }}>
          {/* header */}
          <div style={{ display: 'flex', padding: '13px 20px', borderBottom: '1px solid var(--line)', background: 'rgba(11,61,46,0.03)' }}>
            {cols.map((c) => (
              <button key={c.key} onClick={() => setSort(c.key)} style={{
                width: c.w, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 5, justifyContent: c.align === 'center' ? 'center' : 'flex-start',
                fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: sortKey === c.key ? '#1B2A1D' : 'rgba(34,49,36,0.5)', fontWeight: sortKey === c.key ? 700 : 400 }}>
                {c.label}
                {sortKey === c.key && <span style={{ fontSize: 8, transform: dir === 'asc' ? 'rotate(180deg)' : 'none' }}>▼</span>}
              </button>
            ))}
          </div>
          {/* rows */}
          {sorted.map((r) => (
            <button key={r.id} onClick={() => onOpenRound(r)} className="cb-row" style={{
              display: 'flex', alignItems: 'center', width: '100%', padding: '13px 20px', border: 'none',
              borderBottom: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: '15%', fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(34,49,36,0.7)' }}>{r.dateLong.replace(', 20', ', ’')}</span>
              <span style={{ width: '30%', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 7, height: 7, borderRadius: 7, background: r.course.avg > 100 ? '#B0433D' : '#3E8F63', flexShrink: 0, opacity: 0.7 }} />
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600, color: '#1B2A1D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.courseName}</span>
              </span>
              <span style={{ width: '9%', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: 'rgba(34,49,36,0.6)' }}>{r.holesN}</span>
              <span style={{ width: '11%', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 500, color: r.score === CB.golfer.best ? '#3E8F63' : '#1B2A1D' }}>{r.score}</span>
              <span style={{ width: '11%', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: 'rgba(34,49,36,0.6)' }}>+{r.toPar}</span>
              <span style={{ width: '11%', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: 'rgba(34,49,36,0.6)' }}>{r.diff}</span>
              <span style={{ width: '13%', display: 'flex', justifyContent: 'center' }}>
                <BlowChip n={r.blowups} />
              </span>
            </button>
          ))}
        </Card>
      </div>
    );
  };

  const BlowChip = ({ n }) => {
    const c = n >= 6 ? '#B0433D' : n >= 4 ? '#C0742F' : '#6E9A46';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: CB.hexA(c, 0.13), border: '1px solid ' + CB.hexA(c, 0.28),
        borderRadius: 999, padding: '3px 10px 3px 8px', fontFamily: "'DM Mono',monospace", fontSize: 11.5, fontWeight: 500, color: c }}>
        <span style={{ width: 5, height: 5, borderRadius: 5, background: c }} />{n}
      </span>
    );
  };

  // ── Import modal ────────────────────────────────────────
  const ImportModal = ({ onClose }) => {
    const [stage, setStage] = useState('drop'); // drop | parsing | done
    const [pct, setPct] = useState(0);
    React.useEffect(() => {
      if (stage !== 'parsing') return;
      const iv = setInterval(() => setPct((p) => {
        if (p >= 100) { clearInterval(iv); setTimeout(() => setStage('done'), 300); return 100; }
        return p + 5;
      }), 55);
      return () => clearInterval(iv);
    }, [stage]);
    const steps = ['Reading 18Birdies JSON…', 'Parsing 18 rounds…', 'Matching courses & tees…', 'Recomputing bag grades…'];
    const step = Math.min(3, Math.floor(pct / 26));

    return (
      <div onClick={onClose} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 460, background: 'var(--paper)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: '0 30px 80px -20px rgba(6,30,20,0.6)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: '#1B2A1D' }}>Import from 18Birdies</div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}><window.IconClose size={19} stroke="rgba(34,49,36,0.5)" /></button>
          </div>
          <div style={{ padding: 22 }}>
            {stage === 'drop' && (<>
              <div onClick={() => setStage('parsing')} className="cb-drop" style={{
                cursor: 'pointer', borderRadius: 14, border: '1.5px dashed ' + CB.hexA('#C0912F', 0.5),
                background: CB.hexA('#C0912F', 0.05), padding: '34px 20px', textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: 16, background: CB.hexA('#C0912F', 0.14), display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
                  <window.IconImport size={26} stroke="var(--gold-ink)" />
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: '#1B2A1D' }}>Drop your <span style={{ fontFamily: "'DM Mono',monospace" }}>export.json</span></div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.55)', marginTop: 5 }}>Settings → Export data → JSON in the 18Birdies app</div>
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(34,49,36,0.5)', marginTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
                This is the primary way rounds enter Caddie Book. Every hole, fairway, and putt comes across.
              </div>
            </>)}
            {stage === 'parsing' && (
              <div style={{ padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600, color: '#1B2A1D' }}>{steps[step]}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: 'var(--gold-ink)' }}>{pct}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 7, background: 'rgba(11,61,46,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: 'var(--gold)', borderRadius: 7, transition: 'width 0.1s linear' }} />
                </div>
              </div>
            )}
            {stage === 'done' && (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ width: 54, height: 54, borderRadius: 999, background: CB.hexA('#3E8F63', 0.16), display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                  <window.IconCheck size={26} stroke="#3E8F63" sw={2.2} />
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: '#1B2A1D' }}>18 rounds imported</div>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(34,49,36,0.6)', margin: '8px 0 18px', lineHeight: 1.5 }}>Your bag grades and insights are up to date.</p>
                <button onClick={onClose} style={{ ...importBtn, width: '100%', justifyContent: 'center' }}>See your rounds</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Round detail (scorecard + debrief) ──────────────────
  const RoundDetail = ({ round, onBack }) => {
    const front = round.holes.slice(0, 9), back = round.holes.slice(9);
    const out = front.reduce((a, b) => a + b, 0), inn = back.reduce((a, b) => a + b, 0);
    const parOut = round.pars.slice(0, 9).reduce((a, b) => a + b, 0);
    const parIn = round.pars.slice(9).reduce((a, b) => a + b, 0);
    const worst = round.vs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])[0][1];

    return (
      <div>
        <button onClick={onBack} className="cb-back" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(34,49,36,0.65)', fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 500, padding: '4px 8px 4px 0', marginBottom: 14 }}>
          <window.IconArrowL size={18} stroke="currentColor" sw={2} /> All rounds
        </button>

        <window.CBPageHead eyebrow={round.dateLong.toUpperCase()} title={round.courseName}
          sub={`Rating ${round.course.rating} · Slope ${round.course.slope} · ${round.course.city}`}
          right={<div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 46, fontWeight: 600, color: '#1B2A1D', lineHeight: 0.9 }}>{round.score}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'rgba(34,49,36,0.55)', marginTop: 4 }}>+{round.toPar} TO PAR · {round.diff} DIFF</div>
          </div>} />

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          {/* scorecard */}
          <Card>
            <window.CBCardTitle sub="Par top, your score below — blow-ups filled solid">Scorecard</window.CBCardTitle>
            <Nine label="OUT" holes={front} pars={round.pars.slice(0, 9)} start={0} total={out} parTotal={parOut} />
            <div style={{ height: 12 }} />
            <Nine label="IN" holes={back} pars={round.pars.slice(9)} start={9} total={inn} parTotal={parIn} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 26, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <TotBox label="OUT" v={out} />
              <TotBox label="IN" v={inn} />
              <TotBox label="TOTAL" v={round.score} big />
            </div>
          </Card>

          {/* debrief */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <window.CBCardTitle>The debrief</window.CBCardTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <MiniStat n={round.blowups} label="blow-up holes" color="#B0433D" />
                <MiniStat n={round.vs.filter((v) => v <= 0).length} label="pars or better" color="#3E8F63" />
                <MiniStat n={'#' + (worst + 1)} label={'worst hole (+' + round.vs[worst] + ')'} color="#C0742F" />
                <MiniStat n={round.vs.filter((v) => v === 1).length} label="bogeys" color="#8A7A52" />
              </div>
            </Card>
            <div style={{ background: 'linear-gradient(165deg,#0C4030,#08301F)', borderRadius: 16, border: '1px solid rgba(199,162,75,0.28)', padding: 20, color: '#F2ECDC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <window.IconFlag size={16} stroke="var(--gold)" />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', color: 'var(--gold)' }}>COACH READ THIS ROUND</span>
              </div>
              <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: 'rgba(242,236,220,0.9)' }}>
                {`You made ${round.blowups} blow-up holes. Wipe out just the worst two and this is a ${round.score - (round.vs[worst] - 1) - 2}. The card says the same thing it always does — the damage is off the tee and from 100–150, not on the greens.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Nine = ({ label, holes, pars, start, total, parTotal }) => {
    const scoreColor = CB.scoreColor;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(9, 1fr) 46px`, gap: 4, alignItems: 'stretch' }}>
        <Cell head>HOLE</Cell>
        {holes.map((_, i) => <Cell key={i} head>{start + i + 1}</Cell>)}
        <Cell head>{label}</Cell>
        <Cell sub>PAR</Cell>
        {pars.map((p, i) => <Cell key={i} sub>{p}</Cell>)}
        <Cell sub>{parTotal}</Cell>
        <Cell label>YOU</Cell>
        {holes.map((h, i) => {
          const v = h - pars[i]; const c = scoreColor(v); const blow = v >= 2;
          return <div key={i} style={{ height: 34, borderRadius: 7, display: 'grid', placeItems: 'center',
            background: blow ? c : CB.hexA(c, 0.14), border: blow ? 'none' : '1px solid ' + CB.hexA(c, 0.3),
            fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: blow ? '#F6F1E6' : c }}>{h}</div>;
        })}
        <div style={{ height: 34, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'rgba(11,61,46,0.06)', fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 600, color: '#1B2A1D' }}>{total}</div>
      </div>
    );
  };
  const Cell = ({ children, head, sub, label }) => (
    <div style={{ height: head ? 22 : 20, display: 'grid', placeItems: 'center',
      fontFamily: head || label ? "'DM Mono',monospace" : "'DM Mono',monospace", fontSize: head ? 10 : 11,
      letterSpacing: head ? '0.06em' : 0, fontWeight: label ? 700 : 400,
      color: head ? 'rgba(34,49,36,0.45)' : sub ? 'rgba(34,49,36,0.55)' : label ? '#1B2A1D' : '#1B2A1D' }}>{children}</div>
  );
  const TotBox = ({ label, v, big }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '0.12em', color: 'rgba(34,49,36,0.5)' }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: big ? 30 : 22, fontWeight: 600, color: '#1B2A1D', marginTop: 3 }}>{v}</div>
    </div>
  );
  const MiniStat = ({ n, label, color }) => (
    <div style={{ background: 'rgba(11,61,46,0.03)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 500, color: color || '#1B2A1D', lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'rgba(34,49,36,0.55)', marginTop: 6 }}>{label}</div>
    </div>
  );

  const importBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: '#F2ECDC',
    border: 'none', borderRadius: 11, padding: '10px 16px', cursor: 'pointer',
    fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
  };
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(6,26,18,0.55)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 20 };

  Object.assign(window, { RoundsPage, RoundDetail, ImportModal });
})();

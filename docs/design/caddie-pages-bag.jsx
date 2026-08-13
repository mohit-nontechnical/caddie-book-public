// Caddie Book — Bag & Drills page (+ slot detail, drill detail, mental routine). Attaches to window.
(function () {
  const { useState } = React;
  const CB = window.CB;
  const Card = window.CBCard, GradePill = window.CBGradePill;

  const SECTIONS = [
    { key: 'POWER', label: 'Power', sub: 'Tee to green' },
    { key: 'SCORING', label: 'Scoring', sub: 'Inside 150' },
    { key: 'MENTAL', label: 'Mental', sub: 'Between the ears' },
  ];

  const BagPage = () => {
    const [sub, setSub] = useState(null); // null | {type:'slot'|'drill', data}
    const [routineOpen, setRoutineOpen] = useState(true);

    if (sub && sub.type === 'slot') return <SlotDetail slot={sub.data} onBack={() => setSub(null)} onDrill={(d) => setSub({ type: 'drill', data: d })} />;
    if (sub && sub.type === 'drill') return <DrillDetail drill={sub.data} onBack={() => setSub(null)} onSlot={(s) => setSub({ type: 'slot', data: s })} />;

    const focus = CB.slots.find((s) => s.focus);

    return (
      <div>
        <window.CBPageHead eyebrow="THE BAG" title="Bag & Drills"
          sub={`Fourteen slots, each with a grade and one drill that moves it. Bag GPA ${CB.bagGpa} across the set.`}
          right={<button onClick={() => setSub({ type: 'slot', data: focus })} className="cb-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: CB.hexA('#C0912F', 0.12), border: '1px solid ' + CB.hexA('#C0912F', 0.3), borderRadius: 999, padding: '7px 14px' }}>
            <window.IconStar size={14} stroke="var(--gold-ink)" />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600, color: 'var(--gold-ink)' }}>Focus: {focus.name}</span>
            <window.IconChevron size={13} stroke="var(--gold-ink)" />
          </button>} />

        {/* pre-round mental routine (collapsible) */}
        <div style={{ background: 'linear-gradient(165deg,#0C4030,#08301F)', borderRadius: 16, border: '1px solid rgba(199,162,75,0.28)', marginBottom: 20, overflow: 'hidden' }}>
          <button onClick={() => setRoutineOpen(!routineOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(199,162,75,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <window.IconFlag size={17} stroke="var(--gold)" />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: '#F2ECDC' }}>Pre-round mental routine</span>
              <span style={{ display: 'block', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(242,236,220,0.6)', marginTop: 2 }}>Read this on the first tee. It's worth more than the range.</span>
            </span>
            <window.IconChevronD size={18} stroke="rgba(242,236,220,0.6)" style={{ transform: routineOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {routineOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '0 20px 20px' }}>
              {CB.routine.map((r, i) => (
                <div key={i} style={{ background: 'rgba(242,236,220,0.06)', border: '1px solid rgba(242,236,220,0.1)', borderRadius: 12, padding: '14px 15px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 8 }}>0{i + 1}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 700, color: '#F2ECDC', marginBottom: 6 }}>{r.title}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(242,236,220,0.72)', lineHeight: 1.45 }}>{r.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* slots by section */}
        {SECTIONS.map((sec) => (
          <div key={sec.key} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#1B2A1D' }}>{sec.label}</h2>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(34,49,36,0.5)' }}>{sec.sub}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 12 }}>
              {CB.slots.filter((s) => s.section === sec.key).map((s) => {
                const c = CB.gradeColor(s.grade);
                const drill = CB.drills[s.drill];
                return (
                  <button key={s.id} onClick={() => setSub({ type: 'slot', data: s })} className="cb-hovercard" style={{
                    textAlign: 'left', cursor: 'pointer', border: '1px solid ' + (s.focus ? CB.hexA('#C0912F', 0.4) : 'var(--line)'),
                    borderRadius: 15, padding: 16, background: `linear-gradient(150deg, ${CB.hexA(c, 0.09)}, transparent 60%), var(--paper)`, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: '#1B2A1D', letterSpacing: '-0.01em' }}>{s.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontFamily: "'DM Mono',monospace", fontSize: 9.5, color: 'rgba(34,49,36,0.5)' }}>
                          <window.CBTrend dir={s.trend} size={8} />{s.trend === 'up' ? 'RISING' : s.trend === 'down' ? 'SLIPPING' : 'STEADY'}
                        </div>
                      </div>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, color: c, lineHeight: 0.8 }}>{s.grade}</span>
                    </div>
                    <p style={{ margin: '12px 0 14px', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.65)', lineHeight: 1.45, minHeight: 36 }}>{s.diag}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 11, borderTop: '1px solid var(--line)' }}>
                      <window.IconTarget size={14} stroke="var(--gold-ink)" />
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(34,49,36,0.65)', flex: 1 }}>{drill.name}</span>
                      <window.IconChevron size={14} stroke="rgba(34,49,36,0.4)" />
                    </div>
                    {s.focus && <span style={{ position: 'absolute', top: 14, right: 62, width: 6, height: 6, borderRadius: 6, background: 'var(--gold)', boxShadow: '0 0 0 3px ' + CB.hexA('#C0912F', 0.2) }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Slot detail ─────────────────────────────────────────
  const SlotDetail = ({ slot, onBack, onDrill }) => {
    const c = CB.gradeColor(slot.grade);
    const drill = CB.drills[slot.drill];
    return (
      <div style={{ maxWidth: 860 }}>
        <BackBtn onBack={onBack} label="Bag & Drills" />
        <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid ' + CB.hexA(c, 0.4),
          background: `linear-gradient(160deg, ${CB.hexA(c, 0.14)}, ${CB.hexA(c, 0.02)} 60%), var(--paper)`, padding: '22px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ maxWidth: 460 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.16em', color: 'rgba(34,49,36,0.5)' }}>{slot.section} SLOT</div>
              <h1 style={{ margin: '6px 0 0', fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: '#1B2A1D', letterSpacing: '-0.015em' }}>{slot.name}</h1>
              <p style={{ margin: '10px 0 0', fontFamily: "'DM Sans',sans-serif", fontSize: 14.5, color: 'rgba(34,49,36,0.7)', lineHeight: 1.5 }}>{slot.diag}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 72, fontWeight: 600, color: c, lineHeight: 0.8 }}>{slot.grade}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'rgba(34,49,36,0.5)' }}>
                <window.CBTrend dir={slot.trend} size={9} />{slot.trend === 'up' ? 'RISING' : slot.trend === 'down' ? 'SLIPPING' : 'STEADY'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {slot.stats.map(([label, val, unit], i) => (
            <Card key={i} pad={16}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 500, color: '#1B2A1D' }}>{val}</span>
                {unit && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'rgba(34,49,36,0.5)' }}>{unit}</span>}
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(34,49,36,0.55)', marginTop: 7 }}>{label}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <window.CBCardTitle sub="Grade points, last 5 rounds">Trend</window.CBCardTitle>
            <window.Sparkline data={slot.spark} color={c} w={360} h={70} sw={2.6} />
          </Card>
          <Card onClick={() => onDrill(drill)} hover style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
            <window.CBCardTitle sub="Coach pinned this to move the grade">Assigned drill</window.CBCardTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, background: CB.hexA('#C0912F', 0.14), display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <window.IconTarget size={24} stroke="var(--gold-ink)" />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15.5, fontWeight: 600, color: '#1B2A1D' }}>{drill.name}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(34,49,36,0.55)', marginTop: 2 }}>{drill.dur} · {drill.diff}</div>
              </div>
              <window.IconChevron size={18} stroke="rgba(34,49,36,0.4)" />
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ── Drill detail ────────────────────────────────────────
  const DrillDetail = ({ drill, onBack, onSlot }) => {
    const [done, setDone] = useState(false);
    const slot = CB.slots.find((s) => s.id === drill.slot);
    const c = CB.gradeColor(slot.grade);
    return (
      <div style={{ maxWidth: 720 }}>
        <BackBtn onBack={onBack} label="Back" />
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.16em', color: 'var(--gold-ink)' }}>DRILL · {drill.diff.toUpperCase()}</div>
        <h1 style={{ margin: '8px 0 0', fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 600, color: '#1B2A1D', letterSpacing: '-0.015em' }}>{drill.name}</h1>
        <p style={{ margin: '10px 0 16px', fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: 'rgba(34,49,36,0.7)', lineHeight: 1.5 }}>{drill.fixes}</p>

        <div style={{ display: 'flex', gap: 9, marginBottom: 20 }}>
          <button onClick={() => onSlot && onSlot(slot)} className="cb-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 12px 6px 7px' }}>
            <GradePill grade={slot.grade} size={22} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 500, color: '#1B2A1D' }}>{slot.name}</span>
            <window.IconChevron size={13} stroke="rgba(34,49,36,0.4)" />
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.65)' }}>
            <window.IconClock size={15} stroke="rgba(34,49,36,0.5)" />{drill.dur}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <Card>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.14em', color: 'rgba(34,49,36,0.5)', marginBottom: 14 }}>HOW TO DO IT</div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {drill.steps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: CB.hexA('#C0912F', 0.13), color: 'var(--gold-ink)', display: 'grid', placeItems: 'center', fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 500 }}>{i + 1}</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(34,49,36,0.78)', lineHeight: 1.5 }}>{s}</span>
                </li>
              ))}
            </ol>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ borderRadius: 16, border: '1px solid rgba(199,162,75,0.28)', background: 'linear-gradient(165deg,#0C4030,#08301F)', padding: 20, color: '#F2ECDC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <window.IconSpark size={16} stroke="var(--gold)" />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.13em', color: 'var(--gold)' }}>WHY COACH PICKED THIS</span>
              </div>
              <p style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: 'rgba(242,236,220,0.9)' }}>{drill.why}</p>
            </div>
            <button onClick={() => setDone(!done)} style={{ width: '100%', borderRadius: 13, padding: 15, cursor: 'pointer',
              border: done ? '1px solid ' + CB.hexA('#3E8F63', 0.5) : 'none', background: done ? 'transparent' : 'var(--ink)',
              color: done ? '#3E8F63' : '#F2ECDC', fontFamily: "'DM Sans',sans-serif", fontSize: 14.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {done ? <><window.IconCheck size={18} stroke="#3E8F63" sw={2.2} />Logged for this week</> : 'Mark drill complete'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const BackBtn = ({ onBack, label }) => (
    <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(34,49,36,0.65)', fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 500, padding: '4px 8px 4px 0', marginBottom: 16 }}>
      <window.IconArrowL size={18} stroke="currentColor" sw={2} /> {label}
    </button>
  );

  Object.assign(window, { BagPage });
})();

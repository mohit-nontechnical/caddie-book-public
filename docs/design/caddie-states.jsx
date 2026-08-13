// Caddie Book — passcode login, demo badge, empty state, profile. Attaches to window.
(function () {
  const { useState, useEffect } = React;
  const CB = window.CB;
  const Card = window.CBCard;

  // ── Passcode login ──────────────────────────────────────
  const Passcode = ({ onEnter }) => {
    const [code, setCode] = useState('');
    const [shake, setShake] = useState(false);
    const submit = (mode) => onEnter(mode);
    const press = (d) => {
      if (code.length >= 4) return;
      const next = code + d;
      setCode(next);
      if (next.length === 4) {
        setTimeout(() => { if (next === '0000') { setShake(true); setTimeout(() => { setCode(''); setShake(false); }, 500); } else submit('demo'); }, 180);
      }
    };
    const back = () => setCode(code.slice(0, -1));

    useEffect(() => {
      const onKey = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') back(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [code]);

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(120% 90% at 50% -10%, #12543D, #07281B 72%)', display: 'grid', placeItems: 'center', zIndex: 200 }}>
        <div style={{ width: 340, textAlign: 'center', color: '#F2ECDC' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><window.Crest size={68} /></div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>Caddie Book</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.22em', color: 'rgba(199,162,75,0.85)', marginTop: 8 }}>ENTER YOUR PASSCODE</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, margin: '30px 0 26px', animation: shake ? 'cbShake 0.45s' : 'none' }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ width: 14, height: 14, borderRadius: 999, border: '1.5px solid rgba(199,162,75,0.6)',
                background: i < code.length ? 'var(--gold)' : 'transparent', transition: 'background 0.15s' }} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 250, margin: '0 auto' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <Key key={n} onClick={() => press(String(n))}>{n}</Key>)}
            <span />
            <Key onClick={() => press('0')}>0</Key>
            <Key onClick={back} small>⌫</Key>
          </div>

          <button onClick={() => submit('demo')} style={{ marginTop: 26, background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(242,236,220,0.6)' }}>
            No passcode? <span style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Explore with sample data →</span>
          </button>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => submit('empty')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(242,236,220,0.4)' }}>
              Start a fresh book (empty)
            </button>
          </div>
        </div>
      </div>
    );
  };
  const Key = ({ children, onClick, small }) => (
    <button onClick={onClick} className="cb-key" style={{
      height: 62, borderRadius: 16, cursor: 'pointer', border: '1px solid rgba(242,236,220,0.14)',
      background: 'rgba(242,236,220,0.05)', color: '#F2ECDC', fontFamily: small ? "'DM Sans',sans-serif" : "var(--font-display)",
      fontSize: small ? 20 : 26, fontWeight: 500, transition: 'background 0.12s' }}>{children}</button>
  );

  // ── Demo badge ──────────────────────────────────────────
  const DemoBadge = () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: CB.hexA('#C0912F', 0.14), border: '1px solid ' + CB.hexA('#C0912F', 0.32),
      borderRadius: 999, padding: '5px 12px', fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.08em', color: 'var(--gold-ink)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--gold)' }} />SAMPLE DATA · DEMO MODE
    </span>
  );

  // ── Empty state ─────────────────────────────────────────
  const EmptyState = ({ onImport }) => (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', textAlign: 'center' }}>
      <div style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, opacity: 0.9 }}><window.Crest size={64} /></div>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: '#1B2A1D', letterSpacing: '-0.015em' }}>Your book is empty</h1>
        <p style={{ margin: '12px 0 24px', fontFamily: "'DM Sans',sans-serif", fontSize: 14.5, color: 'rgba(34,49,36,0.62)', lineHeight: 1.55 }}>
          Caddie Book turns your 18Birdies rounds into grades, patterns and drills. Import your first export and the whole book fills in.
        </p>
        <button onClick={onImport} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--ink)', color: '#F2ECDC',
          border: 'none', borderRadius: 13, padding: '13px 22px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600 }}>
          <window.IconImport size={17} stroke="#F2ECDC" />Import 18Birdies export (JSON)
        </button>
        <div style={{ marginTop: 16, fontFamily: "'DM Mono',monospace", fontSize: 10.5, letterSpacing: '0.06em', color: 'rgba(34,49,36,0.4)' }}>
          SETTINGS → EXPORT DATA → JSON
        </div>
      </div>
    </div>
  );

  // ── Profile ─────────────────────────────────────────────
  const ProfilePage = ({ onMode }) => {
    const g = CB.golfer;
    const idxTrend = [28.4, 27.6, 27.0, 26.3, 25.8, 25.1];
    return (
      <div style={{ maxWidth: 860 }}>
        <window.CBPageHead eyebrow="THE PLAYER" title="Profile" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
          <span style={{ width: 66, height: 66, borderRadius: 18, background: CB.hexA('#C0912F', 0.16), border: '1px solid ' + CB.hexA('#C0912F', 0.3), display: 'grid', placeItems: 'center', fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: 'var(--gold-ink)' }}>{g.initials}</span>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: '#1B2A1D' }}>{g.name}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: 'rgba(34,49,36,0.6)', marginTop: 3 }}>{g.home} · {g.rounds} rounds tracked · since Sept 2025</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Stat big={g.index} label="HANDICAP INDEX" sub="↓ 3.3 this season" subColor="#3E8F63" />
          <Stat big={CB.bagGpa} label="BAG GPA" sub="across 14 slots" />
          <Stat big={g.best} label="BEST ROUND" sub="Deep Cliff · Mar 29" />
        </div>

        <Card style={{ marginBottom: 16 }}>
          <window.CBCardTitle sub="Handicap index, this season" right={<span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#3E8F63' }}>↓ 3.3</span>}>Index trend</window.CBCardTitle>
          <window.Sparkline data={idxTrend.map((v) => 32 - v)} color="#3E8F63" w={780} h={64} sw={2.6} />
        </Card>

        <window.CBSectionLabel style={{ margin: '4px 0 10px' }}>Settings</window.CBSectionLabel>
        <Card pad={0}>
          {['Connected apps · 18Birdies', 'Goal: break 85', 'Coaching tone · Direct', 'Notifications', 'Units · Yards'].map((s, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: '#1B2A1D' }}>{s}</span>
              <window.IconChevron size={16} stroke="rgba(34,49,36,0.4)" />
            </div>
          ))}
        </Card>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button onClick={() => onMode('empty')} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 11, padding: '10px 16px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.65)' }}>Preview empty state</button>
          <button onClick={() => onMode('logout')} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 11, padding: '10px 16px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: 'rgba(34,49,36,0.65)' }}>Lock &amp; sign out</button>
        </div>
      </div>
    );
  };
  const Stat = ({ big, label, sub, subColor }) => (
    <Card pad={16}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: '0.12em', color: 'rgba(34,49,36,0.5)' }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 30, fontWeight: 500, color: '#1B2A1D', marginTop: 6 }}>{big}</div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: subColor || 'rgba(34,49,36,0.5)', marginTop: 3 }}>{sub}</div>
    </Card>
  );

  Object.assign(window, { CBPasscode: Passcode, DemoBadge, EmptyState, ProfilePage });
})();

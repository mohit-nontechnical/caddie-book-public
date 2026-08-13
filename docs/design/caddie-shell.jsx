// Caddie Book — app shell: sidebar, coach rail, coach chat. Attaches to window.
(function () {
  const { useState, useRef, useEffect } = React;
  const CB = window.CB;

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', Icon: window.IconDash },
    { key: 'rounds', label: 'Rounds', Icon: window.IconRounds },
    { key: 'insights', label: 'Insights', Icon: window.IconInsights },
    { key: 'courses', label: 'Courses', Icon: window.IconCourses },
    { key: 'bag', label: 'Bag & Drills', Icon: window.IconBag },
    { key: 'coach', label: 'Coach', Icon: window.IconCoach },
    { key: 'profile', label: 'Profile', Icon: window.IconUser },
  ];

  // ── Sidebar ─────────────────────────────────────────────
  const Sidebar = ({ route, onRoute }) => {
    const g = CB.golfer;
    return (
      <aside style={{
        width: 236, flexShrink: 0, background: 'linear-gradient(180deg, #0C4030, #08301F)',
        borderRight: '1px solid rgba(199,162,75,0.16)', display: 'flex', flexDirection: 'column',
        color: '#F2ECDC', position: 'relative',
      }}>
        {/* crest + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 20px 20px' }}>
          <window.Crest size={40} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>Caddie Book</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.22em', color: 'rgba(199,162,75,0.85)', marginTop: 4 }}>EST. AFTER THE ROUND</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(242,236,220,0.10)', margin: '0 16px 10px' }} />

        {/* nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px', flex: 1 }}>
          {NAV.map((it) => {
            const on = route === it.key;
            return (
              <button key={it.key} onClick={() => onRoute(it.key)} className="cb-nav" data-on={on ? 1 : 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                  border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: on ? 'rgba(199,162,75,0.16)' : 'transparent',
                  color: on ? '#F6EFDD' : 'rgba(242,236,220,0.68)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: on ? 600 : 500,
                  position: 'relative', transition: 'background 0.15s, color 0.15s',
                }}>
                {on && <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderRadius: 3, background: 'var(--gold)' }} />}
                <it.Icon size={19} stroke={on ? 'var(--gold)' : 'rgba(242,236,220,0.6)'} sw={on ? 1.9 : 1.7} />
                {it.label}
              </button>
            );
          })}
        </nav>

        {/* handicap pinned bottom */}
        <div style={{ padding: '14px 16px 18px' }}>
          <div style={{ height: 1, background: 'rgba(242,236,220,0.10)', marginBottom: 14 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'rgba(199,162,75,0.18)', display: 'grid', placeItems: 'center', fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>{g.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#F2ECDC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: 'rgba(242,236,220,0.55)', marginTop: 2 }}>Index {g.index}</div>
            </div>
          </div>
        </div>
      </aside>
    );
  };

  // ── Coach chat (shared: rail + full page) ───────────────
  const CoachChat = ({ messages, busy, onSend, variant = 'rail' }) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);
    const full = variant === 'page';
    useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, busy]);

    const submit = (text) => {
      const t = (text != null ? text : input).trim();
      if (!t || busy) return;
      setInput('');
      onSend(t);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* messages */}
        <div ref={scrollRef} className="cb-scroll" style={{ flex: 1, overflowY: 'auto', padding: full ? '8px 4px 4px' : '4px 16px', minHeight: 0 }}>
          <div style={{ maxWidth: full ? 720 : 'none', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m, i) => (
              <Bubble key={i} m={m} full={full} />
            ))}
            {busy && <Bubble m={{ role: 'coach', text: '' }} full={full} typing />}
          </div>
        </div>

        {/* chips (only if fresh) */}
        {messages.length <= 1 && !busy && (
          <div style={{ padding: full ? '10px 4px' : '8px 12px 4px', display: 'flex', flexWrap: 'wrap', gap: 7, maxWidth: full ? 720 : 'none', margin: full ? '0 auto' : 0 }}>
            {CB.coachChips.map((c, i) => (
              <button key={i} onClick={() => submit(c)} className="cb-chip" style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#22321f', cursor: 'pointer',
                background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 999, padding: '7px 12px',
              }}>{c}</button>
            ))}
          </div>
        )}

        {/* composer */}
        <div style={{ padding: full ? '10px 4px 4px' : '10px 12px 12px' }}>
          <div style={{ maxWidth: full ? 720 : 'none', margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 14, padding: '6px 6px 6px 14px' }}>
            <textarea value={input} rows={1} placeholder="Ask your coach…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: '#22321f', padding: '7px 0', maxHeight: 90, lineHeight: 1.4 }} />
            <button onClick={() => submit()} disabled={busy || !input.trim()} className="cb-send" style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0, border: 'none', cursor: busy || !input.trim() ? 'default' : 'pointer',
              background: busy || !input.trim() ? 'rgba(11,61,46,0.18)' : 'var(--ink)', display: 'grid', placeItems: 'center',
              transition: 'background 0.15s' }}>
              <window.IconSend size={17} stroke="#F2ECDC" sw={2} />
            </button>
          </div>
          <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', color: 'rgba(34,49,36,0.4)', marginTop: 8 }}>
            GROUNDED IN YOUR {CB.golfer.rounds} ROUNDS
          </div>
        </div>
      </div>
    );
  };

  const Bubble = ({ m, full, typing }) => {
    const coach = m.role === 'coach';
    if (coach) {
      return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'var(--ink)', display: 'grid', placeItems: 'center', marginTop: 1 }}>
            <window.IconFlag size={14} stroke="var(--gold)" />
          </div>
          <div style={{ flex: 1, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '4px 14px 14px 14px', padding: '10px 13px',
            fontFamily: "'DM Sans', sans-serif", fontSize: full ? 14.5 : 13.5, color: '#22321f', lineHeight: 1.5 }}>
            {typing ? <TypingDots /> : m.text}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '82%', background: 'var(--ink)', color: '#F2ECDC', borderRadius: '14px 4px 14px 14px', padding: '10px 13px',
          fontFamily: "'DM Sans', sans-serif", fontSize: full ? 14.5 : 13.5, lineHeight: 1.5 }}>{m.text}</div>
      </div>
    );
  };

  const TypingDots = () => (
    <span style={{ display: 'inline-flex', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: 6, background: 'rgba(34,49,36,0.4)', animation: `cbBlink 1s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );

  // ── Coach Rail (collapsible right rail) ─────────────────
  const CoachRail = ({ open, onToggle, chat }) => {
    if (!open) {
      return (
        <button onClick={onToggle} title="Open coach" style={{
          width: 52, flexShrink: 0, background: 'var(--panel)', borderLeft: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 20, cursor: 'pointer', border: 'none',
        }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ink)', display: 'grid', placeItems: 'center' }}>
            <window.IconCoach size={18} stroke="var(--gold)" />
          </span>
          <span style={{ writingMode: 'vertical-rl', fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.24em', color: 'rgba(34,49,36,0.5)', marginTop: 6 }}>COACH</span>
        </button>
      );
    }
    return (
      <aside style={{ width: 360, flexShrink: 0, background: 'var(--panel)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 16px 14px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <window.IconFlag size={17} stroke="var(--gold)" />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: '#22321f', lineHeight: 1 }}>Your Coach</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: '#3E8F63' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: '0.08em', color: 'rgba(34,49,36,0.55)' }}>ONLINE · READING YOUR STATS</span>
            </div>
          </div>
          <button onClick={onToggle} title="Collapse" className="cb-icon-btn" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 8 }}>
            <window.IconPanel size={18} stroke="rgba(34,49,36,0.5)" />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {chat}
        </div>
      </aside>
    );
  };

  Object.assign(window, { CBSidebar: Sidebar, CoachChat, CoachRail });
})();

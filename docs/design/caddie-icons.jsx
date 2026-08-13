// Caddie Book — icon set, crest logo, small shared bits. Attaches to window.
(function () {
  const Icon = ({ d, size = 22, stroke = 'currentColor', sw = 1.7, fill = 'none', children, vb = 24, style }) => (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} style={style}
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {d ? <path d={d} /> : children}
    </svg>
  );

  // ── Nav icons ───────────────────────────────────────────
  const IconDash = (p) => <Icon {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></Icon>;
  const IconRounds = (p) => <Icon {...p}><rect x="3.5" y="4" width="17" height="16" rx="2.2"/><path d="M3.5 9h17M9 9v11M3.5 14.5h5.5"/></Icon>;
  const IconInsights = (p) => <Icon {...p}><path d="M4 19V5M4 19h16"/><path d="M7.5 15l3.2-4 2.6 2.4L18 8"/></Icon>;
  const IconCourses = (p) => <Icon {...p}><path d="M12 21c4.5-4.4 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 2.5 6.6 7 11z"/><circle cx="12" cy="10" r="2.5"/></Icon>;
  const IconBag = (p) => <Icon {...p}><path d="M7 8l1-3.2A2 2 0 0 1 9.9 3.3h1.2A2 2 0 0 1 13 4.8L14 8"/><rect x="5.5" y="8" width="11" height="12.5" rx="3"/><path d="M9 8v-1M12 8v-1.6M15 8v-1.2"/><path d="M16.5 11.5h2.2A1.3 1.3 0 0 1 20 12.8v3"/><path d="M9 20.5v1M13 20.5v1"/></Icon>;
  const IconCoach = (p) => <Icon {...p}><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16.5H4.5A1.5 1.5 0 0 1 3 15V7a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M8 10.5h8M8 13h5"/></Icon>;
  const IconUser = (p) => <Icon {...p}><circle cx="12" cy="8.5" r="3.6"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></Icon>;

  // ── UI icons ────────────────────────────────────────────
  const IconChevron = (p) => <Icon {...p}><path d="M9 5l7 7-7 7"/></Icon>;
  const IconChevronD = (p) => <Icon {...p}><path d="M5 9l7 7 7-7"/></Icon>;
  const IconArrowL = (p) => <Icon {...p}><path d="M15 5l-7 7 7 7"/></Icon>;
  const IconArrowR = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>;
  const IconSort = (p) => <Icon {...p}><path d="M8 4v16M8 20l-3-3M8 4l3 3M16 20V4M16 4l3 3M16 20l-3-3"/></Icon>;
  const IconImport = (p) => <Icon {...p}><path d="M12 3v11M12 14l-4-4M12 14l4-4"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/></Icon>;
  const IconSpark = (p) => <Icon {...p}><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"/></Icon>;
  const IconTarget = (p) => <Icon {...p}><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></Icon>;
  const IconFlag = (p) => <Icon {...p}><path d="M6 21V4"/><path d="M6 5h11l-2.2 3L17 11H6"/></Icon>;
  const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="8"/><path d="M12 8v4.3l2.8 1.7"/></Icon>;
  const IconPlay = (p) => <Icon {...p}><path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/></Icon>;
  const IconSend = (p) => <Icon {...p}><path d="M4.5 12h13M11 5.5l6.5 6.5-6.5 6.5"/></Icon>;
  const IconClose = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>;
  const IconCheck = (p) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 6.5"/></Icon>;
  const IconLock = (p) => <Icon {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></Icon>;
  const IconGrip = (p) => <Icon {...p}><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></Icon>;
  const IconPanel = (p) => <Icon {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><path d="M14.5 4.5v15"/></Icon>;
  const IconStar = (p) => <Icon {...p}><path d="M12 4l2.3 4.8 5.2.6-3.9 3.5 1.1 5.1L12 15.9 7.2 18.1l1.1-5.1L4.4 9.4l5.2-.6z"/></Icon>;

  // ── Crest logo (gold flag on a shield) ──────────────────
  const Crest = ({ size = 40, gold = '#C7A24B', ink = '#0B3D2E', cream = '#F2ECDC' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M24 3.5 41 8.2v14.4c0 10.9-7.1 18.3-17 21.9C14.1 40.9 7 33.5 7 22.6V8.2z"
        fill={ink} stroke={gold} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M24 3.5 41 8.2v14.4c0 10.9-7.1 18.3-17 21.9C14.1 40.9 7 33.5 7 22.6V8.2z"
        fill="none" stroke={cream} strokeOpacity="0.14" strokeWidth="0.6" transform="scale(0.9) translate(2.6 2.4)"/>
      {/* flagstick + flag */}
      <path d="M20 13.5V33" stroke={cream} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M20 13.8h9.4l-2.4 3 2.4 3H20z" fill={gold}/>
      {/* hole + green line */}
      <path d="M15 32.5c3 1.8 8 1.8 12.5-.4" stroke={gold} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="20" cy="33" r="1.5" fill={cream}/>
    </svg>
  );

  // ── Trend triangle ──────────────────────────────────────
  const Trend = ({ dir, size = 9, goodColor = '#3E8F63', badColor = '#B0433D' }) => {
    if (dir === 'flat') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', color: 'currentColor', opacity: 0.55, fontSize: size + 3, lineHeight: 1 }}>→</span>;
    }
    const up = dir === 'up';
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" style={{ display: 'block' }}>
        <path d={up ? 'M5 1 9 8 1 8z' : 'M5 9 1 2 9 2z'} fill={up ? goodColor : badColor} />
      </svg>
    );
  };

  Object.assign(window, {
    CBIcon: Icon, IconDash, IconRounds, IconInsights, IconCourses, IconBag, IconCoach, IconUser,
    IconChevron, IconChevronD, IconArrowL, IconArrowR, IconSort, IconImport, IconSpark, IconTarget,
    IconFlag, IconClock, IconPlay, IconSend, IconClose, IconCheck, IconLock, IconGrip, IconPanel, IconStar,
    Crest, CBTrend: Trend,
  });
})();

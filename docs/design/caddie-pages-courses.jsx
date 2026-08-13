// Caddie Book — Courses page (Leaflet map + ranked list). Attaches to window.
(function () {
  const { useState, useRef, useEffect } = React;
  const CB = window.CB;

  const pinColor = (sg) => sg <= -3 ? '#B0433D' : sg < 0 ? '#C0742F' : sg < 3 ? '#C0912F' : '#3E8F63';

  const CoursesPage = () => {
    const ranked = [...CB.courses].sort((a, b) => a.avg - b.avg);
    const [sel, setSel] = useState(ranked[0].id);
    const mapRef = useRef(null);
    const mapObj = useRef(null);
    const markers = useRef({});
    const listRef = useRef(null);

    useEffect(() => {
      if (!window.L || mapObj.current || !mapRef.current) return;
      const map = window.L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true, attributionControl: true })
        .setView([37.55, -122.15], 10);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map);
      CB.courses.forEach((c) => {
        const col = pinColor(c.sg);
        const m = window.L.circleMarker([c.lat, c.lng], {
          radius: 6 + Math.min(6, c.rounds), color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 0.9,
        }).addTo(map);
        m.bindTooltip(`<b>${c.name}</b><br>${c.avg} avg · ${c.rounds} rounds`, { direction: 'top', offset: [0, -4] });
        m.on('click', () => setSel(c.id));
        markers.current[c.id] = m;
      });
      mapObj.current = map;
      setTimeout(() => map.invalidateSize(), 60);
    }, []);

    // fly to selected + emphasise pin
    useEffect(() => {
      const c = CB.courses.find((x) => x.id === sel);
      if (!c || !mapObj.current) return;
      mapObj.current.flyTo([c.lat, c.lng], 12, { duration: 0.6 });
      Object.entries(markers.current).forEach(([id, m]) => {
        const cc = CB.courses.find((x) => x.id === id);
        m.setStyle({ weight: id === sel ? 3.5 : 1.5, color: id === sel ? '#0B3D2E' : '#fff', fillOpacity: id === sel ? 1 : 0.85 });
        if (id === sel) m.bringToFront();
      });
    }, [sel]);

    const selC = CB.courses.find((x) => x.id === sel);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <window.CBPageHead eyebrow="THE PORTFOLIO" title="Courses"
          sub={`All ${CB.courses.length} courses you've played, ranked by how you score them.`} />

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          {/* ranked list */}
          <div ref={listRef} className="cb-scroll" style={{ overflowY: 'auto', minHeight: 0, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranked.map((c, i) => {
              const on = c.id === sel;
              const col = pinColor(c.sg);
              return (
                <button key={c.id} onClick={() => setSel(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', cursor: 'pointer', width: '100%',
                  background: on ? 'var(--paper)' : 'var(--paper-dim)', borderRadius: 13, padding: '12px 14px',
                  border: '1px solid ' + (on ? 'var(--gold)' : 'var(--line)'),
                  boxShadow: on ? '0 4px 14px -8px rgba(11,61,46,0.4)' : 'none', transition: 'border-color 0.15s' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'rgba(34,49,36,0.4)', width: 20, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: col, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600, color: '#1B2A1D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    <span style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'rgba(34,49,36,0.5)', marginTop: 2 }}>{c.rating} / {c.slope} · {c.rounds} rd</span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 17, fontWeight: 500, color: '#1B2A1D' }}>{c.avg}</span>
                    <span style={{ display: 'block', fontFamily: "'DM Mono',monospace", fontSize: 10, color: col, marginTop: 1 }}>{c.sg > 0 ? '+' : ''}{c.sg}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* map */}
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', minHeight: 420 }}>
            <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
            {/* selected course overlay card */}
            {selC && (
              <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 500, width: 260, background: 'var(--paper)', borderRadius: 13,
                border: '1px solid var(--line)', boxShadow: '0 12px 30px -12px rgba(6,30,20,0.5)', padding: '14px 16px' }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: '#1B2A1D', lineHeight: 1.1 }}>{selC.name}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(34,49,36,0.55)', marginTop: 2 }}>{selC.city}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <Ov n={selC.avg} label="AVG" />
                  <Ov n={selC.rating} label="RATING" />
                  <Ov n={selC.slope} label="SLOPE" />
                  <Ov n={selC.rounds} label="ROUNDS" />
                </div>
              </div>
            )}
            {/* legend */}
            <div style={{ position: 'absolute', right: 14, top: 14, zIndex: 500, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)', padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['#3E8F63', 'Play well'], ['#C0912F', 'Neutral'], ['#B0433D', 'Struggle']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: c }} />
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: 'rgba(34,49,36,0.65)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Ov = ({ n, label }) => (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 500, color: '#1B2A1D' }}>{n}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: '0.1em', color: 'rgba(34,49,36,0.45)', marginTop: 2 }}>{label}</div>
    </div>
  );

  Object.assign(window, { CoursesPage });
})();

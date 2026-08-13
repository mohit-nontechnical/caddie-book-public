"use client";

// ── Aerial shot-trace map for one hole ───────────────────────
// Satellite imagery (Esri World Imagery, free with attribution) + the hole's
// GPS shot trace: numbered markers at each shot's start, a flag at the pin,
// segments colored by that shot's strokes gained. Leaflet loads lazily so the
// server prerender never touches `window` (same pattern as CourseMap).

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import React, { useEffect, useRef } from "react";

export interface MapShot {
  seq: number;
  club: string;
  lie: string;
  sg: number;
  sLat?: number;
  sLng?: number;
  eLat?: number;
  eLng?: number;
}

interface Props {
  shots: MapShot[];
  pin: [number, number] | null;
  height?: number;
  selectedSeq?: number | null;
}

function segColor(sg: number): string {
  if (sg <= -0.5) return "#E05B5B";
  if (sg <= -0.15) return "#D98E6A";
  if (sg >= 0.3) return "#4CAF82";
  if (sg >= 0.1) return "#8FBC6F";
  return "#F4EFDF";
}

export const ShotHoleMap = ({ shots, pin, height = 260, selectedSeq = null }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const allBoundsRef = useRef<Leaflet.LatLngBounds | null>(null);
  const shotBoundsRef = useRef<Map<number, Leaflet.LatLngBounds>>(new Map());

  useEffect(() => {
    const el = containerRef.current;
    const located = shots.filter((s) => s.sLat != null && s.eLat != null);
    if (!el || mapRef.current || !located.length) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el || mapRef.current) return;

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        dragging: true,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 20 }
      ).addTo(map);

      const bounds: Leaflet.LatLng[] = [];

      for (const s of located) {
        const a = L.latLng(s.sLat!, s.sLng!);
        const b = L.latLng(s.eLat!, s.eLng!);
        bounds.push(a, b);
        shotBoundsRef.current.set(s.seq, L.latLngBounds([a, b]).pad(0.7));

        L.polyline([a, b], {
          color: segColor(s.sg),
          weight: 2.5,
          opacity: 0.95,
          dashArray: s.lie === "Green" ? "3 5" : undefined,
        }).addTo(map);

        L.marker(a, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:18px;height:18px;border-radius:50%;background:#10251577;border:1.5px solid ${segColor(s.sg)};color:#F4EFDF;font:600 10px/15px 'IBM Plex Mono',monospace;text-align:center;backdrop-filter:blur(1px)">${s.seq}</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
          .addTo(map)
          .bindTooltip(`${s.seq}: ${s.club} (${s.lie}) · SG ${s.sg > 0 ? "+" : ""}${s.sg.toFixed(2)}`, {
            direction: "top",
            offset: [0, -10],
          });
      }

      if (pin) {
        const p = L.latLng(pin[0], pin[1]);
        bounds.push(p);
        L.marker(p, {
          icon: L.divIcon({
            className: "",
            html: `<div style="font-size:16px;line-height:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8))">⛳</div>`,
            iconSize: [18, 18],
            iconAnchor: [4, 16],
          }),
        }).addTo(map);
      }

      allBoundsRef.current = L.latLngBounds(bounds).pad(0.18);
      map.fitBounds(allBoundsRef.current);
      if (selectedSeq != null) {
        const selectedBounds = shotBoundsRef.current.get(selectedSeq);
        if (selectedBounds) map.fitBounds(selectedBounds, { padding: [26, 26], maxZoom: 19 });
      }
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      allBoundsRef.current = null;
      shotBoundsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = selectedSeq == null ? allBoundsRef.current : shotBoundsRef.current.get(selectedSeq);
    if (target) map.flyToBounds(target, { padding: [26, 26], duration: 0.55, maxZoom: 19 });
  }, [selectedSeq]);

  const zoom = (delta: number) => delta > 0 ? mapRef.current?.zoomIn(delta) : mapRef.current?.zoomOut(Math.abs(delta));
  const fitHole = () => {
    if (allBoundsRef.current) mapRef.current?.flyToBounds(allBoundsRef.current, { padding: [10, 10], duration: 0.5 });
  };

  return (
    <div data-noswipe style={{ position: "relative", width: "100%", height, borderRadius: 14, overflow: "hidden", background: "#101510", border: "1px solid rgba(244,239,223,0.16)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", zIndex: 500, top: 10, right: 10, display: "flex", flexDirection: "column", gap: 5 }}>
        <button aria-label="Zoom in" onClick={() => zoom(1)} style={controlStyle}>+</button>
        <button aria-label="Zoom out" onClick={() => zoom(-1)} style={controlStyle}>−</button>
        <button aria-label="Fit entire hole" onClick={fitHole} style={{ ...controlStyle, fontSize: 9, letterSpacing: "0.05em" }}>FIT</button>
      </div>
      <div style={{ position: "absolute", zIndex: 500, left: 10, bottom: 10, padding: "5px 8px", borderRadius: 8, background: "rgba(10,25,14,0.78)", backdropFilter: "blur(8px)", color: "rgba(244,239,223,0.82)", font: "500 9px/1.2 'IBM Plex Mono', monospace", letterSpacing: "0.06em", pointerEvents: "none" }}>
        PINCH · SCROLL · DRAG
      </div>
    </div>
  );
};

const controlStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: "1px solid rgba(244,239,223,0.24)",
  borderRadius: 9,
  background: "rgba(10,25,14,0.82)",
  backdropFilter: "blur(8px)",
  color: "#F4EFDF",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 19,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(0,0,0,0.24)",
};

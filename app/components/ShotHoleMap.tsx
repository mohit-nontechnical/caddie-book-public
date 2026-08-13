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
}

function segColor(sg: number): string {
  if (sg <= -0.5) return "#E05B5B";
  if (sg <= -0.15) return "#D98E6A";
  if (sg >= 0.3) return "#4CAF82";
  if (sg >= 0.1) return "#8FBC6F";
  return "#F4EFDF";
}

export const ShotHoleMap = ({ shots, pin, height = 260 }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);

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
        scrollWheelZoom: false,
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

      map.fitBounds(L.latLngBounds(bounds).pad(0.18));
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      data-noswipe
      style={{ width: "100%", height, borderRadius: 12, overflow: "hidden", background: "#101510" }}
    />
  );
};

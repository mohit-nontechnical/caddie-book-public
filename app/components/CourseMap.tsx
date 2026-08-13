"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet"; // type-only — erased at build, no `window` access during prerender
import React, { useEffect, useRef, useState } from "react";
import { geoFor } from "@/lib/course-geo";

interface CoursePin {
  name: string;
  rounds: number;
  avg18: number | null;
  lat: number;
  lng: number;
}

interface StatsCourse {
  name: string;
  rounds: number;
  avg18: number | null;
}

interface Props {
  onOpenCourse: (course: string) => void;
}

export const CourseMap = ({ onOpenCourse }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);

  const [pins, setPins] = useState<CoursePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch stats and build pin list
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((json: { error?: string; courses?: StatsCourse[] }) => {
        if (json.error) throw new Error(json.error);
        const built: CoursePin[] = [];
        for (const c of json.courses ?? []) {
          const coords = geoFor(c.name);
          if (!coords) continue;
          built.push({ name: c.name, rounds: c.rounds, avg18: c.avg18, lat: coords[0], lng: coords[1] });
        }
        setPins(built);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  // Init Leaflet map after data is ready. Leaflet is imported lazily (browser-only)
  // so its `window` access never runs during Next's server prerender.
  useEffect(() => {
    if (loading || error || pins.length === 0) return;
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el || mapRef.current) return;

      const map = L.map(el, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const goldIcon = () =>
        L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#F0C040;border:2px solid #0A1A0E;box-shadow:0 0 0 2px rgba(240,192,64,0.4);cursor:pointer"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

      const latlngs: Leaflet.LatLng[] = [];

      for (const pin of pins) {
        const ll = L.latLng(pin.lat, pin.lng);
        latlngs.push(ll);

        const avgLabel = pin.avg18 != null ? ` · avg ${pin.avg18.toFixed(1)}` : "";
        const tooltipContent = `<b style="font-size:13px">${pin.name}</b><br/>${pin.rounds} round${pin.rounds !== 1 ? "s" : ""}${avgLabel}`;

        L.marker(ll, { icon: goldIcon() })
          .addTo(map)
          .bindTooltip(tooltipContent, { direction: "top", offset: [0, -10] })
          .on("click", () => onOpenCourse(pin.name));
      }

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 12);
      } else {
        map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
      }
      // Tiles can mis-size if the container animated in; nudge a resize.
      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, pins]);

  if (loading) {
    return (
      <div style={{
        margin: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 460,
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.12em",
        color: "var(--cream-3)",
      }}>
        Loading map…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        margin: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 160,
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        color: "var(--cream-3)",
        padding: "0 24px",
        textAlign: "center",
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px" }}>
      <div
        ref={containerRef}
        style={{
          height: 460,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--line)",
        }}
      />
      <p style={{
        margin: "8px 0 0",
        fontFamily: "var(--font-ui)",
        fontSize: 11.5,
        color: "var(--cream-3)",
        textAlign: "center",
        letterSpacing: "0.02em",
      }}>
        Tap a pin to see the course.
      </p>
    </div>
  );
};

"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature, FeatureCollection } from "topojson-client";

// Types from /api/comets
type CometArc = {
  date: string;
  country: string;
  count: number;
  coords: {
    origin: [number, number];
    dest: [number, number];
  };
};

type HourBucket = {
  date: string;
  arcs: CometArc[];
};

type Props = {
  dataUrl: string;
  width?: number;
  height?: number;
};

export default function CometMap({
  dataUrl,
  width = 1000,
  height = 600,
}: Props) {
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [worldData, setWorldData] = useState<any | null>(null);
  const [index, setIndex] = useState(0);

  // Load comet data
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch(dataUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const raw: HourBucket[] = await res.json();
        if (!cancelled) setBuckets(raw || []);
      } catch (err) {
        console.error("Comet data error", err);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dataUrl]);

  // Load world map topo/geojson
  useEffect(() => {
    const fetchWorld = async () => {
      try {
        const res = await fetch("/world-110m.json");
        const json = await res.json();
        setWorldData(json);
      } catch (err) {
        console.error("World map load error", err);
      }
    };
    fetchWorld();
  }, []);

  // Autoplay animation
  useEffect(() => {
    if (!buckets.length) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % buckets.length);
    }, 700);
    return () => clearInterval(id);
  }, [buckets]);

  // Projection + path generator
  const proj = useMemo(
    () => geoMercator().scale(140).translate([width / 2, height / 1.4]),
    [width, height],
  );

  const pathGen = useMemo(() => geoPath(proj), [proj]);

  // Convert TopoJSON → GeoJSON features (or accept plain GeoJSON)
  const countries = useMemo(() => {
    if (!worldData) return [];
    try {
      if (worldData.type === "Topology" && worldData.objects) {
        const objects = worldData.objects;
        const key = objects.countries
          ? "countries"
          : Object.keys(objects)[0];
        const fc = feature(
          worldData,
          objects[key],
        ) as FeatureCollection;
        return fc.features || [];
      }

      if (worldData.type === "FeatureCollection" && worldData.features) {
        return worldData.features;
      }
    } catch (err) {
      console.error("World map parse error", err);
    }
    return [];
  }, [worldData]);

  // Smooth Bézier arc between two lon/lat points
  const makeArcPath = (origin: [number, number], dest: [number, number]) => {
    const projOrigin = proj(origin);
    const projDest = proj(dest);
    if (!projOrigin || !projDest) return "";

    const [x1, y1] = projOrigin;
    const [x2, y2] = projDest;

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const distance = Math.hypot(x2 - x1, y2 - y1);
    const curveOffset = -0.25 * distance;

    const cx1 = mx;
    const cy1 = my + curveOffset;
    const cx2 = mx;
    const cy2 = my + curveOffset;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  };

  if (!worldData || !buckets.length) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-neutral-500">
        Loading comet map…
      </div>
    );
  }

  const current = buckets[index] || { arcs: [] };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "radial-gradient(circle at 50% 30%, #1a1a1a, #000)",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="cometGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="50%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>

          <filter id="cometGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* World map */}
        <g>
          {countries.map((f: any, i: number) => (
            <path
              key={i}
              d={pathGen(f) || ""}
              fill="#111"
              stroke="#333"
              strokeWidth={0.4}
            />
          ))}
        </g>

        {/* Comet arcs */}
        <g filter="url(#cometGlow)">
          {current.arcs.map((arc, i) => {
            const d = makeArcPath(arc.coords.origin, arc.coords.dest);
            if (!d) return null;

            const strokeW = Math.min(6, 1 + arc.count / 30);

            return (
              <path
                key={i}
                d={d}
                stroke="url(#cometGrad)"
                strokeWidth={strokeW}
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />
            );
          })}
        </g>

        {/* Timestamp label */}
        <text
          x={20}
          y={40}
          fill="#f97316"
          fontSize="22"
          fontWeight="600"
          style={{ textShadow: "0 0 6px #ec4899" }}
        >
          {current.date}
        </text>
      </svg>
    </div>
  );
}
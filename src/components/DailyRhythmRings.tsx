"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";

export type HeartbeatPoint = {
  timestamp: string;
  intensity: number;
  metrics: {
    orders: number;
    shipping_labels: number;
    total_packers: number;
    total_pickers: number;
    total_warehouses_packers: number;
    total_warehouses_pickers: number;
    active_countries: number;
  };
};

type RhythmEntry = {
  hour: number;
  hourLabel: string;
  intensity: number;
  normValue: number;
};

type DayRhythm = {
  dayKey: string; // YYYY-MM-DD
  label: string; // e.g. "Thu 21 Nov"
  data: RhythmEntry[];
};

const MAX_DAYS = 7;

type Props = {
  dataUrl: string;
};

function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function RhythmTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as RhythmEntry;
  if (!p) return null;

  return (
    <div className="rounded-md bg-black/90 px-3 py-2 text-xs text-neutral-100 shadow-lg border border-fuchsia-400/40">
      <div className="font-semibold mb-1">{p.hourLabel}</div>
      <div>Intensity: {p.intensity.toFixed(1)}</div>
    </div>
  );
}

export default function DailyRhythmRings({ dataUrl }: Props) {
  const [points, setPoints] = useState<HeartbeatPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch(dataUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw: HeartbeatPoint[] = await res.json();
        if (cancelled) return;

        const cleaned = (raw || [])
          .filter(
            (p) =>
              p &&
              typeof p.intensity === "number" &&
              Number.isFinite(p.intensity) &&
              p.timestamp,
          )
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        setPoints(cleaned);
      } catch (err) {
        console.error("Failed to load heartbeat data (rhythm)", err);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dataUrl]);

  const dayRhythms: DayRhythm[] = useMemo(() => {
    if (!points.length) return [];

    const byDay = new Map<string, { date: Date; values: HeartbeatPoint[] }>();

    for (const p of points) {
      const d = new Date(p.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      const entry = byDay.get(dayKey);
      if (!entry) {
        byDay.set(dayKey, { date: d, values: [p] });
      } else {
        entry.values.push(p);
      }
    }

    const sortedDays = Array.from(byDay.entries()).sort(
      ([a], [b]) => a.localeCompare(b),
    );

    const lastDays =
      sortedDays.length > MAX_DAYS
        ? sortedDays.slice(-MAX_DAYS)
        : sortedDays;

    let globalMin: number | null = null;
    let globalMax: number | null = null;

    for (const [, { values }] of lastDays) {
      for (const p of values) {
        const v = p.intensity;
        if (!Number.isFinite(v)) continue;
        if (globalMin === null || v < globalMin) globalMin = v;
        if (globalMax === null || v > globalMax) globalMax = v;
      }
    }

    if (globalMin === null || globalMax === null) return [];

    if (globalMin === globalMax) {
      globalMax = globalMin + 1;
    }

    const result: DayRhythm[] = lastDays.map(([dayKey, { date, values }]) => {
      const byHour = new Map<number, number[]>();

      for (const p of values) {
        const d = new Date(p.timestamp);
        const h = d.getUTCHours(); // keep UTC to match your CSV aggregation
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h)!.push(p.intensity);
      }

      const data: RhythmEntry[] = [];
      for (let hour = 0; hour < 24; hour += 1) {
        const arr = byHour.get(hour) || [];
        const avg =
          arr.length === 0
            ? 0
            : arr.reduce((a, b) => a + b, 0) / arr.length;
        const t = (avg - globalMin!) / (globalMax! - globalMin!);
        const normValue = 20 + 80 * t; // 20–100 range for the bar length
        const hourLabel = `${hour.toString().padStart(2, "0")}:00`;
        data.push({
          hour,
          hourLabel,
          intensity: avg,
          normValue,
        });
      }

      return {
        dayKey,
        label: formatDayLabel(date),
        data,
      };
    });

    return result;
  }, [points]);

  if (!dayRhythms.length) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-neutral-500">
        Loading warehouse rhythm…
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {dayRhythms.map((day) => (
          <div
            key={day.dayKey}
            className="relative rounded-2xl bg-black/80 border border-fuchsia-500/30 px-4 pb-4 pt-6 shadow-[0_0_40px_rgba(236,72,153,0.35)]"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-fuchsia-500/10 via-black/0 to-amber-500/10 pointer-events-none" />
            <div className="relative z-10 mb-2 text-xs uppercase tracking-wide text-fuchsia-300/80">
              Warehouse Rhythm
            </div>
            <div className="relative z-10 mb-3 text-lg font-semibold text-neutral-50">
              {day.label}
            </div>
            <div className="relative z-10 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="20%"
                  outerRadius="100%"
                  data={day.data}
                  startAngle={90}
                  endAngle={-270}
                >
                  <defs>
                    <radialGradient
                      id={`ringGradient-${day.dayKey}`}
                      cx="50%"
                      cy="50%"
                      r="50%"
                    >
                      <stop offset="0%" stopColor="#0f172a" stopOpacity={0.1} />
                      <stop
                        offset="60%"
                        stopColor="#ec4899"
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="100%"
                        stopColor="#f97316"
                        stopOpacity={1}
                      />
                    </radialGradient>
                  </defs>
                  <Tooltip content={<RhythmTooltip />} />
                  <RadialBar
                    minAngle={2}
                    background
                    clockWise
                    dataKey="normValue"
                    cornerRadius={4}
                    fill={`url(#ringGradient-${day.dayKey})`}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="relative z-10 mt-3 flex justify-between text-[11px] text-neutral-500">
              <span>One spoke per hour (UTC)</span>
              <span>Brighter = more intense</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
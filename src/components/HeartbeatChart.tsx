"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
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

type Props = {
  dataUrl: string;
};

const MAX_RECENT_POINTS = 96; // last ~4 days if hourly

type RechartsPayload = {
  payload: HeartbeatPoint;
};

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HeartbeatTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length || !label) return null;
  const first = payload[0] as unknown as RechartsPayload;
  const point = first.payload;
  if (!point || !point.metrics) return null;

  const m = point.metrics;

  return (
    <div className="rounded-md bg-black/90 px-3 py-2 text-xs text-neutral-100 shadow-lg border border-red-500/40">
      <div className="font-semibold mb-1">
        {formatTooltipLabel(label as string)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span>Intensity</span>
        <span className="text-right">
          {point.intensity.toFixed(1)}
        </span>
        <span>Orders</span>
        <span className="text-right">{m.orders}</span>
        <span>Labels</span>
        <span className="text-right">{m.shipping_labels}</span>
        <span>Packers</span>
        <span className="text-right">{m.total_packers}</span>
        <span>Pickers</span>
        <span className="text-right">{m.total_pickers}</span>
        <span>WH (packers)</span>
        <span className="text-right">
          {m.total_warehouses_packers}
        </span>
        <span>WH (pickers)</span>
        <span className="text-right">
          {m.total_warehouses_pickers}
        </span>
        <span>Countries</span>
        <span className="text-right">{m.active_countries}</span>
      </div>
    </div>
  );
}

type DotProps = {
  cx?: number;
  cy?: number;
  index?: number;
};

function PulseDot({
  cx,
  cy,
  index,
  latestIndex,
  activeIndex,
}: DotProps & { latestIndex: number | null; activeIndex: number | null }) {
  if (
    cx == null ||
    cy == null ||
    index == null ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy)
  ) {
    return null;
  }

  const isLatest = latestIndex != null && index === latestIndex;
  const isActive = activeIndex != null && index === activeIndex;

  const r = isLatest ? 4 : 2;
  const strokeWidth = isLatest ? 2 : 1;
  const opacity = isActive || isLatest ? 1 : 0.3;

  return (
    <g>
      {isLatest && (
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="none"
          stroke="rgba(248, 113, 113, 0.4)"
          strokeWidth={1}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#fecaca"
        stroke="#f97373"
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    </g>
  );
}

export default function HeartbeatChart({ dataUrl }: Props) {
  const [data, setData] = useState<HeartbeatPoint[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

        setData(cleaned);
      } catch (err) {
        console.error("Failed to load heartbeat data", err);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dataUrl]);

  const recentData = useMemo(() => {
    if (!data.length) return [];
    if (data.length <= MAX_RECENT_POINTS) return data;
    return data.slice(-MAX_RECENT_POINTS);
  }, [data]);

  const latestIndex = useMemo(
    () => (recentData.length ? recentData.length - 1 : null),
    [recentData],
  );

  useEffect(() => {
    if (!recentData.length) {
      setActiveIndex(null);
      return;
    }
    setActiveIndex(recentData.length - 1);

    const beatMs = 800;
    const id = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev == null) return recentData.length - 1;
        return (prev + 1) % recentData.length;
      });
    }, beatMs);

    return () => clearInterval(id);
  }, [recentData]);

  const maxIntensity = useMemo(() => {
    if (!recentData.length) return 0;
    return recentData.reduce(
      (max, p) => (p.intensity > max ? p.intensity : max),
      recentData[0].intensity,
    );
  }, [recentData]);

  const animatedData = useMemo(() => {
    if (activeIndex == null || !recentData.length) return recentData;
    return recentData.map((p, idx) => ({
      ...p,
      intensity: idx === activeIndex ? p.intensity * 1.08 : p.intensity,
    }));
  }, [recentData, activeIndex]);

  const [minAll, maxAll] = useMemo(() => {
    if (!data.length) return [0, 1];
    let min = data[0].intensity;
    let max = data[0].intensity;
    for (const p of data) {
      if (p.intensity < min) min = p.intensity;
      if (p.intensity > max) max = p.intensity;
    }
    if (min === max) max = min + 1;
    return [min, max];
  }, [data]);

  if (!data.length) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-neutral-500">
        Loading warehouse heartbeat…
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={animatedData}>
            <defs>
              {/* neon-ish gradient for the area */}
              <linearGradient
                id="heartbeatGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                <stop offset="40%" stopColor="#fb7185" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTimeLabel}
              minTickGap={24}
              stroke="#9ca3af"
            />
            <YAxis
              domain={[0, maxIntensity * 1.2]}
              tickFormatter={(v) => Math.round(v).toString()}
              stroke="#9ca3af"
            />
            <Tooltip content={<HeartbeatTooltip />} />
            <Area
              type="monotone"
              dataKey="intensity"
              stroke="#fb7185"
              strokeWidth={2}
              fill="url(#heartbeatGradient)"
              isAnimationActive
              dot={(props) => (
                <PulseDot
                  {...(props as DotProps)}
                  latestIndex={latestIndex}
                  activeIndex={activeIndex}
                />
              )}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap strip – all history */}
      <div className="mt-6 h-3 w-full rounded-sm overflow-hidden bg-neutral-900/80">
        <div className="flex h-full">
          {data.map((p, idx) => {
            const t =
              maxAll === minAll
                ? 0
                : (p.intensity - minAll) / (maxAll - minAll);
            const lightness = 20 + 50 * t;
            const opacity = 0.35 + 0.55 * t;
            const bg = `hsl(10 90% ${lightness}%)`;
            return (
              <div
                key={`${p.timestamp}-${idx}`}
                style={{
                  flex: "1 0 auto",
                  backgroundColor: bg,
                  opacity,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-neutral-500 text-right">
        Top strip: latest ~{MAX_RECENT_POINTS} hours in detail ·
        Bottom strip: full history as intensity heatmap
      </div>
    </div>
  );
}
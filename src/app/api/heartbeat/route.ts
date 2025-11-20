import { NextResponse } from "next/server";
import Papa from "papaparse";

const CSV_URLS = {
  orders:
    "https://bfcm-2025-data-viz.shiphero.com/sh_metrics/metrics/orders.csv",
  shippingLabels:
    "https://bfcm-2025-data-viz.shiphero.com/sh_metrics/metrics/shipping_labels.csv",
  shippingsByCountry:
    "https://bfcm-2025-data-viz.shiphero.com/sh_metrics/metrics/shippings_by_country.csv",
  totalPackers:
    "https://bfcm-2025-data-viz.shiphero.com/sh_metrics/metrics/total_packers.csv",
  totalPickers:
    "https://bfcm-2025-data-viz.shiphero.com/sh_metrics/metrics/total_pickers.csv",
};

type RawRow = Record<string, string>;

type MetricsRow = {
  date: string;
  orders?: number;
  shipping_labels?: number;
  total_packers?: number;
  total_warehouses_packers?: number;
  total_pickers?: number;
  total_warehouses_pickers?: number;
  active_countries?: number;
};

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

async function fetchCsvSafe(label: string, url: string): Promise<RawRow[]> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WarehouseHeartbeat/1.0; +https://example.com)",
        Accept: "text/csv,text/plain,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      console.error(
        `[heartbeat] ${label} fetch failed with status ${res.status}`,
      );
      return [];
    }

    const text = await res.text();
    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length) {
      console.error(
        `[heartbeat] ${label} parse errors:`,
        parsed.errors.slice(0, 3),
      );
    }

    return parsed.data;
  } catch (err) {
    console.error(`[heartbeat] ${label} fetch error:`, err);
    return [];
  }
}

function ensureRow(
  map: Map<string, MetricsRow>,
  dateStr: string,
): MetricsRow {
  let row = map.get(dateStr);
  if (!row) {
    row = { date: dateStr };
    map.set(dateStr, row);
  }
  return row;
}

function percentile75(values: number[]): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(0.75 * (sorted.length - 1));
  return sorted[idx] || 1;
}

function computeHeartbeat(rows: MetricsRow[]): HeartbeatPoint[] {
  const safeRows = rows.map((r) => ({
    ...r,
    orders: r.orders ?? 0,
    shipping_labels: r.shipping_labels ?? 0,
    total_packers: r.total_packers ?? 0,
    total_pickers: r.total_pickers ?? 0,
    total_warehouses_packers: r.total_warehouses_packers ?? 0,
    total_warehouses_pickers: r.total_warehouses_pickers ?? 0,
    active_countries: r.active_countries ?? 0,
  }));

  const metricsKeys = [
    "orders",
    "shipping_labels",
    "total_packers",
    "total_pickers",
    "total_warehouses_packers",
    "total_warehouses_pickers",
    "active_countries",
  ] as const;

  const weights: Record<(typeof metricsKeys)[number], number> = {
    orders: 1.0,
    shipping_labels: 1.0,
    total_packers: 0.7,
    total_pickers: 0.7,
    total_warehouses_packers: 0.4,
    total_warehouses_pickers: 0.4,
    active_countries: 0.5,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const q75: Record<string, number> = {};
  for (const key of metricsKeys) {
    const arr = safeRows.map((r) => r[key] as number);
    q75[key] = percentile75(arr) || 1;
  }

  return safeRows
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      let score = 0;
      for (const key of metricsKeys) {
        const v = (r[key] as number) ?? 0;
        const denom = q75[key] || 1;
        const norm = v / denom;
        score += weights[key] * norm;
      }
      const intensity = (100 * score) / totalWeight;
      const timestamp = r.date.replace(" ", "T") + "Z";

      return {
        timestamp,
        intensity,
        metrics: {
          orders: r.orders,
          shipping_labels: r.shipping_labels,
          total_packers: r.total_packers,
          total_pickers: r.total_pickers,
          total_warehouses_packers: r.total_warehouses_packers,
          total_warehouses_pickers: r.total_warehouses_pickers,
          active_countries: r.active_countries,
        },
      };
    });
}

export async function GET() {
  try {
    const [ordersCsv, labelsCsv, byCountryCsv, packersCsv, pickersCsv] =
      await Promise.all([
        fetchCsvSafe("orders", CSV_URLS.orders),
        fetchCsvSafe("shipping_labels", CSV_URLS.shippingLabels),
        fetchCsvSafe("shippings_by_country", CSV_URLS.shippingsByCountry),
        fetchCsvSafe("total_packers", CSV_URLS.totalPackers),
        fetchCsvSafe("total_pickers", CSV_URLS.totalPickers),
      ]);

    const map = new Map<string, MetricsRow>();

    // orders.csv: date_utc, orders
    for (const row of ordersCsv) {
      const rawDate = row["date_utc"] ?? row["date"];
      const dateStr = rawDate?.trim();
      if (!dateStr) continue;
      const target = ensureRow(map, dateStr);
      const orders = Number(row["orders"]);
      if (Number.isFinite(orders)) target.orders = orders;
    }

    // shipping_labels.csv: date, shipping_labels
    for (const row of labelsCsv) {
      const dateStr = row["date"]?.trim();
      if (!dateStr) continue;
      const target = ensureRow(map, dateStr);
      const labels = Number(row["shipping_labels"]);
      if (Number.isFinite(labels)) target.shipping_labels = labels;
    }

    // total_packers.csv: date, total_packers, total_warehouses
    for (const row of packersCsv) {
      const dateStr = row["date"]?.trim();
      if (!dateStr) continue;
      const target = ensureRow(map, dateStr);
      const packers = Number(row["total_packers"]);
      const warehouses = Number(row["total_warehouses"]);
      if (Number.isFinite(packers)) target.total_packers = packers;
      if (Number.isFinite(warehouses))
        target.total_warehouses_packers = warehouses;
    }

    // total_pickers.csv: date, total_pickers, total_warehouses
    for (const row of pickersCsv) {
      const dateStr = row["date"]?.trim();
      if (!dateStr) continue;
      const target = ensureRow(map, dateStr);
      const pickers = Number(row["total_pickers"]);
      const warehouses = Number(row["total_warehouses"]);
      if (Number.isFinite(pickers)) target.total_pickers = pickers;
      if (Number.isFinite(warehouses))
        target.total_warehouses_pickers = warehouses;
    }

    // shippings_by_country.csv: date, shipping_country
    const countriesByDate = new Map<string, Set<string>>();
    for (const row of byCountryCsv) {
      const dateStr = row["date"]?.trim();
      const country = row["shipping_country"]?.trim();
      if (!dateStr || !country) continue;
      let set = countriesByDate.get(dateStr);
      if (!set) {
        set = new Set<string>();
        countriesByDate.set(dateStr, set);
      }
      set.add(country);
    }

    for (const [dateStr, set] of countriesByDate.entries()) {
      const target = ensureRow(map, dateStr);
      target.active_countries = set.size;
    }

    const rows = Array.from(map.values());
    if (!rows.length) {
      console.error("[heartbeat] No rows built from CSVs");
      return NextResponse.json([], { status: 200 });
    }

    const heartbeat = computeHeartbeat(rows);
    return NextResponse.json(heartbeat, { status: 200 });
  } catch (err) {
    console.error("Heartbeat API fatal error", err);
    return NextResponse.json(
      { error: "failed to build heartbeat" },
      { status: 500 },
    );
  }
}
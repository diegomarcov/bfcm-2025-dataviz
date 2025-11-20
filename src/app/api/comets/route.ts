import { NextResponse } from "next/server";
import Papa from "papaparse";

// PUBLIC CSV (country-level shipping labels)
const CSV_URL =
  "https://bfcm-2025-data-viz.shiphero.com/sh_metrics/metrics/shippings_by_country.csv";

// New York (warehouse origin for comets)
const ORIGIN: [number, number] = [-74.0060, 40.7128];

// Simple ISO2 → lat/lon lookup for destination countries.
// (Add more if needed — but most common countries are included.)
const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [-98.35, 39.50],
  CA: [-106.35, 56.13],
  MX: [-102.55, 23.63],
  GB: [-3.43, 55.38],
  DE: [10.45, 51.16],
  FR: [2.21, 46.23],
  ES: [-3.75, 40.46],
  IT: [12.57, 41.87],
  NL: [5.29, 52.13],
  BE: [4.47, 50.50],
  AU: [133.78, -25.27],
  NZ: [174.89, -40.90],
  BR: [-51.93, -14.23],
  AR: [-63.62, -38.42],
  CL: [-71.54, -35.68],
  ZA: [22.94, -30.56],
  JP: [138.25, 36.20],
  CN: [104.19, 35.86],
  IN: [78.96, 20.59],
  SG: [103.82, 1.35],
  KR: [127.98, 37.66],
  // fallback handled below
};

type RawRow = {
  date: string;
  shipping_country: string;
  shipping_labels_by_country: string;
};

type CometArc = {
  date: string;
  country: string;
  count: number;
  coords: {
    origin: [number, number];
    dest: [number, number];
  };
};

async function fetchCsv(): Promise<RawRow[]> {
  try {
    const res = await fetch(CSV_URL, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (comets/1.0; +https://example.com)",
        Accept: "text/csv,text/plain,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      console.error("CSV fetch failed:", res.status);
      return [];
    }

    const text = await res.text();
    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    return parsed.data;
  } catch (err) {
    console.error("CSV error:", err);
    return [];
  }
}

export async function GET() {
  const rows = await fetchCsv();
  if (!rows.length) return NextResponse.json([]);

  const byDate = new Map<string, CometArc[]>();

  for (const row of rows) {
    const date = row.date?.trim();
    const country = row.shipping_country?.trim();
    const count = Number(row.shipping_labels_by_country);

    if (!date || !country || !Number.isFinite(count)) continue;

    const dest =
      COUNTRY_COORDS[country] ?? COUNTRY_COORDS["US"] ?? [-98.35, 39.50];

    let arr = byDate.get(date);
    if (!arr) {
      arr = [];
      byDate.set(date, arr);
    }

    arr.push({
      date,
      country,
      count,
      coords: {
        origin: ORIGIN,
        dest,
      },
    });
  }

  const sorted = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, arcs]) => ({
      date,
      arcs,
    }));

  return NextResponse.json(sorted, { status: 200 });
}
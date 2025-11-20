"use client";

import dynamic from "next/dynamic";

const CometMap = dynamic(() => import("@/components/CometMap"), {
  ssr: false,
});

export default function CometsPage() {
  return (
    <main className="min-h-screen bg-black text-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold mb-2">Warehouse Comet Trails</h1>
        <p className="text-sm text-neutral-400 max-w-xl mb-8">
          Each hour launches neon arcs from New York to active shipping
          countries. Arc width and glow represent shipping volume.
        </p>

        <div className="w-full h-[650px] rounded-2xl overflow-hidden border border-fuchsia-600/20 shadow-[0_0_40px_rgba(236,72,153,0.3)]">
          <CometMap dataUrl="/api/comets" />
        </div>
      </div>
    </main>
  );
}
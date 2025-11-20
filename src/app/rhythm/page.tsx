import DailyRhythmRings from "@/components/DailyRhythmRings";

export default function RhythmPage() {
  return (
    <main className="min-h-screen bg-black text-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">
            Warehouse Rhythm Rings
          </h1>
          <p className="text-sm text-neutral-400 max-w-xl">
            Each ring is a day. Each spoke is an hour. Brighter and longer
            spokes mark the most intense moments in your fulfillment cycle.
          </p>
        </header>
        <DailyRhythmRings dataUrl="/api/heartbeat" />
      </div>
    </main>
  );
}
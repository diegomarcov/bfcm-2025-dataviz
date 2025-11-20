export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-neutral-200 flex flex-col items-center justify-center px-4 py-10">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-semibold mb-4 text-white">
          ShipHero BFCM&nbsp;2025<br />Data Visualizations
        </h1>

        <p className="text-neutral-400 mb-8 text-sm">
          A collection of experimental, real-time visualizations exploring
          fulfillment activity across orders, warehouses, countries, and more.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
          <a
            href="/heartbeat"
            className="px-4 py-3 rounded-lg bg-neutral-900 border border-pink-600/30 hover:bg-neutral-800 transition text-pink-300 text-sm"
          >
            ➜ Warehouse Heartbeat
          </a>

          <a
            href="/rhythm"
            className="px-4 py-3 rounded-lg bg-neutral-900 border border-fuchsia-600/30 hover:bg-neutral-800 transition text-fuchsia-300 text-sm"
          >
            ➜ Daily Rhythm Rings
          </a>

          <a
            href="/comets"
            className="px-4 py-3 rounded-lg bg-neutral-900 border border-orange-500/30 hover:bg-neutral-800 transition text-orange-300 text-sm"
          >
            ➜ Comet Trails Map
          </a>
        </div>

        <footer className="mt-12 text-xs text-neutral-600">
          Experimental visualizations · ShipHero BFCM 2025
        </footer>
      </div>
    </main>
  );
}
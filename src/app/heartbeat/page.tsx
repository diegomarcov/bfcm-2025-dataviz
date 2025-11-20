import HeartbeatChart from "@/components/HeartbeatChart";

export default function HeartbeatPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl font-semibold mb-4">
        Warehouse Heartbeat
      </h1>
      <p className="text-sm text-neutral-500 mb-6 text-center max-w-xl">
        Hourly operational intensity across orders, labels, pickers, packers,
        warehouses, and active shipping countries.
      </p>
      <div className="w-full max-w-4xl">
        <HeartbeatChart dataUrl="/api/heartbeat" />
      </div>
    </main>
  );
}
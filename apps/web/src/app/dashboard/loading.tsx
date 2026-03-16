export default function DashboardLoading() {
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-2 border-white/10 border-t-accent animate-spin"
          aria-label="Loading dashboard…"
          role="status"
        />
        <p className="text-xs text-white/25 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

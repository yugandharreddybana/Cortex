import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-accent" aria-label="Loading dashboard…" role="status" />
        <p className="text-xs text-white/25 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

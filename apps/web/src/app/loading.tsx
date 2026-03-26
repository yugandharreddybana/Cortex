import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <Loader2 className="w-8 h-8 animate-spin text-accent" aria-label="Loading…" role="status" />
        <p className="text-sm text-white/30 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div
          className="w-8 h-8 rounded-full border-2 border-white/10 border-t-accent animate-spin"
          aria-label="Loading…"
          role="status"
        />
        <p className="text-sm text-white/30 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

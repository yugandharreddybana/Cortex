"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Cortex] Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-20">
      {/* Glyph */}
      <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 5.5v4M9 12h.01M3 15l6-10.5L15 15H3z"
            stroke="rgba(255,255,255,0.40)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Copy */}
      <div className="flex flex-col items-center gap-2 text-center max-w-xs">
        <h2 className="text-sm font-semibold text-white/70 tracking-tight">
          Something went wrong
        </h2>
        <p className="text-xs text-white/35 leading-relaxed">
          {error.message || "Failed to load this section. Try again or reload."}
        </p>
        {error.digest && (
          <p className="font-mono text-[9px] text-white/20 mt-0.5">
            {error.digest}
          </p>
        )}
      </div>

      {/* Action */}
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-accent/90 text-white text-xs font-medium hover:bg-accent transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

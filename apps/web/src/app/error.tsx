"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Cortex] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.55, ease: [0.20, 0.90, 0.30, 1.00] }}
        className="flex flex-col items-center text-center max-w-sm"
      >
        {/* Icon */}
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
              transform:  "scale(2.5)",
              filter:     "blur(20px)",
            }}
          />
          <div className="relative w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Copy */}
        <h1 className="text-2xl font-semibold tracking-tight text-white/80 mb-3">
          We lost our train of thought.
        </h1>
        <p className="text-sm text-white/40 leading-relaxed mb-1">
          Something unexpected happened. Your data is safe â€” this is just a
          temporary hiccup.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-white/20 mt-2 mb-0">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-8">
          <button
            onClick={reset}
            className="h-10 px-5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-semibold active:scale-[0.97] transition-all duration-150 transform-gpu shadow-glow-sm"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="h-10 px-5 rounded-xl border border-white/[0.06] text-white/55 text-sm font-medium hover:text-white/80 hover:bg-white/[0.04] active:scale-[0.97] transition-all duration-150 transform-gpu"
          >
            Back to Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

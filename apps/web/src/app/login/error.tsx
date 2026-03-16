"use client";

import { useEffect } from "react";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Cortex Login] Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold mb-2">Login Error</h2>
      <p className="text-white/60 mb-6 text-sm">
        {error.message || "Something went wrong while trying to log in."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-accent rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";

/**
 * global-error.tsx — catches errors in the root layout itself.
 * Must include its own <html> and <body> tags (Next.js requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Cortex] Global error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#06060C",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          padding: "0 24px",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 7v5M11 15h.01M3.5 17.5l7.5-13 7.5 13H3.5z"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Copy */}
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255,255,255,0.80)",
              letterSpacing: "-0.01em",
            }}
          >
            Critical error
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              color: "rgba(255,255,255,0.40)",
              lineHeight: 1.5,
            }}
          >
            {error.message || "Cortex encountered a critical error and cannot continue."}
          </p>
        </div>

        {/* Retry */}
        <button
          onClick={reset}
          style={{
            all: "unset",
            padding: "8px 18px",
            borderRadius: 8,
            background: "#818CF8",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reload app
        </button>
      </body>
    </html>
  );
}

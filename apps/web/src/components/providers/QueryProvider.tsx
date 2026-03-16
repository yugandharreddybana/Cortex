"use client";

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// ─── Singleton factory ────────────────────────────────────────────────────────
/**
 * Creates a QueryClient with production-sensible defaults:
 *  staleTime  5 min  — data is fresh for 5 minutes after fetching
 *  gcTime     10 min — unused cache is GC'd after 10 minutes of inactivity
 *  retry      1      — one automatic retry before surfacing errors
 *  refetchOnWindowFocus false — avoids surprise refetches in research mode
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            5 * 60 * 1000,  // 5 min
        gcTime:               10 * 60 * 1000, // 10 min
        retry:                1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// ─── Module-level singleton for the server (avoids re-creation per request) ──
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client so requests don't share state
    return makeQueryClient();
  }
  // Browser: reuse across re-renders / React StrictMode double-invoke
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // NOTE: Avoid useState for QueryClient so that data isn't cleared on
  // Suspense boundary, and also so it persists across React DevTools reloads.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

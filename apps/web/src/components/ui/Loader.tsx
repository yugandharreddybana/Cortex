"use client";

/**
 * Loader — the ONE canonical loading indicator for the entire Cortex app.
 *
 * Three modes, one component:
 *   • <Loader />                    inline spinner (default size sm, accent variant)
 *   • <Loader page />               centered viewport loader (use in /loading.tsx, full routes)
 *   • <Loader fullScreen />         app-wide blocking overlay — read-only;
 *                                   automatic when store.loadingCount > 0 via <GlobalLoaderHost />
 *
 * Replaces (deleted):
 *   Spinner, GlobalLoader, PremiumLoader, LoadingSkeleton, SettingSkeleton.
 *
 * Design: a single concentric ring rendered with `conic-gradient` + a subtle
 * accent glow.  Tuned for premium feel — no jank, no shimmer/skeleton noise,
 * predictable behaviour at every size.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

type LoaderSize    = "xs" | "sm" | "md" | "lg";
type LoaderVariant = "accent" | "white" | "muted";

interface LoaderProps {
  /** Inline spinner size (ignored when page / fullScreen). */
  size?:       LoaderSize;
  /** Color treatment. Defaults to accent. */
  variant?:    LoaderVariant;
  className?:  string;
  /** Center the loader in a 100vh viewport — for /loading.tsx style routes. */
  page?:       boolean;
  /** Render an app-wide blocking overlay. Use only via <GlobalLoaderHost />. */
  fullScreen?: boolean;
  /** Optional caption (page mode only). */
  label?:      string;
}

const SIZE_PX: Record<LoaderSize, number> = { xs: 12, sm: 16, md: 24, lg: 40 };
const STROKE: Record<LoaderSize, number> = { xs: 1.5, sm: 2, md: 2.5, lg: 3 };

const VARIANT_COLOR: Record<LoaderVariant, string> = {
  accent: "var(--accent, #818CF8)",
  white:  "rgba(255,255,255,0.9)",
  muted:  "rgba(255,255,255,0.35)",
};

function Ring({ size, variant }: { size: LoaderSize; variant: LoaderVariant }) {
  const px = SIZE_PX[size];
  const sw = STROKE[size];
  const color = VARIANT_COLOR[variant];

  // Conic-gradient ring → far smoother than four-borders trick at small sizes,
  // and supports any color without a 1px hairline artefact.
  return (
    <motion.span
      role="status"
      aria-label="Loading"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      style={{
        width:  px,
        height: px,
        background: `conic-gradient(from 0deg, ${color} 0%, ${color}00 75%)`,
        WebkitMask: `radial-gradient(circle ${px / 2}px, transparent ${px / 2 - sw}px, #000 ${px / 2 - sw + 0.5}px)`,
        mask:       `radial-gradient(circle ${px / 2}px, transparent ${px / 2 - sw}px, #000 ${px / 2 - sw + 0.5}px)`,
      }}
      className="inline-block rounded-full"
    />
  );
}

export function Loader({
  size = "sm",
  variant = "accent",
  className,
  page = false,
  fullScreen = false,
  label,
}: LoaderProps) {
  if (fullScreen) {
    // Centered floating island — non-blocking pointer for nested popovers
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] pointer-events-none",
          className,
        )}
      >
        <div className="absolute inset-0 bg-accent/15 blur-[28px] rounded-full scale-150" />
        <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-elevated/90 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <Ring size="md" variant={variant} />
        </div>
      </motion.div>
    );
  }

  if (page) {
    return (
      <div className={cn("min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-bg", className)}>
        <Ring size="lg" variant={variant} />
        {label ? <p className="text-xs text-white/35 tracking-wide">{label}</p> : null}
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      <Ring size={size} variant={variant} />
    </span>
  );
}

/**
 * GlobalLoaderHost — mount once at the providers root.
 * Drives the fullScreen overlay from the dashboard store's loadingCount.
 */
export function GlobalLoaderHost() {
  const isLoading = useDashboardStore((s) => s.loadingCount > 0 || s.isGlobalLoading);
  return (
    <AnimatePresence>
      {isLoading ? <Loader fullScreen /> : null}
    </AnimatePresence>
  );
}

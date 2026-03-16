"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
// Uses a shimmer animation — never spinners.

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Fully round (avatar / icon use-case) */
  circle?: boolean;
}

export function Skeleton({ className, circle = false, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading..."
      className={cn(
        "relative overflow-hidden",
        "bg-white/[0.05]",
        circle ? "rounded-full" : "rounded-xl",
        // Shimmer sweep
        "before:absolute before:inset-0",
        "before:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_40%,rgba(255,255,255,0.10)_50%,rgba(255,255,255,0.06)_60%,transparent_100%)]",
        "before:bg-[length:200%_100%]",
        "before:animate-shimmer",
        "before:transform-gpu",
        className,
      )}
      {...props}
    />
  );
}

// ─── Skeleton presets ─────────────────────────────────────────────────────────

export const SkeletonText = ({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) => (
  <div className={cn("space-y-2.5", className)} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="h-4"
        style={{ width: i === lines - 1 ? "60%" : "100%" }}
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div
    className={cn(
      "rounded-2xl bg-surface border border-white/[0.07] p-4 space-y-4",
      className,
    )}
    style={style}
  >
    <div className="flex items-center gap-3">
      <Skeleton circle className="w-8 h-8 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <Skeleton className="h-32" />
    <SkeletonText lines={2} />
  </div>
);

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";

// ── Base shimmer block ───────────────────────────────────────────────────────
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg",
        "bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04]",
        "bg-[length:200%_100%]",
        "animate-[shimmer_1.8s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

// ── Highlight card skeleton ──────────────────────────────────────────────────
export function HighlightCardSkeleton() {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 space-y-3",
        "border border-white/[0.05]",
      )}
    >
      {/* Source row */}
      <div className="flex items-center gap-2">
        <Shimmer className="w-4 h-4 rounded-sm" />
        <Shimmer className="h-2.5 w-28 rounded-full" />
      </div>

      {/* Text lines */}
      <div className="space-y-2 pl-3 border-l border-white/[0.06]">
        <Shimmer className="h-3 w-full rounded-full" />
        <Shimmer className="h-3 w-5/6 rounded-full" />
        <Shimmer className="h-3 w-4/6 rounded-full" />
      </div>

      {/* Tags row */}
      <div className="flex gap-2">
        <Shimmer className="h-5 w-14 rounded-full" />
        <Shimmer className="h-5 w-20 rounded-full" />
      </div>

      {/* Action row */}
      <div className="flex gap-1.5 justify-end">
        <Shimmer className="w-7 h-7 rounded-xl" />
        <Shimmer className="w-7 h-7 rounded-xl" />
        <Shimmer className="w-7 h-7 rounded-xl" />
      </div>
    </div>
  );
}

// ── Highlight card skeleton grid ─────────────────────────────────────────────
export function HighlightSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <motion.div
      className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.2 }}
          className="break-inside-avoid mb-4"
        >
          <HighlightCardSkeleton />
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Folder item skeleton ──────────────────────────────────────────────────────
export function FolderItemSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
      <Shimmer className="w-5 h-5 rounded-lg flex-shrink-0" />
      <Shimmer className="h-2.5 flex-1 rounded-full" />
      <Shimmer className="w-6 h-4 rounded-full flex-shrink-0" />
    </div>
  );
}

export function SidebarSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
        >
          <FolderItemSkeleton />
        </motion.div>
      ))}
    </div>
  );
}

// ── Header skeleton ───────────────────────────────────────────────────────────
export function HeaderSkeleton() {
  return (
    <div className="h-14 flex items-center justify-between px-6 border-b border-white/[0.05]">
      <div className="flex items-center gap-2">
        <Shimmer className="h-2.5 w-12 rounded-full" />
        <Shimmer className="h-2.5 w-3 rounded-full" />
        <Shimmer className="h-2.5 w-24 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="h-9 w-28 rounded-xl" />
        <Shimmer className="h-9 w-32 rounded-xl" />
        <Shimmer className="w-9 h-9 rounded-full" />
      </div>
    </div>
  );
}

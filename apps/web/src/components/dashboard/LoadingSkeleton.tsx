"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";

export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "relative p-5 rounded-2xl",
            "bg-white/[0.03] border border-white/[0.06]",
            "overflow-hidden"
          )}
        >
          {/* Shimmer overlay */}
          <motion.div
            className="absolute inset-0 z-0"
            animate={{
              background: [
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
                "linear-gradient(90deg, transparent 100%, rgba(255,255,255,0.03) 150%, transparent 200%)"
              ],
              x: ["-100%", "100%"]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          <div className="relative z-10 space-y-4">
            {/* Header: Topic + Pin */}
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 bg-white/[0.08] rounded-md" />
              <div className="h-3 w-3 bg-white/[0.08] rounded-full" />
            </div>

            {/* Body text lines */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-white/[0.07] rounded" />
              <div className="h-3 w-11/12 bg-white/[0.07] rounded" />
              <div className="h-3 w-4/5 bg-white/[0.07] rounded" />
            </div>

            {/* Tags row */}
            <div className="flex gap-2 pt-2">
              <div className="h-4 w-12 bg-white/[0.06] rounded" />
              <div className="h-4 w-10 bg-white/[0.06] rounded" />
            </div>

            {/* Footer metadata */}
            <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04]">
              <div className="h-3 w-24 bg-white/[0.05] rounded" />
              <div className="h-3 w-12 ml-auto bg-white/[0.05] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

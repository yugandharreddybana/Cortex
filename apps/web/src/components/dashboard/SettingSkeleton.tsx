"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";

export function SettingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-10 space-y-3">
        <div className="h-8 w-48 bg-white/[0.08] rounded-xl" />
        <div className="h-4 w-96 bg-white/[0.05] rounded-lg" />
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-12">
        {/* Left: Nav items skeleton */}
        <div className="space-y-2 hidden md:block">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-full bg-white/[0.04] rounded-lg border border-white/[0.03]" />
          ))}
        </div>

        {/* Right: Form fields skeleton */}
        <div className="space-y-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] relative overflow-hidden">
              {/* Shimmer overlay */}
               <motion.div
                className="absolute inset-0 z-0"
                animate={{
                  background: [
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)",
                    "linear-gradient(90deg, transparent 100%, rgba(255,255,255,0.02) 150%, transparent 200%)"
                  ],
                  x: ["-100%", "100%"]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />

              <div className="relative z-10 space-y-4">
                <div className="h-5 w-32 bg-white/[0.07] rounded-lg" />
                <div className="h-12 w-full bg-white/[0.04] rounded-xl border border-white/[0.05]" />
                <div className="h-3 w-64 bg-white/[0.03] rounded-md" />
              </div>
            </div>
          ))}

          {/* Action button skeleton */}
          <div className="pt-4 flex justify-end">
            <div className="h-10 w-32 bg-accent/20 rounded-xl border border-accent/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

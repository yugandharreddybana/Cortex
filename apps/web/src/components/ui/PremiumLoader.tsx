"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

export function PremiumLoader() {
  const isGlobalLoading = useDashboardStore((s) => s.isGlobalLoading);

  return (
    <AnimatePresence>
      {isGlobalLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.20, 0.90, 0.30, 1.00] }}
          className={cn(
            "fixed inset-0 z-[9999] flex items-center justify-center",
            "bg-black/40 backdrop-blur-md",
            "pointer-events-auto" // Block all interactions
          )}
        >
          <div className="relative flex flex-col items-center gap-6">
            {/* Morphing Gradient Ring */}
            <div className="relative w-20 h-20">
              <motion.div
                animate={{
                  rotate: 360,
                  borderRadius: ["40% 60% 60% 40%", "60% 40% 40% 60%", "40% 60% 60% 40%"],
                }}
                transition={{
                  rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                  borderRadius: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
                className="absolute inset-0 border-4 border-transparent bg-gradient-to-tr from-accent via-fuchsia-500 to-accent bg-clip-border opacity-80"
                style={{
                  maskImage: "linear-gradient(white, white)",
                  WebkitMaskImage: "linear-gradient(white, white)",
                  maskClip: "content-box",
                  WebkitMaskClip: "content-box",
                  padding: "4px"
                }}
              />
              
              {/* Inner Glow */}
              <motion.div
                animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-4 bg-accent/40 blur-xl rounded-full"
              />
              
              {/* Center Mark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="6" cy="6" r="4" />
                  <path d="M6 4v2l1.5 1.5" />
                </svg>
              </div>
            </div>

            {/* Pulsing Text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-sm font-semibold tracking-[0.2em] text-white/90 uppercase">
                Synchronizing
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-1 h-1 rounded-full bg-accent"
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore } from "@/store/dashboard";

/**
 * GlobalLoader — A highly premium,centered application-wide loading experience.
 * Features: Mesh gradients, glassmorphism, and high-fidelity micro-animations.
 */
export function GlobalLoader() {
  const isLoading = useDashboardStore((s) => s.loadingCount > 0);

  return (
    <AnimatePresence>
      {isLoading && (
        <>
          {/* Interaction Blocking Overlay (Transparent) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] cursor-wait pointer-events-auto"
          />

          {/* Minimal Floating Spinner Island */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] pointer-events-none"
          >
            {/* Subtle Glow Background */}
            <div className="absolute inset-0 bg-accent/20 blur-[30px] rounded-full scale-125" />

            {/* Floating Island UI (Spinner Only) */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1c1c1c]/90 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <div className="relative w-6 h-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-white/10"
                  style={{ borderTopColor: "#6c63ff" }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CortexLogoMark({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

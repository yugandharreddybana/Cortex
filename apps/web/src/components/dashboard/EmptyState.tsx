"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Component ────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?:   React.ReactNode;
  title?:  string;
  body?:   string;
  action?: { label: string; href: string };
  isViewer?: boolean;
}

export function EmptyState({ icon, title, body, action, isViewer }: EmptyStateProps) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.55, ease: [0.20, 0.90, 0.30, 1.00] }}
      className="flex flex-col items-center justify-center py-32 px-6 text-center"
    >
      {/* Glowing brain icon */}
      <div className="relative mb-8">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: "radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 70%)",
            transform:  "scale(1.8)",
            filter:     "blur(16px)",
          }}
        />
        <div
          className={cn(
            "relative w-20 h-20 rounded-2xl",
            "bg-gradient-to-b from-white/[0.05] to-white/[0.02]",
            "border border-white/[0.08]",
            "flex items-center justify-center",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]",
            "backdrop-blur-sm",
          )}
        >
          {icon || <BrainIcon />}
        </div>
      </div>

      {/* Copy */}
      <h2 className="text-xl font-semibold tracking-tight text-white/80 mb-3">
        {title || (isViewer ? "Waiting for shared knowledge..." : "Your index is empty.")}
      </h2>
      <p className="text-sm text-white/40 max-w-xs leading-relaxed mb-8">
        {body || (isViewer 
          ? "This folder is currently empty. Higher-level members have not added any highlights here yet."
          : "Start building your personal knowledge base. Install the extension to capture insights from anywhere on the web.")}
      </p>

      {/* If custom action is provided, show a simple link instead of the full default CTA block */}
      {action ? (
        <Link
          href={action.href}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-xl",
            "text-sm font-medium text-white/60",
            "border border-white/[0.06] hover:border-white/[0.12]",
            "hover:text-white/80 hover:bg-white/[0.04]",
            "active:scale-[0.97] transition-all duration-150 transform-gpu",
          )}
        >
          {action.label}
        </Link>
      ) : isViewer ? (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] animate-pulse">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Listening for updates</span>
        </div>
      ) : (
        <>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="https://chromewebstore.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-xl",
            "text-sm font-semibold text-white",
            "bg-accent hover:bg-accent/90",
            "shadow-glow-sm active:scale-[0.97]",
            "transition-all duration-150 transform-gpu",
          )}
        >
          <ChromeIcon />
          Install the Chrome Extension
        </Link>
        <Link
          href="/welcome"
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-xl",
            "text-sm font-medium text-white/60",
            "border border-white/[0.06] hover:border-white/[0.12]",
            "hover:text-white/80 hover:bg-white/[0.04]",
            "active:scale-[0.97] transition-all duration-150 transform-gpu",
          )}
        >
          Read the Quick Start Guide
        </Link>
      </div>
      </>
      )}
    </motion.div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function BrainIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 4C9.58 4 6 7.58 6 12c0 2.4 1.06 4.55 2.75 6.02V21h10.5v-2.98A7.96 7.96 0 0022 12c0-4.42-3.58-8-8-8z"
        stroke="rgba(129,140,248,0.85)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 21v2.5a1 1 0 002 0V21M14 4V2"
        stroke="rgba(129,140,248,0.60)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 14c0-2.21 1.79-4 4-4"
        stroke="rgba(129,140,248,0.40)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChromeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.5" stroke="white" strokeWidth="1.4" />
      <path d="M7 4.5h5.5M4.08 5.75L1.33 1M9.92 5.75L12.67 1M4.5 9.5L2 13.5M9.5 9.5L12 13.5M4.5 9.5h5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.93 2.93l1.41 1.41M7.66 7.66l1.41 1.41M2.93 9.07l1.41-1.41M7.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

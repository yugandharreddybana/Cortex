"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";

// ─── Step data ────────────────────────────────────────────────────────────────
const STEPS = [
  {
    number: "01",
    title:  "Pin Cortex to your toolbar",
    body:   "Click the puzzle piece icon in Chrome's toolbar, find Cortex, and click the pin icon. The Cortex logo will appear next to your address bar — ready anytime.",
    visual: <PinVisual />,
  },
  {
    number: "02",
    title:  "Highlight this sentence right now.",
    body:   "Select any text on this page using your mouse or trackpad. The Cortex floating pill will appear — hit Save to capture it to your brain.",
    visual: <HighlightVisual />,
    interactive: true,
  },
  {
    number: "03",
    title:  "Hit ⌘K to find it forever.",
    body:   "Open the Cortex command palette anywhere in the dashboard. Your indexed highlights are one keystroke away, no matter how many you save.",
    visual: <CmdKVisual />,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] px-6 lg:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-glow-sm">
            <CortexMark />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">Cortex</span>
        </div>
        <Link
          href="/dashboard"
          className="text-[12px] text-white/35 hover:text-white/65 transition-colors duration-150"
        >
          Skip to Dashboard →
        </Link>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 pt-20 pb-16 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.65, ease: [0.20, 0.90, 0.30, 1.00] }}
        >
          {/* Celebration badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent/25 bg-accent/8 mb-6">
            <span className="text-accent text-sm">✦</span>
            <span className="text-[12px] font-medium text-accent/80">Extension installed</span>
          </div>

          <h1
            className={cn(
              "text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]",
              "text-white",
            )}
          >
            You&apos;re&nbsp;in.
          </h1>
          <p className="mt-5 text-lg text-white/45 max-w-lg leading-relaxed">
            Three steps. Thirty seconds. You&apos;ll be saving and searching knowledge
            like a power user.
          </p>
        </motion.div>
      </section>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 pb-24 max-w-4xl mx-auto">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-8 bottom-8 w-px bg-white/[0.06] hidden sm:block" />

          <div className="flex flex-col gap-12">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0   }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.12, ease: [0.20, 0.90, 0.30, 1.00] }}
                className="flex gap-8 sm:gap-10"
              >
                {/* Step number disc */}
                <div className="shrink-0 relative z-10 hidden sm:block">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full",
                      "bg-bg border border-white/[0.08]",
                      "flex items-center justify-center",
                      "text-[11px] font-mono font-semibold text-white/40",
                    )}
                  >
                    {step.number}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Mobile step indicator */}
                  <span className="inline-block sm:hidden text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">
                    Step {step.number}
                  </span>

                  <div
                    className={cn(
                      "rounded-2xl border border-white/[0.06]",
                      "bg-surface",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                      "overflow-hidden",
                    )}
                  >
                    {/* Visual area */}
                    <div className="h-36 bg-bg border-b border-white/[0.06] flex items-center justify-center px-6">
                      {step.visual}
                    </div>

                    {/* Text */}
                    <div className="p-6">
                      <h3 className="text-base font-semibold text-white/85 tracking-tight mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-white/45 leading-relaxed">
                        {step.body}
                      </p>

                      {/* Interactive highlight target */}
                      {step.interactive && (
                        <p
                          className={cn(
                            "mt-4 text-sm font-medium",
                            "text-accent/80 border-l-2 border-accent/40 pl-3",
                            "select-text cursor-text leading-relaxed",
                          )}
                        >
                          ← Select this sentence with your mouse to test the extension right now.
                          The Cortex floating pill will appear above your selection.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.5, delay: 0.65, ease: [0.20, 0.90, 0.30, 1.00] }}
          className="mt-16 flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/dashboard"
            className={cn(
              "inline-flex items-center gap-2 h-11 px-7 rounded-xl",
              "text-sm font-semibold text-white",
              "bg-accent hover:bg-accent/90",
              "shadow-glow-sm active:scale-[0.97]",
              "transition-all duration-150 transform-gpu",
            )}
          >
            Open My Dashboard
            <ArrowRightIcon />
          </Link>
          <p className="text-[12px] text-white/25 sm:ml-2">
            Your highlights will start appearing here as you browse.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

// ─── Step Visuals ────────────────────────────────────────────────────────────

function PinVisual() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Mock toolbar */}
      <div className="flex items-center gap-1.5 bg-surface border border-white/[0.06] rounded-full px-3 py-2">
        <div className="w-4 h-4 rounded-sm bg-white/10 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="3" height="2.5" rx="0.7" fill="rgba(255,255,255,0.3)" />
            <rect x="5" y="1" width="4" height="4" rx="0.7" fill="rgba(255,255,255,0.15)" />
            <path d="M5 9H9M7 5v4" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeLinecap="round" />
          </svg>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5 2h4l1 4-2 1.5V10l-2 1.5L6 10V7.5L4 6l1-4z" fill="rgba(129,140,248,0.8)" />
        </svg>
        <div className="w-4 h-4 rounded-sm bg-white/[0.05]" />
      </div>
      {/* Arrow pointing to pin */}
      <div className="flex flex-col items-center gap-1">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-accent/60">
          <path d="M3 8h10M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[9px] text-white/30 font-mono">Pin</span>
      </div>
    </div>
  );
}

function HighlightVisual() {
  return (
    <div className="max-w-xs w-full relative select-none">
      <p className="text-sm text-white/50 leading-relaxed">
        The best way to{" "}
        <mark
          className="bg-accent/25 text-accent/90 rounded-sm px-0.5 not-italic"
          style={{ WebkitTextFillColor: "initial" }}
        >
          predict the future
        </mark>{" "}
        is to invent it.
      </p>
      {/* Mock pill */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-overlay/95 border border-white/[0.08] rounded-lg px-2.5 py-1.5 shadow-spatial-sm whitespace-nowrap">
        <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center">
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true"><path d="M1.5 7.5h6M4.5 1.5v5M2.5 3.5l2-2 2 2" stroke="#818CF8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <span className="text-[10px] font-medium text-white/75">Save</span>
        <div className="w-px h-3 bg-white/10" />
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true"><rect x="2.5" y="2.5" width="4" height="5" rx="0.8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" /><path d="M1.5 5.5V1.5h4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" /></svg>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true"><circle cx="3.5" cy="3.5" r="2.3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" /><path d="M5.5 5.5L7.5 7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}

function CmdKVisual() {
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Kbd combo */}
      <div className="flex items-center gap-1.5">
        {["⌘", "K"].map((key) => (
          <kbd
            key={key}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              "bg-surface border border-white/[0.06]",
              "text-sm font-semibold text-white/70",
              "shadow-[0_2px_0_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)]",
            )}
          >
            {key}
          </kbd>
        ))}
      </div>
      {/* Mock command palette preview */}
      <div className="flex-1 max-w-[180px] bg-overlay border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><circle cx="4" cy="4" r="2.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" /><path d="M6 6l2 2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" /></svg>
          <div className="h-1.5 w-16 rounded-full bg-white/10" />
        </div>
        <div className="p-1">
          {["predict the future", "design is how it"].map((text, i) => (
            <div
              key={i}
              className={cn(
                "px-2 py-1.5 rounded-lg text-[10px] text-white/40 truncate",
                i === 0 && "bg-accent/10 text-accent/70",
              )}
            >
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CortexMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M6.5 4.5v2.5l1.5 1.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h8M7 3l4 4-4 4" />
    </svg>
  );
}

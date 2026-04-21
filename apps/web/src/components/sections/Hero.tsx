"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { Button } from "@cortex/ui";
import { Badge } from "@cortex/ui";

// â”€â”€â”€ Stagger config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.1 } },
};

const itemTransition = {
  duration: 0.7,
  ease:     [0.20, 0.90, 0.30, 1.00] as [number, number, number, number],
};

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function Hero() {
  return (
    <section
      id="hero"
      className={cn(
        "relative min-h-screen flex flex-col items-center justify-center",
        "pt-32 pb-24 px-6",
        "overflow-hidden",
      )}
      aria-label="Hero section"
    >
      {/* â”€â”€ Radial glow behind text â”€â”€ */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-1/2 -translate-x-1/2",
          "w-[900px] h-[600px]",
          "bg-hero-gradient",
          "opacity-50",
          "-z-10",
        )}
      />

      {/* â”€â”€ Background mesh â”€â”€ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-mesh-gradient -z-10"
      />

      {/* â”€â”€ Spotlight orb â”€â”€ */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1  }}
        transition={{ duration: 1.4, ease: [0.20, 0.90, 0.30, 1.00] }}
        className={cn(
          "pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[600px] h-[600px] rounded-full",
          "bg-accent/[0.08] blur-[140px]",
          "-z-10 transform-gpu",
        )}
      />

      {/* â”€â”€ Content â”€â”€ */}
      <motion.div
        className="flex flex-col items-center text-center max-w-4xl mx-auto z-10"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow badge */}
        <motion.div variants={fadeUp} transition={itemTransition}>
          <Badge variant="accent" dot className="mb-8">
            Now in public beta
          </Badge>
        </motion.div>

        {/* H1 */}
        <motion.h1
          variants={fadeUp}
          transition={itemTransition}
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl",
            "font-bold tracking-tighter text-balance",
            "leading-[0.95]",
            // Gradient text
            "bg-clip-text text-transparent",
            "bg-gradient-to-b from-white via-white/90 to-white/50",
            "mb-6",
          )}
        >
          Your brain,
          <br />
          <span
            className={cn(
              "bg-clip-text text-transparent",
              "bg-gradient-to-r from-accent via-accent-light to-[#06B6D4]",
            )}
          >
            perfectly indexed.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={fadeUp}
          transition={itemTransition}
          className={cn(
            "text-lg sm:text-xl text-secondary",
            "max-w-2xl text-balance leading-relaxed",
            "mb-10",
          )}
        >
          Cortex captures every highlight, article, and note you encounter â€”
          then resurfaces it with AI-powered context exactly when you need it.
          Your second brain, running at the speed of thought.
        </motion.p>

        {/* Features Preview tags */}
        <motion.div
          variants={fadeUp}
          transition={itemTransition}
          className="flex flex-wrap justify-center gap-2 mb-10 text-xs font-medium text-white/50"
        >
          <span className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">Auto-Draft Essays</span>
          <span className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">Devil&apos;s Advocate</span>
          <span className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">Connect the Dots</span>
          <span className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">Suggest Action Items</span>
          <span className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">Custom Prompts</span>
          <span className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">AI Source Context</span>
        </motion.div>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          transition={itemTransition}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          {/* Primary â€” Sign up */}
          <a href="/signup">
            <Button size="lg" shine>
              Get Started Free
            </Button>
          </a>
          {/* Secondary â€” Chrome Web Store */}
          <a
            href="https://chrome.google.com/webstore/detail/mock-cortex-id"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" variant="ghost" className="group">
              <ChromeIcon />
              Add to Chrome
            </Button>
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.p
          variants={fadeUp}
          transition={itemTransition}
          className="mt-8 text-sm text-muted"
        >
          No credit card Â·{" "}
          <span className="text-secondary">14-day free trial</span>
          {" "}Â· Chrome & Firefox
        </motion.p>
      </motion.div>

      {/* â”€â”€ Hero graphic / mock â”€â”€ */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ delay: 0.45, duration: 1.0, ease: [0.20, 0.90, 0.30, 1.00] }}
        className={cn(
          "relative mt-20 w-full max-w-5xl",
          "rounded-3xl overflow-hidden",
          "border border-white/[0.06]",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.6)]",
          "transform-gpu will-change-transform",
          "bg-surface",
        )}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.07]">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
          <div className="flex-1 mx-4">
            <div className="mx-auto h-5 max-w-[300px] rounded-md bg-white/[0.05] border border-white/[0.07]" />
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="relative h-[420px] overflow-hidden bg-gradient-to-b from-surface to-bg">
          <DashboardPlaceholder />
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-bg to-transparent"
      />
    </section>
  );
}

// â”€â”€â”€ Icon helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChromeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="white" fillOpacity="0.9" />
      <path d="M8 5h6.2A8 8 0 118 0v5" stroke="white" strokeOpacity="0" />
      {/* Segmented ring */}
      <path d="M8 5h6.196A8 8 0 0114 4H8V5z" fill="#EA4335" />
      <path d="M8 5H1.804A8 8 0 005 13.856L8 8.5V5z" fill="#34A853" />
      <path d="M8 8.5L5 13.856A8 8 0 0014 4H8v4.5z" fill="#FBBC05" />
      <circle cx="8" cy="8" r="3" fill="white" />
      <circle cx="8" cy="8" r="2" fill="#4285F4" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <span className="w-7 h-7 rounded-full flex items-center justify-center border border-white/[0.08] bg-white/[0.05] group-hover:bg-white/[0.10] transition-colors duration-200 ease-spatial">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <path d="M2 1.5l6 3.5-6 3.5V1.5z" />
      </svg>
    </span>
  );
}

function DashboardPlaceholder() {
  const sidebarItems = [
    { icon: "â—»", label: "All Highlights", count: "211", active: true },
    { icon: "â˜…", label: "Favorites", count: "12", active: false },
    { icon: "â–£", label: "Archive", count: "", active: false },
  ];

  const folders: any[] = [];

  const cards = [
    { topic: "Technology", topicColor: "bg-blue-500/20 text-blue-300", text: "The best way to predict the future is to invent it. Personal computing was a direct result of this philosophyâ€¦", source: "The Dream Machine", time: "2h ago" },
    { topic: "Productivity", topicColor: "bg-emerald-500/20 text-emerald-300", text: "Attention is the new oil. But unlike oil, it can be regenerated â€” through rest, deep work, and ruthless subtractionâ€¦", source: "Deep Work â€” Cal Newport", time: "5h ago" },
    { topic: "Design", topicColor: "bg-violet-500/20 text-violet-300", text: "Design is not just what it looks like and feels like. Design is how it worksâ€¦", source: "Steve Jobs â€” Fortune 2003", time: "1d ago" },
    { topic: "AI", topicColor: "bg-pink-500/20 text-pink-300", text: "Language models learn statistical regularities so well that they begin to capture semantic structureâ€¦", source: "Anthropic Research", time: "2d ago" },
  ];

  return (
    <div className="w-full h-full flex select-none pointer-events-none" style={{ fontSize: "10px" }}>
      {/* â”€â”€ Mini sidebar â”€â”€ */}
      <div className="w-[160px] shrink-0 border-r border-white/[0.06] flex flex-col py-3 px-2 gap-0.5 hidden sm:flex">
        {/* Logo */}
        <div className="flex items-center gap-1.5 px-2 pb-3 mb-1 border-b border-white/[0.06]">
          <div className="w-4 h-4 rounded bg-accent/80 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4" /><path d="M6 4v2l1.5 1.5" /></svg>
          </div>
          <span className="font-semibold text-white/80" style={{ fontSize: "11px" }}>Cortex</span>
        </div>

        {/* Search */}
        <div className="mx-1 mb-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-white/25 flex items-center gap-1.5">
          <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M7 13A6 6 0 107 1a6 6 0 000 12zM13 13l2 2" /></svg>
          <span>Searchâ€¦</span>
          <span className="ml-auto text-white/15 font-mono" style={{ fontSize: "8px" }}>âŒ˜K</span>
        </div>

        {/* Nav items */}
        {sidebarItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg",
              item.active
                ? "bg-white/[0.08] text-white/90"
                : "text-white/40",
            )}
          >
            <span className="text-white/30" style={{ fontSize: "8px" }}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.count && (
              <span className="bg-white/10 text-white/40 rounded-full px-1.5" style={{ fontSize: "8px" }}>
                {item.count}
              </span>
            )}
          </div>
        ))}

        {/* Folders header */}
        <div className="flex items-center justify-between px-2 mt-3 mb-1">
          <span className="text-white/25 uppercase tracking-widest" style={{ fontSize: "7px", fontWeight: 600 }}>Folders</span>
          <span className="text-white/20">+</span>
        </div>

        {folders.map((f) => (
          <div key={f.name} className="flex items-center gap-1.5 px-2 py-1 text-white/50 rounded-lg">
            <span style={{ fontSize: "10px" }}>{f.emoji}</span>
            <span className="flex-1 truncate">{f.name}</span>
            <span className="text-white/25" style={{ fontSize: "8px" }}>{f.count}</span>
          </div>
        ))}
      </div>

      {/* â”€â”€ Main content â”€â”€ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white/80" style={{ fontSize: "13px" }}>All Highlights</span>
            <span className="bg-white/10 text-white/40 rounded-full px-1.5" style={{ fontSize: "8px" }}>211</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-white/[0.04] rounded-lg border border-white/[0.07] p-0.5">
              <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/60" style={{ fontSize: "8px" }}>Grid</span>
              <span className="px-1.5 py-0.5 rounded text-white/30" style={{ fontSize: "8px" }}>List</span>
            </div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.6, duration: 0.4, ease: [0.20, 0.90, 0.30, 1.00] }}
              className="px-2.5 py-1 rounded-lg bg-accent text-white font-medium flex items-center gap-1"
              style={{ fontSize: "9px" }}
            >
              <span>+</span> New
            </motion.div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 p-3 overflow-hidden">
          <div className="grid grid-cols-2 gap-2.5">
            {cards.map((card, i) => (
              <motion.div
                key={card.topic}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.12, duration: 0.5, ease: [0.20, 0.90, 0.30, 1.00] }}
                className={cn(
                  "rounded-lg border border-white/[0.06] bg-white/[0.02] p-3",
                  "hover:border-white/[0.12] transition-colors duration-300",
                  i === 0 && "border-white/[0.12] bg-white/[0.04]",
                )}
              >
                {/* Topic + time */}
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("rounded-full px-1.5 py-0.5 font-medium", card.topicColor)} style={{ fontSize: "7px" }}>
                    {card.topic}
                  </span>
                  <span className="text-white/20" style={{ fontSize: "7px" }}>{card.time}</span>
                </div>
                {/* Text */}
                <p className="text-white/55 leading-relaxed line-clamp-3" style={{ fontSize: "9px" }}>
                  &ldquo;{card.text}&rdquo;
                </p>
                {/* Source */}
                <div className="mt-2 flex items-center gap-1 text-white/25" style={{ fontSize: "7px" }}>
                  <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3m0-3L5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{card.source}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ Animated cursor / interaction hints â”€â”€ */}
      <motion.div
        className="absolute"
        style={{ top: "55%", left: "45%" }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          x: [0, 20, 20, 60],
          y: [0, -10, -10, 10],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatDelay: 2,
          ease: "easeInOut",
          delay: 2,
        }}
      >
        <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
          <path d="M1 1l5 14 2-5 5-2L1 1z" fill="white" fillOpacity="0.7" stroke="white" strokeWidth="0.5" />
        </svg>
      </motion.div>
    </div>
  );
}

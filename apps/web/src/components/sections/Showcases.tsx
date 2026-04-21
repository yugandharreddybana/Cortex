"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@cortex/ui";

// â”€â”€â”€ CAPTURE visual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CaptureVisual() {
  const [step, setStep] = React.useState(0);
  // 0 = idle, 1 = selection active, 2 = toolbar visible, 3 = saved
  React.useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 1600),
      setTimeout(() => setStep(3), 2800),
      setTimeout(() => setStep(0), 4400),
    ];
    const interval = setInterval(() => {
      setStep(0);
      setTimeout(() => setStep(1), 800);
      setTimeout(() => setStep(2), 1600);
      setTimeout(() => setStep(3), 2800);
    }, 5200);
    return () => { timers.forEach(clearTimeout); clearInterval(interval); };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#0E0E10] select-none overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.07] bg-[#111113] shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
        <div className="flex-1 mx-4">
          <div className="h-5 rounded-md bg-white/[0.05] border border-white/[0.07] flex items-center px-2.5 gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white/[0.12] shrink-0" />
            <span className="text-[10px] text-white/25 font-mono truncate">medium.com/article/ai-reasoning</span>
          </div>
        </div>
        {/* Cortex extension badge */}
        <div className="w-6 h-6 rounded-md bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
          <div className="w-3 h-3 rounded-sm bg-[#8B5CF6]" />
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 px-8 py-6 space-y-3 relative overflow-hidden">
        {/* Title */}
        <div className="h-4 w-3/4 rounded bg-white/[0.12] mb-4" />

        {/* Body lines â€” the key paragraph */}
        <div className="h-2.5 w-full rounded bg-white/[0.06]" />
        <div className="h-2.5 w-11/12 rounded bg-white/[0.06]" />

        {/* Highlighted sentence */}
        <div className="relative">
          <p className="text-[11px] leading-6 text-white/50">
            Large language models achieve remarkable{" "}
            <span
              className={cn(
                "px-0.5 rounded transition-all duration-500",
                step >= 1
                  ? "bg-[#8B5CF6]/30 text-[#C4BFFF]"
                  : "bg-transparent text-white/50",
              )}
            >
              in-context reasoning capabilities
            </span>{" "}
            through emergent behavior, enabling{" "}
            <span
              className={cn(
                "px-0.5 rounded transition-all duration-500",
                step >= 1
                  ? "bg-[#8B5CF6]/30 text-[#C4BFFF]"
                  : "bg-transparent text-white/50",
              )}
            >
              zero-shot generalization
            </span>{" "}
            at inference time.
          </p>

          {/* Floating toolbar */}
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={step >= 2 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.92 }}
            transition={{ duration: 0.3, ease: [0.20, 0.90, 0.30, 1.00] }}
            className={cn(
              "absolute -top-10 left-1/4",
              "flex items-center gap-1 px-2 py-1.5",
              "bg-[#1C1C1E] border border-white/[0.12] rounded-xl",
              "shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
            )}
          >
            {/* Save button */}
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8B5CF6] text-[10px] font-semibold text-white">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                <path d="M1.5 4.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save
            </button>
            {[
              <svg key="tag" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M1 1h5l5 5-5 5-5-5V1z" /><circle cx="3.5" cy="3.5" r="0.8" fill="currentColor" stroke="none" /></svg>,
              <svg key="folder" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M1 3.5h11v7H1V3.5zM1 3.5l2-2h3l1.5 2" /></svg>,
            ].map((icon, i) => (
              <button key={i} className="w-6 h-6 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.07] flex items-center justify-center transition-colors">
                {icon}
              </button>
            ))}
            <div className="w-px h-4 bg-white/[0.08]" />
            <button className="w-6 h-6 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.07] flex items-center justify-center transition-colors">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M2 9L9 2M5.5 2H9v3.5" /></svg>
            </button>
            {/* Pointer */}
            <div className="absolute -bottom-1.5 left-8 w-3 h-3 bg-[#1C1C1E] border-r border-b border-white/[0.12] rotate-45" />
          </motion.div>
        </div>

        <div className="h-2.5 w-5/6 rounded bg-white/[0.06]" />
        <div className="h-2.5 w-full rounded bg-white/[0.06]" />

        {/* AI tag suggestion pill */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={step >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.35, ease: [0.20, 0.90, 0.30, 1.00], delay: 0.12 }}
          className="flex items-center gap-2 mt-3"
        >
          <span className="text-[9px] text-white/25 uppercase tracking-wider">AI tags</span>
          {["AI / ML", "Reasoning", "LLM"].map((t, i) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border font-medium" style={{
              color: ["#A78BFA","#60A5FA","#34D399"][i],
              borderColor: (["#A78BFA","#60A5FA","#34D399"][i]) + "40",
              background: (["#A78BFA","#60A5FA","#34D399"][i]) + "10",
            }}>
              {t}
            </span>
          ))}
        </motion.div>

        {/* Saved toast */}
        <motion.div
          initial={{ opacity: 0, y: 8, x: "-50%" }}
          animate={step === 3 ? { opacity: 1, y: 0, x: "-50%" } : { opacity: 0, y: 8, x: "-50%" }}
          transition={{ duration: 0.3, ease: [0.20, 0.90, 0.30, 1.00] }}
          className="absolute bottom-4 left-1/2 flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] shadow-spatial-md"
        >
          <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M1.5 4l2 2 3-3" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[11px] text-white/70 font-medium">Saved to AI / ML</span>
        </motion.div>
      </div>
    </div>
  );
}

// â”€â”€â”€ RECALL visual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RecallVisual() {
  const [query, setQuery]           = React.useState("");
  const [showResults, setShowResults] = React.useState(false);
  const [activeIdx, setActiveIdx]   = React.useState(0);
  const [cycle, setCycle]           = React.useState(0);   // increment to replay

  const TARGET = "that article about LLM latencyâ€¦";

  React.useEffect(() => {
    let i = 0;
    setQuery("");
    setShowResults(false);
    setActiveIdx(0);

    // Typewriter
    const typeTimer = setInterval(() => {
      i++;
      setQuery(TARGET.slice(0, i));
      if (i >= TARGET.length) clearInterval(typeTimer);
    }, 55);

    // Show results shortly after typing finishes
    const showTimer = setTimeout(
      () => setShowResults(true),
      TARGET.length * 55 + 350,
    );

    // Cycle highlighted row while results are shown
    const cycleTimer = setInterval(() => {
      setActiveIdx((p) => (p + 1) % 3);
    }, 1100);

    // Reset and loop
    const loopTimer = setTimeout(() => {
      clearInterval(typeTimer);
      clearInterval(cycleTimer);
      setCycle((c) => c + 1);       // re-run this effect
    }, 8000);

    return () => {
      clearInterval(typeTimer);
      clearInterval(cycleTimer);
      clearTimeout(showTimer);
      clearTimeout(loopTimer);
    };
  }, [cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  const RESULTS = [
    { title: "LLM Inference Bottlenecks & Latency",  src: "arxiv.org",              tag: "AI / ML",     tagColor: "#A78BFA", when: "2 days ago" },
    // { title: "Optimizing Token Generation Speed",    src: "towardsdatascience.com", tag: "Engineering", tagColor: "#60A5FA", when: "1 week ago" },
    { title: "The Cost of Long Context Windows",     src: "openai.com/research",    tag: "LLM",         tagColor: "#34D399", when: "3 weeks ago" },
  ];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-bg relative select-none overflow-hidden">
      {/* Background blur grid */}
      <div aria-hidden className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Radial glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(50% 50% at 50% 40%, rgba(96,165,250,0.06) 0%, transparent 100%)",
      }} />

      {/* Command palette */}
      <div className={cn(
        "relative w-[88%] rounded-2xl overflow-hidden",
        "border border-white/[0.10]",
        "bg-[#141416]/90 backdrop-blur-xl",
        "shadow-[0_24px_80px_rgba(0,0,0,0.8)]",
      )}>
        {/* Top gradient strip */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-white/35 shrink-0" aria-hidden="true">
            <circle cx="6" cy="6" r="4.2" /><path d="M9.5 9.5l2.5 2.5" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-[12px] text-white/75 font-mono min-h-[1em]">
            {query}
            <span className="inline-block w-[2px] h-3 bg-[#60A5FA] ml-0.5 align-middle animate-pulse" />
          </span>
          <div className="flex items-center gap-1">
            <kbd className="text-[9px] bg-white/[0.07] border border-white/[0.10] rounded px-1.5 py-0.5 text-white/30 font-mono">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={showResults ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.20, 0.90, 0.30, 1.00] }}
        >
          <div className="px-3 py-2">
            <p className="text-[9px] text-white/25 uppercase tracking-widest px-1 mb-1.5">Best matches â€” semantic search</p>
            <div className="space-y-0.5">
              {RESULTS.map((r, i) => (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={showResults ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                  transition={{ duration: 0.3, ease: [0.20, 0.90, 0.30, 1.00], delay: i * 0.07 }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200",
                    activeIdx === i ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                  )}
                >
                  {/* Icon */}
                  <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-white/40" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" rx="1.5" />
                      <path d="M3 4h5M3 6.5h3" strokeLinecap="round" />
                    </svg>
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/80 font-medium truncate">{r.title}</p>
                    <p className="text-[9px] text-white/30 mt-0.5 truncate">{r.src} Â· {r.when}</p>
                  </div>
                  {/* Tag */}
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ color: r.tagColor, background: r.tagColor + "18", outline: `1px solid ${r.tagColor}35` }}
                  >
                    {r.tag}
                  </span>
                  {/* Return key hint */}
                  {activeIdx === i && (
                    <kbd className="text-[9px] bg-white/[0.08] border border-white/[0.10] rounded px-1 py-0.5 text-white/25 font-mono shrink-0">â†µ</kbd>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
            <div className="flex items-center gap-3">
              {[["â†‘â†“", "navigate"], ["â†µ", "open"], ["âŒ˜K", "close"]].map(([k, l]) => (
                <span key={k} className="flex items-center gap-1 text-[9px] text-white/25">
                  <kbd className="bg-white/[0.06] border border-white/[0.08] rounded px-1 py-0.5 font-mono">{k}</kbd>
                  {l}
                </span>
              ))}
            </div>
            <span className="text-[9px] text-white/20">3 of 1,247 highlights</span>
          </div>
        </motion.div>

        {!showResults && (
          <div className="px-4 py-4 text-center text-[11px] text-white/20">
            Type to search your knowledgeâ€¦
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SHOWCASES = [
  {
    id:      "capture",
    tag:     "Capture",
    heading: "Select. Saved. Forever.",
    body:    "The Cortex extension watches your selections in real-time. Highlight any text on any page and a frictionless toolbar appears â€” one tap to save with full source attribution, auto-tags, and folder placement predicted by AI.",
    visual:  <CaptureVisual />,
    flip:    false,
    accent:  "#8B5CF6",
  },
  {
    id:      "search",
    tag:     "Recall",
    heading: "Cmd+K your entire memory.",
    body:    "Surface anything you've ever saved in under 100ms. Cortex's semantic index understands meaning, not just keywords â€” ask \"that article about LLM latency\" and find it instantly, even if you saved it months ago.",
    visual:  <RecallVisual />,
    flip:    true,
    accent:  "#60A5FA",
  },
] as const;

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ShowcasesSection() {
  return (
    <section
      id="product"
      className="py-32 px-6 lg:px-10 max-w-7xl mx-auto space-y-40"
      aria-label="Product showcases"
    >
      {SHOWCASES.map((item) => (
        <ShowcaseRow key={item.id} {...item} />
      ))}
    </section>
  );
}

// â”€â”€â”€ Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ShowcaseRowProps {
  tag:     string;
  heading: string;
  body:    string;
  visual:  React.ReactNode;
  flip:    boolean;
  accent:  string;
}

function ShowcaseRow({ tag, heading, body, visual, flip, accent }: ShowcaseRowProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  const textVariants = {
    hidden:  { opacity: 0, x: flip ? 30 : -30 },
    visible: { opacity: 1, x: 0               },
  };

  const mediaVariants = {
    hidden:  { opacity: 0, x: flip ? -30 : 30 },
    visible: { opacity: 1, x: 0               },
  };

  const transition = {
    duration: 0.85,
    ease:     [0.20, 0.90, 0.30, 1.00] as [number, number, number, number],
  };

  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center",
        flip && "lg:[&>*:first-child]:order-2",
      )}
    >
      {/* â”€â”€ Text â”€â”€ */}
      <motion.div
        variants={textVariants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        transition={{ ...transition, delay: 0.05 }}
        className="space-y-5"
      >
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {tag}
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter text-balance leading-tight">
          {heading}
        </h2>
        <p className="text-base text-secondary leading-relaxed text-pretty max-w-lg">
          {body}
        </p>
      </motion.div>

      {/* â”€â”€ Media â”€â”€ */}
      <motion.div
        variants={mediaVariants}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        transition={{ ...transition, delay: 0.15 }}
        className={cn(
          "relative rounded-3xl overflow-hidden",
          "border border-white/[0.06]",
          "shadow-spatial-lg",
          "aspect-[4/3] bg-surface",
          "transform-gpu will-change-transform",
          "group",
        )}
      >
        {/* Glow accent behind card */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 blur-2xl -z-10 scale-90"
          style={{ background: `radial-gradient(ellipse at center, ${accent}40 0%, transparent 70%)` }}
        />

        {/* Inline visual */}
        <div className="w-full h-full">
          {visual}
        </div>

        {/* Glass rim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        />
      </motion.div>
    </div>
  );
}

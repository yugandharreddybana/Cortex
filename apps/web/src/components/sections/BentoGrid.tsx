"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@cortex/ui";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

//  Features data 
const FEATURES = [
  {
    id:      "folders",
    tag:     "Organization",
    heading: "Infinite Folders, Zero Limits.",
    body:    "Deeply nested, emoji-tagged folders ” your personal taxonomy.",
    accent:  "#8B5CF6",
    span:    "md:col-span-2",   // wide
  },
  {
    id:      "context",
    tag:     "Intelligence",
    heading: "Ask Your Knowledge Base.",
    body:    "Natural-language queries across your entire library.",
    accent:  "#A78BFA",
    span:    "md:col-span-1",   // narrow
  },
  {
    id:      "offline",
    tag:     "Reliability",
    heading: "Offline-first. Always fast.",
    body:    "Your entire library lives locally with automatic background sync.",
    accent:  "#06B6D4",
    span:    "md:col-span-1",   // narrow
  },
  {
    id:      "highlights",
    tag:     "Capture",
    heading: "Smart Highlights.",
    body:    "Colour-coded by topic, deduped, enriched with AI summaries.",
    accent:  "#F59E0B",
    span:    "md:col-span-2",   // wide
  },
  {
    id:      "api",
    tag:     "Developer",
    heading: "Open API. Build on Cortex.",
    body:    "REST + GraphQL. Webhooks. Zapier-ready. One authenticated request.",
    accent:  "#60A5FA",
    span:    "md:col-span-1",   // narrow
  },
  {
    id:      "tags",
    tag:     "Filtering",
    heading: "Tags & Smart Collections.",
    body:    "Multi-tag and filter in milliseconds. Auto-updating collections.",
    accent:  "#EC4899",
    span:    "md:col-span-1",   // narrow
  },
  {
    id:      "reading",
    tag:     "Focus",
    heading: "Distraction-free Reading.",
    body:    "Pure, typographically perfect prose. Pick up across devices.",
    accent:  "#14B8A6",
    span:    "md:col-span-1",   // narrow
  },
] as const;

//  Visual placeholders 

function FolderTreeVisual() {
  const items = [
    { depth: 0, icon: "ðŸ“", label: "Research",   count: 24 },
    { depth: 1, icon: "ðŸ“‚", label: "AI / ML",    count: 12 },
    { depth: 2, icon: "ðŸ“„", label: "LLM Papers", count:  8 },
    { depth: 1, icon: "ðŸ“‚", label: "Product",    count:  6 },
    { depth: 0, icon: "ðŸ“", label: "Design",     count: 18 },
    { depth: 1, icon: "ðŸ“‚", label: "Typography", count:  5 },
  ];
  return (
    <div className="p-6 space-y-2.5 font-mono text-xs">
      {items.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: [0.20, 0.90, 0.30, 1.00] }}
          style={{ paddingLeft: f.depth * 16 }}
          className="flex items-center justify-between gap-2 group"
        >
          <span className="flex items-center gap-2 text-white/60 group-hover:text-white/80 transition-colors">
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </span>
          <span className="text-white/25 text-[10px]">{f.count}</span>
        </motion.div>
      ))}
    </div>
  );
}

function NLQueryVisual() {
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 h-9">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30 shrink-0" aria-hidden="true">
          <circle cx="5" cy="5" r="3.5" /><path d="M8 8l2 2" />
        </svg>
        <span className="text-xs text-white/35 flex-1">that article about LLM latency</span>
        <kbd className="text-[10px] text-white/20 font-mono shrink-0">â†µ</kbd>
      </div>
      {[
        { title: "LLM Inference Bottlenecks",        src: "arxiv.org",               tag: "AI / ML"     },
        // { title: "Optimizing Token Generation Speed", src: "towardsdatascience.com",  tag: "Engineering" },
      ].map((r) => (
        <div key={r.title} className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="w-5 h-5 rounded bg-white/[0.07] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-white/70 font-medium truncate">{r.title}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{r.src} Â· <span className="text-[#A78BFA]/70">{r.tag}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OfflineBadgeVisual() {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-5 min-h-[220px]">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 14a8 8 0 0116 0" />
            <path d="M10 18a4 4 0 018 0" />
            <circle cx="14" cy="22" r="1.5" fill="#34D399" />
            <line x1="4" y1="4" x2="24" y2="24" strokeOpacity="0.3" />
          </svg>
        </div>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0A0A0A]" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-white/80">Working offline</p>
        <p className="text-xs text-white/35">1,247 notes synced locally</p>
      </div>
      <div className="w-full max-w-[160px] h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300" />
      </div>
    </div>
  );
}

function HighlightMockVisual() {
  return (
    <div className="p-5 space-y-4">
      <p className="text-xs leading-7 text-white/50 select-none">
        Large language models achieve remarkable{" "}
        <mark className="bg-[#8B5CF6]/25 text-[#A78BFA] rounded px-0.5 not-italic">reasoning capabilities</mark>{" "}
        through in-context learning. Unlike traditional{" "}
        <mark className="bg-amber-500/20 text-amber-300 rounded px-0.5 not-italic">fine-tuning approaches</mark>
        , prompting enables{" "}
        <mark className="bg-blue-500/15 text-blue-300 rounded px-0.5 not-italic">zero-shot generalization</mark>{" "}
        across a wide range of tasks at inference time.
      </p>
      <div className="flex items-center gap-3">
        {([["#8B5CF6", "Concept"], ["#F59E0B", "Method"], ["#06B6D4", "Term"]] as [string, string][]).map(([color, t]) => (
          <span key={t} className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function CodeBlockVisual() {
  const lines: [number, string, string][] = [
    [1,  "GET /v1/highlights",           "text-white/60"   ],
    [2,  "Authorization: Bearer {token}","text-white/35"   ],
    [3,  "",                             ""                ],
    [4,  "// Response",                  "text-white/25"   ],
    [5,  '{ "data": [',                  "text-white/50"   ],
    [6,  '  { "id": "h_01J",',          "text-white/40"   ],
    [7,  '    "text": "LLMs achieve",', "text-white/40"   ],
    [8,  '    "tags": ["AI", "NLP"]',    "text-emerald-400/70"],
    [9,  "  }",                          "text-white/40"   ],
    [10, "]}",                           "text-white/50"   ],
  ];
  return (
    <div className="p-4 font-mono text-[11px] space-y-0.5 overflow-hidden">
      {lines.map(([n, code, color]) => (
        <div key={n} className="flex gap-3">
          <span className="text-white/15 w-5 shrink-0 text-right select-none">{n}</span>
          <span className={color}>{code}</span>
        </div>
      ))}
    </div>
  );
}

function TagsFilterVisual() {
  const tags = [
    { label: "AI / ML",      color: "#A78BFA", count: 34 },
    { label: "Product",       color: "#F59E0B", count: 15 },
    { label: "Reading List",  color: "#34D399", count: 12 },
    { label: "Conference",    color: "#FB923C", count:  7 },
  ];
  return (
    <div className="p-5 space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 h-8">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30 shrink-0" aria-hidden="true">
          <circle cx="4.5" cy="4.5" r="3" /><path d="M7 7l2 2" />
        </svg>
        <span className="text-[11px] text-white/30 flex-1">Filter by tag</span>
      </div>
      {/* Tag pills */}
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span
            key={t.label}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
            style={{
              color:            t.color,
              borderColor:      t.color + "40",
              backgroundColor:  t.color + "12",
            }}
          >
            {t.label}
            <span className="text-[10px] opacity-60">{t.count}</span>
          </span>
        ))}
      </div>
      {/* Active filter bar */}
      <div className="flex items-center gap-2 text-[11px] text-white/35">
        {/* <span className="text-[#EC4899]/70">Design</span> */}
        <span>Â·</span>
        <span className="text-[#A78BFA]/70">AI / ML</span>
        <span className="ml-auto text-white/20">55 results</span>
      </div>
    </div>
  );
}

function ReadingModeVisual() {
  return (
    <div className="p-5 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {(["A", "A"] as const).map((a, i) => (
            <button
              key={i}
              className={`w-7 h-7 rounded-lg border border-white/[0.08] text-white/40 flex items-center justify-center transition-colors ${i === 1 ? "bg-white/[0.08] text-white/70" : ""}`}
              style={{ fontSize: i === 0 ? 10 : 13 }}
              aria-hidden="true"
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {(["â˜€", "â—‘", "â—"] as const).map((icon, i) => (
            <button
              key={i}
              className={`w-7 h-7 rounded-lg border text-[13px] flex items-center justify-center transition-colors ${i === 2 ? "border-[#14B8A6]/50 bg-[#14B8A6]/10 text-[#14B8A6]" : "border-white/[0.07] text-white/30"}`}
              aria-hidden="true"
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      {/* Article mock */}
      <div className="space-y-2.5">
        <div className="h-3 w-3/4 rounded bg-white/[0.10]" />
        <div className="h-2.5 w-full rounded bg-white/[0.06]" />
        <div className="h-2.5 w-full rounded bg-white/[0.06]" />
        <div className="h-2.5 w-5/6 rounded bg-white/[0.06]" />
        <div className="h-2.5 w-0 rounded" />
        <div className="h-2.5 w-full rounded bg-white/[0.06]" />
        <div className="h-2.5 w-3/4 rounded bg-white/[0.06]" />
      </div>
      {/* Reading progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-white/25">
          <span>Reading progress</span><span>42%</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-[#14B8A6] to-[#14B8A6]/60" />
        </div>
      </div>
    </div>
  );
}

//  Visuals registry 
const VISUALS: Record<string, React.ReactNode> = {
  folders:    <FolderTreeVisual />,
  context:    <NLQueryVisual />,
  offline:    <OfflineBadgeVisual />,
  highlights: <HighlightMockVisual />,
  api:        <CodeBlockVisual />,
  tags:       <TagsFilterVisual />,
  reading:    <ReadingModeVisual />,
};

//  Section 
export function BentoGrid() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="features"
      ref={ref}
      className="py-28 px-6 lg:px-10 max-w-7xl mx-auto"
      aria-label="Features"
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.20, 0.90, 0.30, 1.00] }}
        className="text-center space-y-4 mb-16"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Features
        </span>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tighter">
          Everything you need.{" "}
          <span className="text-secondary">Nothing you don&apos;t.</span>
        </h2>
      </motion.div>

      {/* Asymmetric Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
        {FEATURES.map((feature, i) => (
          <BentoCard key={feature.id} index={i} parentInView={inView} {...feature} visual={VISUALS[feature.id]} />
        ))}
      </div>
    </section>
  );
}

//  Card 
interface BentoCardProps {
  tag:           string;
  heading:       string;
  body:          string;
  accent:        string;
  span:          string;
  visual:        React.ReactNode;
  index:         number;
  parentInView:  boolean;
}

function BentoCard({ tag, heading, body, accent, span, visual, index, parentInView }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={parentInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{
        duration: 0.7,
        ease: [0.20, 0.90, 0.30, 1.00],
        delay: 0.06 * index,
      }}
      className={span}
    >
      <SpotlightCard
        spotlightColor={`${accent}18`}
        className="h-full flex flex-col"
      >
        {/* Radial glow at top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background: `radial-gradient(60% 40% at 50% 0%, ${accent}10 0%, transparent 100%)`,
          }}
        />

        {/* Glass rim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        />

        {/* Visual */}
        <div className="relative z-10 min-h-[200px] border-b border-white/[0.04]">
          {visual}
        </div>

        {/* Text content */}
        <div className="relative z-10 p-6 space-y-2 flex-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {tag}
          </span>
          <h3 className="text-lg font-bold tracking-tight text-white/90">
            {heading}
          </h3>
          <p className="text-sm text-white/45 leading-relaxed">
            {body}
          </p>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

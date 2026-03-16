"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@cortex/ui";
import { SkeletonCard } from "@cortex/ui";
import { Badge } from "@cortex/ui";
import { Card, CardContent } from "@cortex/ui";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Highlight {
  id:      string;
  text:    string;
  url:     string;
  domain:  string;
  date:    string;
  tags:    string[];
  color:   "violet" | "blue" | "emerald" | "amber" | "rose";
  folder?: string;
}

// ─── Mock fetcher (replace with real API) ────────────────────────────────────
async function fetchHighlights(): Promise<Highlight[]> {
  await new Promise((r) => setTimeout(r, 800)); // Simulate network
  return [
    // { id: "1",  text: "The key insight is that attention mechanisms allow the model to dynamically weight the importance of different input tokens when generating each output token.", url: "https://arxiv.org/abs/1706.03762", domain: "arxiv.org", date: "2h ago", tags: ["ML", "Attention"], color: "violet", folder: "Research" },
    // { id: "2",  text: "Progressive disclosure is the practice of sequencing information and actions so that users feel less overwhelmed.", url: "https://nngroup.com", domain: "nngroup.com", date: "5h ago", tags: ["UX", "Design"], color: "blue", folder: "Design" },
    { id: "3",  text: "Zero-knowledge proofs enable one party to prove they know a value x without conveying any information apart from the fact that they know the value x.", url: "https://blog.ethereum.org", domain: "ethereum.org", date: "1d ago", tags: ["Crypto", "ZK"], color: "emerald" },
    { id: "4",  text: "The most profound technologies are those that disappear. They weave themselves into the fabric of everyday life until they are indistinguishable from it.", url: "https://ubiquitous-computing.org", domain: "ubiquitous-computing.org", date: "2d ago", tags: ["Philosophy", "Tech"], color: "amber" },
    { id: "5",  text: "Speculative execution is a performance optimization where a processor executes instructions before it is known whether they will actually be needed.", url: "https://cpu-architecture.io", domain: "cpu-architecture.io", date: "3d ago", tags: ["Systems", "CPU"], color: "rose", folder: "Engineering" },
    { id: "6",  text: "The CAP theorem states that in a distributed system you can only guarantee two out of three properties: Consistency, Availability, and Partition tolerance.", url: "https://distributed.systems", domain: "distributed.systems", date: "4d ago", tags: ["Distributed", "DB"], color: "violet", folder: "Engineering" },
    { id: "7",  text: "Spatial computing represents a paradigm shift where the physical and digital worlds merge seamlessly, enabling humans and machines to interact in three-dimensional space.", url: "https://spatial.io", domain: "spatial.io", date: "5d ago", tags: ["AR", "XR"], color: "blue" },
    { id: "8",  text: "Flow state is characterized by complete absorption in what one is doing, resulting in a loss of one's sense of space and time.", url: "https://psychology.today", domain: "psychology.today", date: "1w ago", tags: ["Psychology"], color: "emerald" },
  ];
}

// ─── Color map ────────────────────────────────────────────────────────────────
const ACCENT_COLORS: Record<Highlight["color"], { tag: string; dot: string; border: string }> = {
  violet:  { tag: "border-violet-500/30 text-violet-400 bg-violet-500/10",  dot: "bg-violet-400",  border: "hover:border-violet-500/20"  },
  blue:    { tag: "border-blue-500/30 text-blue-400 bg-blue-500/10",        dot: "bg-blue-400",    border: "hover:border-blue-500/20"    },
  emerald: { tag: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400", border: "hover:border-emerald-500/20" },
  amber:   { tag: "border-amber-500/30 text-amber-400 bg-amber-500/10",     dot: "bg-amber-400",   border: "hover:border-amber-500/20"   },
  rose:    { tag: "border-rose-500/30 text-rose-400 bg-rose-500/10",        dot: "bg-rose-400",    border: "hover:border-rose-500/20"    },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function HighlightsGrid() {
  const { data: highlights, isLoading } = useQuery({
    queryKey: ["highlights"],
    queryFn:  fetchHighlights,
  });

  if (isLoading) return <SkeletonMasonry />;

  return (
    <div>
      {/* Count */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-base font-semibold text-primary">
          All Highlights
          <span className="ml-2 text-sm text-muted font-normal">
            {highlights?.length}
          </span>
        </h1>
      </div>

      {/* Masonry grid — CSS columns */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-0">
        {highlights?.map((h, i) => (
          <HighlightCard key={h.id} highlight={h} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Highlight card ───────────────────────────────────────────────────────────
function HighlightCard({ highlight: h, index }: { highlight: Highlight; index: number }) {
  const colors = ACCENT_COLORS[h.color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{
        duration: 0.5,
        delay:    index * 0.06,
        ease:     [0.16, 1, 0.3, 1],
      }}
      className="break-inside-avoid mb-4"
    >
      <Card
        interactive
        className={cn(
          "group transition-all duration-350 ease-snappy",
          colors.border,
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Left accent bar */}
          <div className="flex gap-3">
            <div className={cn("w-0.5 rounded-full flex-shrink-0 self-stretch", colors.dot)} />
            <blockquote className="text-sm text-secondary leading-relaxed italic flex-1">
              &ldquo;{h.text}&rdquo;
            </blockquote>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between">
            <a
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors duration-150 truncate max-w-[160px]"
              onClick={(e) => e.stopPropagation()}
            >
              <LinkIcon />
              <span className="truncate">{h.domain}</span>
            </a>
            <span className="text-xs text-muted flex-shrink-0">{h.date}</span>
          </div>

          {/* Tags */}
          {h.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {h.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "text-2xs px-2 py-0.5 rounded-full border",
                    "font-medium uppercase tracking-wide",
                    colors.tag,
                  )}
                >
                  {tag}
                </span>
              ))}
              {h.folder && (
                <span className="text-2xs px-2 py-0.5 rounded-full border border-white/10 text-muted bg-white/[0.04] font-medium uppercase tracking-wide">
                  {h.folder}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Skeleton masonry ─────────────────────────────────────────────────────────
function SkeletonMasonry() {
  const heights = [120, 180, 140, 200, 130, 170, 160, 140];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-5 w-32 rounded-lg bg-white/[0.05] animate-shimmer" />
      </div>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
        {heights.map((h, i) => (
          <div key={i} className="break-inside-avoid mb-4">
            <SkeletonCard className="w-full" style={{ height: h }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6l1-1a2 2 0 012.83 0l.58.58a2 2 0 010 2.83L7.83 9A2 2 0 015 9L4.17 8.17" />
      <path d="M6 4L5 5A2 2 0 012.17 5L1.59 4.41A2 2 0 011.59 1.59L2.17 1A2 2 0 015 1L5.83 1.83" />
    </svg>
  );
}

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { toast } from "sonner";

const ease = [0.16, 1, 0.3, 1] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedHighlight {
  id: string;
  text: string;
  source: string;
  url: string | null;
  note: string | null;
  topic: string;
  topicColor: string;
  isCode: boolean;
  isAI: boolean;
  highlightColor: string | null;
  chatName: string | null;
}

interface SharedFolder {
  id: string;
  name: string;
  emoji: string;
  highlights: SharedHighlight[];
  subFolders: SharedFolder[];
}

interface SharePayload {
  hash: string;
  resourceType: "HIGHLIGHT" | "FOLDER";
  sharedBy: string;
  sharedAt: string;
  highlight?: SharedHighlight;
  folder?: SharedFolder;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams<{ hash: string }>();
  const router = useRouter();
  const hash   = params.hash;

  const [payload, setPayload]   = React.useState<SharePayload | null>(null);
  const [loading, setLoading]   = React.useState(true);
  const [error, setError]       = React.useState<string | null>(null);
  const [acting, setActing]     = React.useState(false);

  // ── Auth check + data fetch ──
  React.useEffect(() => {
    async function load() {
      try {
        // Check if user is authenticated by calling the BFF proxy
        const res = await fetch(`/api/share/${encodeURIComponent(hash)}`);

        if (res.status === 401) {
          // Not logged in → redirect to signup with returnTo
          router.push(`/signup?returnTo=${encodeURIComponent(`/share/${hash}`)}`);
          return;
        }

        if (!res.ok) {
          setError("This share link is invalid or has been removed.");
          setLoading(false);
          return;
        }

        const data = (await res.json()) as SharePayload;
        setPayload(data);
        setLoading(false);
      } catch {
        setError("Failed to load shared content. Please check your connection and try again.");
        setLoading(false);
      }
    }

    load();
  }, [hash, router]);

  // ── Action handlers ──

  async function handleView() {
    setActing(true);
    try {
      await fetch(`/api/share/${encodeURIComponent(hash)}/view`, { method: "POST" });
      toast.success("Saved to \"Shared with me\"");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActing(false);
    }
  }

  async function handleClone() {
    setActing(true);
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(hash)}/clone`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Added to your library!");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to add to library");
    } finally {
      setActing(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.4)] animate-pulse">
            <CortexMark />
          </div>
          <p className="text-sm text-white/40">Loading shared content…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !payload) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3M8 10.5v.5" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white/90 mb-2">Link not found</h1>
          <p className="text-sm text-white/40 mb-6">{error ?? "This share link is invalid."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-sm font-medium",
              "bg-accent hover:bg-accent/90 text-white",
              "shadow-[0_0_15px_rgba(108,99,255,0.3)]",
              "transition-all duration-200",
            )}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Hero-gradient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-hero-gradient opacity-20 -z-10"
      />

      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-bg/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-[0_0_14px_rgba(108,99,255,0.3)]">
            <CortexMark />
          </span>
          <span className="font-semibold text-sm tracking-tight">Cortex</span>
          <span className="text-white/20 text-sm mx-2">·</span>
          <span className="text-sm text-white/40">Shared content</span>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="max-w-4xl mx-auto px-6 pt-10"
      >
        {payload.resourceType === "HIGHLIGHT" && payload.highlight && (
          <HighlightPreview highlight={payload.highlight} />
        )}

        {payload.resourceType === "FOLDER" && payload.folder && (
          <FolderPreview folder={payload.folder} />
        )}
      </motion.main>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-bg/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-white/40">
            Shared by <span className="text-white/70 font-medium">{payload.sharedBy}</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleView}
              disabled={acting}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-medium",
                "bg-white/[0.06] border border-white/[0.10]",
                "text-white/80 hover:bg-white/[0.10] hover:text-white",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              Just view
            </button>
            <button
              onClick={handleClone}
              disabled={acting}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-medium",
                "bg-accent hover:bg-accent/90 text-white",
                "shadow-[0_0_20px_rgba(108,99,255,0.3)]",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {acting ? "Adding…" : "Add to my library"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Highlight Preview ────────────────────────────────────────────────────────

function HighlightPreview({ highlight }: { highlight: SharedHighlight }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-surface",
        "shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
        "p-8",
      )}
    >
      {/* Topic badge */}
      <div className="flex items-center gap-2 mb-6">
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", highlight.topicColor)}>
          {highlight.topic}
        </span>
        {highlight.isAI && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
            🤖 AI Highlight
          </span>
        )}
      </div>

      {/* Text */}
      <blockquote
        className={cn(
          "text-lg leading-relaxed text-white/90 font-medium",
          "border-l-2 border-accent/40 pl-5",
          highlight.isCode && "font-mono text-sm bg-white/[0.03] rounded-lg p-4 border-l-0",
        )}
        style={highlight.highlightColor ? { borderLeftColor: highlight.highlightColor } : undefined}
      >
        {highlight.text}
      </blockquote>

      {/* Note */}
      {highlight.note && (
        <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs font-medium text-white/40 mb-1.5">Comments</p>
          <p className="text-sm text-white/70 leading-relaxed">{highlight.note}</p>
        </div>
      )}

      {/* Source */}
      <div className="mt-6 flex items-center gap-2 text-sm text-white/40">
        <SourceIcon />
        {highlight.url ? (
          <a
            href={highlight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors truncate"
          >
            {highlight.source || highlight.url}
          </a>
        ) : (
          <span className="text-white/30">Private AI Chat</span>
        )}
      </div>
    </div>
  );
}

// ─── Folder Preview ───────────────────────────────────────────────────────────

function FolderPreview({ folder }: { folder: SharedFolder }) {
  return (
    <div className="space-y-6">
      {/* Folder header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{folder.emoji}</span>
        <div>
          <h1 className="text-xl font-semibold text-white/90">{folder.name}</h1>
          <p className="text-sm text-white/40">
            {countHighlights(folder)} highlight{countHighlights(folder) !== 1 ? "s" : ""}
            {folder.subFolders.length > 0 && ` · ${folder.subFolders.length} subfolder${folder.subFolders.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Highlights in root folder */}
      {folder.highlights.length > 0 && (
        <div className="space-y-3">
          {folder.highlights.map((h) => (
            <HighlightCard key={h.id} highlight={h} />
          ))}
        </div>
      )}

      {/* Sub-folders */}
      {folder.subFolders.map((sub) => (
        <SubFolderSection key={sub.id} folder={sub} depth={0} />
      ))}
    </div>
  );
}

function SubFolderSection({ folder, depth }: { folder: SharedFolder; depth: number }) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="space-y-3" style={{ marginLeft: Math.min(depth, 3) * 16 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors group"
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
        >
          <path d="M3 1L7 5L3 9" />
        </svg>
        <span className="text-base leading-none">{folder.emoji}</span>
        <span className="font-medium">{folder.name}</span>
        <span className="text-xs text-white/30">({folder.highlights.length})</span>
      </button>

      {expanded && (
        <div className="space-y-3 ml-4">
          {folder.highlights.map((h) => (
            <HighlightCard key={h.id} highlight={h} />
          ))}
          {folder.subFolders.map((sub) => (
            <SubFolderSection key={sub.id} folder={sub} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: SharedHighlight }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02]",
        "p-5 transition-all duration-200",
        "hover:border-white/[0.10] hover:bg-white/[0.03]",
      )}
    >
      <p className="text-sm text-white/80 leading-relaxed">{highlight.text}</p>
      {highlight.note && (
        <p className="mt-2 text-xs text-white/40 italic">{highlight.note}</p>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-white/30">
        {highlight.isAI && <span className="text-amber-400/60">🤖 AI</span>}
        {highlight.url ? (
          <a
            href={highlight.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent truncate"
          >
            {highlight.source || highlight.url}
          </a>
        ) : (
          <span>Private AI Chat</span>
        )}
      </div>
    </div>
  );
}

function countHighlights(folder: SharedFolder): number {
  let count = folder.highlights.length;
  for (const sub of folder.subFolders) {
    count += countHighlights(sub);
  }
  return count;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CortexMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4" />
      <path d="M6 4v2l1.5 1.5" />
    </svg>
  );
}

function SourceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3H3v10h10v-3" />
      <path d="M8 8L14 2M10 2h4v4" />
    </svg>
  );
}

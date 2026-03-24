"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useScroll, useSpring } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYouTubeVideoId(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
  } catch { /* invalid URL */ }
  return null;
}

function formatVideoTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatRelativeDate(value: string | undefined): string {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: "System", value: "system-ui, -apple-system, sans-serif" },
  { label: "Serif",  value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono",   value: "'JetBrains Mono', 'SF Mono', monospace" },
];

const SIZE_OPTIONS = [
  { label: "S",  value: "text-sm leading-relaxed" },
  { label: "M",  value: "text-base leading-relaxed" },
  { label: "L",  value: "text-lg leading-loose" },
  { label: "XL", value: "text-xl leading-loose" },
];

const THEME_OPTIONS = [
  { label: "Dark",  bg: "bg-[#0a0a0a]", text: "text-white/80" },
  { label: "Sepia", bg: "bg-[#1a1712]", text: "text-[#d4c5a0]" },
  { label: "Light", bg: "bg-[#fafaf9]", text: "text-[#1a1a1a]" },
];

export default function ReadingModePage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;

  const highlight = useDashboardStore((s) => s.highlights.find((h) => h.id === id));

  if (!highlight) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-sm text-white/40">Highlight not found</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-3 text-xs text-accent hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <ReadingModeContent highlight={highlight} />;
}

function ReadingModeContent({ highlight }: { highlight: any }) {
  const router  = useRouter();
  const tags           = useDashboardStore((s) => s.tags);
  const toggleFavorite = useDashboardStore((s) => s.toggleFavorite);
  const updateHighlight = useDashboardStore((s) => s.updateHighlight);

  const [fontIdx,  setFontIdx]  = React.useState(0);
  const [sizeIdx,  setSizeIdx]  = React.useState(1);
  const [themeIdx, setThemeIdx] = React.useState(0);
  const [noteText, setNoteText] = React.useState(highlight.note ?? "");

  // Sync note text when highlight loads
  React.useEffect(() => {
    setNoteText(highlight.note ?? "");
  }, [highlight.id, highlight.note]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  const theme = THEME_OPTIONS[themeIdx];
  const font  = FONT_OPTIONS[fontIdx];
  const size  = SIZE_OPTIONS[sizeIdx];

  return (
    <div className={cn("h-screen flex flex-col", theme.bg)}>
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-accent z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Top toolbar */}
      <div className={cn(
        "sticky top-0 z-40 shrink-0",
        "h-12 flex items-center justify-between px-4",
        "border-b border-white/[0.06]",
        theme.bg,
      )}>
        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M9 3L5 7l4 4" />
          </svg>
          Back
        </button>

        {/* Source info */}
        <div className="text-center min-w-0">
          <p className="text-xs text-white/50 truncate max-w-[200px]">{highlight.source}</p>
        </div>

        {/* Typography controls */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "text-white/40 hover:text-white/70 hover:bg-white/[0.06]",
              "transition-all duration-150",
            )}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M2 11h10M4 3h6M7 3v8" />
              </svg>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={8}
              align="end"
              className={cn(
                "z-50 w-56 rounded-xl p-3",
                "bg-[#1c1c1c] border border-white/[0.09]",
                "shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              )}
            >
              {/* Font */}
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Font</p>
              <div className="flex gap-1 mb-3">
                {FONT_OPTIONS.map((f, i) => (
                  <button
                    key={f.label}
                    onClick={() => setFontIdx(i)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                      fontIdx === i
                        ? "bg-white/[0.10] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Size */}
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Size</p>
              <div className="flex gap-1 mb-3">
                {SIZE_OPTIONS.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => setSizeIdx(i)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                      sizeIdx === i
                        ? "bg-white/[0.10] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Theme */}
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Theme</p>
              <div className="flex gap-1">
                {THEME_OPTIONS.map((t, i) => (
                  <button
                    key={t.label}
                    onClick={() => setThemeIdx(i)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                      themeIdx === i
                        ? "bg-white/[0.10] text-white"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Reading area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        <article
          className="max-w-2xl mx-auto px-6 py-12"
          style={{ fontFamily: font.value }}
        >
          {/* Topic badge */}
          <div className="mb-6">
            <span className={cn("inline-block px-2.5 py-1 rounded-md text-[11px] font-medium", highlight.topicColor)}>
              {highlight.topic}
            </span>
          </div>

          {/* Source & metadata */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className={cn("text-lg font-semibold", theme.text)}>{highlight.source}</h1>
              {/* Favorite toggle */}
              <button
                onClick={() => toggleFavorite(highlight.id)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                aria-label={highlight.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={highlight.isFavorite ? "#F59E0B" : "none"}
                  stroke={highlight.isFavorite ? "#F59E0B" : "currentColor"}
                  strokeWidth="1.5"
                  className={highlight.isFavorite ? "" : "text-white/30"}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30 flex-wrap">
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-white/25">
                  <circle cx="6" cy="6" r="4.5" /><path d="M6 3.5v3l2 1" />
                </svg>
                {formatRelativeDate(highlight.savedAt)}
              </span>
              {highlight.folder && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-white/25">
                    <path d="M1.5 3.5V9.5C1.5 10.05 1.95 10.5 2.5 10.5H9.5C10.05 10.5 10.5 10.05 10.5 9.5V4.5C10.5 3.95 10.05 3.5 9.5 3.5H6L5 2H2.5C1.95 2 1.5 2.45 1.5 3V3.5Z" />
                  </svg>
                  {highlight.folder}
                </span>
              )}
              {highlight.url && highlight.url !== "#" && (
                <a
                  href={highlight.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent/60 hover:text-accent transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <path d="M9 3L3 9M9 3H5M9 3v4" />
                  </svg>
                  Source
                </a>
              )}
            </div>
          </div>

          {/* YouTube video embed */}
          {highlight.resourceType === "VIDEO" && (() => {
            const videoId = getYouTubeVideoId(highlight.url);
            if (!videoId) return null;
            const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}${highlight.videoTimestamp ? `?start=${Math.floor(highlight.videoTimestamp)}` : ""}`;
            return (
              <div className="mb-8">
                <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    src={src}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video"
                  />
                </div>
                {highlight.videoTimestamp != null && (
                  <p className="mt-2 text-[11px] text-white/30 flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-red-400/60">
                      <circle cx="6" cy="6" r="4.5" /><path d="M6 3.5v3l2 1" />
                    </svg>
                    Captured at {formatVideoTime(highlight.videoTimestamp)}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Highlight text */}
          {highlight.isCode ? (
            <pre className={cn(
              "font-mono text-sm whitespace-pre-wrap",
              "p-6 rounded-xl",
              "bg-white/[0.03] border border-white/[0.08]",
              theme.text,
            )}>
              {highlight.text}
            </pre>
          ) : (
            <blockquote className={cn(
              size.value,
              theme.text,
              "border-l-2 border-accent/30 pl-6",
            )}>
              &ldquo;{highlight.text}&rdquo;
            </blockquote>
          )}

          {/* Note — editable */}
          <div className={cn(
            "mt-8 p-4 rounded-xl",
            "bg-white/[0.03] border border-white/[0.06]",
          )}>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Your Notes</p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={() => {
                if (noteText !== (highlight.note ?? "")) {
                  updateHighlight(highlight.id, { note: noteText });
                }
              }}
              placeholder="Add a note…"
              className={cn(
                "w-full min-h-[80px] bg-transparent border-none outline-none resize-y text-sm",
                theme.text,
                "opacity-70 placeholder:text-white/20",
              )}
            />
          </div>

          {/* Tags — resolved to display names */}
          {highlight.tags && highlight.tags.length > 0 && (
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-white/25 shrink-0">
                <path d="M7.5 1.5l5 5-6 6-5-5v-6h6z" /><circle cx="4.5" cy="4.5" r="1" />
              </svg>
              {highlight.tags.map((tagId) => {
                const tag = tags.find((t) => t.id === tagId);
                return (
                  <span
                    key={tagId}
                    className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-white/50 border border-white/[0.08]"
                  >
                    {tag?.name ?? tagId}
                  </span>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

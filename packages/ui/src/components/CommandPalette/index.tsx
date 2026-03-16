"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  group?: string;
  onSelect?: () => void;
  color?: string; // Optional: tag color hex or palette
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: CommandItem[];
  placeholder?: string;
  /** Mentionable sources for AI @context targeting */
  mentionSources?: MentionSource[];
  /** Trigger custom render slot (defaults to invisible) */
  children?: React.ReactNode;
}

export interface MentionSource {
  id:    string;
  label: string;
  type:  "folder" | "highlight";
  text?: string; // highlight text for context scanning
}

// ─── Animation variants ───────────────────────────────────────────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit:   { opacity: 0 },
};

const panelVariants = {
  hidden:  { opacity: 0, scale: 0.96, y: -8 },
  visible: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.97, y:  4 },
};

const panelTransition = {
  type:      "spring" as const,
  stiffness: 500,
  damping:   35,
  mass:      0.6,
};

// ─── Internal sub-components ─────────────────────────────────────────────────

const SearchIcon = () => (
  <svg
    width="16" height="16" viewBox="0 0 16 16"
    fill="none" stroke="currentColor" strokeWidth="1.75"
    aria-hidden="true" className="flex-shrink-0"
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
  </svg>
);

const KbdKey = ({ children }: { children: React.ReactNode }) => (
  <kbd
    className={cn(
      "inline-flex items-center justify-center",
      "h-5 min-w-[1.25rem] px-1 rounded-md",
      "bg-white/[0.07] border border-white/10",
      "text-2xs text-secondary font-mono leading-none",
      "shadow-inner",
    )}
  >
    {children}
  </kbd>
);

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette({
  open,
  onOpenChange,
  items = [],
  placeholder = "Search anything...",
  mentionSources = [],
  children,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [mode, setMode]   = React.useState<"search" | "ai">("search");

  // AI mode state
  const [aiQuery, setAiQuery]       = React.useState("");
  const [aiResponse, setAiResponse] = React.useState("");
  const [aiLoading, setAiLoading]   = React.useState(false);
  const [aiCitations, setAiCitations] = React.useState<Array<{ text: string; source: string }>>([]);

  // @mention state
  const [mentions, setMentions]             = React.useState<MentionSource[]>([]);
  const [showMentionPicker, setShowMentionPicker] = React.useState(false);
  const [mentionFilter, setMentionFilter]   = React.useState("");
  const [mentionIndex, setMentionIndex]     = React.useState(0);
  const aiInputRef = React.useRef<HTMLInputElement>(null);

  // Mock AI responses
  const MOCK_AI_RESPONSES: Record<string, { answer: string; citations: Array<{ text: string; source: string }> }> = {
    default: {
      answer: "Based on your highlights, the key theme across your saved knowledge is the intersection of technology and human intention. Your Product folder emphasizes hypothesis-driven development. The common thread is that tools should serve human agency, not replace it.",
      citations: [
        { text: "The best way to predict the future is to invent it.", source: "The Dream Machine" },
        { text: "A product is a hypothesis. Every feature is a bet.", source: "Intercom Blog" },
      ],
    },
  };

  // Typewriter effect
  const typewriterRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAiResponse = React.useCallback((q: string) => {
    setAiLoading(true);
    setAiResponse("");
    setAiCitations([]);

    // Strip @mention pills from query text for analysis
    const cleanQuery = q.replace(/@\S+/g, "").trim();

    // Context-aware mock AI: scan mentioned sources for query terms
    if (mentions.length > 0 && cleanQuery) {
      const contextTexts = mentions
        .map((m) => m.text ?? m.label)
        .join(" ")
        .toLowerCase();
      const queryWords = cleanQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const found = queryWords.some((w) => contextTexts.includes(w));

      if (!found) {
        setTimeout(() => {
          setAiLoading(false);
          setAiResponse(
            `The word/concept is not present in the selected highlights. Please try another query or broaden your search.`,
          );
        }, 600);
        return;
      }
    }

    const response = MOCK_AI_RESPONSES.default;

    // Simulate 1s API delay, then typewriter
    setTimeout(() => {
      setAiLoading(false);
      let idx = 0;
      const fullText = response.answer;
      const type = () => {
        if (idx < fullText.length) {
          setAiResponse(fullText.slice(0, idx + 1));
          idx++;
          typewriterRef.current = setTimeout(type, 12 + Math.random() * 18);
        } else {
          setAiCitations(response.citations);
        }
      };
      type();
    }, 1000);
  }, [mentions]);

  // Clean up typewriter on close
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setMode("search");
      setAiQuery("");
      setAiResponse("");
      setAiLoading(false);
      setAiCitations([]);
      setMentions([]);
      setShowMentionPicker(false);
      setMentionFilter("");
      setMentionIndex(0);
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    }
  }, [open]);

  // Filtered mention sources (exclude already selected)
  const filteredMentions = React.useMemo(() => {
    const selectedIds = new Set(mentions.map((m) => m.id));
    return mentionSources
      .filter((s) => !selectedIds.has(s.id))
      .filter((s) => s.label.toLowerCase().includes(mentionFilter.toLowerCase()));
  }, [mentionSources, mentions, mentionFilter]);

  // Handle @ detection in AI input
  const handleAiInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAiQuery(val);

    // Detect @ trigger
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");

    if (atIdx !== -1 && (atIdx === 0 || textBefore[atIdx - 1] === " ")) {
      const filter = textBefore.slice(atIdx + 1);
      if (!filter.includes(" ")) {
        setShowMentionPicker(true);
        setMentionFilter(filter);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentionPicker(false);
    setMentionFilter("");
  }, []);

  // Select a mention
  const selectMention = React.useCallback((source: MentionSource) => {
    setMentions((prev) => [...prev, source]);
    // Remove the @query text from input
    const cursorPos = aiInputRef.current?.selectionStart ?? aiQuery.length;
    const textBefore = aiQuery.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1) {
      setAiQuery(aiQuery.slice(0, atIdx) + aiQuery.slice(cursorPos));
    }
    setShowMentionPicker(false);
    setMentionFilter("");
    aiInputRef.current?.focus();
  }, [aiQuery]);

  // Remove a mention pill
  const removeMention = React.useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Group items
  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const g = item.group ?? "General";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children && (
        <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
      )}

      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* ── Backdrop ── */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.18 }}
              />
            </DialogPrimitive.Overlay>

            {/* ── Panel ── */}
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className={cn(
                  "fixed left-1/2 top-[20vh] z-50 -translate-x-1/2",
                  "w-full max-w-[640px] mx-4",
                  "rounded-2xl overflow-hidden",
                  "bg-surface/80 backdrop-blur-xl",
                  "border border-white/10",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.10),0_24px_64px_rgba(0,0,0,0.7)]",
                  "transform-gpu will-change-transform",
                )}
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={panelTransition}
              >
                <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Search and navigate the application, or ask AI questions.
                </DialogPrimitive.Description>

                {/* ── Mode toggle tabs ── */}
                <div className={cn("flex items-center gap-1 px-4 pt-3 pb-0")}>
                  {(["search", "ai"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                        mode === m
                          ? "bg-white/[0.10] text-white"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]",
                      )}
                    >
                      {m === "search" ? "Search" : "✨ Ask AI"}
                    </button>
                  ))}
                </div>

                {mode === "search" ? (
                  /* ── SEARCH MODE ── */
                  <CommandPrimitive className="flex flex-col" shouldFilter={true} loop>
                    <div className={cn("flex items-center gap-3 px-4 py-3.5", "border-b border-white/[0.07]")}>
                      <span className="text-secondary"><SearchIcon /></span>
                      <CommandPrimitive.Input
                        value={query}
                        onValueChange={setQuery}
                        placeholder={placeholder}
                        className={cn(
                          "flex-1 bg-transparent",
                          "text-sm font-medium text-primary placeholder:text-muted",
                          "outline-none border-none caret-accent",
                        )}
                        autoFocus
                      />
                      <KbdKey>ESC</KbdKey>
                    </div>

                    <CommandPrimitive.List className="overflow-y-auto max-h-[340px] py-2 px-1.5 scrollbar-thin">
                      <CommandPrimitive.Empty className="py-12 text-center text-sm text-secondary">
                        No results for &ldquo;{query}&rdquo;
                      </CommandPrimitive.Empty>

                      {Array.from(grouped.entries()).map(([group, groupItems]) => (
                        <CommandPrimitive.Group
                          key={group}
                          heading={group}
                          className={cn(
                            "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2",
                            "[&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase",
                            "[&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted",
                            "[&_[cmdk-group-heading]]:font-semibold",
                          )}
                        >
                          {groupItems.map((item) => {
                            // If this is a tag item with a color, render with color styling
                            const isTag = !!item.color;
                            return (
                              <CommandPrimitive.Item
                                key={item.id}
                                value={`${item.label} ${item.description ?? ""}`}
                                onSelect={() => {
                                  item.onSelect?.();
                                  onOpenChange(false);
                                }}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                                  isTag
                                    ? "text-xs font-medium border cursor-pointer select-none transition-all duration-150"
                                    : "text-sm text-secondary cursor-pointer select-none transition-all duration-150",
                                  "data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-primary",
                                  "data-[selected=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                                )}
                                style={isTag && item.color ? { background: item.color, color: '#fff', borderColor: item.color + '80' } : {}}
                              >
                                {item.icon && (
                                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-secondary">
                                    {item.icon}
                                  </span>
                                )}
                                <span className="flex-1 min-w-0">
                                  <span className={isTag ? "block truncate" : "block font-medium text-primary truncate"}>{item.label}</span>
                                  {item.description && !isTag && (
                                    <span className="block text-xs text-muted truncate mt-0.5">{item.description}</span>
                                  )}
                                </span>
                                {item.shortcut && (
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    {item.shortcut.map((k, i) => <KbdKey key={i}>{k}</KbdKey>)}
                                  </span>
                                )}
                              </CommandPrimitive.Item>
                            );
                          })}
                        </CommandPrimitive.Group>
                      ))}
                    </CommandPrimitive.List>

                    <div className={cn("flex items-center justify-between px-4 py-2.5", "border-t border-white/[0.06]")}>
                      <div className="flex items-center gap-3 text-2xs text-muted">
                        <span className="flex items-center gap-1">
                          <KbdKey>↑</KbdKey><KbdKey>↓</KbdKey><span className="ml-1">navigate</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <KbdKey>↵</KbdKey><span className="ml-1">select</span>
                        </span>
                      </div>
                      <span className="text-2xs text-muted uppercase tracking-widest font-medium">Cortex</span>
                    </div>
                  </CommandPrimitive>
                ) : (
                  /* ── ASK AI MODE ── */
                  <div className="flex flex-col">
                    {/* @mention pills */}
                    {mentions.length > 0 && (
                      <div className={cn("flex flex-wrap gap-1.5 px-4 pt-3 pb-0")}>
                        {mentions.map((m) => (
                          <span
                            key={m.id}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                              "text-blue-400 bg-blue-500/20",
                            )}
                          >
                            @{m.label}
                            <button
                              onClick={() => removeMention(m.id)}
                              className="text-blue-400/60 hover:text-blue-400 ml-0.5"
                              aria-label={`Remove ${m.label}`}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                                <path d="M2 2l6 6M8 2l-6 6" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* AI input */}
                    <div className={cn("flex items-center gap-3 px-4 py-3.5", "border-b border-white/[0.07] relative")}>
                      <span className="text-purple-400">
                        <AiSparkleIcon />
                      </span>
                      <input
                        ref={aiInputRef}
                        value={aiQuery}
                        onChange={handleAiInputChange}
                        onKeyDown={(e) => {
                          if (showMentionPicker) {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
                              return;
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              setMentionIndex((i) => Math.max(i - 1, 0));
                              return;
                            }
                            if (e.key === "Enter" && filteredMentions[mentionIndex]) {
                              e.preventDefault();
                              selectMention(filteredMentions[mentionIndex]);
                              return;
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setShowMentionPicker(false);
                              return;
                            }
                          }
                          if (e.key === "Enter" && aiQuery.trim() && !showMentionPicker) {
                            startAiResponse(aiQuery);
                          }
                        }}
                        placeholder="Ask anything… type @ to mention a folder or highlight"
                        className={cn(
                          "flex-1 bg-transparent",
                          "text-sm font-medium text-primary placeholder:text-muted",
                          "outline-none border-none caret-purple-400",
                        )}
                        autoFocus
                      />
                      <KbdKey>ESC</KbdKey>

                      {/* @mention dropdown picker */}
                      {showMentionPicker && filteredMentions.length > 0 && (
                        <div
                          className={cn(
                            "absolute left-4 right-4 top-full mt-1 z-10",
                            "rounded-xl overflow-hidden",
                            "bg-[#1e1e1e] border border-white/[0.09]",
                            "shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]",
                            "max-h-[200px] overflow-y-auto",
                          )}
                        >
                          {filteredMentions.map((source, i) => (
                            <button
                              key={source.id}
                              onClick={() => selectMention(source)}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                                "transition-colors duration-100",
                                i === mentionIndex
                                  ? "bg-white/[0.08] text-white"
                                  : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                              )}
                            >
                              <span className="text-2xs uppercase tracking-wider text-muted w-12 shrink-0">
                                {source.type === "folder" ? "📁" : "✦"}
                              </span>
                              <span className="truncate">{source.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI response area */}
                    <div className="overflow-y-auto max-h-[340px] py-4 px-4 scrollbar-thin">
                      {!aiResponse && !aiLoading && (
                        <div className="py-8 text-center">
                          <p className="text-sm text-muted">Ask a question about your highlights library</p>
                          <p className="text-xs text-muted/60 mt-1">e.g. &ldquo;What are the key themes?&rdquo;</p>
                        </div>
                      )}

                      {aiLoading && (
                        <div className="space-y-3">
                          {/* Shimmer skeleton */}
                          <div className="h-3 w-4/5 rounded bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] animate-pulse" />
                          <div className="h-3 w-3/5 rounded bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] animate-pulse" />
                          <div className="h-3 w-2/3 rounded bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] animate-pulse" />
                        </div>
                      )}

                      {aiResponse && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-4"
                        >
                          <p className="text-sm text-white/80 leading-relaxed">
                            {aiResponse}
                            {aiResponse.length < (MOCK_AI_RESPONSES.default?.answer.length ?? 0) && (
                              <span className="inline-block w-0.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                          </p>

                          {/* Citation cards */}
                          {aiCitations.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                              <p className="text-2xs text-muted uppercase tracking-widest font-semibold">Sources</p>
                              {aiCitations.map((c, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.1 }}
                                  className={cn(
                                    "p-3 rounded-xl",
                                    "bg-white/[0.04] border border-white/[0.08]",
                                    "hover:bg-white/[0.06] transition-colors cursor-pointer",
                                  )}
                                >
                                  <p className="text-xs text-white/70 line-clamp-2">&ldquo;{c.text}&rdquo;</p>
                                  <p className="text-[10px] text-muted mt-1">— {c.source}</p>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    <div className={cn("flex items-center justify-between px-4 py-2.5", "border-t border-white/[0.06]")}>
                      <div className="flex items-center gap-2 text-2xs text-muted">
                        <span className="flex items-center gap-1">
                          <KbdKey>↵</KbdKey><span className="ml-1">ask</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <KbdKey>Tab</KbdKey><span className="ml-1">switch mode</span>
                        </span>
                      </div>
                      <span className="text-2xs text-purple-400/60 uppercase tracking-widest font-medium">AI Mode</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

// ─── AI Sparkle icon ──────────────────────────────────────────────────────────
function AiSparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" />
    </svg>
  );
}

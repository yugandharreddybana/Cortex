"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { ConnectDots } from "./ConnectDots";
import { ActionEngine } from "./ActionEngine";
import type { Highlight } from "@/store/dashboard";

// ─── Tag color map ─────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/20" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  pink:    { bg: "bg-pink-500/10",    text: "text-pink-400",    border: "border-pink-500/20" },
  teal:    { bg: "bg-teal-500/10",    text: "text-teal-400",    border: "border-teal-500/20" },
};

function TagPill({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  const c = TAG_COLORS[color] ?? TAG_COLORS.blue;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        c.bg, c.text, `border ${c.border}`,
        "rounded-md px-2 py-0.5 text-xs font-medium",
      )}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity" aria-label={`Remove tag ${name}`}>
          <XSmallIcon />
        </button>
      )}
    </span>
  );
}

// ─── HighlightSheet ────────────────────────────────────────────────────────────
interface HighlightSheetProps {
  highlight:    Highlight | null;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function HighlightSheet({ highlight, open, onOpenChange }: HighlightSheetProps) {
  const allTags       = useDashboardStore((s) => s.tags);
  const updateHighlight = useDashboardStore((s) => s.updateHighlight);

  const [note,        setNote]        = React.useState(highlight?.note ?? "");
  const [pickedTags,  setPickedTags]  = React.useState<string[]>(highlight?.tags ?? []);
  const [tagQuery,    setTagQuery]    = React.useState("");
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [saved,       setSaved]       = React.useState(false);

  // Sync state when highlight changes
  React.useEffect(() => {
    setNote(highlight?.note ?? "");
    setPickedTags(highlight?.tags ?? []);
    setSaved(false);
  }, [highlight?.id, highlight?.note, highlight?.tags]);

  const filteredTags = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(tagQuery.toLowerCase()) &&
      !pickedTags.includes(t.id),
  );

  function toggleTag(tagId: string) {
    setPickedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  function handleSave() {
    if (!highlight) return;
    updateHighlight(highlight.id, { note, tags: pickedTags });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                key="sheet-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* Sheet panel */}
            <Dialog.Content asChild>
              <motion.div
                key="sheet-panel"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
                className={cn(
                  "fixed right-0 top-0 z-50",
                  "w-full sm:w-[500px] h-screen",
                  "bg-[#121212] border-l border-white/10",
                  "flex flex-col overflow-hidden",
                  "focus:outline-none",
                )}
              >
                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-white/[0.07]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90 truncate">{highlight?.source}</p>
                    {highlight?.url && highlight.url !== "#" && (
                      <a
                        href={highlight.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent/60 hover:text-accent transition-colors truncate block mt-0.5"
                      >
                        {highlight.url}
                      </a>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className={cn(
                        "shrink-0 w-7 h-7 rounded-lg",
                        "flex items-center justify-center",
                        "text-white/40 hover:text-white hover:bg-white/[0.07]",
                        "transition-all duration-150",
                      )}
                      aria-label="Close"
                    >
                      <XIcon />
                    </button>
                  </Dialog.Close>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                  {/* Highlight content */}
                  {highlight?.isCode ? (
                    <pre className="font-mono text-sm whitespace-pre-wrap bg-white/[0.05] p-4 rounded-md overflow-x-auto text-white/75 border border-white/[0.07]">
                      {highlight.text}
                    </pre>
                  ) : highlight?.isTruncated ? (
                    <blockquote className="border-l-2 border-accent/60 pl-4 text-white/80 text-sm leading-relaxed italic relative group">
                      &ldquo;{highlight.text}...&rdquo;
                      <span
                        className="ml-1 underline cursor-pointer text-accent/80 group-hover:text-accent"
                        tabIndex={0}
                        title={highlight.fullText}
                        style={{ textDecoration: "underline dotted" }}
                      >
                        (hover to read more)
                      </span>
                      <div className="text-amber-400 text-xs mt-2">
                        This highlight is very large. Visit the source to read it entirely.
                      </div>
                    </blockquote>
                  ) : (
                    <blockquote className="border-l-2 border-accent/60 pl-4 text-white/80 text-sm leading-relaxed italic">
                      &ldquo;{highlight?.text}&rdquo;
                    </blockquote>
                  )}

                  {/* Topic badge */}
                  {highlight?.topic && (
                    <span className={cn("inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border-0", highlight.topicColor)}>
                      {highlight.topic}
                    </span>
                  )}

                  {/* Personal Notes */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-white/35">
                      Personal Notes
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      placeholder="Add your thoughts on this highlight…"
                      className={cn(
                        "w-full rounded-xl px-3.5 py-3",
                        "bg-white/[0.04] border border-white/[0.08]",
                        "text-sm text-white/80 placeholder:text-white/20",
                        "outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20",
                        "resize-none transition-all duration-150",
                      )}
                    />
                  </div>

                  {/* Connect the Dots */}
                  <ConnectDots text={highlight?.fullText || highlight?.text || ""} url={highlight?.url} />

                  {/* Action Engine */}
                  <ActionEngine text={highlight?.fullText || highlight?.text || ""} url={highlight?.url} />

                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-white/35">
                      Tags
                    </label>

                    {/* Selected tags */}
                    {pickedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {pickedTags.map((tid) => {
                          const tag = allTags.find((t) => t.id === tid);
                          if (!tag) return null;
                          return (
                            <TagPill
                              key={tag.id}
                              name={tag.name}
                              color={tag.color}
                              onRemove={() => toggleTag(tag.id)}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Popover combobox */}
                    <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <Popover.Trigger asChild>
                        <button
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl",
                            "bg-white/[0.04] border border-white/[0.08]",
                            "text-sm text-white/40 hover:text-white/70",
                            "hover:bg-white/[0.07] hover:border-white/[0.13]",
                            "transition-all duration-150 w-full",
                          )}
                        >
                          <PlusCircleIcon />
                          <span>Add tag…</span>
                        </button>
                      </Popover.Trigger>

                      <Popover.Portal>
                        <Popover.Content
                          align="center"
                          sideOffset={6}
                          className={cn(
                            "z-[60] w-[240px] rounded-xl overflow-hidden",
                            "bg-[#1c1c1c] border border-white/[0.09]",
                            "shadow-[0_16px_48px_rgba(0,0,0,0.6)]",
                            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                            "origin-top",
                          )}
                        >
                          {/* Search input */}
                          <div className="px-3 py-2.5 border-b border-white/[0.06]">
                            <input
                              autoFocus
                              value={tagQuery}
                              onChange={(e) => setTagQuery(e.target.value)}
                              placeholder="Search tags…"
                              className={cn(
                                "w-full bg-transparent text-sm text-white/80",
                                "placeholder:text-white/25 outline-none",
                              )}
                            />
                          </div>

                          {/* Tag list */}
                          <div className="p-1.5 max-h-48 overflow-y-auto">
                            {filteredTags.length === 0 ? (
                              <p className="px-3 py-2.5 text-xs text-white/30">No tags found</p>
                            ) : (
                              filteredTags.map((tag) => {
                                const c = TAG_COLORS[tag.color] ?? TAG_COLORS.blue;
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() => { toggleTag(tag.id); setTagQuery(""); setPopoverOpen(false); }}
                                    className={cn(
                                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg",
                                      "text-sm text-white/70 hover:text-white",
                                      "hover:bg-white/[0.06] transition-colors duration-100",
                                      "text-left",
                                    )}
                                  >
                                    <span className={cn("w-2 h-2 rounded-full", c.bg.replace("/10", ""), tag.color === "blue" ? "bg-blue-400" : tag.color === "violet" ? "bg-violet-400" : tag.color === "emerald" ? "bg-emerald-400" : tag.color === "amber" ? "bg-amber-400" : tag.color === "pink" ? "bg-pink-400" : "bg-teal-400")} />
                                    {tag.name}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-white/[0.07]">
                  <button
                    onClick={handleSave}
                    className={cn(
                      "w-full h-10 rounded-xl",
                      "text-sm font-medium",
                      "transition-all duration-200 ease-snappy",
                      saved
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-accent hover:bg-accent/90 text-white shadow-[0_0_20px_rgba(108,99,255,0.25)]",
                    )}
                  >
                    {saved ? (
                      <span className="flex items-center justify-center gap-2"><CheckIcon /> Saved</span>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>

                {/* Accessibility */}
                <Dialog.Title className="sr-only">
                  Highlight detail — {highlight?.source}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Edit notes and tags for this highlight
                </Dialog.Description>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l6 6M8 2L2 8" />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4.5v5M4.5 7h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6.5l3 3 5-5" />
    </svg>
  );
}

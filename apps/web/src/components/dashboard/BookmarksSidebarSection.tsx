"use client";

/**
 * BookmarksSidebarSection
 * =======================
 * Drop into your existing Sidebar.tsx.
 * Shows all ai_chat bookmarks with click-to-navigate and delete.
 *
 * Usage in Sidebar.tsx:
 *   import { BookmarksSidebarSection } from "@/components/dashboard/BookmarksSidebarSection";
 *   // then in JSX after your folders/tags sections:
 *   <BookmarksSidebarSection />
 *
 * Auth: This section lives inside the authenticated dashboard layout — no
 * extra auth check needed. If the user is not logged in, they can't see
 * the sidebar at all.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStore } from "@/store/dashboard";
import { useBookmarkNavigator } from "@/hooks/useBookmarkNavigator";
import type { Highlight } from "@/store/types";

export function BookmarksSidebarSection() {
  const highlights     = useDashboardStore((s) => s.highlights);
  const { navigateTo } = useBookmarkNavigator();

  // Only show ai_chat bookmarks that carry navigation meta
  const bookmarks = React.useMemo(
    () => highlights.filter((h) => h.highlightType === "ai_chat" && !!h.meta),
    [highlights],
  );

  const [open, setOpen] = React.useState(true);

  return (
    <div className="mt-2">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full flex items-center justify-between gap-2",
          "px-3 py-2 rounded-lg",
          "text-white/50 hover:text-white/80",
          "hover:bg-white/[0.04] transition-colors duration-150",
        ].join(" ")}
      >
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          Bookmarks
        </span>
        <span className="flex items-center gap-1.5">
          {bookmarks.length > 0 && (
            <span className="text-[10px] font-medium bg-white/[0.08] text-white/50 px-1.5 py-0.5 rounded-full">
              {bookmarks.length}
            </span>
          )}
          <svg
            width="10" height="10" viewBox="0 0 10 10"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M2 3.5l3 3 3-3"/>
          </svg>
        </span>
      </button>

      {/* Collapsible bookmark list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="bookmark-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{   height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {bookmarks.length === 0 ? (
              <p className="px-4 py-3 text-xs text-white/25 leading-relaxed">
                Select text in the AI chat and tap{" "}
                <span className="font-medium text-white/40">Save Bookmark</span>{" "}
                to pin it here.
              </p>
            ) : (
              <div className="mt-0.5 space-y-0.5 pb-1">
                {bookmarks.map((bm) => (
                  <BookmarkItem key={bm.id} bookmark={bm} onNavigate={navigateTo} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── BookmarkItem ──────────────────────────────────────────────────────────────

function BookmarkItem({
  bookmark,
  onNavigate,
}: {
  bookmark: Highlight;
  onNavigate: (h: Highlight) => void;
}) {
  const deleteFn    = useDashboardStore((s) => s.deleteHighlight);
  const [hov, setH] = React.useState(false);

  const preview = bookmark.text.length > 55
    ? bookmark.text.slice(0, 55) + "\u2026"
    : bookmark.text;

  const folderLabel = bookmark.folder ?? null;
  const tagLabels   = bookmark.tags?.map((t) => t.name) ?? [];

  const date = bookmark.savedAt
    ? new Date(bookmark.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <div
      role="group"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="relative flex items-start gap-2 px-3 py-2 mx-1 rounded-lg hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
    >
      {/* Left accent stripe */}
      <span className="mt-0.5 w-0.5 min-h-[2rem] self-stretch bg-blue-400/30 rounded-full shrink-0" aria-hidden="true" />

      {/* Content — click to navigate */}
      <button
        type="button"
        onClick={() => onNavigate(bookmark)}
        className="flex-1 text-left min-w-0"
        aria-label={`Navigate to bookmark: ${bookmark.text.slice(0, 60)}`}
      >
        <p className="text-xs text-white/70 leading-relaxed line-clamp-2 break-words">{preview}</p>

        {/* Folder / tag badges */}
        {(folderLabel || tagLabels.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {folderLabel && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.06] text-white/40">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {folderLabel}
              </span>
            )}
            {tagLabels.slice(0, 2).map((name) => (
              <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300/60">
                {name}
              </span>
            ))}
            {tagLabels.length > 2 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.05] text-white/30">
                +{tagLabels.length - 2}
              </span>
            )}
          </div>
        )}

        <p className="mt-1 text-[10px] text-white/25">{date}</p>
      </button>

      {/* Delete — visible on hover */}
      <AnimatePresence>
        {hov && (
          <motion.button
            key="del"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{   opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            type="button"
            onClick={(e) => { e.stopPropagation(); deleteFn(bookmark.id); }}
            className="absolute right-2 top-2 w-5 h-5 flex items-center justify-center rounded text-white/25 hover:text-red-400 hover:bg-white/[0.06] transition-colors duration-150"
            aria-label="Delete bookmark"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

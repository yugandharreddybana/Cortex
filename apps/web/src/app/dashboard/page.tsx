"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { ViewControlBar } from "@/components/dashboard/ViewControlBar";
import { useDashboardStore } from "@/store/dashboard";
import { cn } from "@cortex/ui";

export default function DashboardPage() {
  const searchQuery          = useDashboardStore((s) => s.searchQuery);
  const setSearchQuery       = useDashboardStore((s) => s.setSearchQuery);
  const highlights           = useDashboardStore((s) => s.highlights);
  const selectedIds          = useDashboardStore((s) => s.selectedHighlightIds);
  const selectAll            = useDashboardStore((s) => s.selectAllHighlights);
  const clearSelection       = useDashboardStore((s) => s.clearHighlightSelection);
  const activeCount          = highlights.filter((h) => !h.isArchived).length;
  const pinnedCount          = highlights.filter((h) => h.isPinned && !h.isArchived).length;

  const visibleIds = React.useMemo(
    () => highlights.filter((h) => !h.isArchived).map((h) => h.id),
    [highlights],
  );

  const allSelected   = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someSelected  = selectedIds.length > 0 && !allSelected;

  const handleSelectAll = React.useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(visibleIds);
    }
  }, [allSelected, clearSelection, selectAll, visibleIds]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky filter / layout-toggle bar */}
      <ViewControlBar />

      {/* Page content */}
      <div className="p-6 lg:p-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-white/90">
            Highlights
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {activeCount} saved &middot; last updated 2 hours ago
          </p>
        </div>

        {/* Search input */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <SearchInputIcon />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search highlights…"
              className={cn(
                "w-full h-9 pl-9 pr-3 rounded-lg",
                "bg-white/[0.04] border border-white/[0.08]",
                "text-sm text-white placeholder:text-white/25",
                "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30",
                "transition-all duration-150",
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Select all bar */}
        {visibleIds.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div
              onClick={handleSelectAll}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-all duration-150",
                  allSelected
                    ? "bg-accent border-accent"
                    : someSelected
                      ? "bg-accent/50 border-accent"
                      : "bg-transparent border-white/20 hover:border-white/40",
                )}
              >
                {allSelected && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                    <path d="M1.5 4.5l2.5 2.5L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {someSelected && !allSelected && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                    <path d="M2 4.5h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span className="text-[12px] text-white/50 group-hover:text-white/70 transition-colors select-none">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <span className="text-[11px] text-white/30">
                {selectedIds.length} of {visibleIds.length} selected
              </span>
            )}
          </div>
        )}

        {/* ── Pinned Highlights section ── */}
        {pinnedCount > 0 && (
          <section className="mb-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-2 mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent/70" aria-hidden="true">
                  <path d="M16 2l4.59 4.59a2 2 0 010 2.82L12 18l-1.17-1.17L16.17 11.5l-3.88-3.88L5.46 14.46 2 18v4h4l3.54-3.46L14.83 24 21.4 17.4a4 4 0 000-5.66L16 6.1V2z" />
                </svg>
                <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                  Pinned
                </h2>
                <span className="text-[10px] text-white/30 bg-white/[0.06] rounded-full px-2 py-0.5">
                  {pinnedCount}
                </span>
              </div>
              <HighlightsMasonry filterFn={(h) => !!h.isPinned && !h.isArchived} />
            </motion.div>
            <div className="h-px bg-white/[0.06] mt-8" />
          </section>
        )}

        {/* ── All Highlights section ── */}
        <section>
          {pinnedCount > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                All Highlights
              </h2>
              <span className="text-[10px] text-white/30 bg-white/[0.06] rounded-full px-2 py-0.5">
                {activeCount - pinnedCount}
              </span>
            </div>
          )}
          <HighlightsMasonry />
        </section>
      </div>
    </div>
  );
}

function SearchInputIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

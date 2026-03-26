"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { toast } from "sonner";

// ─── Component ────────────────────────────────────────────────────────────────
export function ViewControlBar() {
  const viewMode           = useDashboardStore((s) => s.viewMode);
  const setViewMode        = useDashboardStore((s) => s.setViewMode);
  const tags               = useDashboardStore((s) => s.tags);
  const activeTagFilters   = useDashboardStore((s) => s.activeTagFilters);
  const toggleTagFilter    = useDashboardStore((s) => s.toggleTagFilter);
  const addSmartCollection = useDashboardStore((s) => s.addSmartCollection);

  const filterCount = activeTagFilters.length;

  const handleSaveCollection = React.useCallback(() => {
    if (activeTagFilters.length === 0) return;
    const selectedNames = tags
      .filter((t) => activeTagFilters.includes(t.id))
      .map((t) => t.name);
    const name = selectedNames.join(" + ");
    addSmartCollection(name, [...activeTagFilters]);
    toast.success("Smart Collection created", {
      description: `Filtering by: ${name}`,
    });
  }, [activeTagFilters, tags, addSmartCollection]);

  return (
    <div
      className={cn(
        "sticky top-0 z-40 h-12",
        "border-b border-white/10",
        "bg-[#121212]/80 backdrop-blur-md",
        "flex items-center justify-between px-4",
      )}
    >
      {/* ── Left: Filter popover ────────────────────────────────────────── */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg",
              "text-[12px] font-medium",
              "border transition-all duration-150",
              filterCount > 0
                ? "bg-accent/10 border-accent/40 text-accent"
                : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.07]",
            )}
          >
            <FilterIcon />
            Filter
            {filterCount > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-accent/20 text-accent text-[10px] font-semibold flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={8}
            align="center"
            className={cn(
              "z-50 w-52 rounded-xl p-3",
              "bg-[#1c1c1c] border border-white/[0.09]",
              "shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
              "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
            )}
          >
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2 px-1">
              Tags
            </p>
            <div className="flex flex-col gap-0.5">
              {tags.map((tag) => {
                const checked = activeTagFilters.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer",
                      "transition-colors duration-100",
                      checked ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <div
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleTagFilter(tag.id)}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-150",
                        checked
                          ? "bg-accent border-accent"
                          : "border-white/20 bg-transparent",
                      )}
                    >
                      {checked && (
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                          <path d="M1.5 4.5l2.5 2.5L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={cn("text-[12px]", checked ? "text-white/85" : "text-white/55")}>
                      {tag.name}
                    </span>
                  </label>
                );
              })}
            </div>

            {filterCount > 0 && (
              <>
                <div className="h-px bg-white/[0.06] my-2" />
                <button
                  onClick={() => {
                    activeTagFilters.forEach((t) => toggleTagFilter(t));
                  }}
                  className="w-full text-center text-[11px] text-white/40 hover:text-white/70 transition-colors duration-100 py-1"
                >
                  Clear all filters
                </button>

                {activeTagFilters.length >= 2 && (
                  <button
                    onClick={handleSaveCollection}
                    className={cn(
                      "w-full text-center text-[11px] font-medium py-1.5 mt-1 rounded-lg",
                      "bg-accent/10 text-accent border border-accent/20",
                      "hover:bg-accent/20 transition-colors duration-150",
                    )}
                  >
                    ⚡ Save as Smart Collection
                  </button>
                )}
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* ── Right: Layout toggle ─────────────────────────────────────────── */}
      <ToggleGroup.Root
        type="single"
        value={viewMode}
        onValueChange={(v) => { if (v) setViewMode(v as "grid" | "list"); }}
        className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]"
        aria-label="View layout"
      >
        <ToggleGroup.Item
          value="grid"
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150",
            "text-white/50 hover:text-white/80",
            "data-[state=on]:bg-white/[0.10] data-[state=on]:text-white",
          )}
          aria-label="Grid view"
        >
          <GridIcon />
        </ToggleGroup.Item>
        <ToggleGroup.Item
          value="list"
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150",
            "text-white/50 hover:text-white/80",
            "data-[state=on]:bg-white/[0.10] data-[state=on]:text-white",
          )}
          aria-label="List view"
        >
          <ListIcon />
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 3h10M3 6h6M5 9h2" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="5" height="5" rx="1" opacity="0.8" />
      <rect x="7" y="1" width="5" height="5" rx="1" opacity="0.8" />
      <rect x="1" y="7" width="5" height="5" rx="1" opacity="0.8" />
      <rect x="7" y="7" width="5" height="5" rx="1" opacity="0.8" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M1 3.5h11M1 6.5h11M1 9.5h11" />
    </svg>
  );
}

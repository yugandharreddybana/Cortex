"use client";

import * as React from "react";
import { useDashboardStore } from "@/store/dashboard";
import { useSearchStore } from "@/store/useSearchStore";

/**
 * useHotkeys — global keyboard shortcuts for mouse-free navigation.
 *
 * Super+C           → open New Highlight dialog
 * Super+F           → open Cmd+K palette
 * Super+G           → toggle grid / list view
 * Super+J / Super+K → move focus ring down / up through highlight cards
 * Super+X           → toggle checkbox on focused card
 * Super+Backspace   → delete focused card (calls onDelete with the id)
 *
 * All shortcuts require the Super (Windows/Meta) key modifier.
 * They are silently ignored when focus is inside an
 * input, textarea, select, or contenteditable element.
 */
export function useHotkeys(onDelete: (id: string) => void) {
  const highlights            = useDashboardStore((s) => s.highlights);
  const focusedIdx            = useDashboardStore((s) => s.focusedHighlightIdx);
  const setFocusedIdx         = useDashboardStore((s) => s.setFocusedHighlightIdx);
  const toggleHighlightSelect = useDashboardStore((s) => s.toggleHighlightSelect);
  const setNewHighlightOpen   = useDashboardStore((s) => s.setNewHighlightDialogOpen);
  const setSearchOpen         = useSearchStore((s) => s.setIsOpen);
  const viewMode              = useDashboardStore((s) => s.viewMode);
  const setViewMode           = useDashboardStore((s) => s.setViewMode);

  // Keep a stable ref to the latest onDelete to avoid stale closures
  const onDeleteRef = React.useRef(onDelete);
  React.useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip when typing in an input surface
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT"       ||
        target.tagName === "TEXTAREA"    ||
        target.tagName === "SELECT"      ||
        target.isContentEditable
      ) return;

      // Require Meta (Windows/Super) key — ignore bare or Ctrl/Alt-only presses
      if (!e.metaKey) return;
      // Let Ctrl+Meta combos pass through to OS
      if (e.altKey) return;

      switch (e.key) {
        case "c":
          e.preventDefault();
          setNewHighlightOpen(true);
          break;

        case "f":
          e.preventDefault();
          setSearchOpen(true);
          break;

        case "g":
          e.preventDefault();
          setViewMode(viewMode === "grid" ? "list" : "grid");
          break;

        case "j":
          e.preventDefault();
          setFocusedIdx(Math.min(focusedIdx + 1, highlights.length - 1));
          break;

        case "k":
          e.preventDefault();
          setFocusedIdx(Math.max(focusedIdx - 1, 0));
          break;

        case "x": {
          e.preventDefault();
          const h = highlights[focusedIdx];
          if (h) toggleHighlightSelect(h.id);
          break;
        }

        case "Backspace":
        case "Delete": {
          e.preventDefault();
          const h = highlights[focusedIdx];
          if (h) onDeleteRef.current(h.id);
          break;
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    highlights,
    focusedIdx,
    setFocusedIdx,
    toggleHighlightSelect,
    setNewHighlightOpen,
    setSearchOpen,
    viewMode,
    setViewMode,
  ]);
}

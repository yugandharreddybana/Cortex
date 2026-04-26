"use client";

import * as React from "react";
import { useDashboardStore } from "@/store/dashboard";
import { useSearchStore } from "@/store/useSearchStore";

/**
 * useHotkeys — global keyboard shortcuts for mouse-free navigation.
 *
 * Cross-platform shortcuts (Cmd on macOS, Ctrl elsewhere):
 *   Mod+Shift+S       → open New Highlight dialog (capture)  ← primary
 *   Mod+Shift+F       → open command palette / search
 *   Mod+G             → toggle grid / list view
 *   Mod+J / Mod+K     → move focus ring down / up through highlight cards
 *   Mod+X             → toggle checkbox on focused card
 *   Mod+Backspace     → delete focused card (calls onDelete with the id)
 *
 * Ctrl+K is intentionally NOT bound — Chrome/Edge use it for the address bar.
 * Cmd+C / Ctrl+C is intentionally NOT bound — that is the OS copy shortcut.
 *
 * Shortcuts are silently ignored when focus is inside an
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

      // Cross-platform "Mod" key: Cmd on macOS, Ctrl elsewhere.
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
      const mod   = isMac ? e.metaKey : e.ctrlKey;
      if (!mod || e.altKey) return;

      const key = e.key.toLowerCase();

      // Mod+Shift combos → primary actions (don't collide with browser defaults)
      if (e.shiftKey) {
        switch (key) {
          case "s":
            e.preventDefault();
            setNewHighlightOpen(true);
            return;
          case "f":
            e.preventDefault();
            setSearchOpen(true);
            return;
        }
        return;
      }

      // Mod-only navigation shortcuts
      switch (key) {
        case "g":
          e.preventDefault();
          setViewMode(viewMode === "grid" ? "list" : "grid");
          break;

        case "j":
          e.preventDefault();
          setFocusedIdx(Math.min(focusedIdx + 1, highlights.length - 1));
          break;

        case "k":
          // Don't override Ctrl+K (Chrome address bar) — only fire on macOS Cmd+K
          if (!isMac) return;
          e.preventDefault();
          setFocusedIdx(Math.max(focusedIdx - 1, 0));
          break;

        case "x": {
          e.preventDefault();
          const h = highlights[focusedIdx];
          if (h) toggleHighlightSelect(h.id);
          break;
        }

        case "backspace":
        case "delete": {
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

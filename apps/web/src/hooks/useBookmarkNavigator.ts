/**
 * useBookmarkNavigator
 * ====================
 * Returns a single navigateTo(highlight) function.
 * When called, it:
 *   1. Finds the message block by data-message-id
 *   2. Smooth-scrolls it into view
 *   3. Restores the saved text selection (exact offsets, falls back to fuzzy quote match)
 *   4. Flashes the block with a golden highlight to draw the eye
 *
 * No auth check needed here — it's a pure DOM utility.
 * The sidebar that calls it is already inside the authenticated layout.
 */

import type { Highlight } from "@/store/types";

export function useBookmarkNavigator() {
  function navigateTo(highlight: Highlight) {
    if (!highlight.meta) {
      console.warn("[BookmarkNavigator] No meta on highlight — cannot navigate.", highlight.id);
      return;
    }
    const { messageId, startOffset, endOffset, quote } = highlight.meta;

    const block = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!block) {
      console.warn("[BookmarkNavigator] Message block not found:", messageId);
      return;
    }

    block.scrollIntoView({ behavior: "smooth", block: "center" });

    // Wait for smooth scroll to settle, then restore highlight
    setTimeout(() => {
      try { restoreTextRange(block, startOffset, endOffset, quote); }
      catch (err) { console.warn("[BookmarkNavigator] Could not restore text range:", err); }
      flashBlock(block);
    }, 600);
  }

  return { navigateTo };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function restoreTextRange(
  block: HTMLElement,
  startOffset: number,
  endOffset: number,
  quote: string,
) {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();

  // Collect all text nodes inside the block
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) textNodes.push(node);

  // Strategy 1: exact character offsets on the first matching text node
  let found = false;
  for (const tn of textNodes) {
    const len = tn.textContent?.length ?? 0;
    if (startOffset <= len) {
      try {
        const range = document.createRange();
        range.setStart(tn, Math.min(startOffset, len));
        range.setEnd(tn, Math.min(endOffset, len));
        sel.addRange(range);
        found = true;
        break;
      } catch { /* offset out-of-bounds on this node, try next */ }
    }
  }

  // Strategy 2: fuzzy match on quote string
  if (!found && quote) {
    const shortQuote = quote.slice(0, 40);
    for (const tn of textNodes) {
      const content = tn.textContent ?? "";
      const idx = content.indexOf(shortQuote);
      if (idx === -1) continue;
      try {
        const range = document.createRange();
        range.setStart(tn, idx);
        range.setEnd(tn, Math.min(idx + (endOffset - startOffset), content.length));
        sel.addRange(range);
        break;
      } catch { /* skip */ }
    }
  }
}

function flashBlock(block: HTMLElement) {
  if (!block.animate) return;
  block.animate(
    [
      { backgroundColor: "rgba(255,220,50,0.18)", outline: "2px solid rgba(255,220,50,0.4)" },
      { backgroundColor: "transparent",           outline: "2px solid transparent" },
    ],
    { duration: 1800, easing: "ease-out" },
  );
}

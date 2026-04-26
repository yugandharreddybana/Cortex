/**
 * URL helpers — absolute-URL coercion + Scroll-to-Text-Fragment generation.
 *
 * Text Fragments spec: https://wicg.github.io/scroll-to-text-fragment/
 * Format:  #:~:text=[prefix-,]textStart[,textEnd][,-suffix]
 *
 * Supported natively by Chrome / Edge / Brave / Opera / Arc / Vivaldi.
 * Firefox/Safari ignore the fragment — link still resolves to the page.
 */

export function ensureAbsoluteUrl(url: string | undefined): string {
  if (!url || url === "#") return "#";
  const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (hasProtocol) return url;
  return `https://${url}`;
}

/** Spec-required percent-encoding for the text-fragment value. */
function encodeFragmentSegment(s: string): string {
  return encodeURIComponent(s)
    .replace(/-/g, "%2D")
    .replace(/,/g, "%2C")
    .replace(/&/g, "%26");
}

/** Normalize a snippet so it actually matches the page's rendered text:
 *   • collapse all whitespace runs to a single space
 *   • strip surrounding zero-width / non-printable chars
 *   • trim leading/trailing punctuation that often differs (quotes, brackets)
 */
function normalizeSnippet(text: string): string {
  return text
    .replace(/[​-‍﻿]/g, "")     // zero-width
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’«»\[\(\{<\s]+/, "")
    .replace(/["'“”‘’«»\]\)\}>\s]+$/, "")
    .trim();
}

/**
 * Generate a Text-Fragment hash for the given snippet.
 *
 *  • Short (≤80 chars):     #:~:text=<full>
 *  • Long  (>80 chars):     #:~:text=<first6words>,<last6words>
 *    (range form is far more robust on long passages because exact-match on
 *    150 chars often fails when the page collapses whitespace differently.)
 */
export function generateTextFragment(text: string): string {
  if (!text) return "";
  const cleaned = normalizeSnippet(text);
  if (!cleaned) return "";

  if (cleaned.length <= 80) {
    return `#:~:text=${encodeFragmentSegment(cleaned)}`;
  }

  const words = cleaned.split(" ");
  if (words.length <= 12) {
    // Few words but long tokens — fall back to truncated single value.
    return `#:~:text=${encodeFragmentSegment(cleaned.slice(0, 150))}`;
  }
  const start = words.slice(0, 6).join(" ");
  const end   = words.slice(-6).join(" ");
  return `#:~:text=${encodeFragmentSegment(start)},${encodeFragmentSegment(end)}`;
}

/**
 * Build the "Open source" URL for a saved highlight. Appends a Text Fragment
 * so supporting browsers scroll to and highlight the passage automatically.
 */
export function formatSourceUrl(url: string | undefined, highlightText?: string): string {
  const absolute = ensureAbsoluteUrl(url);
  if (absolute === "#") return "#";
  if (!highlightText) return absolute;
  // Don't clobber an existing fragment (deep links into specific page sections).
  if (absolute.includes("#")) return absolute;
  return absolute + generateTextFragment(highlightText);
}

"use client";

/**
 * HighlightsGrid — list-layout view of highlights.
 *
 * This component is the "list" view variant; the masonry grid is handled
 * by HighlightsMasonry. Both views are also accessible via the viewMode
 * toggle in ViewControlBar (HighlightsMasonry switches internally).
 *
 * Re-exports HighlightsMasonry so existing import paths keep working.
 */
export { HighlightsMasonry as HighlightsGrid } from "./HighlightsMasonry";

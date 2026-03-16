"use client";

import { useDashboardStore } from "@/store/dashboard";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { EmptyState } from "@/components/dashboard/EmptyState";

function StarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3l2.7 5.5 6.1 1-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L5 9.5l6.1-1z" />
    </svg>
  );
}

export default function FavoritesPage() {
  const highlights = useDashboardStore((s) => s.highlights);
  const favorites = highlights.filter((h) => h.isFavorite);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-white/90">Favorites</h1>
        <p className="mt-1 text-sm text-white/40">
          {favorites.length > 0
            ? `${favorites.length} starred highlight${favorites.length === 1 ? "" : "s"}`
            : "Your starred highlights"}
        </p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<StarIcon />}
          title="No favorites yet"
          body="Star any highlight to pin it here for quick access. Your most important insights, always one click away."
          action={{ label: "Browse all highlights", href: "/dashboard" }}
        />
      ) : (
        <HighlightsMasonry filterFn={(h) => h.isFavorite} />
      )}
    </div>
  );
}

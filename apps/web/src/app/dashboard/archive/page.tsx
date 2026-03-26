"use client";

import { useDashboardStore } from "@/store/dashboard";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { EmptyState } from "@/components/dashboard/EmptyState";

function ArchiveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h20M5 8v14a1 1 0 001 1h16a1 1 0 001-1V8M10 8V6a1 1 0 011-1h6a1 1 0 011 1v2M11 14h6" />
    </svg>
  );
}

export default function ArchivePage() {
  const { highlights, isLoading } = useDashboardStore();
  const archived = highlights.filter((h) => h.isArchived);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-white/90">Archive</h1>
        <p className="mt-1 text-sm text-white/40">
          {archived.length > 0
            ? `${archived.length} archived highlight${archived.length === 1 ? "" : "s"}`
            : "Archived highlights"}
        </p>
      </div>

      {!isLoading && archived.length === 0 ? (
        <EmptyState
          icon={<ArchiveIcon />}
          title="Archive is empty"
          body="Highlights you archive are stored here — out of the way but never gone. You can restore any item at any time."
          action={{ label: "Browse all highlights", href: "/dashboard" }}
        />
      ) : (
        <HighlightsMasonry filterFn={(h) => h.isArchived} />
      )}
    </div>
  );
}

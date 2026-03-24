"use client";

import { use } from "react";
import { useDashboardStore } from "@/store/dashboard";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { AutoDraft } from "@/components/AutoDraft";
import { FolderSynthesis } from "@/components/dashboard/FolderSynthesis";

function FolderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20V9a2 2 0 012-2h5l2 2h11a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

export default function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const folder = useDashboardStore((s) => s.folders.find((f) => f.id === id));
  const folderHighlights = useDashboardStore((s) =>
    s.highlights.filter((h) => h.folderId === id && !h.isArchived && !h.isDeleted),
  );
  const count = folderHighlights.length;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-white/90">
          {folder ? `${folder.emoji} ${folder.name}` : "Folder"}
        </h1>
        <p className="mt-1 text-sm text-white/40">
          {count > 0
            ? `${count} highlight${count === 1 ? "" : "s"}`
            : "No highlights in this folder"}
        </p>
        <FolderSynthesis folderId={id} highlights={folderHighlights} />
        {count > 0 && <AutoDraft folderId={id} />}
      </div>

      {count === 0 ? (
        <EmptyState
          icon={<FolderIcon />}
          title="This folder is empty"
          body="Highlights saved to this folder will appear here. Use the extension to capture and organize as you browse."
          action={{ label: "Go to all highlights", href: "/dashboard" }}
        />
      ) : (
        <HighlightsMasonry filterFn={(h) => h.folderId === id} />
      )}
    </div>
  );
}

"use client";

import { use } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store/dashboard";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { AutoDraft } from "@/components/AutoDraft";
import { FolderSynthesis } from "@/components/dashboard/FolderSynthesis";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@cortex/ui";

const ROLE_INFO: Record<string, { label: string; desc: string; color: string }> = {
  OWNER: { label: "Owner", desc: "You own this folder and can manage all contents and settings.", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  EDITOR: { label: "Editor", desc: "You can edit highlights, tags, and add comments.", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  COMMENTER: { label: "Commenter", desc: "You can view contents and add comments.", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  VIEWER: { label: "Viewer", desc: "You can only view highlights and existing comments.", color: "text-white/60 bg-white/[0.08] border-white/[0.08]" },
};

function FolderIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 20V9a2 2 0 012-2h5l2 2h11a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

export default function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // useShallow prevents infinite re-renders caused by .find() / .filter()
  // returning a new reference on every call even when contents are identical.
  const { folder, isLoading } = useDashboardStore(
    useShallow((s) => ({
      folder: s.folders.find((f) => f.id === id) ?? null,
      isLoading: s.isLoading,
    })),
  );

  const folderHighlights = useDashboardStore(
    useShallow((s) =>
      s.highlights.filter((h) => h.folderId === id && !h.isArchived && !h.isDeleted),
    ),
  );

  const count = folderHighlights.length;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-white/90">
            {folder ? `${folder.emoji} ${folder.name}` : "Folder"}
          </h1>
          {folder?.effectiveRole && folder.effectiveRole !== "OWNER" && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-medium border flex items-center gap-1.5 transition-colors hover:brightness-110",
                  ROLE_INFO[folder.effectiveRole]?.color || ROLE_INFO.VIEWER.color
                )}>
                  {ROLE_INFO[folder.effectiveRole]?.label || "Shared"}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="6" cy="6" r="4.5" />
                    <path d="M6 8v.5M6 3.5v3" />
                  </svg>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  sideOffset={8}
                  align="start"
                  className="z-50 w-64 rounded-xl p-4 bg-[#1c1c1c] border border-white/[0.09] shadow-[0_12px_40px_rgba(0,0,0,0.55)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                >
                  <h4 className="text-sm font-semibold text-white/90 mb-1">
                    {ROLE_INFO[folder.effectiveRole]?.label || "Access Level"}
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {ROLE_INFO[folder.effectiveRole]?.desc || "Shared folder access."}
                  </p>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </div>
        <p className="mt-1 text-sm text-white/40">
          {count > 0
            ? `${count} highlight${count === 1 ? "" : "s"}`
            : "No highlights in this folder"}
        </p>
        <FolderSynthesis folderId={id} highlights={folderHighlights} />
        {count > 0 && <AutoDraft folderId={id} />}
      </div>

      {!isLoading && count === 0 ? (
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

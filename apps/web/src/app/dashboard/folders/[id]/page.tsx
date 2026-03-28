"use client";

import { use } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store/dashboard";
import { HighlightsMasonry } from "@/components/dashboard/HighlightsMasonry";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { AutoDraft } from "@/components/AutoDraft";
import { FolderSynthesis } from "@/components/dashboard/FolderSynthesis";
import * as Popover from "@radix-ui/react-popover";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { cn } from "@cortex/ui";
import { Trash2, AlertTriangle, Loader2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import React from "react";
import { RequestAccessModal } from "@/components/dashboard/RequestAccessModal";
import { ManageAccessModal } from "@/components/dashboard/ManageAccessModal";
import { DeleteAlertDialog } from "@/components/dashboard/DeleteAlertDialog";
import { ShieldAlert } from "lucide-react";

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
  const { folder, isLoading, deleteFolder, unshareFolder } = useDashboardStore(
    useShallow((s) => ({
      folder: s.folders.find((f) => f.id === id) ?? null,
      isLoading: s.isLoading,
      deleteFolder: s.deleteFolder,
      unshareFolder: s.unshareFolder,
    })),
  );
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = React.useState(false);
  const [manageAccessOpen, setManageAccessOpen] = React.useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);

  const effectiveRole = folder?.effectiveRole || "OWNER";
  const isOwner = effectiveRole === "OWNER";
  const isViewer = effectiveRole === "VIEWER";

  const handleDelete = async () => {
    if (!folder) return;
    setIsDeleting(true);
    try {
      if (isOwner) {
        await deleteFolder(folder.id);
        toast.success(`Folder "${folder.name}" and its contents deleted`);
      } else {
        await unshareFolder(folder.id);
        toast.success(`Access removed for "${folder.name}"`);
      }
      router.push("/dashboard");
    } catch (err) {
      toast.error(isOwner ? "Failed to delete folder" : "Failed to remove access");
      setIsDeleting(false);
    }
  };

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

        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-white/40">
            {count > 0
              ? `${count} highlight${count === 1 ? "" : "s"}`
              : "No highlights in this folder"}
          </p>

          {folder && isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setManageAccessOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all border border-white/[0.08]"
              >
                <Users className="w-3.5 h-3.5" />
                Manage Access
              </button>

              <AlertDialog.Root>
                <AlertDialog.Trigger asChild>
                  <button
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-red-500/10"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete Folder
                  </button>
                </AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                  <AlertDialog.Content className="fixed left-[50%] top-[50%] z-[101] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-[#1c1c1c] border border-white/[0.09] p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                    <div className="flex items-center gap-3 mb-4 text-red-400">
                      <div className="p-2 rounded-full bg-red-500/10">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <AlertDialog.Title className="text-lg font-semibold text-white">
                        Delete Folder?
                      </AlertDialog.Title>
                    </div>

                    <AlertDialog.Description className="text-sm text-white/60 leading-relaxed mb-6">
                      Are you sure you want to delete <span className="text-white font-medium">"{folder.name}"</span>?
                      <br /><br />
                      <span className="text-red-400/80 font-medium italic">
                        Warning: All subfolders and highlights present in this folder will be permanently deleted.
                      </span>
                    </AlertDialog.Description>

                    <div className="flex justify-end gap-3">
                      <AlertDialog.Cancel asChild>
                        <button className="px-4 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                          Cancel
                        </button>
                      </AlertDialog.Cancel>
                      <AlertDialog.Action asChild>
                        <button
                          onClick={handleDelete}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all"
                        >
                          Delete Everything
                        </button>
                      </AlertDialog.Action>
                    </div>
                  </AlertDialog.Content>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </div>
          )}

          {folder && effectiveRole !== "OWNER" && (
            <div className="flex items-center gap-2">
              {(effectiveRole === "VIEWER" || effectiveRole === "COMMENTER") && (
                <button
                  onClick={() => setRequestAccessOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent hover:text-accent/80 hover:bg-accent/10 transition-all border border-accent/20"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Request Higher Access
                </button>
              )}

              <button
                onClick={() => setShowRemoveConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Access
              </button>
            </div>
          )}
        </div>

        <FolderSynthesis folderId={id} highlights={folderHighlights} />
        {count > 0 && <AutoDraft folderId={id} />}
      </div>

      {folderHighlights.length === 0 ? (
          <EmptyState isViewer={isViewer} />
        ) : (
          <HighlightsMasonry filterFn={(h) => h.folderId === id} />
        )}
      {folder && (
        <>
          <RequestAccessModal 
            open={requestAccessOpen} 
            onOpenChange={setRequestAccessOpen} 
            folderId={folder.id} 
            folderName={folder.name} 
            currentRole={folder.effectiveRole}
          />
          <ManageAccessModal
            open={manageAccessOpen}
            onOpenChange={setManageAccessOpen}
            resourceId={Number(folder.id)}
            resourceType="FOLDER"
            resourceName={folder.name}
          />
          <DeleteAlertDialog 
            open={showRemoveConfirm} 
            onOpenChange={setShowRemoveConfirm} 
            targetLabel={folder.name} 
            targetType="folder" 
            isShared={true}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}


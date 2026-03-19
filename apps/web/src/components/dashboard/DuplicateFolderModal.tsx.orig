"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuplicateFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the shared folder being duplicated */
  folderName: string;
  /** ID of the shared folder to duplicate */
  folderId: string;
  /** Called when the API successfully creates the duplicate */
  onSuccess?: (newFolderId: string) => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DuplicateFolderModal
 *
 * Warns the user that duplicating a shared folder will:
 *   1. Create a full private copy of the folder tree (all subfolders + highlights)
 *   2. REVOKE their access to the original shared folder
 *
 * On confirmation it calls POST /api/v1/folders/{id}/duplicate and reports
 * the new root folder id back via onSuccess.
 */
export function DuplicateFolderModal({
  open,
  onOpenChange,
  folderName,
  folderId,
  onSuccess,
}: DuplicateFolderModalProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset error when dialog opens
  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/folders/${folderId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Server error ${res.status}`);
      }

      const data = (await res.json()) as { id: string };
      onOpenChange(false);
      onSuccess?.(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal forceMount>
            {/* Backdrop */}
            <AlertDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </AlertDialog.Overlay>

            {/* Dialog panel */}
            <AlertDialog.Content asChild>
              <motion.div
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
                  "w-full max-w-md rounded-2xl border border-white/10",
                  "bg-neutral-900 p-6 shadow-2xl"
                )}
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                transition={{ duration: 0.25, ease }}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-2xl select-none" aria-hidden>📋</span>
                  <div>
                    <AlertDialog.Title className="text-base font-semibold text-white leading-tight">
                      Duplicate &quot;{folderName}&quot;?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-1 text-sm text-neutral-400 leading-relaxed">
                      Duplicating this folder will create a{" "}
                      <strong className="text-neutral-200">full private copy</strong> for you —
                      including all subfolders and highlights.
                    </AlertDialog.Description>
                  </div>
                </div>

                {/* Warning callout */}
                <div className={cn(
                  "mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3"
                )}>
                  <p className="text-sm text-amber-300 leading-relaxed">
                    <span className="font-semibold">⚠️ You will lose access to the original shared folder.</span>{" "}
                    This action cannot be undone — the original owner can re-share with you if needed.
                  </p>
                </div>

                {/* Error state */}
                {error && (
                  <p className="mt-3 text-sm text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="mt-5 flex justify-end gap-3">
                  <AlertDialog.Cancel asChild>
                    <button
                      className={cn(
                        "rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300",
                        "hover:bg-white/5 transition-colors",
                        "disabled:opacity-50"
                      )}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                  </AlertDialog.Cancel>

                  <AlertDialog.Action asChild>
                    <button
                      onClick={(e) => {
                        e.preventDefault(); // prevent AlertDialog auto-close; we close on success
                        handleConfirm();
                      }}
                      disabled={isPending}
                      className={cn(
                        "rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900",
                        "hover:bg-neutral-100 transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                    >
                      {isPending ? "Duplicating…" : "Yes, duplicate & lose access"}
                    </button>
                  </AlertDialog.Action>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}

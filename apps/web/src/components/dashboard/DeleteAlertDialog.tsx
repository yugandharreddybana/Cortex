"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";

// ─── Component ────────────────────────────────────────────────────────────────
interface DeleteAlertDialogProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  /** What is being deleted — shown in the description */
  targetLabel:    string;
  /** "folder" | "highlight" etc. */
  targetType?:    string;
  onConfirm:      () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function DeleteAlertDialog({
  open,
  onOpenChange,
  targetLabel,
  targetType = "item",
  onConfirm,
}: DeleteAlertDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal forceMount>
            {/* Overlay */}
            <AlertDialog.Overlay asChild>
              <motion.div
                key="delete-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </AlertDialog.Overlay>

            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            {/* Panel */}
            <AlertDialog.Content asChild>
              <motion.div
                key="delete-dialog"
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.25, ease }}
                className={cn(
                  "relative z-50 pointer-events-auto",
                  "w-full max-w-md",
                  "rounded-2xl bg-[#171717] border border-white/[0.09]",
                  "shadow-[0_32px_64px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]",
                  "p-6",
                  "focus:outline-none",
                )}
              >
                {/* Warning icon */}
                <div className="mb-4 w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M9 6v4M9 12.5v.5" stroke="#f87171" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M7.37 2.55L1.3 12.75A1.83 1.83 0 003.09 15.5h11.82a1.83 1.83 0 001.77-2.75L10.63 2.55a1.83 1.83 0 00-3.26 0z" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>

                <AlertDialog.Title className="text-base font-semibold tracking-tight mb-2">
                  Are you absolutely sure?
                </AlertDialog.Title>

                <AlertDialog.Description className="text-sm text-white/50 mb-6 leading-relaxed">
                  This action cannot be undone. This will permanently delete{" "}
                  <span className="text-white/80 font-medium">&quot;{targetLabel}&quot;</span>{" "}
                  and remove its data from our servers.
                </AlertDialog.Description>

                <div className="flex items-center gap-2.5 justify-end">
                  <AlertDialog.Cancel asChild>
                    <button
                      className={cn(
                        "h-9 px-4 rounded-xl",
                        "text-sm text-white/60 hover:text-white",
                        "bg-white/[0.04] hover:bg-white/[0.08]",
                        "border border-white/[0.07]",
                        "transition-all duration-150",
                      )}
                    >
                      Cancel
                    </button>
                  </AlertDialog.Cancel>

                  <AlertDialog.Action asChild>
                    <button
                      onClick={onConfirm}
                      className={cn(
                        "h-9 px-5 rounded-xl",
                        "text-sm font-medium",
                        "bg-red-500/10 text-red-400",
                        "border border-red-500/20",
                        "hover:bg-red-500/20 hover:border-red-500/30",
                        "transition-all duration-150",
                      )}
                    >
                      Delete {targetType}
                    </button>
                  </AlertDialog.Action>
                </div>
              </motion.div>
            </AlertDialog.Content>
            </div>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}

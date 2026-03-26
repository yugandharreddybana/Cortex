"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 7 6 7 24 7" />
      <path d="M22 7l-1.5 17a2 2 0 01-2 1.8H9.5a2 2 0 01-2-1.8L6 7" />
      <path d="M11 12v7M17 12v7" />
      <path d="M10 7V5a1.2 1.2 0 011.2-1.2h5.6A1.2 1.2 0 0118 5v2" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 7a5 5 0 105 -5" />
      <path d="M2 3v4h4" />
    </svg>
  );
}

function DeletePermanentlyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3.5h10M5 3.5V2.5h4v1M5.5 6v4M8.5 6v4M3.5 3.5l.5 8.5h6l.5-8.5" />
    </svg>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function TrashPage() {
  const { trash, isLoading } = useDashboardStore();
  const restoreHighlight = useDashboardStore((s) => s.restoreHighlight);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [emptyingTrash, setEmptyingTrash] = React.useState(false);

  // Permanent delete (removes from trash state only — server already deleted on first delete)
  const permanentlyDelete = React.useCallback((id: string) => {
    useDashboardStore.setState((s) => ({
      trash: s.trash.filter((h) => h.id !== id),
    }));
    toast.success("Permanently deleted", {
      description: "The selected highlight has been purged from your storage.",
    });
  }, []);

  const _emptyTrash = React.useCallback(() => {
    setEmptyingTrash(true);
    useDashboardStore.setState({ trash: [] });
    setEmptyingTrash(false);
  }, []);

  const handleEmptyTrash = React.useCallback(() => {
    _emptyTrash();
    toast.success("Trash emptied", {
      description: "All items have been permanently removed from your trash.",
    });
  }, [_emptyTrash]);

  const handleRestore = React.useCallback(async (id: string) => {
    setDeletingId(id);
    await restoreHighlight(id);
    setDeletingId(null);
    toast.success("Highlight restored", {
      description: "The selected item has been moved back to your dashboard.",
    });
  }, [restoreHighlight]);

  function truncate(text: string, max = 120): string {
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white/90 flex items-center gap-3">
            <span className="text-white/40">
              <TrashIcon />
            </span>
            Trash
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {trash.length > 0
              ? `${trash.length} deleted highlight${trash.length === 1 ? "" : "s"} — restore or permanently delete`
              : "Deleted highlights"}
          </p>
        </div>

        {trash.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className={cn(
              "h-8 px-3 rounded-lg flex items-center gap-1.5",
              "text-xs font-medium bg-red-500/10 text-red-400",
              "hover:bg-red-500/20 transition-all duration-150 active:scale-95",
            )}
          >
            <DeletePermanentlyIcon />
            Empty Trash
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 w-full animate-pulse bg-white/[0.03] border border-white/[0.06] rounded-xl" />
          ))}
        </div>
      ) : trash.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <span className="text-white/10">
            <TrashIcon />
          </span>
          <p className="text-sm font-medium text-white/30">Trash is empty</p>
          <p className="text-xs text-white/20 text-center max-w-xs">
            Deleted highlights appear here. They are permanently removed when you empty the trash.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {trash.map((h) => (
              <motion.div
                key={h.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl",
                  "bg-white/[0.03] border border-white/[0.06]",
                  "hover:bg-white/[0.05] transition-colors",
                )}
              >
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70 leading-relaxed italic">
                    &ldquo;{truncate(h.text)}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-white/30">{h.source}</span>
                    {h.savedAt && (
                      <>
                        <span className="text-white/15">·</span>
                        <span className="text-[11px] text-white/25">
                          {new Date(h.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(h.id)}
                    disabled={deletingId === h.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                      "text-xs font-medium",
                      "bg-accent/10 text-accent border border-accent/20",
                      "hover:bg-accent/20 transition-colors disabled:opacity-50",
                    )}
                    aria-label="Restore highlight"
                  >
                    <RestoreIcon />
                    {deletingId === h.id ? "Restoring…" : "Restore"}
                  </button>
                  <button
                    onClick={() => permanentlyDelete(h.id)}
                    disabled={deletingId === h.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                      "text-xs font-medium",
                      "bg-red-500/10 text-red-400 border border-red-500/20",
                      "hover:bg-red-500/20 transition-colors disabled:opacity-50",
                    )}
                    aria-label="Delete permanently"
                  >
                    <DeletePermanentlyIcon />
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

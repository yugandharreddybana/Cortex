import React, { useState, useMemo } from "react";
import { useDashboardStore } from "@/store/dashboard";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@cortex/ui";
import { motion, AnimatePresence } from "framer-motion";

export function AutoDraft({ folderId }: { folderId: string }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [warningOpen, setWarningOpen] = useState(false);

  const highlights = useDashboardStore((s) => s.highlights);
  const folders    = useDashboardStore((s) => s.folders);
  const setGlobalLoading = useDashboardStore((s) => s.setGlobalLoading);

  const folder = folders.find(f => String(f.id) === String(folderId));
  const canEdit = !folder?.effectiveRole || folder.effectiveRole === "OWNER" || folder.effectiveRole === "EDITOR";

  // Filter highlights in this folder
  const folderHighlights = useMemo(() => {
    return highlights.filter((h) => String(h.folderId) === String(folderId) && !h.isDeleted && !h.isArchived);
  }, [highlights, folderId]);

  const allAIText = useMemo(() => {
    return folderHighlights.length > 0 && folderHighlights.every((h) => h.topic === "AI Text");
  }, [folderHighlights]);

  const hasAIText = useMemo(() => {
    return folderHighlights.some((h) => h.topic === "AI Text");
  }, [folderHighlights]);

  const handleGenerateClick = () => {
    if (allAIText) {
      setError("Cannot generate an essay. All highlights in this folder are AI-generated text without original sources.");
      return;
    }
    if (hasAIText) {
      setWarningOpen(true);
      return;
    }
    executeGenerate();
  };

  const executeGenerate = async () => {
    setWarningOpen(false);
    setLoading(true);
    setGlobalLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/auto-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId, format: "Essay" })
      });
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to generate draft");
      }
      setDraft(await res.text());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white/90">AI Auto-Draft</h3>
        <div className="relative group/tooltip inline-block">
          <button
            onClick={handleGenerateClick}
            disabled={loading || folderHighlights.length === 0 || !canEdit}
            className="px-4 py-2 bg-accent/90 hover:bg-accent text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate Essay"}
          </button>
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[200px] opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg z-50 text-right">
            {canEdit 
              ? "Automatically generates a well-structured essay based on the highlights in this folder."
              : "Ask the owner for Editor access to generate drafts."}
            <svg className="absolute text-black h-2 w-full right-4 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {draft && (
        <div className="prose prose-invert prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-white/70 bg-black/20 p-4 rounded-lg border border-white/[0.05]">
            {draft}
          </div>
        </div>
      )}

      {/* Warning Modal for Mixed Content */}
      <Dialog.Root open={warningOpen} onOpenChange={setWarningOpen}>
        <AnimatePresence>
          {warningOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className={cn(
                    "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                    "w-[90vw] max-w-md rounded-2xl",
                    "bg-[#1c1c1c] border border-white/[0.08]",
                    "shadow-2xl overflow-hidden",
                    "flex flex-col focus:outline-none",
                  )}
                >
                  <div className="px-6 py-5 border-b border-white/[0.06]">
                    <Dialog.Title className="text-lg font-semibold text-white/90">
                      Warning: AI Texts Included
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-white/60 mt-2 leading-relaxed">
                      This folder contains some AI-generated highlights. AI texts will be considered, but the source context will be taken strictly from the web highlights to generate the essay.
                      <br /><br />
                      Do you want to continue?
                    </Dialog.Description>
                  </div>

                  <div className="px-6 py-4 flex items-center justify-end gap-3 bg-white/[0.02]">
                    <button
                      onClick={() => setWarningOpen(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeGenerate}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </div>
  );
}

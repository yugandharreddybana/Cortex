"use client";

import React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import type { Highlight } from "@/store/dashboard";

interface FolderSynthesisProps {
  folderId: string;
  highlights: Highlight[];
}

export function FolderSynthesis({ folderId, highlights }: FolderSynthesisProps) {
  const folders               = useDashboardStore((s) => s.folders);
  const updateFolderSynthesis = useDashboardStore((s) => s.updateFolderSynthesis);

  const folder    = folders.find((f) => f.id === folderId);
  const synthesis = folder?.synthesis;
  const [loading, setLoading] = React.useState(false);

  const canGenerate = highlights.length >= 3;

  if (!synthesis && !canGenerate) return null;

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texts: highlights.slice(0, 20).map((h) => h.text) }),
      });
      if (res.ok) {
        const text = await res.text();
        updateFolderSynthesis(folderId, text);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 mb-8 p-5 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-400 group-hover:scale-110 transition-transform duration-700">
        <Sparkles size={120} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-400" size={18} />
            <h3 className="text-sm font-medium text-purple-100">Living Literature Review</h3>
          </div>
          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-lg",
                "bg-purple-500/20 text-purple-300 border border-purple-500/30",
                "hover:bg-purple-500/30 transition-colors disabled:opacity-50",
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating…
                </span>
              ) : synthesis ? (
                "✦ Regenerate"
              ) : (
                "✦ Generate Literature Review"
              )}
            </button>
          )}
        </div>

        {synthesis && (
          <p className="text-sm text-purple-200/80 leading-relaxed max-w-4xl">
            {synthesis}
          </p>
        )}

        {!synthesis && canGenerate && !loading && (
          <p className="text-xs text-purple-200/40">
            Generate an AI synthesis across the {highlights.length} highlights in this folder.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-purple-300/60">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing highlights…
          </div>
        )}
      </div>
    </div>
  );
}

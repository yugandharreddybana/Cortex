import React, { useState } from "react";
import { type Folder } from "@/store/dashboard";

export function AutoDraft({ folderId }: { folderId: string }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/ai/auto-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    }
  };

  return (
    <div className="mt-8 p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white/90">AI Auto-Draft</h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-accent/90 hover:bg-accent text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Essay"}
        </button>
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
    </div>
  );
}

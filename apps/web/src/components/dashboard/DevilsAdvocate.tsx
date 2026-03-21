import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function DevilsAdvocate({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; warning: string } | null>(null);

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch("/api/ai/devils-advocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(typeof data === "string" ? JSON.parse(data) : data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="mt-3 flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
      >
        <AlertTriangle size={12} />
        {loading ? "Analyzing..." : "Devil's Advocate"}
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 font-semibold text-orange-400">
        <AlertTriangle size={12} />
        Trust Score: {result.score}/10
      </div>
      <p className="opacity-90 leading-relaxed">{result.warning}</p>
    </div>
  );
}

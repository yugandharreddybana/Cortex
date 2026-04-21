import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function DevilsAdvocate({ text, url, customPrompt, isAI, onRequireContext }: { text: string; url?: string; customPrompt?: string; isAI?: boolean; onRequireContext?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; warning: string } | null>(null);

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAI) return;
    if (onRequireContext) {
      onRequireContext();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/devils-advocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, url, customPrompt })
      });
      if (res.ok) {
        const textData = await res.text();
        try {
          // Ollama might wrap the JSON in markdown blocks even when told not to.
          const cleanedText = textData.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);
          setResult(parsed);
        } catch (parseErr) {
          console.error("Failed to parse AI response", textData);
          setResult({ score: 0, warning: "Failed to generate analysis (Invalid format from AI)." });
        }
      }
    } catch (err) {
      console.error("Failed to analyze text", err);
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    if (isAI) {
      return (
        <div className="relative group/tooltip inline-block mt-3 w-full opacity-50 cursor-not-allowed">
          <button
            disabled
            className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded bg-white/5 text-white/50"
          >
            <AlertTriangle size={12} />
            Devil&apos;s Advocate
          </button>
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] text-white text-[10px] px-2 py-1.5 rounded-xl shadow-spatial-md z-50 text-center">
            Not available for AI Chat highlights.
            <svg className="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
          </div>
        </div>
      );
    }
    return (
      <div className="relative group/tooltip inline-block mt-3 w-full">
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
        >
          <AlertTriangle size={12} />
          {loading ? "Analyzing..." : "Devil's Advocate"}
        </button>
        {/* Tooltip */}
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-elevated/90 backdrop-blur-2xl border border-white/[0.06] text-white text-[10px] px-2 py-1.5 rounded-xl shadow-spatial-md z-50 text-center">
          Analyzes text for hidden biases, logical fallacies, or unverified claims.
          <svg className="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
        </div>
      </div>
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

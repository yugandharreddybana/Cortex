import React, { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

export function ActionEngine({ text, url, customPrompt, onRequireContext }: { text: string; url?: string; customPrompt?: string; onRequireContext?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<string[]>([]);

  const handleSuggest = async () => {
    if (onRequireContext) {
      onRequireContext();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggest-actions", {
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
          setActions(Array.isArray(parsed) ? parsed : []);
        } catch (parseErr) {
          console.error("Failed to parse AI response", textData);
          setActions(["Failed to generate action items (Invalid format)"]);
        }
      }
    } catch (err) {
      console.error("Failed to suggest actions", err);
    } finally {
      setLoading(false);
    }
  };

  if (!actions.length && !loading) {
    return (
      <div className="relative group/tooltip inline-block mt-6 w-full">
        <button
          onClick={handleSuggest}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition-colors w-full justify-center border border-accent/20"
        >
          <Sparkles size={16} />
          Suggest Action Items
        </button>
        {/* Tooltip */}
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg z-50 text-center">
          Extract exactly 3 concrete, actionable steps you can take based on this highlight.
          <svg className="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/10">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-accent mb-3 flex items-center gap-2">
        <Sparkles size={14} /> Action Engine
      </h4>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/50 py-2">
          <Loader2 className="animate-spin" size={14} />
          Generating steps...
        </div>
      ) : (
        <ul className="space-y-2.5">
          {actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/80 leading-snug">
              <CheckCircle2 size={16} className="text-accent/60 mt-0.5 shrink-0" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

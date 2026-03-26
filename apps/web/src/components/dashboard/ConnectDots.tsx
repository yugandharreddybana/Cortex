import React, { useState } from "react";
import { Link2, Loader2 } from "lucide-react";

export function ConnectDots({ text, url, customPrompt, isAI, onRequireContext }: { text: string; url?: string; customPrompt?: string; isAI?: boolean; onRequireContext?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState<string>("");

  const handleConnect = async () => {
    if (isAI) return;
    if (onRequireContext) {
      onRequireContext();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/connect-dots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, url, customPrompt })
      });
      if (res.ok) {
        setDots(await res.text());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border-t border-white/[0.08] pt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
          <Link2 size={16} className="text-accent" />
          Connect the Dots
        </h4>
        <div className="relative group/tooltip inline-block">
          <button
            onClick={handleConnect}
            disabled={loading || isAI}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isAI ? 'bg-white/[0.02] text-white/30 cursor-not-allowed' : 'bg-white/[0.05] hover:bg-white/[0.1] text-white/70'}`}
          >
            {loading ? (
              <span className="flex items-center gap-2 text-white/50">
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing...
              </span>
            ) : (
              "Find semantic links"
            )}
          </button>
          {/* Tooltip */}
          {isAI ? (
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[200px] opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg z-50 text-right">
              Not available for AI Chat highlights.
              <svg className="absolute text-black h-2 w-full right-4 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
            </div>
          ) : (
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[200px] opacity-0 group-hover/tooltip:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg z-50 text-right">
              Find meaningful connections and patterns with your recent highlights.
              <svg className="absolute text-black h-2 w-full right-4 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
            </div>
          )}
        </div>
      </div>

      {dots && !isAI && (
        <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {dots}
          </p>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

export function ActionEngine({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<string[]>([]);

  const handleSuggest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/suggest-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        setActions(typeof data === "string" ? JSON.parse(data) : data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!actions.length && !loading) {
    return (
      <button
        onClick={handleSuggest}
        className="mt-6 flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition-colors w-full justify-center border border-accent/20"
      >
        <Sparkles size={16} />
        Suggest Action Items
      </button>
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

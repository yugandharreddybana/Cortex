import React, { useState } from "react";
import { Link2 } from "lucide-react";

export function ConnectDots({ text, url }: { text: string; url?: string }) {
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState<string>("");

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/connect-dots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url })
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
        <button
          onClick={handleConnect}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 transition-colors"
        >
          {loading ? "Analyzing..." : "Find semantic links"}
        </button>
      </div>

      {dots && (
        <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {dots}
          </p>
        </div>
      )}
    </div>
  );
}

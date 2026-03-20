"use client";

import React, { useMemo } from "react";
import { useDashboardStore, type Highlight } from "@/store/dashboard";
import { Clock } from "lucide-react";

export default function TemporalReplayPage() {
  const highlights = useDashboardStore((s) => s.highlights);

  // Group highlights by date
  const timeline = useMemo(() => {
    const groups: Record<string, Highlight[]> = {};
    const sorted = [...highlights].sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime());

    for (const h of sorted) {
      if (!h.savedAt) continue;
      const date = new Date(h.savedAt).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric"
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(h);
    }
    return Object.entries(groups);
  }, [highlights]);

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-10 flex items-center gap-3 border-b border-white/[0.08] pb-6">
        <div className="p-3 bg-accent/20 text-accent rounded-xl">
          <Clock size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Temporal Replay</h1>
          <p className="text-sm text-white/40 mt-1">
            A chronological journey through your indexed knowledge.
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {timeline.map(([date, items]) => (
          <div key={date} className="relative">
            {/* Timeline line */}
            <div className="absolute top-0 bottom-0 left-[15px] w-px bg-white/[0.08]" />

            <div className="flex items-center gap-4 mb-6 relative">
              <div className="w-8 h-8 rounded-full bg-[#1c1c1c] border-2 border-accent/40 flex items-center justify-center z-10">
                <div className="w-2 h-2 rounded-full bg-accent" />
              </div>
              <h2 className="text-lg font-medium text-white/80">{date}</h2>
            </div>

            <div className="pl-12 space-y-4">
              {items.map(h => (
                <div key={h.id} className="p-5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-accent/80">
                      {h.topic}
                    </span>
                    <span className="text-xs text-white/30 truncate flex-1">
                      {h.source}
                    </span>
                  </div>
                  <blockquote className="text-sm text-white/80 leading-relaxed border-l-2 border-accent/40 pl-3 italic">
                    "{h.text}"
                  </blockquote>
                </div>
              ))}
            </div>
          </div>
        ))}

        {timeline.length === 0 && (
          <div className="text-center py-20 text-white/40">
            No highlights saved yet.
          </div>
        )}
      </div>
    </div>
  );
}

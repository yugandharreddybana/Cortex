import React from "react";
import { Sparkles } from "lucide-react";

export function FolderSynthesis({ synthesis }: { synthesis: string }) {
  if (!synthesis) return null;

  return (
    <div className="mt-6 mb-8 p-5 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-400 group-hover:scale-110 transition-transform duration-700">
        <Sparkles size={120} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-purple-400" size={18} />
          <h3 className="text-sm font-medium text-purple-100">Living Literature Review</h3>
        </div>
        <p className="text-sm text-purple-200/80 leading-relaxed max-w-4xl">
          {synthesis}
        </p>
      </div>
    </div>
  );
}

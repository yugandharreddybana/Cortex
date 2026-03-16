"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Dummy data builder ───────────────────────────────────────────────────────
function buildExportPayload(
  highlights: ReturnType<typeof useDashboardStore.getState>["highlights"],
  folders:    ReturnType<typeof useDashboardStore.getState>["folders"],
  tags:       ReturnType<typeof useDashboardStore.getState>["tags"],
) {
  return {
    exportedAt: new Date().toISOString(),
    version:    "1.0.0",
    meta: {
      totalHighlights: highlights.length,
      totalFolders:    folders.length,
      totalTags:       tags.length,
    },
    highlights,
    folders,
    tags,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DataExportPage() {
  const highlights = useDashboardStore((s) => s.highlights);
  const folders    = useDashboardStore((s) => s.folders);
  const tags       = useDashboardStore((s) => s.tags);
  const [exporting, setExporting] = React.useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);

    const toastId = toast.loading("Preparing your export…");

    // Simulate async packaging
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const payload = buildExportPayload(highlights, folders, tags);
      const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href     = url;
      a.download = `cortex-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Export ready — download started", { id: toastId });
    } catch {
      toast.error("Export failed. Please try again.", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Breadcrumb */}
      <p className="text-[12px] text-white/30 mb-6">Settings &rsaquo; Data</p>

      {/* Section */}
      <div
        className={cn(
          "rounded-2xl border border-white/[0.08] bg-[#141414]",
          "p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        )}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
          <BrainIcon />
        </div>

        <h2 className="text-base font-semibold tracking-tight text-white/90 mb-1">
          Export your brain.
        </h2>
        <p className="text-sm text-white/45 leading-relaxed mb-6">
          Download all your highlights, folders, and tags as a structured JSON file.
          Your data is always yours — no vendor lock-in.
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Highlights", value: highlights.length },
            { label: "Folders",    value: folders.length    },
            { label: "Tags",       value: tags.length       },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"
            >
              <p className="text-xl font-semibold text-white/90 tabular-nums">{value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-5 rounded-lg",
            "text-[13px] font-semibold",
            "bg-accent hover:bg-accent/90 active:scale-[0.98]",
            "text-white shadow-glow-sm",
            "transition-all duration-150 transform-gpu",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
          )}
        >
          {exporting ? (
            <>
              <SpinnerIcon />
              Preparing…
            </>
          ) : (
            <>
              <DownloadIcon />
              Export Data
            </>
          )}
        </button>

        <p className="mt-3 text-[11px] text-white/25">
          Output format: JSON &middot; Includes all metadata, notes, and tags.
        </p>
      </div>

      {/* Danger zone stub */}
      <div
        className={cn(
          "mt-6 rounded-2xl border border-red-500/[0.15] bg-red-500/[0.04]",
          "p-5",
        )}
      >
        <h3 className="text-sm font-semibold text-red-400/80 mb-1">Danger Zone</h3>
        <p className="text-[12px] text-white/35 leading-relaxed mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          className={cn(
            "h-8 px-4 rounded-lg text-[12px] font-medium",
            "border border-red-500/30 text-red-400/80",
            "hover:bg-red-500/10 hover:text-red-300 transition-all duration-150",
          )}
          onClick={() => toast.error("Account deletion is disabled in this preview.")}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function BrainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3C6.24 3 4 5.24 4 8c0 1.54.7 2.92 1.8 3.83V14h6.4v-2.17C13.3 10.92 14 9.54 14 8c0-2.76-2.24-5-5-5z" />
      <path d="M7 14v1.5a1 1 0 002 0V14M9 3V2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 2v7M4 6.5L7 9.5l3-3M2 11h10" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="animate-spin">
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" />
    </svg>
  );
}

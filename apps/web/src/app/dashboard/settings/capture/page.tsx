"use client";

import * as React from "react";
import { buildBookmarklet } from "@/lib/bookmarklet";

/**
 * Settings → Capture — gives the user a draggable "+ Cortex" link.
 * Drag to the bookmarks bar; click on any page to save the selected text
 * to Cortex with no extension installed.
 */
export default function CaptureSettingsPage() {
  const [origin, setOrigin] = React.useState("https://app.cortex.so");
  React.useEffect(() => { setOrigin(window.location.origin); }, []);

  const href = buildBookmarklet(origin);

  return (
    <div className="max-w-2xl mx-auto p-6 text-white/85">
      <h1 className="text-xl font-semibold mb-2">Quick Capture (no extension)</h1>
      <p className="text-sm text-white/55 mb-6">
        Drag the button below to your bookmarks bar. On any page, select some text and
        click it — Cortex opens a small popup with the text and URL pre-filled.
      </p>

      <div className="rounded-2xl border border-white/[0.08] bg-elevated/60 p-6 flex flex-col items-start gap-4">
        <a
          href={href}
          onClick={(e) => e.preventDefault()}
          draggable
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-accent text-white font-medium text-sm cursor-grab active:cursor-grabbing select-none"
          title="Drag me to your bookmarks bar"
        >
          ＋ Save to Cortex
        </a>

        <ol className="text-sm text-white/65 list-decimal list-inside space-y-1">
          <li>Make sure your bookmarks bar is visible (Ctrl/Cmd + Shift + B).</li>
          <li>Drag the button above onto the bookmarks bar.</li>
          <li>On any page, select text and click the bookmark.</li>
          <li>Pick a folder / tag in the popup and hit <kbd className="px-1.5 py-0.5 text-[10px] bg-white/[0.08] border border-white/[0.10] rounded">⌘ ↵</kbd>.</li>
        </ol>

        <p className="text-xs text-white/40">
          Works in Chrome, Edge, Brave, Opera, Arc, Vivaldi, Firefox, and Safari.
        </p>
      </div>

      <div className="mt-6 text-xs text-white/40">
        Inside the dashboard, press <kbd className="px-1.5 py-0.5 bg-white/[0.08] border border-white/[0.10] rounded">Ctrl/⌘ + Shift + S</kbd> to open the New Highlight dialog.
      </div>
    </div>
  );
}

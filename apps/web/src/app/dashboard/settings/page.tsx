"use client";

import * as React from "react";
import { useAuthStore } from "@/store/authStore";
import { buildBookmarklet } from "@/lib/bookmarklet";

type Tab = "profile" | "bookmarklet" | "billing";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = React.useState<Tab>("bookmarklet");
  const [copied, setCopied] = React.useState(false);

  // Build the bookmarklet href using the current origin
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const bookmarkletHref = appUrl ? buildBookmarklet(appUrl) : "#";

  function handleCopy() {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/40 mt-1">Manage your account, capture tools, and subscription.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/[0.07] pb-0">
        {([
          { key: "bookmarklet", label: "Bookmarklet" },
          { key: "profile",     label: "Profile" },
          { key: "billing",     label: "Billing" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px",
              tab === key
                ? "text-white border-accent"
                : "text-white/40 border-transparent hover:text-white/70",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── BOOKMARKLET TAB ── */}
      {tab === "bookmarklet" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Save to Cortex — Bookmarklet</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Highlight any text on <span className="text-white/80">any website</span> — ChatGPT, Claude,
                Wikipedia, news articles — and save it to Cortex instantly.
                No extension install required.
              </p>
            </div>

            {/* Drag target */}
            <div className="flex flex-col items-center gap-4 py-6 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01]">
              <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">Step 1 — drag this to your bookmarks bar</p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href={bookmarkletHref}
                draggable
                onClick={(e) => e.preventDefault()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent text-sm font-semibold cursor-grab active:cursor-grabbing select-none transition-colors duration-150 shadow-[0_0_16px_rgba(129,140,248,0.15)]"
                title="Drag me to your bookmarks bar"
              >
                <BookmarkIcon />
                Save to Cortex
              </a>
              <p className="text-[11px] text-white/25">
                Drag the button above to your browser&apos;s bookmarks / favourites bar
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">Step 2 — use it on any page</p>
              <ol className="space-y-2 text-sm text-white/60">
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/[0.06] text-white/50 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">1</span>
                  Go to any website — ChatGPT, Claude, an article, anything
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/[0.06] text-white/50 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">2</span>
                  Select / highlight the text you want to save
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/[0.06] text-white/50 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">3</span>
                  Click <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/80 font-mono text-xs">Save to Cortex</span> in your bookmarks bar
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/[0.06] text-white/50 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">4</span>
                  A small popup opens — confirm and save. Done!
                </li>
              </ol>
            </div>

            {/* Browser-specific tips */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Browser tips</p>
              <ul className="space-y-1.5 text-xs text-white/40">
                <li><span className="text-white/60 font-medium">Edge / Chrome:</span> Press <kbd className="px-1 py-0.5 rounded bg-white/[0.08] font-mono">Ctrl+Shift+B</kbd> to show the bookmarks bar, then drag</li>
                <li><span className="text-white/60 font-medium">Firefox:</span> View → Toolbars → Bookmarks Toolbar, then drag</li>
                <li><span className="text-white/60 font-medium">Safari:</span> View → Show Favourites Bar, then drag</li>
                <li><span className="text-white/60 font-medium">Can&apos;t drag?</span> Copy the code below and add it as a new bookmark manually</li>
              </ul>
            </div>

            {/* Manual fallback — copy code */}
            <div className="space-y-2">
              <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">Can&apos;t drag? Add manually</p>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.07] px-3 py-2 font-mono text-[11px] text-white/40 truncate">
                  {bookmarkletHref.slice(0, 80)}&hellip;
                </div>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white text-xs font-medium transition-colors duration-150 shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-white/25">
                Create a new bookmark in your browser, paste this as the URL, name it &ldquo;Save to Cortex&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">Profile</h2>
          <div className="space-y-4">
            <Field label="Display name" value={user?.fullName || "—"} />
            <Field label="Email" value={user?.email || "—"} />
            <Field label="Account tier" value={user?.tier ? capitalize(user.tier) : "—"} />
          </div>
          <p className="text-xs text-white/25">Profile editing coming soon.</p>
        </div>
      )}

      {/* ── BILLING TAB ── */}
      {tab === "billing" && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">Subscription</h2>
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div>
              <p className="text-sm font-medium text-white">{user?.tier === "pro" ? "Pro Plan" : "Starter Plan"}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {user?.tier === "pro" ? "Unlimited highlights, AI features, priority support" : "Up to 100 highlights per month"}
              </p>
            </div>
            {user?.tier !== "pro" && (
              <a
                href="/pricing"
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold shadow-[0_0_12px_rgba(129,140,248,0.3)] hover:shadow-[0_0_20px_rgba(129,140,248,0.4)] transition-all duration-200"
              >
                Upgrade
              </a>
            )}
          </div>
          <p className="text-xs text-white/25">Billing portal coming soon.</p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-white/30 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-sm text-white/80">{value}</p>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

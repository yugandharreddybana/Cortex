"use client";

import * as React from "react";
import { useAuthStore } from "@/store/authStore";
import { buildBookmarklet } from "@/lib/bookmarklet";

type Tab = "profile" | "bookmarklet" | "billing";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = React.useState<Tab>("bookmarklet");
  const [copied, setCopied] = React.useState(false);

  // Build the bookmarklet URL client-side only (needs window.location.origin)
  const [bookmarkletHref, setBookmarkletHref] = React.useState("");
  // Ref used to set the drag anchor href via setAttribute — this bypasses
  // React's javascript: URL sanitization which would throw a runtime error.
  const dragAnchorRef = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    const url = buildBookmarklet(window.location.origin);
    setBookmarkletHref(url);
    // Set the href on the drag anchor directly so React never sees the
    // javascript: value and won't block it.
    if (dragAnchorRef.current) {
      dragAnchorRef.current.setAttribute("href", url);
    }
  }, []);

  function handleCopy() {
    if (!bookmarkletHref) return;
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
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
      <div className="flex gap-1 border-b border-white/[0.07]">
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
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Save to Cortex — Bookmarklet</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Highlight text on <span className="text-white/80">any website</span> — ChatGPT, Claude,
                Wikipedia, news articles — and save it to Cortex in one click.
                No browser extension required.
              </p>
            </div>

            {/* Step 1 — Copy */}
            <div className="space-y-3">
              <StepLabel n={1} text="Copy the bookmarklet code" />
              <div className="flex gap-2 items-stretch">
                <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 font-mono text-[11px] text-white/30 truncate flex items-center select-all">
                  {bookmarkletHref ? bookmarkletHref.slice(0, 72) + "…" : "Loading…"}
                </div>
                <button
                  onClick={handleCopy}
                  disabled={!bookmarkletHref}
                  className={[
                    "px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0",
                    copied
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 shadow-[0_0_12px_rgba(129,140,248,0.15)]",
                  ].join(" ")}
                >
                  {copied ? "✓ Copied!" : "Copy Code"}
                </button>
              </div>
            </div>

            {/* Step 2 — Show bookmarks bar */}
            <div className="space-y-3">
              <StepLabel n={2} text="Show your bookmarks bar" />
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2 text-sm text-white/50">
                <BrowserHint browser="Edge / Chrome" shortcut="Ctrl+Shift+B" mac="Cmd+Shift+B" />
                <BrowserHint browser="Firefox" shortcut="View → Toolbars → Bookmarks Toolbar" />
                <BrowserHint browser="Safari" shortcut="View → Show Favourites Bar" />
              </div>
            </div>

            {/* Step 3 — Add manually */}
            <div className="space-y-3">
              <StepLabel n={3} text="Add it to your bookmarks bar" />
              <ol className="space-y-2.5 text-sm text-white/55">
                <li className="flex gap-3">
                  <Bullet />
                  <span>Right-click an empty space in your bookmarks bar → choose <Kbd>Add page</Kbd> or <Kbd>New bookmark</Kbd></span>
                </li>
                <li className="flex gap-3">
                  <Bullet />
                  <span>Set <span className="text-white/80">Name</span> to <Kbd>Save to Cortex</Kbd></span>
                </li>
                <li className="flex gap-3">
                  <Bullet />
                  <span>Set <span className="text-white/80">URL / Address</span> to the code you copied in Step 1 — paste with <Kbd>Ctrl+V</Kbd></span>
                </li>
                <li className="flex gap-3">
                  <Bullet />
                  <span>Click <Kbd>Save</Kbd> — done!</span>
                </li>
              </ol>
            </div>

            {/* How to use */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">How to use it</p>
              <ol className="space-y-1.5 text-xs text-white/50">
                <li>1. Go to any website — ChatGPT, Claude, a news article, anywhere</li>
                <li>2. Select the text you want to save</li>
                <li>3. Click <span className="text-white/75 font-medium">Save to Cortex</span> in your bookmarks bar</li>
                <li>4. A popup opens with your text pre-filled — click Save</li>
              </ol>
            </div>
          </div>

          {/* Drag fallback — anchor href is set via ref/setAttribute, NOT via React prop */}
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-white/30 font-medium">Alternative: drag to bookmarks bar</p>
              <p className="text-[11px] text-white/20 mt-0.5">Works on some browsers — drag the button to your bar</p>
            </div>
            {/* href is intentionally left out of JSX and set via useEffect + setAttribute
                to avoid React's javascript: URL runtime error */}
            <a
              ref={dragAnchorRef}
              draggable
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-white/50 text-xs font-medium cursor-grab active:cursor-grabbing select-none transition-colors duration-150 shrink-0"
            >
              <BookmarkIcon />
              Save to Cortex
            </a>
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
      <span className="text-sm font-medium text-white/80">{text}</span>
    </div>
  );
}

function Bullet() {
  return (
    <span className="w-5 h-5 rounded-full bg-white/[0.05] text-white/30 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">•</span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.10] font-mono text-[11px] text-white/70">{children}</kbd>
  );
}

function BrowserHint({ browser, shortcut, mac }: { browser: string; shortcut: string; mac?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-white/60 font-medium w-36 shrink-0">{browser}</span>
      <span className="text-white/35 text-xs"><Kbd>{shortcut}</Kbd>{mac && <> or <Kbd>{mac}</Kbd></>}</span>
    </div>
  );
}

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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

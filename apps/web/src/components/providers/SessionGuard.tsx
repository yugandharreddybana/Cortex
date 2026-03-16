"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { sendExtensionToken } from "@/lib/extension-auth";

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes — token is 60 min, refresh well before expiry
const INACTIVITY_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours — if inactive for 2 hours, stop refreshing
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const lastActivity = React.useRef(Date.now());
  const isActive = React.useRef(true);
  const [showPopup, setShowPopup] = React.useState(false);
  const [expired, setExpired] = React.useState(false);

  // ── Track user activity ────────────────────────────────────────────────────

  React.useEffect(() => {
    function onActivity() {
      lastActivity.current = Date.now();
      isActive.current = true;

      // If the popup is showing because of inactivity (not expired token),
      // don't auto-dismiss — user must click Refresh
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, []);

  // ── Token refresh cycle: every 15 min ─────────────────────────────────────

  React.useEffect(() => {
    async function tick() {
      const inactiveDuration = Date.now() - lastActivity.current;

      // User is inactive — don't refresh, mark inactive
      if (inactiveDuration >= INACTIVITY_THRESHOLD) {
        isActive.current = false;

        // Check if token is still valid
        try {
          const hb = await fetch("/api/auth/heartbeat", { credentials: "include" });
          if (!hb.ok) {
            // Token has expired while inactive
            setExpired(true);
          }
        } catch {
          // Network error — assume expired
          setExpired(true);
        }

        // Show popup telling user to refresh
        setShowPopup(true);
        return;
      }

      // User is active — silently refresh the token
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (!res.ok) {
          // Token already expired or invalid — force re-login
          setExpired(true);
          setShowPopup(true);
        } else {
          // After a successful refresh, update extension token
          await sendExtensionToken();
        }
      } catch {
        // Network error — skip, will retry next cycle
      }
    }

    const interval = setInterval(tick, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAction() {
    if (expired) {
      router.push("/login");
    } else {
      // Refresh the extension token before reloading so the extension stays signed in
      sendExtensionToken().finally(() => window.location.reload());
    }
  }

  return (
    <>
      {children}

      <AnimatePresence>
        {showPopup && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm mx-4 rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                {expired ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-400">
                    <rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="1.5" />
                    <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400">
                    <path d="M23 4v6h-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-white mb-1">
                {expired ? "Session Expired" : "Session Paused"}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/50 mb-6">
                {expired
                  ? "Your session has expired. Please log in again to continue."
                  : "You've been inactive. Refresh the page to re-verify your identity and get the latest data."}
              </p>

              {/* Action */}
              <button
                onClick={handleAction}
                className="w-full h-10 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
              >
                {expired ? "Log In" : "Refresh Page"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

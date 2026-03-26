"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

const ease = [0.16, 1, 0.3, 1] as const;

const TIER_CONFIG: Record<string, { label: string; price: string }> = {
  starter: { label: "Starter",  price: "Free" },
  pro:     { label: "Pro",      price: "$8 / month" },
  team:    { label: "Teams",    price: "$15 / user / month" },
};

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const [cancelOpen,    setCancelOpen]    = React.useState(false);
  const [teamsOpen,     setTeamsOpen]     = React.useState(false);
  const [loadingPortal, setLoadingPortal] = React.useState(false);

  const tier = user?.tier ?? "starter";
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.starter;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const handleManageBilling = async () => {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           returnUrl: `${window.location.origin}/dashboard/settings/billing`
        })
      });
      if (!res.ok) throw new Error("Failed to open billing portal");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing portal");
      setLoadingPortal(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="mb-8"
      >
        <h1 className="text-xl font-semibold tracking-tight text-white/90">
          Billing &amp; Subscription
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your plan, payments, and subscription status.
        </p>
      </motion.div>

      {/* ── Section 1: Current Plan ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.05 }}
        className={cn(
          "border border-white/[0.09] rounded-xl p-6 bg-surface mb-5",
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-white/70">Current Plan</h2>
          <div className="flex gap-2">
            {tier !== "starter" && (
              <button
                onClick={handleManageBilling}
                disabled={loadingPortal}
                className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-full",
                  "bg-white/[0.05] text-white/70 border border-white/10",
                  "hover:bg-white/10 transition-colors",
                  loadingPortal && "opacity-50 cursor-wait"
                )}
              >
                {loadingPortal ? "Loading..." : "Manage Billing"}
              </button>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25">
              Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {([
            ["Plan",         `${config.label} (${config.price})`],
            ["Member Since", memberSince],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-[11px] text-white/35 uppercase tracking-wider">{label}</p>
              <p className="text-sm text-white/80 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Section 2: Change Plan ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.1 }}
        className={cn(
          "border border-white/[0.09] rounded-xl p-6 bg-surface mb-5",
        )}
      >
        <h2 className="text-sm font-medium text-white/70 mb-1">Change Plan</h2>
        <p className="text-xs text-white/35 mb-5">
          Upgrades take effect immediately. Downgrades apply at the end of the billing cycle.
        </p>

        <div className="flex flex-wrap gap-3">
          {tier !== "team" && (
            <button
              onClick={() => setTeamsOpen(true)}
              className={cn(
                "h-9 px-5 rounded-xl text-sm font-medium",
                "bg-white text-black",
                "hover:bg-gray-200 active:scale-95",
                "transition-all duration-150",
              )}
            >
              Upgrade to Teams
            </button>
          )}
          {tier === "starter" && (
            <button
              onClick={() => { window.location.href = '/pricing'; }}
              className={cn(
                "h-9 px-5 rounded-xl text-sm",
                "border border-white/[0.12] text-white/60",
                "hover:border-white/25 hover:text-white/85",
                "transition-colors duration-150",
              )}
            >
              Upgrade to Pro
            </button>
          )}
          {tier === "team" && (
            <span className="h-9 px-5 inline-flex items-center rounded-xl text-sm font-medium bg-accent/15 text-accent border border-accent/25">
              Teams Plan Active
            </span>
          )}
          {tier === "pro" && (
            <span className="h-9 px-5 inline-flex items-center rounded-xl text-sm font-medium bg-accent/15 text-accent border border-accent/25">
              Pro Plan Active
            </span>
          )}
        </div>
      </motion.div>

      {/* ── Section 3: Danger Zone (only for paid plans) ── */}
      {tier !== "starter" && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.15 }}
        className={cn(
          "border border-red-500/[0.15] rounded-xl p-6 bg-surface",
        )}
      >
        <h2 className="text-sm font-medium text-white/70 mb-1">Danger Zone</h2>
        <p className="text-xs text-white/35 mb-5">
          Canceling will keep your {config.label} features active until the end of
          your current billing cycle, then downgrade to Free.
        </p>

        <button
          onClick={handleManageBilling}
          disabled={loadingPortal}
          className={cn(
            "h-9 px-5 rounded-xl text-sm",
            "border border-red-500/20 text-red-400",
            "hover:bg-red-500/10 hover:border-red-500/40",
            "transition-colors duration-150 active:scale-95",
            loadingPortal && "opacity-50 cursor-wait"
          )}
        >
          {loadingPortal ? "Redirecting..." : "Manage Subscription via Stripe"}
        </button>
      </motion.div>
      )}

      {/* ── Teams Upgrade Dialog ── */}
      <Dialog.Root open={teamsOpen} onOpenChange={setTeamsOpen}>
        <AnimatePresence>
          {teamsOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 4 }}
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                  className={cn(
                    "fixed left-1/2 top-1/2 z-50",
                    "-translate-x-1/2 -translate-y-1/2",
                    "w-full max-w-[480px] mx-4 outline-none",
                    "bg-[#141414] border border-white/[0.09] rounded-2xl",
                    "shadow-[0_24px_80px_rgba(0,0,0,0.7)]",
                    "overflow-hidden",
                  )}
                >
                  {/* Header gradient strip */}
                  <div className="h-1 w-full bg-gradient-to-r from-accent via-purple-400 to-blue-400" />

                  <div className="p-6">
                    {/* Plan badge */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                        <TeamsIcon />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white/90">Upgrade to Teams</p>
                        <p className="text-xs text-white/40">Mock Stripe Checkout</p>
                      </div>
                      <Dialog.Close className="ml-auto w-7 h-7 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition-colors duration-150 flex items-center justify-center text-base leading-none">
                        ✕
                      </Dialog.Close>
                    </div>

                    {/* Summary card */}
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 mb-5 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Teams plan</span>
                        <span className="text-white/80 font-medium">$15 / user / mo</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Seats</span>
                        <span className="text-white/80 font-medium">5 users</span>
                      </div>
                      <div className="h-px bg-white/[0.06]" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Total today</span>
                        <span className="text-white font-semibold">$75 / month</span>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {[
                        "Shared knowledge bases across your team",
                        "Admin dashboard & member management",
                        "Priority support & SSO (soon)",
                        "Everything in Pro, for everyone",
                      ].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-white/55">
                          <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Mock card line */}
                    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 mb-5">
                      <div className="w-8 h-5 rounded bg-gradient-to-br from-[#252525] to-[#1a1a1a] border border-white/10 text-[8px] text-white/30 flex items-center justify-center font-mono">VISA</div>
                      <span className="text-sm text-white/40 font-mono tracking-wider">•••• •••• •••• 4242</span>
                    </div>

                    <button
                      onClick={() => {
                        setTeamsOpen(false);
                        toast.info("Stripe checkout pending", {
                          description: "The payment gateway for team subscriptions is currently in the integration phase.",
                        });
                      }}
                      className={cn(
                        "w-full h-10 rounded-xl text-sm font-semibold",
                        "bg-accent text-white",
                        "hover:bg-accent/90 active:scale-[0.98]",
                        "transition-all duration-150",
                        "shadow-[0_0_20px_rgba(108,99,255,0.35)]",
                      )}
                    >
                      Confirm Upgrade — $75 / mo
                    </button>
                    <p className="text-center text-[11px] text-white/25 mt-3">
                      Secured by Stripe · Cancel anytime · No hidden fees
                    </p>
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      {/* ── Cancel AlertDialog ── */}
      <AlertDialog.Root open={cancelOpen} onOpenChange={setCancelOpen}>
        <AnimatePresence>
          {cancelOpen && (
            <AlertDialog.Portal forceMount>
              {/* Overlay */}
              <AlertDialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                />
              </AlertDialog.Overlay>

              {/* Content */}
              <AlertDialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 4 }}
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                  className={cn(
                    "fixed left-1/2 top-1/2 z-50",
                    "-translate-x-1/2 -translate-y-1/2",
                    "w-full max-w-[460px] mx-4",
                    "bg-[#171717] border border-white/[0.09] rounded-2xl",
                    "shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
                    "p-6 outline-none",
                  )}
                >
                  {/* Warning icon */}
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                    <WarningIcon />
                  </div>

                  <AlertDialog.Title className="text-base font-semibold text-white/90 mb-2">
                    Cancel Subscription?
                  </AlertDialog.Title>

                  <AlertDialog.Description className="text-sm text-white/45 leading-relaxed mb-6">
                    If you cancel now, you will retain full access to your{" "}
                    <span className="text-white/70 font-medium">{config.label} features</span> until the end of
                    your current billing cycle. After that
                    date, your account will be downgraded to the{" "}
                    <span className="text-white/70 font-medium">Free tier</span> and you will not be
                    charged again.
                  </AlertDialog.Description>

                  <div className="flex items-center justify-end gap-3">
                    <AlertDialog.Cancel asChild>
                      <button
                        className={cn(
                          "h-9 px-5 rounded-xl text-sm font-medium",
                          "bg-white text-black",
                          "hover:bg-gray-200 active:scale-95",
                          "transition-all duration-150",
                        )}
                      >
                        Keep Subscription
                      </button>
                    </AlertDialog.Cancel>

                    <AlertDialog.Action asChild>
                      <button
                        className={cn(
                          "h-9 px-5 rounded-xl text-sm",
                          "border border-red-500/20 text-red-400",
                          "hover:bg-red-500/10 hover:border-red-500/40",
                          "transition-colors duration-150 active:scale-95",
                        )}
                      >
                        Confirm Cancellation
                      </button>
                    </AlertDialog.Action>
                  </div>
                </motion.div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          )}
        </AnimatePresence>
      </AlertDialog.Root>
    </div>
  );
}

function TeamsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#6C63FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="6" r="2.5" />
      <path d="M2 15c0-2.761 2.239-4 5-4s5 1.239 5 4" />
      <path d="M12.5 5a2.5 2.5 0 010 5" />
      <path d="M16 15c0-2.2-1.5-3.5-3.5-4" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8.485 3.215a1.75 1.75 0 013.03 0l6.01 10.32A1.75 1.75 0 0116.01 16H3.99a1.75 1.75 0 01-1.515-2.465l6.01-10.32z"
        stroke="#f87171"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 7.5v3.5M10 13.5h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

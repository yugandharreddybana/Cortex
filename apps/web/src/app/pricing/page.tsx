"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import * as Switch from "@radix-ui/react-switch";
import { cn } from "@cortex/ui";
import { Nav } from "@/components/layout/Nav";
import { useAuthStore } from "@/store/authStore";

// ─── Pricing data ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id:       "starter",
    name:     "Starter",
    price:    { monthly: 0,  annual: 0  },
    desc:     "For individuals just getting started.",
    features: [
      "100 highlights per month",
      "Local full-text search",
      "Browser extension",
      "7-day history",
    ],
    cta:      "Get started free",
    href:     "/signup?tier=starter",
    featured: false,
  },
  {
    id:       "pro",
    name:     "Pro",
    price:    { monthly: 8,  annual: 6  },
    desc:     "For power researchers and knowledge workers.",
    features: [
      "Unlimited highlights",
      "AI context tagging",
      "Cloud sync across all devices",
      "Semantic search",
      "Priority support",
      "Folders & collections",
    ],
    cta:      "Start free trial",
    href:     "/signup?tier=pro",
    featured: true,
  },
  {
    id:       "team",
    name:     "Team",
    price:    { monthly: 15, annual: 12 },
    unit:     "/user",
    desc:     "For teams building shared knowledge bases.",
    features: [
      "Everything in Pro",
      "Shared workspaces",
      "Multiplayer annotations",
      "Admin panel & roles",
      "SSO & SCIM",
      "Dedicated onboarding",
    ],
    cta:      "Contact sales",
    href:     "/signup?tier=team",
    featured: false,
  },
] as const;

// ─── Animation variants ───────────────────────────────────────────────────────
const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: 0.05 + i * 0.08, ease },
  }),
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [annual, setAnnual] = React.useState(false);

  return (
    <div className="min-h-screen bg-bg text-primary">
      <Nav />

      <main className="pt-32 pb-24 px-6 lg:px-10 max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease }}
          className="text-center mb-14 space-y-4"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-accent mb-2">
            Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tighter">
            Simple, transparent pricing.
          </h1>
          <p className="text-base text-white/50 max-w-lg mx-auto">
            Unlock the full power of your indexed knowledge. No hidden fees, cancel any time.
          </p>

          {/* ── Billing toggle ── */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className={cn("text-sm transition-colors", !annual ? "text-white/90" : "text-white/40")}>
              Monthly
            </span>

            <Switch.Root
              checked={annual}
              onCheckedChange={setAnnual}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
                "border border-white/10 bg-white/[0.07]",
                "transition-colors duration-200",
                "data-[state=checked]:bg-accent/80 data-[state=checked]:border-accent/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              )}
              aria-label="Toggle annual billing"
            >
              <Switch.Thumb
                className={cn(
                  "pointer-events-none block h-4 w-4 rounded-full",
                  "bg-white shadow-sm",
                  "transition-transform duration-200 ease-snappy",
                  "translate-x-1 data-[state=checked]:translate-x-6",
                )}
              />
            </Switch.Root>

            <span className={cn("flex items-center gap-2 text-sm transition-colors", annual ? "text-white/90" : "text-white/40")}>
              Annually
              <span
                className={cn(
                  "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
                  "transition-opacity duration-200",
                  annual ? "opacity-100" : "opacity-40",
                )}
              >
                Save 20%
              </span>
            </span>
          </div>
        </motion.div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan, i) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              annual={annual}
              index={i}
            />
          ))}
        </div>

        {/* ── Footer note ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease }}
          className="mt-12 text-center text-xs text-white/30"
        >
          All prices in USD. Starter is free forever. Pro & Team include a 14-day free trial.
        </motion.p>
      </main>
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────
interface PricingCardProps {
  plan: typeof PLANS[number];
  annual: boolean;
  index: number;
}

function PricingCard({ plan, annual, index }: PricingCardProps) {
  const price = annual ? plan.price.annual : plan.price.monthly;
  const unit  = "unit" in plan ? plan.unit : "";

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative flex flex-col rounded-2xl p-7 overflow-hidden",
        "border transition-all duration-300",
        plan.featured
          ? [
              "bg-surface border-accent/50",
              "shadow-[0_0_40px_rgba(108,99,255,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]",
              "scale-[1.02]",
            ]
          : [
              "bg-surface/60 border-white/[0.07]",
              "hover:border-white/[0.14] hover:shadow-glass",
            ],
      )}
    >
      {/* Featured badge */}
      {plan.featured && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
      )}

      {/* Plan name */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white/90">{plan.name}</span>
          {plan.featured && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
              Most Popular
            </span>
          )}
        </div>
        <p className="text-xs text-white/40">{plan.desc}</p>
      </div>

      {/* Price */}
      <div className="mb-7 flex items-end gap-1">
        <span className="text-4xl font-bold tracking-tighter text-white">
          {price === 0 ? "Free" : `$${price}`}
        </span>
        {price > 0 && (
          <span className="text-sm text-white/40 mb-1.5">
            /mo{unit}
            {annual && (
              <span className="ml-1 text-emerald-400 text-xs">billed annually</span>
            )}
          </span>
        )}
      </div>

      {/* CTA */}
      <PricingCTA plan={plan} annual={annual} />

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-6" />

      {/* Features */}
      <ul className="space-y-3 flex-1">
        {plan.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5 text-sm text-white/60">
            <CheckIcon />
            {feat}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ─── CTA Component ────────────────────────────────────────────────────────────
import { toast } from "sonner";

function PricingCTA({ plan, annual }: { plan: typeof PLANS[number], annual: boolean }) {
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(false);

  const handleCheckout = async () => {
    if (!user) {
      window.location.href = `/signup?tier=${plan.id}`;
      return;
    }

    if (plan.id === "starter") {
      window.location.href = "/dashboard";
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          annual: annual,
          successUrl: `${window.location.origin}/dashboard?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`
        })
      });

      if (!res.ok) throw new Error("Failed to create checkout session");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      toast.error("Checkout failed", {
        description: err.message || "An unexpected error occurred during the checkout process. Please try again.",
      });
      setLoading(false);
    }
  };

  const isCurrentPlan = user?.tier === plan.id || (plan.id === "pro" && user?.tier === "premium");

  if (isCurrentPlan) {
    return (
      <button
        disabled
        className={cn(
          "mb-7 w-full inline-flex items-center justify-center",
          "h-9 px-4 rounded-xl text-sm font-medium",
          "bg-white/[0.05] text-white/40 border border-white/[0.05] cursor-not-allowed"
        )}
      >
        Current Plan
      </button>
    );
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={cn(
        "mb-7 w-full inline-flex items-center justify-center",
        "h-9 px-4 rounded-xl text-sm font-medium",
        "transition-all duration-200 ease-snappy",
        loading && "opacity-70 cursor-wait",
        plan.featured
          ? "bg-accent hover:bg-accent/90 text-white shadow-[0_0_20px_rgba(108,99,255,0.35)]"
          : "bg-white/[0.07] hover:bg-white/[0.12] text-white/80 border border-white/[0.08]",
      )}
    >
      {loading ? "Please wait..." : plan.cta}
    </button>
  );
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      className="mt-0.5 shrink-0 text-accent"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="6" fill="currentColor" fillOpacity="0.15" />
      <path d="M4.5 7l2 2L9.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

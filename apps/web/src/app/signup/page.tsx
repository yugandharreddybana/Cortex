"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { sendExtensionToken } from "@/lib/extension-auth";
import { premiumToast } from "@/lib/premium-feedback";
import { Loader2 } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const TIER_LABELS: Record<string, string> = {
  starter: "Starter — Free forever",
  pro:     "Pro — $8/mo",
  team:    "Team — $15/user/mo",
};

const signupSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Name is too long"),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
});

type SignupValues = z.infer<typeof signupSchema>;

// Wrapped separately so useSearchParams() has a Suspense boundary
function SignupContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tier         = searchParams.get("tier") ?? "starter";
  const returnTo     = searchParams.get("returnTo");
  const [authChecked, setAuthChecked] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // All hooks must be declared unconditionally before any early returns
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  // ── Check if already authenticated & redirect to dashboard ──
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { authenticated: boolean };
          if (data.authenticated) {
            router.replace(returnTo ?? "/dashboard");
            return;
          }
        }
      } catch {}
      setAuthChecked(true);
    })();
  }, [router, returnTo]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  async function onSubmit(values: SignupValues) {
    const res = await fetch("/api/auth/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...values, tier }),
    });

    const data = await res.json() as { success: boolean; error?: string; code?: string };

    if (!data.success) {
      if (data.code === "EMAIL_EXISTS") {
        premiumToast.emailExists();
      } else {
        premiumToast.signupFailed(data.error);
      }
      return;
    }

    // Send extension token in background (fire-and-forget, non-blocking)
    sendExtensionToken();
    
    // Show success message
    premiumToast.signupSuccess();

    // Small delay before redirect for UX
    setTimeout(() => {
      router.push(returnTo ?? "/dashboard");
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-hero-gradient opacity-30 -z-10"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.4)]">
              <CortexMark />
            </span>
            <span className="text-base font-semibold tracking-tight">Cortex</span>
          </Link>
        </div>

        {/* Card */}
        <div className={cn(
          "rounded-2xl border border-white/[0.08] bg-surface",
          "shadow-[0_24px_48px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]",
          "p-8",
        )}>
          <h1 className="text-xl font-semibold tracking-tight mb-1">Create your brain.</h1>

          {/* Tier pill */}
          <div className="flex items-center gap-2 mb-7">
            <p className="text-sm text-white/40">Plan:</p>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25">
              {TIER_LABELS[tier] ?? tier}
            </span>
          </div>

          {/* Google sign-up */}
          <button
            type="button"
            disabled={isSubmitting}
            className={cn(
              "w-full h-10 rounded-xl mb-4",
              "bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10]",
              "text-sm font-medium text-white/80",
              "transition-all duration-200 ease-snappy",
              "flex items-center justify-center gap-2.5",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            <GoogleIcon />
            Sign up with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[11px] text-white/30 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                {...register("fullName")}
                placeholder="Your full name"
                className={cn(
                  "w-full h-10 px-3.5 rounded-xl",
                  "bg-white/[0.05] border border-white/[0.08]",
                  "text-sm text-white placeholder:text-white/25",
                  "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-150",
                )}
              />
              {errors.fullName && (
                <p className="text-xs text-red-400">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                placeholder="you@example.com"
                className={cn(
                  "w-full h-10 px-3.5 rounded-xl",
                  "bg-white/[0.05] border border-white/[0.08]",
                  "text-sm text-white placeholder:text-white/25",
                  "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-150",
                )}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("password")}
                  placeholder="Minimum 8 characters"
                  className={cn(
                    "w-full h-10 px-3.5 pr-10 rounded-xl",
                    "bg-white/[0.05] border border-white/[0.08]",
                    "text-sm text-white placeholder:text-white/25",
                    "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-150",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full h-10 rounded-xl mt-1",
                "bg-accent hover:bg-accent/90 text-sm font-medium text-white",
                "shadow-[0_0_20px_rgba(108,99,255,0.3)]",
                "transition-all duration-200 ease-snappy",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/35 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-accent/80 hover:text-accent transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={null}>
      <SignupContent />
    </React.Suspense>
  );
}

function CortexMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.5v2.5l1.5 1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return <Loader2 className="w-4 h-4 animate-spin" />;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.97-6.19a24.042 24.042 0 000 21.56l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

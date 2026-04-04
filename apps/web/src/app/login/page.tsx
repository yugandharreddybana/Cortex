"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { sendExtensionToken } from "@/lib/extension-auth";
import { premiumToast } from "@/lib/premium-feedback";
import { useDashboardStore } from "@/store/dashboard";
import { Loader2 } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const loginSchema = z.object({
  email:    z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const returnTo     = searchParams.get("returnTo");
  const isExtLogin   = searchParams.get("ext") === "1";
  const [extDone, setExtDone] = React.useState(false);
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotSending, setForgotSending] = React.useState(false);
  const [forgotSent, setForgotSent] = React.useState(false);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // All hooks must be declared unconditionally before any early returns
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const resetStore = useDashboardStore((s) => s.resetStore);

  // ── Clear any stale persisted state when landing on /login ──
  React.useEffect(() => {
    resetStore();
    // Also tell the extension to clear its storage
    if (typeof window !== "undefined") {
      window.postMessage({ type: "CORTEX_LOGOUT" }, window.location.origin);
    }
    // Run ONLY on mount, never again
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check if already authenticated & redirect to dashboard ──
  // Use useCallback to stabilize the function reference
  const checkAuthAndRedirect = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { authenticated: boolean };
        if (data.authenticated) {
          // Use replace to prevent back button returning to login
          router.replace(returnTo ?? "/dashboard");
          return;
        }
      }
    } catch {}
    setAuthChecked(true);
  }, [returnTo, router]);

  React.useEffect(() => {
    checkAuthAndRedirect();
  }, [checkAuthAndRedirect]); // Stable callback

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  async function onSubmit(values: LoginValues) {
    console.log('[LOGIN] Submitting login form', values);
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body:    JSON.stringify(values),
    });

    console.log('[LOGIN] Response status:', res.status);
    let data;
    try {
      data = await res.json();
      console.log('[LOGIN] Response data:', data);
    } catch (e) {
      console.error('[LOGIN] Error parsing response JSON', e);
      premiumToast.networkError();
      return;
    }

    if (!data.success) {
      premiumToast.loginFailed(data.error);
      return;
    }

    // Send extension token in background (fire-and-forget, non-blocking)
    sendExtensionToken();

    // Hydrate extension with current user data after login
    void (async () => {
      try {
        const [fRes, tRes, hRes] = await Promise.all([
          fetch("/api/folders", { credentials: "include" }),
          fetch("/api/tags", { credentials: "include" }),
          fetch("/api/highlights", { credentials: "include" }),
        ]);
        const [folders, tags, highlights] = await Promise.all([
          fRes.ok ? fRes.json() : [],
          tRes.ok ? tRes.json() : [],
          hRes.ok ? hRes.json() : [],
        ]);
        window.postMessage(
          { type: "CORTEX_INIT", payload: { folders, tags, highlights } },
          window.location.origin,
        );
      } catch { /* non-critical — extension will sync on hourly alarm */ }
    })();
    
    // Show success message
    premiumToast.loginSuccess();

    if (isExtLogin) {
      setExtDone(true);
      return;
    }

    // Small delay before redirect for UX
    setTimeout(() => {
      router.push(returnTo ?? "/dashboard");
    }, 1000);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail.trim() }),
    });
    setForgotSending(false);
    setForgotSent(true);
  }

  // Extension login success screen
  if (extDone) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div aria-hidden className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-hero-gradient opacity-30 -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="w-full max-w-md text-center"
        >
          <div className={cn(
            "rounded-2xl border border-white/[0.08] bg-surface",
            "shadow-[0_24px_48px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "p-10",
          )}>
            <div className="w-14 h-14 rounded-2xl bg-accent mx-auto mb-5 flex items-center justify-center shadow-[0_0_32px_rgba(108,99,255,0.4)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold tracking-tight mb-2">You&apos;re all set!</h2>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">
              Your extension is now connected. Open the Cortex extension from your browser toolbar to access your highlights.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className={cn(
                "w-full h-10 rounded-xl",
                "bg-white/[0.05] border border-white/[0.08]",
                "text-sm text-white/70 hover:text-white hover:bg-white/[0.09]",
                "transition-all duration-200 ease-snappy",
              )}
            >
              Go to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      {/* Radial glow */}
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
          <Link href="/" className="flex items-center gap-2.5 group">
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
          <h1 className="text-xl font-semibold tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-white/40 mb-7">Sign in to continue to Cortex</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60" htmlFor="email">
                Email
              </label>
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
                  "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30",
                  "transition-all duration-150",
                )}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/60" htmlFor="password">
                  Password
                </label>
                <Link href="#" onClick={(e) => { e.preventDefault(); setForgotOpen(true); }} className="text-xs text-accent/70 hover:text-accent transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  placeholder="••••••••"
                  className={cn(
                    "w-full h-10 px-3.5 pr-10 rounded-xl",
                    "bg-white/[0.05] border border-white/[0.08]",
                    "text-sm text-white placeholder:text-white/25",
                    "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30",
                    "transition-all duration-150",
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
                "w-full h-10 rounded-xl",
                "bg-accent hover:bg-accent/90",
                "text-sm font-medium text-white",
                "shadow-[0_0_20px_rgba(108,99,255,0.3)]",
                "transition-all duration-200 ease-snappy",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "mt-2",
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-white/[0.06]" />
            <span className="text-xs text-white/25">or</span>
            <div className="flex-1 border-t border-white/[0.06]" />
          </div>

          {/* OAuth stubs */}
          <button
            onClick={() => router.push("/dashboard")}
            className={cn(
              "w-full h-10 rounded-xl",
              "bg-white/[0.05] border border-white/[0.08]",
              "text-sm text-white/70 hover:text-white hover:bg-white/[0.09]",
              "transition-all duration-200 ease-snappy",
              "flex items-center justify-center gap-2.5",
            )}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="text-center text-xs text-white/35 mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent/80 hover:text-accent transition-colors">
            Sign up free
          </Link>
        </p>
      </motion.div>

      {/* ── Forgot password overlay ── */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "w-full max-w-sm rounded-2xl border border-white/[0.08] bg-surface",
              "shadow-[0_24px_48px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]",
              "p-6",
            )}
          >
            {forgotSent ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 mx-auto mb-4 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="16 5 7.5 14 4 10" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold tracking-tight mb-1">Check your email</h3>
                <p className="text-sm text-white/40 mb-5">
                  If an account with that email exists, we&apos;ve sent a password reset link.
                </p>
                <button
                  onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(""); }}
                  className={cn(
                    "w-full h-9 rounded-xl text-sm font-medium",
                    "bg-white/[0.06] border border-white/[0.08]",
                    "text-white/70 hover:text-white hover:bg-white/[0.10]",
                    "transition-all duration-150",
                  )}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold tracking-tight mb-1">Reset your password</h3>
                <p className="text-sm text-white/40 mb-5">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
                <form onSubmit={handleForgot} className="space-y-4">
                  <input
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={cn(
                      "w-full h-10 px-3.5 rounded-xl",
                      "bg-white/[0.05] border border-white/[0.08]",
                      "text-sm text-white placeholder:text-white/25",
                      "outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30",
                      "transition-all duration-150",
                    )}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setForgotOpen(false); setForgotEmail(""); }}
                      className={cn(
                        "flex-1 h-9 rounded-xl text-sm",
                        "bg-white/[0.06] border border-white/[0.08]",
                        "text-white/60 hover:text-white/80",
                        "transition-all duration-150",
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotSending || !forgotEmail.trim()}
                      className={cn(
                        "flex-1 h-9 rounded-xl text-sm font-medium",
                        "bg-accent hover:bg-accent/90 text-white",
                        "transition-all duration-150",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      {forgotSending ? "Sending…" : "Send reset link"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
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

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M13.8 7.67c0-.4-.03-.79-.09-1.16H7.5v2.2h3.53a3.02 3.02 0 01-1.31 1.98v1.65h2.12c1.24-1.14 1.96-2.83 1.96-4.67z" fill="#4285F4" />
      <path d="M7.5 14c1.77 0 3.25-.59 4.33-1.59l-2.12-1.65a3.7 3.7 0 01-2.21.63 3.71 3.71 0 01-3.48-2.56H1.84v1.7A6.5 6.5 0 007.5 14z" fill="#34A853" />
      <path d="M4.02 8.83A3.74 3.74 0 013.8 7.5c0-.46.08-.91.22-1.33V4.47H1.84A6.5 6.5 0 001 7.5c0 1.05.25 2.04.84 2.03l2.18-.7z" fill="#FBBC05" />
      <path d="M7.5 3.96a3.55 3.55 0 012.51 .98l1.88-1.88A6.3 6.3 0 007.5 1a6.5 6.5 0 00-5.66 3.47l2.18 1.7A3.71 3.71 0 017.5 3.96z" fill="#EA4335" />
    </svg>
  );
}

// ─── Page wrapper (Suspense for useSearchParams) ──────────────────────────────
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginContent />
    </React.Suspense>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { Button } from "@cortex/ui";
import { useSearchStore } from "@/store/useSearchStore";

// ─── Nav links ────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: "#product",  label: "Product"  },
  { href: "#features", label: "Features" },
  { href: "/pricing",  label: "Pricing"  },
] as const;

// ─── Cmd+K items — removed: now handled by SearchProvider

// ─── Nav ──────────────────────────────────────────────────────────────────────
export function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  const setIsOpen  = useSearchStore((s) => s.setIsOpen);
  const pathname   = usePathname();
  const router     = useRouter();

  // Detect scroll for border visibility
  React.useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Restore scroll target injected by cross-page navigation
  React.useEffect(() => {
    if (pathname !== "/") return;
    const target = sessionStorage.getItem("cortex:scrollTo");
    if (!target) return;
    sessionStorage.removeItem("cortex:scrollTo");
    const timer = setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
    }, 350);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Handle hash-anchor clicks without mutating the URL
  function handleNavClick(e: React.MouseEvent, href: string) {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const id = href.slice(1);
    if (pathname === "/") {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    } else {
      sessionStorage.setItem("cortex:scrollTo", id);
      router.push("/");
    }
  }

  return (
    <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.20, 0.90, 0.30, 1.00] }}
        className={cn(
          // Layout
          "fixed top-0 inset-x-0 z-40",
          "flex items-center justify-between",
          "h-14 px-6 lg:px-10",
          // Glass
          "bg-bg/70 backdrop-blur-xl",
          // Border appears only after scroll
          "border-b transition-colors duration-300 ease-spatial",
          scrolled ? "border-white/[0.06]" : "border-transparent",
          // Hardware accel
          "transform-gpu will-change-transform",
        )}
      >
        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="Cortex home"
        >
          <span
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              "bg-accent shadow-[0_0_12px_rgba(129,140,248,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]",
              "transition-shadow duration-250 ease-spatial",
              "group-hover:shadow-[0_0_20px_rgba(129,140,248,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]",
            )}
          >
            <CortexLogoMark />
          </span>
          <span className="text-sm font-semibold text-primary tracking-tight">
            Cortex
          </span>
        </Link>

        {/* ── Center links ── */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => {
            const linkCls = cn(
              "px-3 py-1.5 rounded-xl",
              "text-sm text-secondary",
              "transition-colors duration-200 ease-spatial",
              "hover:text-primary hover:bg-white/[0.04]",
            );
            return href.startsWith("#") ? (
              <button
                key={href}
                onClick={(e) => handleNavClick(e, href)}
                className={linkCls}
              >
                {label}
              </button>
            ) : (
              <Link key={href} href={href} className={linkCls}>
                {label}
              </Link>
            );
          })}

          {/* Cmd+K trigger — delegates to global SearchProvider */}
          <button
            onClick={() => setIsOpen(true)}
            className={cn(
              "flex items-center gap-2 ml-2 px-3 py-1.5 rounded-xl",
              "text-sm text-muted border border-white/[0.06]",
              "bg-white/[0.02]",
              "transition-all duration-200 ease-spatial",
              "hover:border-white/[0.10] hover:text-secondary hover:bg-white/[0.04]",
            )}
            aria-label="Open search (⌘K)"
          >
            <span>Search</span>
            <span className="flex items-center gap-0.5">
              <kbd className="text-2xs bg-white/[0.05] border border-white/[0.08] rounded-md px-1 py-0.5 font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">⌘</kbd>
              <kbd className="text-2xs bg-white/[0.05] border border-white/[0.08] rounded-md px-1 py-0.5 font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">K</kbd>
            </span>
          </button>
        </nav>

        {/* ── Right CTA ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className={cn(
              "hidden sm:inline-flex items-center",
              "text-sm text-secondary",
              "transition-colors duration-200 ease-spatial hover:text-primary",
            )}
          >
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm" shine>
              Get Started Free
            </Button>
          </Link>
        </div>
    </motion.header>
  );
}

// ─── Logomark SVG ─────────────────────────────────────────────────────────────
function CortexLogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2C4.686 2 2 4.686 2 8s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 5v3l2 2"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

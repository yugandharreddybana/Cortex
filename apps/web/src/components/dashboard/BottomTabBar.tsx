"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  {
    label: "Home",
    href: "/dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7.5L10 2l7 5.5V16a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16V7.5z" />
        <path d="M7.5 17.5V11h5v6.5" />
      </svg>
    ),
    exact: true,
  },
  {
    label: "Favorites",
    href: "/dashboard/favorites",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3.22l1.95 3.95 4.36.64-3.16 3.08.75 4.33L10 13.27l-3.9 2.05.75-4.33L3.69 7.81l4.36-.64L10 3.22z" />
      </svg>
    ),
  },
  {
    label: "Archive",
    href: "/dashboard/archive",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="4" rx="1" />
        <path d="M3 7v8a2 2 0 002 2h10a2 2 0 002-2V7" />
        <path d="M8 11h4" />
      </svg>
    ),
  },
  {
    label: "Replay",
    href: "/dashboard/temporal-replay",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6.5V10l2.5 2.5" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings/profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="2.5" />
        <path d="M16.2 12.2a1.2 1.2 0 00.24 1.32l.04.04a1.46 1.46 0 11-2.06 2.06l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.73 1.1v.12a1.46 1.46 0 01-2.92 0v-.06a1.2 1.2 0 00-.79-1.1 1.2 1.2 0 00-1.32.24l-.04.04a1.46 1.46 0 11-2.06-2.06l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.1-.73h-.12a1.46 1.46 0 010-2.92h.06a1.2 1.2 0 001.1-.79 1.2 1.2 0 00-.24-1.32l-.04-.04a1.46 1.46 0 112.06-2.06l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.73-1.1v-.12a1.46 1.46 0 012.92 0v.06a1.2 1.2 0 00.73 1.1 1.2 1.2 0 001.32-.24l.04-.04a1.46 1.46 0 112.06 2.06l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.1.73h.12a1.46 1.46 0 010 2.92h-.06a1.2 1.2 0 00-1.1.73z" />
      </svg>
    ),
    prefix: true,
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/70 backdrop-blur-xl border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : tab.prefix
              ? pathname.startsWith(tab.href)
              : pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-xl transition-colors duration-200 ease-spatial"
            >
              <span
                className={`transition-colors duration-200 ${
                  isActive ? "text-accent" : "text-white/40"
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-medium leading-none transition-colors duration-200 ${
                  isActive ? "text-accent" : "text-white/35"
                }`}
              >
                {tab.label}
              </span>

              {/* Active indicator glow */}
              {isActive && (
                <motion.span
                  layoutId="bottomtab-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-accent shadow-[0_0_8px_rgba(129,140,248,0.5)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

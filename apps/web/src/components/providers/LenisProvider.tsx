"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// ─── Context ──────────────────────────────────────────────────────────────────
const LenisContext = React.createContext<Lenis | null>(null);

export function useLenisInstance() {
  return React.useContext(LenisContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
/**
 * LenisProvider — wraps the app in Lenis smooth, inertial scrolling.
 *
 * Disabled on /dashboard routes because the dashboard uses its own nested
 * overflow-y-auto scroll container that Lenis would otherwise block.
 *
 * Physics:
 *  duration  1.2s
 *  easing    1 - (1 - t)^4  (quartic ease-out — feels Apple-native)
 *  wheelMultiplier 1.0, touchMultiplier 2.0 for fast mobile swipe
 *
 * The RAF loop runs on requestAnimationFrame and is torn down on unmount
 * to avoid memory leaks between hot-reloads.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const [lenis, setLenis] = React.useState<Lenis | null>(null);

  React.useEffect(() => {
    if (isDashboard) {
      setLenis(null);
      return;
    }

    const instance = new Lenis({
      duration:           1.2,
      // Quartic ease-out — smooth deceleration, no overshooting
      easing:             (t: number) => 1 - Math.pow(1 - t, 4),
      orientation:        "vertical",
      gestureOrientation: "vertical",
      smoothWheel:        true,
      wheelMultiplier:    1.0,
      touchMultiplier:    2.0,
      infinite:           false,
    });

    // Expose for anchor-link programmatic scrolling
    setLenis(instance);

    let rafId: number;
    function raf(time: number) {
      instance.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      instance.destroy();
    };
  }, [isDashboard]);

  return (
    <LenisContext.Provider value={lenis}>
      {children}
    </LenisContext.Provider>
  );
}

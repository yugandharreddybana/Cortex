"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Initialises Lenis smooth scroll on mount and tears it down on unmount.
 * The raf loop runs via requestAnimationFrame for zero-jank 60FPS scrolling.
 */
export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration:   1.2,
      easing:     (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation:    "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 2.0,
    });

    let rafId: number;

    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}

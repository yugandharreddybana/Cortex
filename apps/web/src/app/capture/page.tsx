/**
 * /capture — bookmarklet landing page.
 *
 * Opened by the Cortex bookmarklet from any web page:
 *   https://app.cortex.so/capture?text=...&url=...&title=...
 *
 * Renders a slim auto-filled save form (no full dashboard chrome).
 * Auth is enforced by SessionGuard — unauthenticated users are redirected
 * to /login?next=/capture?... so the bookmarklet flow survives a cold session.
 */
import { Suspense } from "react";
import CaptureClient from "./CaptureClient";

export const metadata = { title: "Save to Cortex" };

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureClient />
    </Suspense>
  );
}

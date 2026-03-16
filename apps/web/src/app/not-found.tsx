import Link from "next/link";
import { cn } from "@cortex/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      {/* Giant 404 */}
      <div className="relative mb-6 select-none">
        {/* Background glow */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 65%)",
            transform:  "scale(1.6)",
            filter:     "blur(32px)",
          }}
        />
        <p
          className={cn(
            "relative font-semibold tracking-tighter leading-none",
            "text-[120px] sm:text-[160px] lg:text-[200px]",
            "text-white/[0.04]",
            // Engraved-text effect via inset shadow trick
            "[-webkit-text-stroke:1px_rgba(255,255,255,0.07)]",
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          404
        </p>
      </div>

      {/* Copy */}
      <div className="flex flex-col items-center text-center gap-3 mb-10">
        <h1 className="text-xl font-semibold tracking-tight text-white/75">
          This thought doesn&apos;t exist.
        </h1>
        <p className="text-sm text-white/35 max-w-xs leading-relaxed">
          The page you&apos;re looking for was never indexed, or it&apos;s been
          moved somewhere new.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className={cn(
            "h-10 px-5 rounded-xl",
            "bg-accent hover:bg-accent/90 text-white text-sm font-semibold",
            "shadow-glow-sm active:scale-[0.95]",
            "transition-all duration-150 transform-gpu",
          )}
        >
          Back to Dashboard
        </Link>
        <Link
          href="/"
          className={cn(
            "h-10 px-5 rounded-xl",
            "border border-white/[0.09] text-white/55 text-sm font-medium",
            "hover:text-white/80 hover:bg-white/[0.04] active:scale-[0.95]",
            "transition-all duration-150 transform-gpu",
          )}
        >
          Home
        </Link>
      </div>
    </div>
  );
}

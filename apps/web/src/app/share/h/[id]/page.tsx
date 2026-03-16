import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getHighlight } from "@/lib/share-data";

// ─── Dynamic metadata for OG unfurling ────────────────────────────────────────
interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const h = getHighlight(id);
  if (!h) return { title: "Not Found — Cortex" };

  const title       = `Highlight from ${h.source} — Cortex`;
  const description = h.text.slice(0, 120) + (h.text.length > 120 ? "…" : "");
  const ogUrl       = `https://cortex.app/share/h/${id}`;
  const ogImage     = `https://cortex.app/api/og?title=${encodeURIComponent(h.text.slice(0, 80))}&type=highlight`;

  return {
    title,
    description,
    openGraph: {
      type:        "website",
      url:         ogUrl,
      title,
      description,
      images:      [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SharedHighlightPage({ params }: PageProps) {
  const { id } = await params;
  const h = getHighlight(id);
  if (!h) notFound();

  const faviconUrl = h.url !== "#"
    ? `https://www.google.com/s2/favicons?domain=${new URL(h.url).hostname}&sz=32`
    : null;

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 backdrop-blur-md bg-bg/60 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shadow-glow-sm">
            <CortexMark />
          </span>
          <span className="font-semibold text-sm tracking-tight text-white/90">Cortex</span>
        </Link>

        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-colors duration-200"
        >
          Build your own brain
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-2xl px-6 mt-24 pb-24">
        <blockquote className="text-2xl font-serif text-white/90 leading-relaxed border-l-4 border-white/20 pl-6">
          &ldquo;{h.text}&rdquo;
        </blockquote>

        {/* Source + favicon */}
        <div className="mt-8 flex items-center gap-3">
          {faviconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconUrl} alt="" width={16} height={16} className="rounded-sm opacity-70" />
          )}
          <a
            href={h.url !== "#" ? h.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/50 hover:text-accent transition-colors duration-200"
          >
            {h.source}
          </a>
        </div>

        {/* Topic badge */}
        <div className="mt-6">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${h.topicColor}`}>
            {h.topic}
          </span>
        </div>
      </main>
    </div>
  );
}

// ─── Logo mark ────────────────────────────────────────────────────────────────
function CortexMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4" />
      <path d="M6 4v2l1.5 1.5" />
    </svg>
  );
}

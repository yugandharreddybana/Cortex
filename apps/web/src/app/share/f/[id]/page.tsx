import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getFolder } from "@/lib/share-data";

// ─── Dynamic metadata for OG unfurling ────────────────────────────────────────
interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const folder = getFolder(id);
  if (!folder) return { title: "Not Found — Cortex" };

  const title       = `${folder.name} — Cortex`;
  const description = `${folder.highlights.length} highlight${folder.highlights.length === 1 ? "" : "s"} in this collection.`;
  const ogUrl       = `https://cortex.app/share/f/${id}`;
  const ogImage     = `https://cortex.app/api/og?title=${encodeURIComponent(folder.name)}&type=folder`;

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
export default async function SharedFolderPage({ params }: PageProps) {
  const { id } = await params;
  const folder = getFolder(id);
  if (!folder) notFound();

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
      <main className="mx-auto max-w-5xl px-6 mt-24 pb-24">
        {/* Folder heading */}
        <h1 className="text-5xl font-bold tracking-tighter text-white/95">
          <span className="mr-3">{folder.emoji}</span>
          {folder.name}
        </h1>
        <p className="mt-3 text-sm text-white/40">
          {folder.highlights.length} highlight{folder.highlights.length === 1 ? "" : "s"} in this collection
        </p>

        {/* Masonry grid — read-only, no interactive elements */}
        <div className="mt-12 columns-1 md:columns-2 xl:columns-3 gap-4">
          {folder.highlights.map((h) => (
            <div
              key={h.id}
              className="break-inside-avoid mb-4 bg-surface rounded-xl p-5 border border-white/[0.06]"
            >
              {/* Topic badge */}
              <div className="mb-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${h.topicColor}`}>
                  {h.topic}
                </span>
              </div>

              {/* Text */}
              {h.isCode ? (
                <pre className="font-mono text-sm whitespace-pre-wrap bg-white/[0.05] p-3 rounded-lg overflow-x-auto text-white/65 border border-white/[0.07] line-clamp-6">
                  {h.text}
                </pre>
              ) : (
                <blockquote className="text-sm text-white/75 leading-relaxed border-l-2 border-accent/40 pl-3 line-clamp-6">
                  &ldquo;{h.text}&rdquo;
                </blockquote>
              )}

              {/* Source */}
              <div className="mt-3 flex items-center gap-1 text-[11px] text-white/35">
                <LinkIcon />
                <span className="truncate max-w-[200px]">{h.source}</span>
              </div>
            </div>
          ))}
        </div>

        {folder.highlights.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-white/30 text-sm">This folder is empty.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CortexMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4" />
      <path d="M6 4v2l1.5 1.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3m0-3L5 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

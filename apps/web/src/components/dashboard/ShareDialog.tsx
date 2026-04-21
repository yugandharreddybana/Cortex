"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { DocsShareModal } from "./DocsShareModal";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShareDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  /** "h" for highlight, "f" for folder */
  type:  "h" | "f";
  id:    string;
  title: string;
}

// ─── Social deep-link helper ──────────────────────────────────────────────────
function handleSocialShare(
  platform: string,
  url: string,
  text: string,
) {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  const subj = encodeURIComponent("Check out this highlight");

  const urls: Record<string, string> = {
    whatsapp:  `https://api.whatsapp.com/send?text=${t}%20${u}`,
    twitter:   `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    linkedin:  `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    telegram:  `https://t.me/share/url?url=${u}&text=${t}`,
    gmail:     `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${subj}&body=${t}%20${u}`,
    outlook:   `https://outlook.live.com/mail/0/deeplink/compose?subject=${subj}&body=${t}%20${u}`,
  };

  const target = urls[platform];
  if (target) window.open(target, "_blank", "noopener,noreferrer");
}

// ─── Share targets ────────────────────────────────────────────────────────────
const SHARE_TARGETS = [
  { id: "whatsapp", label: "WhatsApp",  color: "#25D366", icon: <WhatsAppIcon /> },
  { id: "twitter",  label: "X",         color: "#ffffff", icon: <XPlatformIcon /> },
  { id: "linkedin", label: "LinkedIn",  color: "#0A66C2", icon: <LinkedInIcon /> },
  { id: "telegram", label: "Telegram",  color: "#2AABEE", icon: <TelegramIcon /> },
  { id: "gmail",    label: "Gmail",     color: "#EA4335", icon: <GmailIcon /> },
  { id: "outlook",  label: "Outlook",   color: "#0078D4", icon: <OutlookIcon /> },
  { id: "native",   label: "More",      color: "#ffffff", icon: <NativeShareIcon /> },
] as const;

// ─── AI source detection ─────────────────────────────────────────────────────
const AI_URL_PATTERNS = ["chatgpt.com", "claude.ai", "gemini.google.com", "openai.com", "bard.google.com"];

function isAIUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return AI_URL_PATTERNS.some((p) => lower.includes(p));
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ShareDialog({ open, onOpenChange, type, id, title }: ShareDialogProps) {
  const [copied, setCopied]           = React.useState(false);
  const [shareUrl, setShareUrl]       = React.useState("");
  const [creating, setCreating]       = React.useState(false);
  const [linkGenerated, setLinkGenerated] = React.useState(false);
  const [isGenerating, setIsGenerating]   = React.useState(false);
  const [exporting, setExporting] = React.useState<"doc" | "excel" | null>(null);
  const [accessOpen, setAccessOpen] = React.useState(false);

  // Preserve the last non-empty id/title so DocsShareModal keeps the correct
  // resourceId even after the parent nulls shareTarget (which makes id="").
  const stableId    = React.useRef(id);
  const stableTitle = React.useRef(title);
  if (id)    stableId.current    = id;
  if (title) stableTitle.current = title;

  // Look up the highlight to detect AI vs. web source
  const highlight = useDashboardStore((s) =>
    type === "h" ? s.highlights.find((h) => h.id === id) ?? null : null,
  );
  const isAIHighlight = type === "h" && (
    highlight?.topic === "AI Chat" || isAIUrl(highlight?.url)
  );
  // For web highlights, the public URL to share is the original source page
  const webSourceUrl = (!isAIHighlight && type === "h" && highlight?.url && highlight.url !== "#")
    ? highlight.url
    : null;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://cortex.app";
  const shareText = title.length > 80 ? title.slice(0, 80) + "…" : title;

    // Reset state on close
  React.useEffect(() => {
    if (!open) {
      setCopied(false);
      setLinkGenerated(false);
      setIsGenerating(false);
      setShareUrl("");
    }
  }, [open]);

  async function handleGenerateLink() {
    if (isAIHighlight) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/share", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          resourceType: type === "f" ? "FOLDER" : "HIGHLIGHT",
          resourceId:   Number(id),
        }),
      });
      const data: { hash: string } | null = res.ok ? await res.json() : null;
      if (data?.hash) {
        setShareUrl(`${origin}/share/${data.hash}`);
      } else {
        setShareUrl(`${origin}/share/${type}/${id}`);
      }
      setLinkGenerated(true);
    } catch {
      setShareUrl(`${origin}/share/${type}/${id}`);
      setLinkGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExport(format: "doc" | "excel") {
    setExporting(format);
    try {
      // Scope the export to what the user is sharing:
      //   highlight → only that highlight
      //   folder    → all highlights in the folder AND every sub-folder inside it
      const scope = type === "h" ? "highlight" : "folder";
      const idParam = type === "h"
        ? `&highlightId=${encodeURIComponent(id)}`
        : `&folderId=${encodeURIComponent(id)}`;
      const res = await fetch(`/api/export?format=${encodeURIComponent(format)}&scope=${scope}${idParam}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const ext = format === "doc" ? "docx" : "xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cortex_highlight.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded as ${format === "doc" ? "Document" : "Excel"}`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  async function handleCopy() {
    // For web highlights, copy the original source URL.
    // For folders and Cortex share links, copy the Cortex share link.
    const urlToCopy = webSourceUrl ?? shareUrl;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  async function handleNativeShare() {
    const urlToShare = webSourceUrl ?? shareUrl;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Cortex Highlight",
          text:  shareText,
          url:   urlToShare,
        });
      } catch {
        /* user cancelled — intentional no-op */
      }
    } else {
      toast.error("Native sharing not supported on this browser.");
    }
  }

  function handleTarget(platformId: string) {
    // Social sharing for web highlights uses the original source page URL.
    // For folders, the Cortex share link is used.
    const urlForSharing = webSourceUrl ?? shareUrl;
    if (platformId === "native") {
      handleNativeShare();
    } else {
      handleSocialShare(platformId, urlForSharing, shareText);
    }
  }

  return (
    <>
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
        </Dialog.Overlay>

        <Dialog.Content
          asChild
          onPointerDownOutside={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.20, 0.90, 0.30, 1.00] }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-md rounded-2xl",
                "bg-elevated/90 backdrop-blur-2xl border border-white/[0.06]",
                "shadow-spatial-lg",
                "p-6",
                "focus:outline-none",
              )}
            >
            {/* Header */}
            <Dialog.Title className="text-base font-semibold text-white/90 tracking-tight">
              Share {type === "f" ? "Folder" : "Highlight"}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-white/40 line-clamp-1">
              {title}
            </Dialog.Description>

            {/* ── Social share grid (hidden for AI highlights) ── */}
            {!isAIHighlight && (
            <div
              className={cn(
                "mt-6 flex gap-4 pb-3 overflow-x-auto snap-x",
                // Hide scrollbar across all browsers
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              )}
            >
              {SHARE_TARGETS.map((target) => (
                <button
                  key={target.id}
                  onClick={() => handleTarget(target.id)}
                  className="flex flex-col items-center gap-2 shrink-0 snap-start group"
                >
                  <div
                    className={cn(
                      "w-14 h-14 rounded-full",
                      "bg-white/[0.05] border border-white/10",
                      "flex items-center justify-center",
                      "hover:bg-white/[0.10] active:scale-95",
                      "transition-all duration-200",
                    )}
                  >
                    {target.icon}
                  </div>
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors duration-150">
                    {target.label}
                  </span>
                </button>
              ))}
            </div>
            )}

            {/* ── AI highlight notice OR copy link strip ── */}
            {isAIHighlight ? (
              <div className={cn(
                "flex items-start gap-3 p-3 mt-6 rounded-xl",
                "bg-amber-500/10 border border-amber-500/20",
              )}>
                <span className="text-amber-400 shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <p className="text-sm text-amber-300/90 leading-relaxed">
                  This is an AI-generated highlight from a private chat session and cannot be shared publicly.
                </p>
              </div>
            ) : !linkGenerated && !webSourceUrl ? (
              <div className="mt-4">
                <button
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                  className={cn(
                    "w-full h-10 rounded-xl text-sm font-medium",
                    "bg-accent hover:bg-accent/80 text-white",
                    "transition-all duration-200 disabled:opacity-50",
                  )}
                >
                  {isGenerating ? "Generating…" : "Generate Public Link"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-1 pl-3 bg-black/50 border border-white/10 rounded-xl mt-4">
                <input
                  readOnly
                  value={webSourceUrl ?? shareUrl}
                  className={cn(
                    "flex-1 min-w-0 bg-transparent text-sm text-white/60",
                    "outline-none truncate select-all",
                  )}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  className={cn(
                    "shrink-0 rounded-lg px-4 py-2 text-sm font-medium",
                    "transition-all duration-200",
                    copied
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-accent text-white hover:bg-accent/80",
                  )}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}

            {/* ── Export buttons ── */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => handleExport("doc")}
                disabled={exporting !== null}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-10 rounded-xl",
                  "bg-white/[0.05] border border-white/10",
                  "text-sm text-white/70 hover:text-white hover:bg-white/[0.10]",
                  "transition-all duration-200",
                  exporting && "opacity-50 cursor-not-allowed",
                )}
              >
                <DocIcon />
                {exporting === "doc" ? "Exporting…" : "Send as Document"}
              </button>
              <button
                onClick={() => handleExport("excel")}
                disabled={exporting !== null}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-10 rounded-xl",
                  "bg-white/[0.05] border border-white/10",
                  "text-sm text-white/70 hover:text-white hover:bg-white/[0.10]",
                  "transition-all duration-200",
                  exporting && "opacity-50 cursor-not-allowed",
                )}
              >
                <ExcelIcon />
                {exporting === "excel" ? "Exporting…" : "Send as Excel"}
              </button>
            </div>

            {/* ── Manage Access ── */}
            <button
              onClick={() => {
                onOpenChange(false);
                setAccessOpen(true);
              }}
              className={cn(
                "w-full flex items-center justify-center gap-2 h-10 rounded-xl mt-3",
                "bg-white/[0.03] border border-white/[0.06]",
                "text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.07]",
                "transition-all duration-200",
              )}
            >
              <AccessIcon />
              Manage Access
            </button>

            {/* Close */}
            <Dialog.Close asChild>
              <button
                className={cn(
                  "absolute top-4 right-4 w-6 h-6 rounded-md",
                  "flex items-center justify-center",
                  "text-white/30 hover:text-white/70",
                  "hover:bg-white/[0.08] transition-all duration-150",
                )}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </Dialog.Close>
          </motion.div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <DocsShareModal
      open={accessOpen}
      onOpenChange={setAccessOpen}
      resourceId={stableId.current}
      resourceType={type === "f" ? "FOLDER" : "HIGHLIGHT"}
      title={stableTitle.current}
      shareHash={shareUrl.split("/share/")[1]}
    />
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AccessIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l8 8M10 2l-8 8" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function XPlatformIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#2AABEE" aria-hidden="true">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M24 7.387v10.478c0 .23-.08.424-.238.576a.806.806 0 01-.59.236h-8.79v-6.09l1.61 1.167a.476.476 0 00.282.092.464.464 0 00.282-.092l7.444-5.378v-.001zm-1.003-1.463l-7.615 5.5-5.487-3.968-.075-.052v9.273H.81a.806.806 0 01-.59-.236A.77.77 0 01-.02 15.865V5.38c0-.568.18-1.04.54-1.418A1.74 1.74 0 011.84 3.4h7.864l5.025 3.67 8.271-1.146z" fill="#0078D4" />
      <path d="M7.2 8.4C5.688 8.4 4.8 9.636 4.8 12s.888 3.6 2.4 3.6c1.512 0 2.4-1.236 2.4-3.6S8.712 8.4 7.2 8.4zm0 6c-.696 0-1.2-.876-1.2-2.4s.504-2.4 1.2-2.4c.696 0 1.2.876 1.2 2.4s-.504 2.4-1.2 2.4z" fill="#0078D4" />
    </svg>
  );
}

function NativeShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

// ─── Reusable share icon for menus ────────────────────────────────────────────

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#4A90D9" strokeWidth="1.3" fill="none" />
      <path d="M10 1v4h4" stroke="#4A90D9" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 8h5M5.5 10.5h5M5.5 13h3" stroke="#4A90D9" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#217346" strokeWidth="1.3" fill="none" />
      <path d="M10 1v4h4" stroke="#217346" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 8l5 5M10.5 8l-5 5" stroke="#217346" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="2.5" r="1.5" />
      <circle cx="9" cy="9.5" r="1.5" />
      <circle cx="3" cy="6" r="1.5" />
      <path d="M4.3 5.2l3.4-1.9M4.3 6.8l3.4 1.9" />
    </svg>
  );
}

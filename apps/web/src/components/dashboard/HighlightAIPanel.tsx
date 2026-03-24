"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import type { Highlight } from "@/store/dashboard";
import { AIContextModal } from "./AIContextModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HighlightAIPanelProps {
  highlight: Highlight;
  onResultSaved: (patch: Partial<Pick<Highlight, "connectDotsResult" | "actionItemsResult" | "devilsAdvocateResult">>) => void;
}

type Tab = "connect" | "actions" | "factcheck";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAIText(h: Highlight): string {
  if (h.highlightType === "ai_chat" || h.topic === "AI Text") {
    return [h.aiContext && `Context: ${h.aiContext}`, h.aiResponse && `Response: ${h.aiResponse}`]
      .filter(Boolean)
      .join("\n") || h.text;
  }
  return h.fullText ?? h.text;
}

function getAIUrl(h: Highlight): string | undefined {
  if (h.highlightType === "ai_chat" || h.topic === "AI Text") return undefined;
  return h.url && h.url !== "#" ? h.url : undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HighlightAIPanel({ highlight: h, onResultSaved }: HighlightAIPanelProps) {
  const updateHighlight = useDashboardStore((s) => s.updateHighlight);
  const [expanded, setExpanded] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("connect");

  // Context modal for AI Chat highlights
  const [contextModalOpen, setContextModalOpen] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<Tab | null>(null);

  const isAIChat     = h.highlightType === "ai_chat" || h.topic === "AI Text";
  const needsContext = isAIChat && (!h.aiContext || !h.aiResponse);

  // Per-tab loading / result state (seeded from cached results)
  const [connectResult,  setConnectResult]  = React.useState(h.connectDotsResult ?? "");
  const [actionsResult,  setActionsResult]  = React.useState(h.actionItemsResult ?? "");
  const [factResult,     setFactResult]     = React.useState<{ score: number; warning: string } | null>(
    h.devilsAdvocateResult ? (() => { try { return JSON.parse(h.devilsAdvocateResult!); } catch { return null; } })() : null,
  );
  const [loading, setLoading] = React.useState<Tab | null>(null);

  const aiText = getAIText(h);
  const aiUrl  = getAIUrl(h);

  function handleTabClick(tab: Tab) {
    if (needsContext) {
      setPendingTab(tab);
      setContextModalOpen(true);
      if (!expanded) setExpanded(true);
      return;
    }
    setActiveTab(tab);
    if (!expanded) setExpanded(true);
  }

  async function handleGenerate() {
    if (loading) return;
    if (needsContext) {
      setPendingTab(activeTab);
      setContextModalOpen(true);
      return;
    }
    setLoading(activeTab);
    try {
      if (activeTab === "connect") {
        const res = await fetch("/api/ai/connect-dots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: aiText, url: aiUrl }),
        });
        if (res.ok) {
          const result = await res.text();
          setConnectResult(result);
          onResultSaved({ connectDotsResult: result });
        }
      } else if (activeTab === "actions") {
        const res = await fetch("/api/ai/suggest-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: aiText, url: aiUrl }),
        });
        if (res.ok) {
          const raw = await res.text();
          const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed: string[] = JSON.parse(cleaned);
          const result = JSON.stringify(parsed);
          setActionsResult(result);
          onResultSaved({ actionItemsResult: result });
        }
      } else if (activeTab === "factcheck") {
        const res = await fetch("/api/ai/devils-advocate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: aiText, url: aiUrl }),
        });
        if (res.ok) {
          const raw = await res.text();
          const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned) as { score: number; warning: string };
          setFactResult(parsed);
          onResultSaved({ devilsAdvocateResult: JSON.stringify(parsed) });
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(null);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "connect",   label: "Connect Dots" },
    { id: "actions",   label: "Action Items" },
    { id: "factcheck", label: "Fact Check"   },
  ];

  const hasResult = (tab: Tab) => {
    if (tab === "connect")   return !!connectResult;
    if (tab === "actions")   return !!actionsResult;
    if (tab === "factcheck") return !!factResult;
    return false;
  };

  return (
    <>
      {/* Collapsed toggle row */}
      <div
        className={cn(
          "mt-3 pt-3 border-t border-white/[0.06]",
          "flex items-center justify-between gap-2",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Collapsed: single button */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium",
              "px-2.5 py-1 rounded-lg",
              "bg-accent/10 text-accent border border-accent/20",
              "hover:bg-accent/20 transition-colors",
            )}
          >
            <SparkleIcon />
            ✦ AI Insights
          </button>
        )}

        {/* Expanded: tab row */}
        {expanded && (
          <div className="flex items-center gap-1 flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors",
                  activeTab === tab.id
                    ? "bg-accent/20 text-accent"
                    : "text-white/45 hover:text-white/70 hover:bg-white/[0.05]",
                  hasResult(tab.id) && activeTab !== tab.id && "after:content-['·'] after:text-accent after:ml-0.5",
                )}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => setExpanded(false)}
              className="ml-auto text-white/25 hover:text-white/60 transition-colors p-0.5 rounded"
              aria-label="Collapse AI panel"
            >
              <ChevronUpIcon />
            </button>
          </div>
        )}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2 pb-1">
              {/* Context badge for AI Chat */}
              {isAIChat && !needsContext && (
                <div className="mb-2 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/15 text-[10px] text-violet-300/80">
                  Using saved AI context for analysis
                </div>
              )}

              {/* Connect Dots */}
              {activeTab === "connect" && (
                <AITabContent
                  result={connectResult}
                  loading={loading === "connect"}
                  onGenerate={handleGenerate}
                  placeholder="Find semantic links and patterns across your highlights"
                  renderResult={(r) => (
                    <p className="text-xs text-white/75 leading-relaxed whitespace-pre-wrap">{r}</p>
                  )}
                />
              )}

              {/* Action Items */}
              {activeTab === "actions" && (
                <AITabContent
                  result={actionsResult}
                  loading={loading === "actions"}
                  onGenerate={handleGenerate}
                  placeholder="Extract 3 concrete action items from this highlight"
                  renderResult={(r) => {
                    let items: string[] = [];
                    try { items = JSON.parse(r) as string[]; } catch { items = [r]; }
                    return (
                      <ul className="space-y-1.5">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-white/75">
                            <span className="text-accent mt-0.5 shrink-0">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    );
                  }}
                />
              )}

              {/* Fact Check */}
              {activeTab === "factcheck" && (
                <AITabContent
                  result={factResult ? JSON.stringify(factResult) : ""}
                  loading={loading === "factcheck"}
                  onGenerate={handleGenerate}
                  placeholder="Analyze for biases, fallacies, or unverified claims"
                  renderResult={() => {
                    if (!factResult) return null;
                    const { score, warning } = factResult;
                    const isLow = score <= 3;
                    const isMid = score <= 6;
                    const badgeClass = isLow
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : isMid
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    const label = isLow ? "Low credibility" : isMid ? "Mixed" : "High credibility";
                    return (
                      <div className="space-y-2">
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border", badgeClass)}>
                          {label} — {score}/10
                        </div>
                        {/* Score bar */}
                        <div className="flex gap-0.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1 flex-1 rounded-sm",
                                i < score
                                  ? isLow ? "bg-red-400" : isMid ? "bg-amber-400" : "bg-emerald-400"
                                  : "bg-white/10",
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-white/65 leading-relaxed">{warning}</p>
                      </div>
                    );
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Context Modal for AI Chat highlights */}
      <AIContextModal
        highlight={h}
        open={contextModalOpen}
        onOpenChange={setContextModalOpen}
        onSuccess={() => {
          if (pendingTab) {
            setActiveTab(pendingTab);
            setPendingTab(null);
          }
        }}
      />
    </>
  );
}

// ─── AI Tab Content ───────────────────────────────────────────────────────────

function AITabContent({
  result,
  loading,
  onGenerate,
  placeholder,
  renderResult,
}: {
  result:        string;
  loading:       boolean;
  onGenerate:    () => void;
  placeholder:   string;
  renderResult:  (r: string) => React.ReactNode;
}) {
  return (
    <div className="min-h-[48px]">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/40 py-2">
          <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          Analyzing…
        </div>
      ) : result ? (
        <div className="space-y-2">
          {renderResult(result)}
          <button
            onClick={onGenerate}
            className="text-[10px] text-white/30 hover:text-accent transition-colors"
          >
            ↻ Regenerate
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-white/35 italic">{placeholder}</p>
          <button
            onClick={onGenerate}
            className={cn(
              "shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg",
              "bg-accent/10 text-accent border border-accent/20",
              "hover:bg-accent/20 transition-colors",
            )}
          >
            Generate
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M9 7.5L6 4.5L3 7.5" />
    </svg>
  );
}

"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { toast } from "sonner";

export default function DeveloperSettingsPage() {
  const apiKeys      = useDashboardStore((s) => s.apiKeys);
  const addApiKey    = useDashboardStore((s) => s.addApiKey);
  const deleteApiKey = useDashboardStore((s) => s.deleteApiKey);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [keyName, setKeyName]       = React.useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = React.useState<string | null>(null);

  const handleCreate = () => {
    if (!keyName.trim()) return;
    addApiKey(keyName);
    setKeyName("");
    setDialogOpen(false);
    // Get the newly created key
    const keys = useDashboardStore.getState().apiKeys;
    const latest = keys[keys.length - 1];
    if (latest) {
      setNewlyCreatedKey(latest.key);
      toast.success("API key created", { description: "Copy it now — it won't be shown again." });
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", {
      description: "You can now paste your API key into your integration code.",
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Developer Settings</h1>
        <p className="text-sm text-white/40 mt-1">Manage API keys and integrate Cortex into your workflow.</p>
      </div>

      {/* API Keys section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">API Keys</h2>
          <button
            onClick={() => setDialogOpen(true)}
            className={cn(
              "h-8 px-3.5 rounded-lg",
              "bg-white text-black text-xs font-medium",
              "hover:bg-gray-200 active:scale-95",
              "transition-all duration-150",
              "flex items-center gap-1.5",
            )}
          >
            <PlusIcon /> Generate Key
          </button>
        </div>

        {/* Newly created key banner */}
        <AnimatePresence>
          {newlyCreatedKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-emerald-400 font-medium mb-1">New API Key — copy it now</p>
                  <code className="text-xs text-white/80 font-mono break-all">{newlyCreatedKey}</code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(newlyCreatedKey)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="px-2 py-1.5 rounded-lg text-white/40 hover:text-white/70 text-xs transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keys table */}
        {apiKeys.length === 0 ? (
          <div className={cn(
            "rounded-xl p-8 text-center",
            "bg-white/[0.02] border border-dashed border-white/[0.08]",
          )}>
            <p className="text-sm text-white/40">No API keys yet</p>
            <p className="text-xs text-white/20 mt-1">Generate your first key to start using the Cortex API.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest">Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest">Key</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest">Created</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-widest" />
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-white/80 font-medium">{key.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-white/50 font-mono">
                        {key.key.slice(0, 12)}•••{key.key.slice(-4)}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          deleteApiKey(key.id);
                          toast.success("API key revoked", {
                            description: "The selected key will no longer be valid for API requests.",
                          });
                        }}
                        className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* API Documentation */}
      <div>
        <h2 className="text-sm font-semibold text-white/80 mb-4">Quick Start</h2>
        <div className={cn(
          "rounded-xl overflow-hidden",
          "bg-[#0d0d0d] border border-white/[0.08]",
        )}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-[11px] text-white/40 font-mono">curl</span>
            <button
              onClick={() => handleCopy(curlExample)}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              Copy
            </button>
          </div>
          <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono">
            <span className="text-emerald-400">curl</span>{" "}
            <span className="text-white/60">-X POST https://api.cortex.so/v1/highlights \</span>{"\n"}
            <span className="text-white/60">{"  "}-H </span>
            <span className="text-amber-400">&quot;Authorization: Bearer ctx_your_api_key&quot;</span>{" "}
            <span className="text-white/60">\</span>{"\n"}
            <span className="text-white/60">{"  "}-H </span>
            <span className="text-amber-400">&quot;Content-Type: application/json&quot;</span>{" "}
            <span className="text-white/60">\</span>{"\n"}
            <span className="text-white/60">{"  "}-d </span>
            <span className="text-purple-400">{`'{
    "text": "Your highlight text here",
    "source": "Source name",
    "url": "https://example.com"
  }'`}</span>
          </pre>
        </div>

        <div className={cn(
          "mt-4 rounded-xl overflow-hidden",
          "bg-[#0d0d0d] border border-white/[0.08]",
        )}>
          <div className="flex items-center px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-[11px] text-white/40 font-mono">Response — 201 Created</span>
          </div>
          <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono text-white/50">
{`{
  "id": "hl_abc123",
  "text": "Your highlight text here",
  "source": "Source name",
  "created_at": "2024-01-15T12:00:00Z"
}`}
          </pre>
        </div>
      </div>

      {/* Generate Key Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "w-full max-w-md",
              "rounded-2xl p-6",
              "bg-[#1a1a1a] border border-white/[0.10]",
              "shadow-[0_24px_64px_rgba(0,0,0,0.7)]",
            )}
          >
            <Dialog.Title className="text-sm font-semibold text-white mb-4">Generate API Key</Dialog.Title>
            <Dialog.Description className="text-xs text-white/40 mb-4">
              Give your key a descriptive name so you can identify it later.
            </Dialog.Description>

            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="e.g. Production Server"
              className={cn(
                "w-full px-3 py-2.5 rounded-xl mb-4",
                "bg-white/[0.05] border border-white/[0.10]",
                "text-sm text-white placeholder:text-white/30",
                "outline-none focus:border-accent/50 transition-colors caret-accent",
              )}
              autoFocus
            />

            <div className="flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleCreate}
                disabled={!keyName.trim()}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-medium",
                  "bg-white text-black",
                  "hover:bg-gray-200 active:scale-95",
                  "transition-all duration-150",
                  "disabled:opacity-40 disabled:pointer-events-none",
                )}
              >
                Generate
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

const curlExample = `curl -X POST https://api.cortex.so/v1/highlights \\
  -H "Authorization: Bearer ctx_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Your highlight text here",
    "source": "Source name",
    "url": "https://example.com"
  }'`;

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

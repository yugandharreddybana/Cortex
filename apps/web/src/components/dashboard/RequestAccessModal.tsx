"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { Loader2, ShieldCheck, ShieldAlert, Check } from "lucide-react";

// ─── Animation ────────────────────────────────────────────────────────────────
const ease = [0.16, 1, 0.3, 1] as const;

// ─── Component ────────────────────────────────────────────────────────────────
interface RequestAccessModalProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  folderId:     string;
  folderName:   string;
  currentRole?: string;
}

const ALL_ROLES = [
  {
    id: "COMMENTER",
    label: "Commenter",
    description: "Can view and leave comments on highlights.",
    icon: ShieldCheck,
  },
  {
    id: "EDITOR",
    label: "Editor",
    description: "Can create, edit, and delete highlights.",
    icon: ShieldCheck,
  },
];

// Role ordering for comparison
const ROLE_ORDER: Record<string, number> = { VIEWER: 0, COMMENTER: 1, EDITOR: 2, OWNER: 3 };

export function RequestAccessModal({ open, onOpenChange, folderId, folderName, currentRole }: RequestAccessModalProps) {
  const requestAccess = useDashboardStore((s) => s.requestAccess);

  // Only show roles strictly higher than the user's current role
  const currentRoleOrder = ROLE_ORDER[currentRole?.toUpperCase() ?? "VIEWER"] ?? 0;
  const availableRoles = ALL_ROLES.filter((r) => (ROLE_ORDER[r.id] ?? 0) > currentRoleOrder);

  const [selectedRole, setSelectedRole] = React.useState<string>("EDITOR");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset state on open — default to highest available role
  React.useEffect(() => {
    if (open) {
      const highest = availableRoles[availableRoles.length - 1];
      setSelectedRole(highest?.id ?? "EDITOR");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSendRequest() {
    setIsSubmitting(true);
    useDashboardStore.getState().setGlobalLoading(true);
    try {
      const res = await requestAccess(folderId, selectedRole);
      if (res.ok) {
        toast.success(`Request for ${selectedRole.toLowerCase()} access sent to owner.`);
        onOpenChange(false);
      } else if (res.status === 409) {
        toast.info("Request has been raised, we are waiting for the approval. You can ask the owner to approve it.");
        onOpenChange(false);
      } else {
        toast.error("Failed to send request.");
      }
    } catch (err: unknown) {
      toast.error("An error occurred while sending the request.");
    } finally {
      setIsSubmitting(false);
      useDashboardStore.getState().setGlobalLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 4 }}
                  transition={{ duration: 0.25, ease }}
                  className={cn(
                    "relative z-50 pointer-events-auto",
                    "w-full max-w-sm",
                    "rounded-2xl bg-[#171717] border border-white/[0.09]",
                    "shadow-[0_32px_64px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]",
                    "p-6",
                    "focus:outline-none",
                  )}
                >
                  <Dialog.Title className="text-base font-semibold tracking-tight mb-1">
                    Request access
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-white/40 mb-4">
                    Choose the level of access you need for &quot;{folderName}&quot;. The owner will be notified.
                  </Dialog.Description>

                  {currentRole && (
                    <div className="mb-6 flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <span className="text-xs text-white/40">Current Access</span>
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider">{currentRole}</span>
                    </div>
                  )}

                  <div className="space-y-3 mb-8">
                    {availableRoles.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role.id)}
                        className={cn(
                          "w-full text-left p-3.5 rounded-xl border transition-all duration-150",
                          "flex items-start gap-3.5 group",
                          selectedRole === role.id
                            ? "bg-accent/[0.08] border-accent/40 ring-1 ring-accent/20"
                            : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          selectedRole === role.id ? "bg-accent text-white" : "bg-white/5 text-white/40 group-hover:bg-white/10"
                        )}>
                          <role.icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium transition-colors",
                            selectedRole === role.id ? "text-white" : "text-white/80"
                          )}>
                            {role.label}
                          </p>
                          <p className="text-xs text-white/40 leading-relaxed mt-0.5">
                            {role.description}
                          </p>
                        </div>
                        {selectedRole === role.id && (
                          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2.5 justify-end">
                    <Dialog.Close asChild>
                      <button
                        className={cn(
                          "h-9 px-4 rounded-xl",
                          "text-sm text-white/60 hover:text-white",
                          "bg-white/[0.04] hover:bg-white/[0.08]",
                          "border border-white/[0.07]",
                          "transition-all duration-150",
                        )}
                      >
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      onClick={handleSendRequest}
                      disabled={isSubmitting}
                      className={cn(
                        "h-9 px-5 rounded-xl min-w-[120px]",
                        "text-sm font-medium text-white",
                        "bg-accent hover:bg-accent/90",
                        "shadow-[0_0_16px_rgba(108,99,255,0.3)]",
                        "transition-all duration-150",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
                      ) : (
                        "Send Request"
                      )}
                    </button>
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

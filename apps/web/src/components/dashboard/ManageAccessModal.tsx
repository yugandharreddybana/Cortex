"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Shield, Trash2, Check, AlertCircle, Loader2, UserPlus, Search } from "lucide-react";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";
import { toast } from "sonner";

interface ManageAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: number;
  resourceType: "FOLDER" | "HIGHLIGHT";
  resourceName: string;
}

interface PermissionItem {
  id: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  email?: string;
  accessLevel: "VIEWER" | "EDITOR" | "OWNER";
  avatarUrl?: string;
}

export function ManageAccessModal({
  open,
  onOpenChange,
  resourceId,
  resourceType,
  resourceName,
}: ManageAccessModalProps) {
  const [permissions, setPermissions] = React.useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingUpdates, setPendingUpdates] = React.useState<Record<number, string>>({});
  const [pendingRemovals, setPendingRemovals] = React.useState<Set<number>>(new Set());
  
  // Invitation State
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"VIEWER" | "EDITOR">("VIEWER");
  const [suggestions, setSuggestions] = React.useState<{ id: number; email: string; fullName: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const bulkManagePermissions = useDashboardStore((s) => s.bulkManagePermissions);

  React.useEffect(() => {
    if (open) {
      fetchPermissions();
      fetchCollaborators();
    } else {
      // Reset state on close
      setPendingUpdates({});
      setPendingRemovals(new Set());
      setInviteEmail("");
      setShowSuggestions(false);
    }
  }, [open, resourceId]);

  const fetchCollaborators = async () => {
    try {
      const resp = await fetch("/api/permissions/collaborators");
      if (resp.ok) {
        setSuggestions(await resp.json());
      }
    } catch (err) {
      console.error("Failed to fetch collaborators:", err);
    }
  };

  const fetchPermissions = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/permissions/${resourceId}?type=${resourceType}`);
      if (resp.ok) {
        const data = await resp.json();
        const normalized = Array.isArray(data)
          ? data.map((p: PermissionItem) => ({
              ...p,
              id: Number(p.id),
              userId: Number(p.userId),
              userEmail: p.userEmail || p.email,
              userName: p.userName || p.email,
            }))
          : [];
        setPermissions(normalized);
      } else {
        toast.error("Failed to load permissions");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while fetching permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = (userId: number, newRole: string) => {
    setPendingUpdates((prev) => ({ ...prev, [userId]: newRole }));
    setPendingRemovals((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleRemove = (userId: number) => {
    setPendingRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setPendingUpdates((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const handleAddMember = async () => {
    if (!inviteEmail.trim()) return;
    
    setIsSaving(true);
    try {
      const resp = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          resourceId,
          resourceType,
          accessLevel: inviteRole
        }),
      });

      if (resp.ok) {
        toast.success(`Access granted to ${inviteEmail}`);
        setInviteEmail("");
        fetchPermissions();
      } else {
        const err = await resp.json();
        toast.error(err.message || "Failed to grant access");
      }
    } catch (err) {
      toast.error("An error occurred while inviting user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    useDashboardStore.getState().setGlobalLoading(true);
    try {
      const updates = Object.entries(pendingUpdates).map(([userId, accessLevel]) => ({
        userId: Number(userId),
        accessLevel,
      }));
      const removals = Array.from(pendingRemovals);
 
      if (updates.length === 0 && removals.length === 0) {
        onOpenChange(false);
        return;
      }

      await bulkManagePermissions(resourceId, resourceType, updates, removals);
      toast.success("Permissions updated successfully");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update permissions");
    } finally {
      setIsSaving(false);
      useDashboardStore.getState().setGlobalLoading(false);
    }
  };

  const hasChanges = Object.keys(pendingUpdates).length > 0 || pendingRemovals.size > 0;

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
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#161616]/80 p-0 shadow-2xl backdrop-blur-xl focus:outline-none">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Manage Access
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-white/40">
                        {resourceName}
                      </Dialog.Description>
                    </div>
                  </div>
                  <Dialog.Close className="rounded-lg p-2 text-white/20 hover:bg-white/5 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar space-y-8">
                  {/* Add Member Section */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 px-1">
                      Add People
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors">
                          <Search className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search by email or name..."
                          value={inviteEmail}
                          onChange={(e) => {
                            setInviteEmail(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/30 focus:bg-white/[0.05] transition-all"
                        />
                        
                        {/* Suggestions Dropdown */}
                        <AnimatePresence>
                          {showSuggestions && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="absolute left-0 right-0 top-full mt-2 z-[60] bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
                            >
                              {suggestions
                                .filter(s => {
                                  const q = inviteEmail.toLowerCase();
                                  if (!q) return true;
                                  return (
                                    s.email.toLowerCase().includes(q) ||
                                    s.fullName.toLowerCase().includes(q)
                                  );
                                })
                                .slice(0, 8)
                                .map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      setInviteEmail(s.email);
                                      setShowSuggestions(false);
                                    }}
                                    className="w-full flex flex-col items-start px-4 py-2.5 hover:bg-white/5 text-left border-b border-white/5 last:border-0 transition-colors"
                                  >
                                    <span className="text-sm font-medium text-white/90">{s.fullName}</span>
                                    <span className="text-xs text-white/30">{s.email}</span>
                                  </button>
                                ))
                              }
                              {!suggestions.some((s) => {
                                const q = inviteEmail.toLowerCase();
                                if (!q) return true;
                                return s.email.toLowerCase().includes(q) || s.fullName.toLowerCase().includes(q);
                              }) && (
                                <div className="px-4 py-2.5 text-xs text-white/35">
                                  No existing collaborators found. You can invite by email.
                                </div>
                              )}
                              {inviteEmail.includes("@") && (
                                <button
                                  onClick={() => setShowSuggestions(false)}
                                  className="w-full px-4 py-2.5 hover:bg-white/5 text-left text-xs text-white/40 italic"
                                >
                                  Invite new user: {inviteEmail}
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as any)}
                        className="bg-white/[0.03] border border-white/5 border-transparent px-3 py-2 rounded-xl text-sm text-white/70 focus:outline-none focus:border-accent/30 transition-all cursor-pointer"
                      >
                        <option value="VIEWER" className="bg-[#1e1e1e]">Viewer</option>
                        <option value="EDITOR" className="bg-[#1e1e1e]">Editor</option>
                      </select>

                      <button
                        disabled={!inviteEmail || isSaving}
                        onClick={handleAddMember}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 px-1">
                      Collaborators
                    </label>

                    {isLoading ? (
                      <div className="flex h-40 flex-col items-center justify-center gap-3 text-white/20">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm">Fetching collaborators...</p>
                      </div>
                    ) : permissions.length === 0 ? (
                      <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-white/20">
                        <Users className="h-12 w-12 opacity-50" />
                        <p className="text-sm italic">No shared collaborators yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {permissions.map((perm) => {
                          const isRemoved = pendingRemovals.has(perm.userId);
                          const currentRole = pendingUpdates[perm.userId] || perm.accessLevel;
                          
                          return (
                            <div
                              key={perm.userId}
                              className={cn(
                                "group flex items-center justify-between rounded-xl border border-transparent p-3 transition-all duration-200",
                                isRemoved ? "bg-red-500/5 opacity-50 grayscale" : "hover:bg-white/5 hover:border-white/5"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-xs font-medium text-white/40">
                                  {(perm.userName || perm.userEmail || perm.email || "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {perm.userName || perm.userEmail || perm.email || "Unknown user"}
                                  </p>
                                  <p className="truncate text-xs text-white/30">
                                    {perm.userEmail || perm.email || ""}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {perm.accessLevel !== "OWNER" && (
                                  <>
                                    <select
                                      disabled={isRemoved || isSaving}
                                      value={currentRole}
                                      onChange={(e) => handleRoleChange(perm.userId, e.target.value)}
                                      className="bg-transparent text-xs text-white/60 focus:outline-none hover:text-white transition-colors cursor-pointer"
                                    >
                                      <option value="VIEWER" className="bg-[#1e1e1e]">Viewer</option>
                                      <option value="EDITOR" className="bg-[#1e1e1e]">Editor</option>
                                    </select>

                                    <button
                                      onClick={() => handleRemove(perm.userId)}
                                      className={cn(
                                        "p-2 rounded-lg transition-all",
                                        isRemoved 
                                          ? "text-accent hover:bg-accent/10" 
                                          : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
                                      )}
                                      title={isRemoved ? "Restore access" : "Remove access"}
                                    >
                                      {isRemoved ? <AlertCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                  </>
                                )}
                                {perm.accessLevel === "OWNER" && (
                                  <span className="px-2 py-1 rounded bg-white/5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                                    Owner
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-white/5 p-6 bg-white/[0.02] rounded-b-2xl">
                  <div className="text-xs text-white/30">
                    {hasChanges ? (
                      <span className="flex items-center gap-1.5 text-accent/80">
                        <Check className="h-3 w-3" />
                        Unsaved changes
                      </span>
                    ) : (
                      "No changes pending"
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => onOpenChange(false)}
                      className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!hasChanges || isSaving}
                      onClick={handleSave}
                      className={cn(
                        "relative flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200",
                        hasChanges && !isSaving
                          ? "bg-accent text-white shadow-glow hover:scale-105 active:scale-95"
                          : "bg-white/5 text-white/20 cursor-not-allowed"
                      )}
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

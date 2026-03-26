"use client";

/**
 * DocsShareModal — permission management and sharing dialog for highlights/folders.
 * Used in: ShareDialog.tsx (the "Manage access" button opens this modal).
 * TODO: Wire to notes/docs view when that feature is implemented.
 */

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessLevel = "VIEWER" | "COMMENTER" | "EDITOR";
type LinkAccess = "RESTRICTED" | "ANYONE_WITH_LINK";

interface Permission {
  id: string;
  email: string;
  userId: string;
  resourceId: string;
  resourceType: string;
  accessLevel: AccessLevel;
  createdAt: string;
}

interface DocsShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceType: "HIGHLIGHT" | "FOLDER";
  title: string;
  shareHash?: string;
  ownerEmail?: string;
}

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<AccessLevel, string> = {
  VIEWER: "Viewer",
  COMMENTER: "Commenter",
  EDITOR: "Editor",
};

const ROLE_OPTIONS: AccessLevel[] = ["VIEWER", "COMMENTER", "EDITOR"];

// ─── Component ────────────────────────────────────────────────────────────────

export function DocsShareModal({
  open,
  onOpenChange,
  resourceId,
  resourceType,
  title,
  shareHash,
  ownerEmail,
}: DocsShareModalProps) {
  const [emails, setEmails] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<AccessLevel>("VIEWER");
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = React.useState(true);
  const [linkAccess, setLinkAccess] = React.useState<LinkAccess>("RESTRICTED");
  const [defaultLinkRole, setDefaultLinkRole] = React.useState<AccessLevel>("VIEWER");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  // Synchronous guard — prevents double-submission when Enter key and Send
  // button fire in the same render cycle before setSending(true) re-renders.
  const sendingGuard = React.useRef(false);

  // Fetch permissions on open
  React.useEffect(() => {
    if (!open) return;
    // Don't fetch if resourceId is empty or not yet a server-assigned numeric ID
    if (!resourceId || !Number.isFinite(Number(resourceId)) || Number(resourceId) <= 0) return;

    setIsLoadingPermissions(true);
    fetch(`/api/permissions/${resourceId}?type=${resourceType}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setPermissions(Array.isArray(data) ? data : []);
      })
      .catch(() => setPermissions([]))
      .finally(() => setIsLoadingPermissions(false));

    // Fetch link access settings
    fetch(`/api/permissions/access-level?resourceId=${resourceId}&type=${resourceType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.linkAccess) setLinkAccess(data.linkAccess);
        if (data?.defaultLinkRole) setDefaultLinkRole(data.defaultLinkRole);
      })
      .catch(() => {});
  }, [open, resourceId, resourceType]);

  // ── Send invites ──────────────────────────────────────────────────────────

  async function handleSendInvites() {
    if (sendingGuard.current) return;

    const emailList = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (emailList.length === 0) {
      toast.error("Enter at least one email address");
      return;
    }

    const numId = Number(resourceId);
    if (!Number.isFinite(numId) || numId <= 0) {
      toast.error("This item hasn't synced with the server yet — please wait a moment and try again.");
      return;
    }

    sendingGuard.current = true;
    setSending(true);
    try {
      const res = await fetch("/api/share/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: numId,
          resourceType,
          emails: emailList,
          accessLevel: inviteRole,
          resourceTitle: title,
        }),
      });

      if (!res.ok) throw new Error("Failed to send invites");

      const data = await res.json() as {
        results: Array<{ email: string; status: string; emailSent?: boolean; error?: string }>;
      };
      const invited    = data.results?.filter((r) => r.status === "invited").length ?? 0;
      const emailsSent = data.results?.filter((r) => r.emailSent).length ?? 0;

      if (invited > 0 && emailsSent > 0) {
        toast.success(`${invited} invite${invited !== 1 ? "s" : ""} sent`);
      } else if (invited > 0) {
        toast.success(`Access granted to ${invited} user${invited !== 1 ? "s" : ""}`);
        toast.warning("Invite email could not be delivered — set RESEND_API_KEY in .env.local");
      } else {
        toast.error("No invites were sent — check that the emails are registered Cortex users");
      }
      setEmails("");

      // Refresh permissions list
      const permsRes = await fetch(
        `/api/permissions/${resourceId}?type=${resourceType}`,
      );
      if (permsRes.ok) setPermissions(await permsRes.json());
    } catch {
      toast.error("Failed to send invites");
    } finally {
      sendingGuard.current = false;
      setSending(false);
    }
  }

  // ── Update a person's role ────────────────────────────────────────────────

  async function handleRoleChange(permId: string, newRole: AccessLevel) {
    setPermissions((prev) =>
      prev.map((p) => (p.id === permId ? { ...p, accessLevel: newRole } : p)),
    );

    try {
      const res = await fetch(`/api/permissions/manage/${permId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessLevel: newRole }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to update role");
      // Refresh to revert
      const permsRes = await fetch(
        `/api/permissions/${resourceId}?type=${resourceType}`,
      );
      if (permsRes.ok) setPermissions(await permsRes.json());
    }
  }

  // ── Remove a person's access ──────────────────────────────────────────────

  async function handleRemove(permId: string) {
    setPermissions((prev) => prev.filter((p) => p.id !== permId));

    try {
      const res = await fetch(`/api/permissions/manage/${permId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Access removed");
    } catch {
      toast.error("Failed to remove access");
      const permsRes = await fetch(
        `/api/permissions/${resourceId}?type=${resourceType}`,
      );
      if (permsRes.ok) setPermissions(await permsRes.json());
    }
  }

  // ── Update link access settings ───────────────────────────────────────────

  async function handleLinkAccessChange(
    newLinkAccess: LinkAccess,
    newDefaultRole?: AccessLevel,
  ) {
    const la = newLinkAccess;
    const role = newDefaultRole ?? defaultLinkRole;

    setLinkAccess(la);
    if (newDefaultRole) setDefaultLinkRole(newDefaultRole);
    setLoading(true);

    try {
      const res = await fetch("/api/permissions/link-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: Number(resourceId),
          resourceType,
          linkAccess: la,
          defaultLinkRole: role,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to update link settings");
    } finally {
      setLoading(false);
    }
  }

  // ── Copy link ─────────────────────────────────────────────────────────────

  async function handleCopyLink() {
    const url = shareHash
      ? `${window.location.origin}/share/${shareHash}`
      : window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-full max-w-[500px] rounded-2xl bg-[#1a1a1a] border border-white/[0.08] shadow-2xl overflow-hidden">
                  {/* ── Header ── */}
                  <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                    <Dialog.Title className="text-[15px] font-semibold text-white">
                      Share &ldquo;{title}&rdquo;
                    </Dialog.Title>
                    <Dialog.Close className="rounded-full p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                      <CloseIcon />
                    </Dialog.Close>
                  </div>

                  {/* ── Section 1: Add people ── */}
                  <div className="px-6 pb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add people by email"
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendInvites();
                        }}
                        className="flex-1 h-10 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-colors"
                      />

                      <RoleDropdown
                        value={inviteRole}
                        onChange={setInviteRole}
                        size="sm"
                      />

                      <button
                        onClick={handleSendInvites}
                        disabled={sending || !emails.trim()}
                        className={cn(
                          "h-10 px-4 rounded-lg text-sm font-medium transition-all",
                          "bg-white text-black hover:bg-white/90",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                        )}
                      >
                        {sending ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-black/50" />
                            Sending…
                          </span>
                        ) : (
                          "Send"
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ── Section 1b: People with access ── */}
                  <div className="px-6 pb-4">
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
                      People with access
                    </p>

                    <div className="space-y-1 max-h-[180px] overflow-y-auto scrollbar-thin">
                      {/* Owner */}
                      {ownerEmail && (
                        <PersonRow
                          email={ownerEmail}
                          role="Owner"
                          isOwner
                        />
                      )}

                      {/* Invited users */}
                      {isLoadingPermissions ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="animate-spin text-white/30" size={20} />
                        </div>
                      ) : (
                        <>
                          {permissions.map((p) => (
                            <PersonRow
                              key={p.id}
                              email={p.email}
                              role={ROLE_LABELS[p.accessLevel]}
                              accessLevel={p.accessLevel}
                              onRoleChange={(role) =>
                                handleRoleChange(p.id, role)
                              }
                              onRemove={() => handleRemove(p.id)}
                            />
                          ))}

                          {permissions.length === 0 && !ownerEmail && (
                            <p className="text-sm text-white/30 py-2">
                              No one has been invited yet
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Section 2: General access ── */}
                  <div className="mx-6 mb-4 p-4 rounded-xl bg-[#121212] border border-white/[0.06]">
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
                      General access
                    </p>

                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          linkAccess === "RESTRICTED"
                            ? "bg-white/[0.08]"
                            : "bg-emerald-500/20",
                        )}
                      >
                        {linkAccess === "RESTRICTED" ? (
                          <LockIcon />
                        ) : (
                          <GlobeIcon />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <LinkAccessDropdown
                          value={linkAccess}
                          onChange={(v) => handleLinkAccessChange(v)}
                          disabled={loading}
                        />
                        <p className="text-xs text-white/30 mt-0.5">
                          {linkAccess === "RESTRICTED"
                            ? "Only people with access can open"
                            : "Anyone with the link can view"}
                        </p>
                      </div>

                      {linkAccess === "ANYONE_WITH_LINK" && (
                        <RoleDropdown
                          value={defaultLinkRole}
                          onChange={(r) =>
                            handleLinkAccessChange(linkAccess, r)
                          }
                          size="xs"
                        />
                      )}
                    </div>
                  </div>

                  {/* ── Footer: Copy link ── */}
                  <div className="px-6 pb-5 flex justify-between items-center">
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.1] transition-colors"
                    >
                      <LinkIcon />
                      Copy link
                    </button>

                    <button
                      onClick={() => onOpenChange(false)}
                      className="h-9 px-5 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
                    >
                      Done
                    </button>
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonRow({
  email,
  role,
  isOwner = false,
  accessLevel,
  onRoleChange,
  onRemove,
}: {
  email: string;
  role: string;
  isOwner?: boolean;
  accessLevel?: AccessLevel;
  onRoleChange?: (role: AccessLevel) => void;
  onRemove?: () => void;
}) {
  const initials = email
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.04] group">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{email}</p>
      </div>

      {isOwner ? (
        <span className="text-xs text-white/30 font-medium px-2">Owner</span>
      ) : (
        <div className="flex items-center gap-1">
          {onRoleChange && accessLevel && (
            <RoleDropdown
              value={accessLevel}
              onChange={onRoleChange}
              size="xs"
              showRemove
              onRemove={onRemove}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RoleDropdown({
  value,
  onChange,
  size = "sm",
  showRemove = false,
  onRemove,
  disabled = false,
}: {
  value: AccessLevel;
  onChange: (v: AccessLevel) => void;
  size?: "sm" | "xs";
  showRemove?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 rounded-lg border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors outline-none",
          size === "sm" ? "h-10 px-3 text-sm" : "h-7 px-2 text-xs",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {ROLE_LABELS[value]}
        <ChevronDownIcon />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="end"
          className="z-[200] min-w-[140px] rounded-xl bg-[#1e1e1e] border border-white/[0.1] shadow-2xl p-1 animate-in fade-in slide-in-from-top-1"
        >
          {ROLE_OPTIONS.map((role) => (
            <DropdownMenu.Item
              key={role}
              onSelect={() => onChange(role)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer outline-none",
                value === role
                  ? "text-white bg-white/[0.08]"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]",
              )}
            >
              {ROLE_LABELS[role]}
              {value === role && <CheckIcon />}
            </DropdownMenu.Item>
          ))}

          {showRemove && onRemove && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-white/[0.08]" />
              <DropdownMenu.Item
                onSelect={onRemove}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer outline-none text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Remove access
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function LinkAccessDropdown({
  value,
  onChange,
  disabled,
}: {
  value: LinkAccess;
  onChange: (v: LinkAccess) => void;
  disabled?: boolean;
}) {
  const labels: Record<LinkAccess, string> = {
    RESTRICTED: "Restricted",
    ANYONE_WITH_LINK: "Anyone with the link",
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        className="flex items-center gap-1 text-sm text-white font-medium hover:text-white/80 outline-none transition-colors"
      >
        {labels[value]}
        <ChevronDownIcon />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="start"
          className="z-[200] min-w-[200px] rounded-xl bg-[#1e1e1e] border border-white/[0.1] shadow-2xl p-1 animate-in fade-in slide-in-from-top-1"
        >
          <DropdownMenu.Item
            onSelect={() => onChange("RESTRICTED")}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer outline-none",
              value === "RESTRICTED"
                ? "bg-white/[0.08]"
                : "hover:bg-white/[0.06]",
            )}
          >
            <LockIcon />
            <div>
              <p className="text-sm text-white font-medium">Restricted</p>
              <p className="text-xs text-white/40">Only people with access</p>
            </div>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => onChange("ANYONE_WITH_LINK")}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer outline-none",
              value === "ANYONE_WITH_LINK"
                ? "bg-white/[0.08]"
                : "hover:bg-white/[0.06]",
            )}
          >
            <GlobeIcon />
            <div>
              <p className="text-sm text-white font-medium">
                Anyone with the link
              </p>
              <p className="text-xs text-white/40">
                Anyone on the internet can access
              </p>
            </div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-auto">
      <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white/50">
      <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-emerald-400">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5.5 8.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 5.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

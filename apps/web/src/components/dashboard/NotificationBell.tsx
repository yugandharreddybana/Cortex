"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@cortex/ui";
import { useDashboardStore, type NotificationItem } from "@/store/dashboard";
import { useShallow } from "zustand/react/shallow";
import { Loader } from "@/components/ui/Loader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationMetadata {
  permissionId?: string;
  resourceId?: string;
  resourceType?: string;
  resourceTitle?: string;
  senderName?: string;
  senderEmail?: string;
  requestId?: string;
  requestedLevel?: string;
  requesterName?: string;
  folderName?: string;
  requestedRole?: string;
}

// Local alias so all function signatures below stay unchanged
type Notification = NotificationItem;

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [respondingId, setRespondingId] = React.useState<string | null>(null);

  const { notifications, unreadNotifCount, fetchNotifications,
          removeNotification, markNotificationRead, markAllNotificationsRead } =
    useDashboardStore(
      useShallow((s) => ({
        notifications:            s.notifications,
        unreadNotifCount:         s.unreadNotifCount,
        fetchNotifications:       s.fetchNotifications,
        removeNotification:       s.removeNotification,
        markNotificationRead:     s.markNotificationRead,
        markAllNotificationsRead: s.markAllNotificationsRead,
      })),
    );

  // Load notifications once on mount
  React.useEffect(() => {
    setLoading(true);
    void fetchNotifications().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh list each time the popover opens (catches up on any missed WS events)
  React.useEffect(() => {
    if (open) {
      setLoading(true);
      void fetchNotifications().finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleClick(notification: Notification) {
    // If it's a pending share/access notification, row click is disabled anyway,
    // but if it's already responded, the user wants "nothing to happen".
    const isActionable = notification.type === "SHARE_INVITE" || notification.type === "ACCESS_REQUEST";
    if (isActionable && notification.responded) return;

    // Share invites also use buttons when pending — row click does nothing then either.
    if (notification.type === "SHARE_INVITE" && !notification.responded) return;

    // Mark as read
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: "PUT" });
        markNotificationRead(notification.id);
      } catch {
        // silent
      }
    }

    setOpen(false);

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  }

  async function handleAccessRequestResponse(notification: Notification, action: "APPROVE" | "REJECT") {
    const meta = parseMetadata(notification.metadata);
    if (!meta.requestId) return;

    setRespondingId(notification.id + ":" + action);
    try {
      const success = await useDashboardStore.getState().respondToAccessRequest(meta.requestId, action);
      if (success) {
        markNotificationRead(notification.id);
        removeNotification(notification.id);
        // Refresh folders so any permission change is reflected in store
        await useDashboardStore.getState().fetchFolders();
        const requesterName = meta.requesterName ?? "User";
        const folderName = meta.folderName ?? "the folder";
        if (action === "APPROVE") {
          toast.success(`Approved ${requesterName}'s request for "${folderName}"`);
        } else {
          toast("Request declined.");
        }
      } else {
        toast.error("Failed to respond to the request.");
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setRespondingId(null);
    }
  }

  async function handleRespond(notification: Notification, action: "accept" | "decline") {
    setRespondingId(notification.id + ":" + action);
    try {
      const res = await fetch(
        `/api/notifications/${notification.id}/respond?action=${action}`,
        { method: "PUT" },
      );
      if (res.ok) {
        markNotificationRead(notification.id);
        removeNotification(notification.id);
        if (action === "accept") {
          const store = useDashboardStore.getState();
          store.invalidateFolders();
          void store.fetchFolders();
        }
      }
    } catch {
      toast.error("Failed to respond to invite. Please try again.");
    } finally {
      setRespondingId(null);
    }
  }

  async function handleMarkAllRead(e: React.MouseEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PUT" });
      if (res.ok) {
        markAllNotificationsRead();
      } else {
        toast.error("Failed to mark all notifications as read.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    }
  }

  function parseMetadata(raw: string): NotificationMetadata {
    if (!raw) return {};
    try { return JSON.parse(raw) as NotificationMetadata; } catch { return {}; }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "relative w-9 h-9 rounded-xl",
            "flex items-center justify-center",
            "text-white/35 hover:text-white/65",
            "hover:bg-white/[0.05]",
            "transition-all duration-200 ease-spatial",
          )}
          aria-label="Notifications"
        >
          <BellIcon />
          {unreadNotifCount > 0 && (
            <span className="bg-danger w-2 h-2 rounded-full absolute top-0.5 right-0.5 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="center"
          className={cn(
            "z-50 w-80 rounded-2xl",
            "bg-elevated/90 backdrop-blur-2xl border border-white/[0.08]",
            "shadow-spatial-lg",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            "overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white/90">Notifications</span>
            {unreadNotifCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader size="md" variant="muted" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-2xl">🔔</span>
                <p className="text-xs text-white/30">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isShareInvite = n.type === "SHARE_INVITE";
                const isAccessRequest = n.type === "ACCESS_REQUEST";
                const pending = (isShareInvite || isAccessRequest) && !n.responded;
                const meta = (isShareInvite || isAccessRequest) ? parseMetadata(n.metadata) : null;

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "border-b border-white/[0.04] last:border-0",
                      !n.isRead && "bg-white/[0.03]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      disabled={pending}
                      className={cn(
                        "w-full text-left px-4 py-3 flex gap-3 items-start",
                        !pending && "hover:bg-white/[0.04] transition-colors",
                        pending && "cursor-default",
                      )}
                    >
                      {/* Unread dot */}
                      <div className="pt-1.5 shrink-0">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            n.isRead ? "bg-transparent" : "bg-accent",
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            n.isRead ? "text-white/50" : "text-white/90",
                          )}
                        >
                          {n.message}
                        </p>
                        {isShareInvite && meta?.resourceTitle && (
                          <p className="text-[11px] text-white/40 mt-0.5 truncate">
                            {meta.resourceType === "FOLDER" ? "📁" : "📌"}{" "}
                            {meta.resourceTitle}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-white/30">{timeAgo(n.createdAt)}</p>
                          {/* Responded status badge */}
                          {(n.responded === "accept" || n.responded === "approve") && (
                            <span className="text-[10px] text-emerald-400/80 font-medium">✓ Approved</span>
                          )}
                          {(n.responded === "decline" || n.responded === "reject") && (
                            <span className="text-[10px] text-red-400/60 font-medium">✗ Declined</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Accept / Decline buttons for pending share invites */}
                    {isShareInvite && pending && (
                      <div className="flex gap-2 px-4 pb-3 -mt-1">
                        <button
                          type="button"
                          onClick={() => handleRespond(n, "accept")}
                          disabled={respondingId !== null}
                          className={cn(
                            "flex-1 py-1.5 rounded-md text-[12px] font-semibold",
                            "bg-accent/20 text-accent hover:bg-accent/30",
                            "transition-colors disabled:opacity-50",
                          )}
                        >
                          {respondingId === n.id + ":accept" ? "…" : "Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(n, "decline")}
                          disabled={respondingId !== null}
                          className={cn(
                            "flex-1 py-1.5 rounded-md text-[12px] font-medium",
                            "bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white/70",
                            "transition-colors disabled:opacity-50",
                          )}
                        >
                          {respondingId === n.id + ":decline" ? "…" : "Decline"}
                        </button>
                      </div>
                    )}

                    {/* Approve / Reject buttons for pending access requests */}
                    {isAccessRequest && pending && (
                      <div className="flex gap-2 px-4 pb-3 -mt-1">
                        <button
                          type="button"
                          onClick={() => handleAccessRequestResponse(n, "APPROVE")}
                          disabled={respondingId !== null}
                          className={cn(
                            "flex-1 py-1.5 rounded-md text-[12px] font-semibold",
                            "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
                            "transition-colors disabled:opacity-50",
                          )}
                        >
                          {respondingId === n.id + ":APPROVE" ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccessRequestResponse(n, "REJECT")}
                          disabled={respondingId !== null}
                          className={cn(
                            "flex-1 py-1.5 rounded-md text-[12px] font-medium",
                            "bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400",
                            "transition-colors disabled:opacity-50",
                          )}
                        >
                          {respondingId === n.id + ":REJECT" ? "…" : "Reject"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}


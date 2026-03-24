"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import { cn } from "@cortex/ui";
import { useDashboardStore } from "@/store/dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationMetadata {
  permissionId?: string;
  resourceId?: string;
  resourceType?: string;
  resourceTitle?: string;
  senderName?: string;
  senderEmail?: string;
}

interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  actionUrl: string;
  type: string;
  metadata: string;
  responded: string;
  createdAt: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [respondingId, setRespondingId] = React.useState<string | null>(null);
  const intervalRef    = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const failureCount   = React.useRef(0);
  const [pollInterval, setPollInterval] = React.useState(15000);

  // Poll unread count and rebuild interval when pollInterval changes
  React.useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, pollInterval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval]);

  // Fetch full list when popover opens
  React.useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  async function fetchUnreadCount() {
    try {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
        failureCount.current = 0;
        setPollInterval(15000);
      } else if (res.status === 401) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        failureCount.current += 1;
        const next = Math.min(15000 * Math.pow(2, failureCount.current), 300000);
        setPollInterval(next);
      }
    } catch {
      failureCount.current += 1;
      const next = Math.min(15000 * Math.pow(2, failureCount.current), 300000);
      setPollInterval(next);
    }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
        setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleClick(notification: Notification) {
    // Share invite notifications use dedicated accept/decline buttons — skip row click
    if (notification.type === "SHARE_INVITE" && !notification.responded) return;

    // Mark as read
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: "PUT" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silent
      }
    }

    setOpen(false);

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
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
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true, responded: action } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        if (action === "accept") {
          useDashboardStore.getState().fetchFolders();
        }
      }
    } catch {
      // silent
    } finally {
      setRespondingId(null);
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent
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
          className={cn(
            "relative w-8 h-8 rounded-lg",
            "flex items-center justify-center",
            "text-white/40 hover:text-white/70",
            "hover:bg-white/[0.06]",
            "transition-all duration-150",
          )}
          aria-label="Notifications"
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="bg-red-500 w-2 h-2 rounded-full absolute top-0 right-0 animate-pulse" />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="center"
          className={cn(
            "z-50 w-80 rounded-xl",
            "bg-surface border border-white/10",
            "shadow-[0_16px_64px_rgba(0,0,0,0.5)]",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            "overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white/90">Notifications</span>
            {unreadCount > 0 && (
              <button
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
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-2xl">🔔</span>
                <p className="text-xs text-white/30">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isShareInvite = n.type === "SHARE_INVITE";
                const pending = isShareInvite && !n.responded;
                const meta = isShareInvite ? parseMetadata(n.metadata) : null;

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "border-b border-white/[0.04] last:border-0",
                      !n.isRead && "bg-white/[0.03]",
                    )}
                  >
                    <button
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
                          {n.responded === "accept" && (
                            <span className="text-[10px] text-emerald-400/80 font-medium">✓ Accepted</span>
                          )}
                          {n.responded === "decline" && (
                            <span className="text-[10px] text-red-400/60 font-medium">✗ Declined</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Accept / Decline buttons for pending share invites */}
                    {pending && (
                      <div className="flex gap-2 px-4 pb-3 -mt-1">
                        <button
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


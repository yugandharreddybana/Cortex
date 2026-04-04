import { StateCreator } from "zustand";
import { DashboardState, NotificationItem } from "../types";

export interface NotificationSlice {
  notifications: NotificationItem[];
  unreadNotifCount: number;
  fetchNotifications: () => Promise<void>;
  pushNotification: (n: NotificationItem) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

export const createNotificationSlice: StateCreator<DashboardState, [], [], NotificationSlice> = (set) => ({
  notifications: [],
  unreadNotifCount: 0,

  fetchNotifications: async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const list: NotificationItem[] = Array.isArray(data) ? data : [];
        set({ notifications: list, unreadNotifCount: list.filter((n) => !n.isRead).length });
      }
    } catch {
    }
  },

  pushNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)],
      unreadNotifCount: !n.isRead ? s.unreadNotifCount + 1 : s.unreadNotifCount,
    })),

  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  markNotificationRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      if (!target || target.isRead) return s;
      return {
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadNotifCount: Math.max(0, s.unreadNotifCount - 1),
      };
    }),

  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadNotifCount: 0,
    })),
});

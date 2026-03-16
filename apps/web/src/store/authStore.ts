"use client";

import { create } from "zustand";
import { useDashboardStore } from "@/store/dashboard";

export interface AuthUser {
  id:        string;
  email:     string;
  fullName:  string | null;
  avatarUrl: string | null;
  tier:      string;
  createdAt: string | null;
}

interface AuthState {
  user:       AuthUser | null;
  isLoading:  boolean;
  hasFetched: boolean;
  fetchUser:  () => Promise<void>;
  setUser:    (user: AuthUser | null) => void;
  updateUser: (patch: Partial<Pick<AuthUser, "fullName" | "email" | "avatarUrl">>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logout:     () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user:       null,
  isLoading:  false,
  hasFetched: false,

  fetchUser: async () => {
    // Prevent concurrent or duplicate fetches
    if (get().hasFetched || get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        set({ user: null, isLoading: false, hasFetched: true });
        // Only redirect if the token is genuinely expired (401) — the /api/auth/me
        // route already falls back to JWT claims for transient backend errors, so a
        // 401 here means the session is actually invalid.
        // Skip redirect if already on /login or /signup to avoid infinite loops.
        if (res.status === 401 && typeof window !== "undefined") {
          const path = window.location.pathname;
          if (!path.startsWith("/login") && !path.startsWith("/signup")) {
            const returnTo = path + window.location.search;
            window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
          }
        }
        return;
      }
      const data = await res.json() as { authenticated: boolean; user?: AuthUser };
      // no-op — the store is API-first, no vault needed
      set({
        user: data.authenticated && data.user ? data.user : null,
        isLoading: false,
        hasFetched: true,
      });
    } catch {
      set({ user: null, isLoading: false, hasFetched: true });
    }
  },

  setUser: (user) => {
    set({ user, hasFetched: true });
  },

  updateUser: async (patch) => {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return false;
      const data = await res.json() as AuthUser;
      set({ user: data });
      return true;
    } catch {
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) return { ok: true };
      const data = await res.json().catch(() => ({})) as { message?: string };
      return { ok: false, error: data.message ?? "Failed to change password" };
    } catch {
      return { ok: false, error: "Network error" };
    }
  },

  logout: () => {
    // Clear server-side session cookie (fire-and-forget)
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    useDashboardStore.getState().resetStore();
    set({ user: null, hasFetched: false });
  },
}));

import { StateCreator } from "zustand";
import { DashboardState } from "../types";
import { apiFetch } from "../helpers";

export interface APIKeySlice {
  apiKeys: Array<{ id: string; name: string; key: string; createdAt: string }>;
  lastCreatedApiKey: string | null;
  addApiKey: (name: string) => void;
  deleteApiKey: (id: string) => void;
  clearLastCreatedApiKey: () => void;
}

export const createAPIKeySlice: StateCreator<DashboardState, [], [], APIKeySlice> = (set) => ({
  apiKeys: [],
  lastCreatedApiKey: null,

  addApiKey: async (name) => {
    const { ok, data } = await apiFetch<any>(
      "/api/developer/api-keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      },
    );
    if (!ok || !data) return;
    const newKey = {
      id:        String(data.id),
      name:      data.name,
      key:       data.key,
      createdAt: data.createdAt ?? new Date().toISOString(),
    };
    set((s) => ({ apiKeys: [...s.apiKeys, newKey], lastCreatedApiKey: newKey.key }));
  },

  deleteApiKey: (id) => {
    set((s) => ({ apiKeys: s.apiKeys.filter((k) => k.id !== id) }));
    void apiFetch(`/api/developer/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  clearLastCreatedApiKey: () => set({ lastCreatedApiKey: null }),
});

import { StateCreator } from "zustand";
import { DashboardState, SmartCollection } from "../types";
import { apiFetch, nextLocalId } from "../helpers";

export interface SmartCollectionSlice {
  smartCollections: SmartCollection[];
  addSmartCollection: (name: string, tagIds: string[]) => void;
  deleteSmartCollection: (id: string) => void;
  fetchSmartCollections: () => Promise<void>;
}

export const createSmartCollectionSlice: StateCreator<DashboardState, [], [], SmartCollectionSlice> = (set) => ({
  smartCollections: [],

  addSmartCollection: async (name, tagIds) => {
    const trimmedName = name.trim();
    const localId = nextLocalId();
    set((s) => ({
      smartCollections: [...s.smartCollections, { id: localId, name: trimmedName, tagIds }],
    }));
    const { ok, data } = await apiFetch<any>(
      "/api/smart-collections",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, tagIds }),
      },
    );
    if (ok && data) {
      set((s) => ({
        smartCollections: s.smartCollections.map((c) =>
          c.id === localId ? { ...c, id: String(data.id) } : c,
        ),
      }));
    }
  },

  deleteSmartCollection: (id) => {
    set((s) => ({
      smartCollections: s.smartCollections.filter((c) => c.id !== id),
    }));
    if (!id.startsWith("local-")) {
      void apiFetch(`/api/smart-collections/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  },

  fetchSmartCollections: async () => {
    const { ok, data } = await apiFetch<any>(
      "/api/smart-collections",
    );
    if (ok && Array.isArray(data)) {
      set({
        smartCollections: data.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          tagIds: Array.isArray(c.tagIds) ? c.tagIds.map(String) : [],
        })),
      });
    }
  },
});

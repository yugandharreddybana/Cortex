import { StateCreator } from "zustand";
import { DashboardState, Tag } from "../types";
import { apiFetch, dedupById } from "../helpers";

export interface TagSlice {
  tags: Tag[];
  addTag: (name: string, color: string) => Promise<void>;
  updateTag: (id: string, name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => void;
  fetchTags: () => Promise<void>;
  setTagFilterExclusive: (tagIds: string[]) => void;
}

let tagsInFlight = false;

export const createTagSlice: StateCreator<DashboardState, [], [], TagSlice> = (set, get) => ({
  tags: [],

  fetchTags: async () => {
    if (tagsInFlight) return;
    tagsInFlight = true;
    try {
      const res = await fetch(`/api/tags`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const raw: Array<{ id: number; name: string; color?: string; createdAt?: string }> = Array.isArray(data) ? data : Array.isArray(data.tags) ? data.tags : [];
      const mapped = raw.map((t) => ({
        id: String(t.id),
        name: t.name,
        color: t.color ?? "",
        createdAt: t.createdAt || undefined
      }));
      set({ tags: dedupById(mapped) });
    } catch {
    } finally {
      tagsInFlight = false;
    }
  },

  addTag: async (name, color) => {
    const trimmedName = name.trim().slice(0, 50);
    if (!trimmedName) return;
    const { ok, data, status } = await apiFetch<{ id: number; name: string; color: string; createdAt?: string }>(
      "/api/tags",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, color }),
      },
    );
    if (!ok || !data) {
      if (status === 409) throw new Error("Tag already exists.");
      throw new Error("Failed to create tag.");
    }
    const newTag: Tag = { id: String(data.id), name: data.name, color: data.color, createdAt: data.createdAt };
    set((s) => ({
      tags: dedupById([...s.tags, newTag])
    }));
  },

  updateTag: async (id, name, color) => {
    const trimmedName = name.trim().slice(0, 50);
    if (!trimmedName) return;

    set((s) => ({
      tags: s.tags.map((t) => (t.id === id ? { ...t, name: trimmedName, color } : t)),
    }));

    const { ok, status } = await apiFetch(
      `/api/tags/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, color }),
      },
    );

    if (!ok) {
      await get().fetchTags();
      if (status === 409) throw new Error("Tag name already exists.");
      throw new Error("Failed to update tag.");
    }
  },

  deleteTag: (id) => {
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      activeTagFilters: s.activeTagFilters.filter((t) => t !== id),
      highlights: s.highlights.map((h) => ({
        ...h,
        tags: h.tags?.filter((tag) => String(tag.id) !== id),
      })),
    }));
    void apiFetch(`/api/tags/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  setTagFilterExclusive: (tagIds) => {
    set({ activeTagFilters: tagIds });
  },
});

import { StateCreator } from "zustand";
import { DashboardState, Folder } from "../types";
import { apiFetch, nextEmoji, dedupById } from "../helpers";

export interface FolderSlice {
  folders: Folder[];
  lastFoldersFetchAt: number;
  addFolder: (name: string, parentId?: string) => Promise<void>;
  deleteFolder: (id: string) => void;
  unshareFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => void;
  moveFolder: (id: string, newParentId: string | undefined) => void;
  setFolderEmoji: (id: string, emoji: string) => void;
  fetchFolders: () => Promise<void>;
  invalidateFolders: () => void;
  updateFolderSynthesis: (id: string, synthesis: string) => void;
  togglePinFolder: (id: string) => void;
}

let foldersInFlight = false;

export const createFolderSlice: StateCreator<DashboardState, [], [], FolderSlice> = (set, get) => ({
  folders: [],
  lastFoldersFetchAt: 0,

  fetchFolders: async () => {
    if (Date.now() - get().lastFoldersFetchAt < 30_000) return;
    if (foldersInFlight) return;
    foldersInFlight = true;
    try {
      const res = await fetch(`/api/folders`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const raw: Array<{ id: number; name: string; emoji?: string; parentId?: number; isPinned?: boolean; effectiveRole?: string; ownerId?: number }> = Array.isArray(data) ? data : Array.isArray(data.folders) ? data.folders : [];
      const mapped = raw.map((f) => ({
        id:            String(f.id),
        name:          f.name,
        emoji:         f.emoji ?? "",
        count:         0,
        parentId:      f.parentId != null ? String(f.parentId) : undefined,
        isPinned:      f.isPinned ?? false,
        effectiveRole: f.effectiveRole ?? undefined,
        ownerId:       f.ownerId != null ? String(f.ownerId) : undefined,
      }));
      set({ folders: dedupById(mapped), lastFoldersFetchAt: Date.now() });
      
      const { highlights } = get();
      const counts: Record<string, number> = {};
      for (const h of highlights) {
        if (h.folderId && !h.isArchived && !h.isDeleted) {
          counts[h.folderId] = (counts[h.folderId] ?? 0) + 1;
        }
      }
      set((s) => ({ folders: s.folders.map((f) => ({ ...f, count: counts[f.id] ?? 0 })) }));
    } catch {
    } finally {
      foldersInFlight = false;
    }
  },

  invalidateFolders: () => set({ lastFoldersFetchAt: 0 }),

  addFolder: async (name, parentId) => {
    const trimmedName = name.trim().slice(0, 100);
    if (!trimmedName) return;
    const emoji = nextEmoji();
    const numericParentId = parentId && /^\d+$/.test(parentId) ? Number(parentId) : null;
    const { ok, data, status } = await apiFetch<{ id: number; name: string; emoji: string; parentId?: number; isPinned: boolean }>(
      "/api/folders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, emoji, parentId: numericParentId, isPinned: false }),
      },
    );
    if (!ok || !data) {
      if (status === 409) throw new Error("A folder with this name already exists.");
      if (status === 403) throw new Error("You don't have permission to create folders here.");
      throw new Error("Failed to create folder.");
    }
    const newFolder: Folder = {
      id:       String(data.id),
      name:     data.name,
      emoji:    data.emoji ?? emoji,
      count:    0,
      parentId: data.parentId != null ? String(data.parentId) : parentId,
      isPinned: data.isPinned ?? false,
    };
    set((s) => ({
      folders: dedupById([...s.folders, newFolder])
    }));
    get().invalidateFolders();
  },

  deleteFolder: async (id) => {
    const state = get();
    const idsToDelete = new Set<string>();
    const childrenMap = new Map<string, string[]>();
    for (const f of state.folders) {
      if (f.parentId) {
        const pid = String(f.parentId);
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(String(f.id));
      }
    }
    const collectChildren = (parentId: string) => {
      idsToDelete.add(parentId);
      (childrenMap.get(parentId) || []).forEach(childId => {
        if (!idsToDelete.has(childId)) collectChildren(childId);
      });
    };
    collectChildren(String(id));

    set((s) => ({
      folders: s.folders.filter((f) => !idsToDelete.has(String(f.id))),
      highlights: s.highlights.map((h) => 
        h.folderId && idsToDelete.has(String(h.folderId)) 
          ? { ...h, folderId: undefined, folder: undefined } 
          : h
      ),
      activeFolder: s.activeFolder && idsToDelete.has(String(s.activeFolder)) ? null : s.activeFolder
    }));

    await apiFetch(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
    get().invalidateFolders();
  },

  unshareFolder: async (id) => {
    get().setGlobalLoading(true);
    try {
      const { ok } = await apiFetch<any>(`/api/folders/${encodeURIComponent(id)}/unshare`, { method: "POST" });
      if (ok) {
        set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
        get().invalidateFolders();
      }
    } finally {
      get().setGlobalLoading(false);
    }
  },

  renameFolder: (id, name) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
    }));
    get().invalidateFolders();
    void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  },

  moveFolder: (id, newParentId) => {
    const state = get();
    if (id === newParentId) return;
    const childrenMap = new Map<string, string[]>();
    for (const f of state.folders) {
      if (f.parentId) {
        if (!childrenMap.has(f.parentId)) childrenMap.set(f.parentId, []);
        childrenMap.get(f.parentId)!.push(f.id);
      }
    }
    const isDescendant = (parentId: string, targetId: string): boolean => {
      const children = childrenMap.get(parentId) || [];
      for (const childId of children) {
        if (childId === targetId) return true;
        if (isDescendant(childId, targetId)) return true;
      }
      return false;
    };
    if (newParentId && isDescendant(id, newParentId)) return;
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)),
    }));
    get().invalidateFolders();
    void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: newParentId ?? null }),
    });
  },

  setFolderEmoji: (id, emoji) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, emoji } : f)),
    }));
    get().invalidateFolders();
    void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  },

  updateFolderSynthesis: (id, synthesis) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, synthesis } : f)),
    }));
  },

  togglePinFolder: (id) => {
    const target = get().folders.find((f) => f.id === id);
    if (!target) return;
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isPinned: !f.isPinned } : f,
      ),
    }));
    get().invalidateFolders();
    void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !target.isPinned }),
    });
  },
});

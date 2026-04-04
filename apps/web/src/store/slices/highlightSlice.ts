import { StateCreator } from "zustand";
import { DashboardState, Highlight, Tag } from "../types";
import { apiFetch } from "../helpers";

export interface HighlightSlice {
  highlights: Highlight[];
  trash: Highlight[];
  isSearching: boolean;
  addHighlight: (h: Pick<Highlight, "text" | "source"> & { folderId?: string, tagIds?: string[], url?: string }) => Promise<boolean>;
  updateHighlight: (id: string, patch: Partial<Highlight> & { tagIds?: string[] }) => Promise<void>;
  moveHighlight: (id: string, folderId: string | null, folderName?: string) => void;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  togglePinHighlight: (id: string) => void;
  deleteHighlight: (id: string) => void;
  restoreHighlight: (id: string) => Promise<void>;
  searchHighlights: (query: string) => Promise<void>;
  fetchTrash: () => Promise<void>;
}

export const createHighlightSlice: StateCreator<DashboardState, [], [], HighlightSlice> = (set, get) => ({
  highlights: [],
  trash: [],
  isSearching: false,

  addHighlight: async ({ text, source, folderId, tagIds, url: explicitUrl }) => {
    if (!text || text.trim().length === 0) return false;
    const trimmedText = text.trim();
    const displayText = trimmedText.length > 500 ? trimmedText.slice(0, 500) : trimmedText;
    const numericFolderId = folderId && /^\d+$/.test(folderId) ? Number(folderId) : null;

    const isUrl = explicitUrl
      ? true
      : source.trim().startsWith("http://") || source.trim().startsWith("https://");
    const resolvedUrl = explicitUrl ?? (isUrl ? source.trim() : "#");
    const resolvedSource = isUrl && !explicitUrl
      ? (() => { try { return new URL(source.trim()).hostname; } catch { return source.trim(); } })()
      : source.trim() || "Manual entry";

    interface HighlightCreateResponse {
      id: number;
      text: string;
      source: string;
      url: string;
      topic: string;
      topicColor: string;
      savedAt: string;
      folder?: string;
      folderId?: number;
      note?: string;
      tags: Tag[];
      isCode: boolean;
      isFavorite: boolean;
      isArchived: boolean;
      isPinned: boolean;
      highlightColor?: string;
    }

    const { ok, data } = await apiFetch<HighlightCreateResponse>(
      "/api/highlights",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: displayText,
          source: resolvedSource,
          url: resolvedUrl,
          topic: "Manual",
          topicColor: "bg-purple-500/20 text-purple-300",
          savedAt: new Date().toISOString(),
          folder: null,
          folderId: numericFolderId,
          note: null,
          tags: tagIds ?? [],
          isCode: false,
          isFavorite: false,
          isArchived: false,
          isPinned: false,
          highlightColor: null,
        }),
      },
    );
    if (!ok || !data) return false;

    const newH: Highlight = {
      id:         String(data.id ?? ""),
      text:       String(data.text ?? displayText),
      source:     String(data.source ?? "Manual entry"),
      url:        String(data.url ?? "#"),
      topic:      String(data.topic ?? "Manual"),
      topicColor: String(data.topicColor ?? "bg-purple-500/20 text-purple-300"),
      savedAt:    String(data.savedAt ?? new Date().toISOString()),
      folder:     data.folder != null ? String(data.folder) : undefined,
      folderId:   data.folderId != null ? String(data.folderId) : folderId,
      note:       data.note != null ? String(data.note) : undefined,
      tags:       Array.isArray(data.tags) ? data.tags : [],
      isCode:     Boolean(data.isCode),
      isFavorite: Boolean(data.isFavorite),
      isArchived: Boolean(data.isArchived),
      isPinned:   Boolean(data.isPinned),
      highlightColor: data.highlightColor != null ? String(data.highlightColor) : undefined,
      highlightType: (String(data.url ?? "#") !== "#" ? "web" : String(data.topic ?? "Manual") === "AI Text" ? "ai_chat" : "manual") as "web" | "ai_chat" | "manual",
      isTruncated: trimmedText.length > 500,
      fullText:   trimmedText.length > 500 ? trimmedText : undefined,
    };

    set((s) => {
      if (s.highlights.some((h) => h.id === newH.id)) return s;
      return { highlights: [newH, ...s.highlights] };
    });
    return true;
  },

  updateHighlight: async (id, patch) => {
    const { tags: allTags } = get();

    // Optimistic update
    set((s) => ({
      highlights: s.highlights.map((h) => {
        if (h.id !== id) return h;
        
        const next = { ...h, ...patch };
        
        // If tagIds changed, sync the full 'tags' objects for the UI
        if (patch.tagIds !== undefined) {
          next.tags = patch.tagIds
            .map(tid => allTags.find(t => String(t.id) === String(tid)))
            .filter((t): t is Tag => !!t);
        }
        
        return next;
      }),
    }));

    const body: Record<string, unknown> = { ...patch };
    // Numeric folderId for backend
    if (patch.folderId !== undefined) {
      body.folderId = patch.folderId && /^\d+$/.test(patch.folderId) ? Number(patch.folderId) : 0;
    }

    await apiFetch(`/api/highlights/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  moveHighlight: (id, folderId, folderName) => {
    get().updateHighlight(id, { folderId: folderId ?? undefined, folder: folderName });
  },

  toggleFavorite: (id) => {
    const target = get().highlights.find((h) => h.id === id);
    if (!target) return;
    set((s) => ({
      highlights: s.highlights.map((h) =>
        h.id === id ? { ...h, isFavorite: !h.isFavorite } : h,
      ),
    }));
    void apiFetch(`/api/highlights/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !target.isFavorite }),
    });
  },

  toggleArchive: (id) => {
    const target = get().highlights.find((h) => h.id === id);
    if (!target) return;
    set((s) => ({
      highlights: s.highlights.map((h) =>
        h.id === id ? { ...h, isArchived: !h.isArchived } : h,
      ),
    }));
    void apiFetch(`/api/highlights/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !target.isArchived }),
    });
  },

  togglePinHighlight: (id) => {
    const target = get().highlights.find((h) => h.id === id);
    if (!target) return;
    set((s) => ({
      highlights: s.highlights.map((h) =>
        h.id === id ? { ...h, isPinned: !h.isPinned } : h,
      ),
    }));
    void apiFetch(`/api/highlights/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !target.isPinned }),
    });
  },

  deleteHighlight: (id) => {
    const state = get();
    const target = state.highlights.find((h) => h.id === id);
    set((s) => ({
      highlights: s.highlights.filter((h) => h.id !== id),
      trash: target ? [target, ...s.trash] : s.trash,
    }));
    void apiFetch(`/api/highlights/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  restoreHighlight: async (id) => {
    const { ok, data } = await apiFetch<Highlight>(`/api/highlights/${encodeURIComponent(id)}/restore`, {
      method: "POST"
    });

    if (ok && data) {
      set((s) => ({
        trash: s.trash.filter((h) => h.id !== id),
        highlights: [data, ...s.highlights.filter((h) => h.id !== data.id)],
      }));
    }
  },

  searchHighlights: async (query) => {
    if (!query.trim()) return;
    set({ isSearching: true });
    try {
      const { ok, data } = await apiFetch<Highlight[]>(`/api/highlights/search?q=${encodeURIComponent(query)}`);
      if (ok && data) {
        set({ highlights: data });
      }
    } finally {
      set({ isSearching: false });
    }
  },

  fetchTrash: async () => {
    const { ok, data } = await apiFetch<Highlight[]>("/api/highlights?includeDeleted=true");
    if (ok && data) {
      set({ trash: data });
    }
  },
});

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOrder = "recent" | "oldest" | "site";

export interface Folder {
  id:       string;
  name:     string;
  emoji:    string;
  count:    number;
  parentId?: string; // null/undefined = root
  isPinned?: boolean;
  linkAccess?: string;      // RESTRICTED, PUBLIC
  defaultLinkRole?: string; // VIEWER, COMMENTER, EDITOR
  // RBAC (Phase 2)
  effectiveRole?: string;   // OWNER | EDITOR | COMMENTER | VIEWER
  createdAt?: string;
  updatedAt?: string;
  synthesis?: string;
}

export interface SmartCollection {
  id:       string;
  name:     string;
  tagIds:   string[];  // intersection filter
}

export interface Tag {
  id:    string;
  name:  string;
  color: string; // tailwind color key e.g. "blue" | "violet" | "emerald" …
}

export interface Highlight {
  id:         string;
  text:       string;
  source:     string;
  url:        string;
  topic:      string;
  topicColor: string;
  savedAt:    string;
  folder?:    string; // display name of the folder
  folderId?:  string; // id of the folder
  note?:      string;
  tags?:      string[]; // Tag ids
  isCode?:    boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned?:  boolean;
  highlightColor?: string; // hex color for color-coded highlights
  resourceType?: "TEXT" | "VIDEO";
  videoTimestamp?: number;
  linkAccess?: string;      // RESTRICTED, PUBLIC
  defaultLinkRole?: string; // VIEWER, COMMENTER, EDITOR
  isDeleted?: boolean;      // Soft deletion support
  // Added for UI logic for large highlights
  isTruncated?: boolean;
  fullText?: string;
}

interface DashboardState {
  // UI
  sidebarCollapsed: boolean;
  activeFolder:     string | null;
  sortOrder:        SortOrder;

  // View / filter
  viewMode:            "grid" | "list";
  activeDomainFilters: string[];
  activeTagFilters:    string[];
  searchQuery:         string;

  // Multi-select
  selectedHighlightIds: string[];

  // Folders
  folders: Folder[];

  // Smart Collections
  smartCollections: SmartCollection[];

  // Tags
  tags: Tag[];

  // Highlights
  highlights: Highlight[];

  // Actions
  setSidebarCollapsed: (v: boolean) => void;
  setActiveFolder:     (id: string | null) => void;
  setSortOrder:        (order: SortOrder) => void;
  toggleSidebar:       () => void;
  setViewMode:              (mode: "grid" | "list") => void;
  toggleDomainFilter:       (domain: string) => void;
  toggleTagFilter:          (tagId: string) => void;
  setSearchQuery:           (q: string) => void;
  toggleHighlightSelect:    (id: string) => void;
  selectAllHighlights:      (ids: string[]) => void;
  clearHighlightSelection:  () => void;
  addFolder:           (name: string, parentId?: string) => void;
  deleteFolder:        (id: string) => void;
  renameFolder:        (id: string, name: string) => void;
  moveFolder:          (id: string, newParentId: string | undefined) => void;
  setFolderEmoji:      (id: string, emoji: string) => void;
  addTag:              (name: string, color: string) => void;
  deleteTag:           (id: string) => void;
  addHighlight:        (h: Pick<Highlight, "text" | "source"> & { folderId?: string, tags?: string[] }) => Promise<boolean>;
  updateHighlight:     (id: string, patch: Partial<Pick<Highlight, "note" | "tags" | "highlightColor">>) => void;
  moveHighlight:       (id: string, folderId: string, folderName: string) => void;
  toggleFavorite:      (id: string) => void;
  toggleArchive:       (id: string) => void;
  togglePinHighlight:  (id: string) => void;
  togglePinFolder:     (id: string) => void;
  populateDemoData:    () => void;

  // Smart Collections
  addSmartCollection:    (name: string, tagIds: string[]) => void;
  deleteSmartCollection: (id: string) => void;

  // API Keys
  apiKeys: Array<{ id: string; name: string; key: string; createdAt: string }>;
  addApiKey:    (name: string) => void;
  deleteApiKey: (id: string) => void;

  // Trash / undo
  trash:               Highlight[];
  deleteHighlight:     (id: string) => void;
  restoreHighlight:    (id: string) => void;

  // Loading skeleton
  isLoading:              boolean;
  setIsLoading:           (v: boolean) => void;

  // Keyboard focus navigation
  focusedHighlightIdx:    number;
  setFocusedHighlightIdx: (n: number) => void;

  // Dialog triggers (for command palette)
  newFolderDialogOpen:       boolean;
  newHighlightDialogOpen:    boolean;
  setNewFolderDialogOpen:    (v: boolean) => void;
  setNewHighlightDialogOpen: (v: boolean) => void;

  // Folder hydration
  fetchFolders: () => Promise<void>;
  // Tag hydration
  fetchTags: () => Promise<void>;

  // Reset all user data (clears on logout)
  resetStore: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMOJIS = ["📁", "🔬", "🎨", "⚙️", "📦", "✨", "🌐", "💡", "🧠", "📝"];
let emojiIdx = 0;

function nextEmoji() {
  const e = EMOJIS[emojiIdx % EMOJIS.length];
  emojiIdx++;
  return e;
}

/** Remove duplicate entries by string-coerced id. First occurrence wins. */
function dedupFolders<T extends { id: string | number }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const sid = String(item.id);
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
}

// Client-side ID counter for local-only entities (SmartCollections)
let _localIdCounter = 0;
function nextLocalId(): string { return `local-${++_localIdCounter}`; }

// Convenience wrapper for API calls (returns parsed JSON or null)
async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: T | null; status: number }> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) return { ok: false, data: null, status: res.status };
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T) : null;
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0 };
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

// Module-level in-flight flags to prevent concurrent fetches across React re-renders
let foldersInFlight = false;
let tagsInFlight = false;

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set, get) => ({
      sidebarCollapsed: false,
      activeFolder:     null,
      sortOrder:        "recent",
      viewMode:            "grid",
      activeDomainFilters: [],
      activeTagFilters:    [],
      searchQuery:         "",
      selectedHighlightIds: [],

      folders: [],

      // Fetch folders from backend and hydrate store
      fetchFolders: async () => {
        if (foldersInFlight) return;
        foldersInFlight = true;
        try {
          const res = await fetch(`/api/folders`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          // Normalize to string IDs so the store is always consistent with useServerSync
          const raw: Array<{ id: string | number; name: string; emoji?: string; parentId?: string | number | null; isPinned?: boolean; effectiveRole?: string }> =
            Array.isArray(data) ? data : Array.isArray(data.folders) ? data.folders : [];
          const mapped = raw.map((f) => ({
            id:            String(f.id),
            name:          f.name,
            emoji:         f.emoji ?? "",
            count:         0,
            parentId:      f.parentId != null ? String(f.parentId) : undefined,
            isPinned:      f.isPinned ?? false,
            effectiveRole: f.effectiveRole ?? undefined,
          }));
          set({ folders: dedupFolders(mapped) });
        } catch {
          // Keep existing folders on error — don't clear them
        } finally {
          foldersInFlight = false;
        }
      },

      // Fetch tags from backend and hydrate store
      fetchTags: async () => {
        if (tagsInFlight) return;
        tagsInFlight = true;
        try {
          const res = await fetch(`/api/tags`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          // Normalize to string IDs so the store is always consistent with useServerSync
          const raw: Array<{ id: string | number; name: string; color?: string }> =
            Array.isArray(data) ? data : Array.isArray(data.tags) ? data.tags : [];
          const mapped = raw.map((t) => ({ id: String(t.id), name: t.name, color: t.color ?? "" }));
          set({ tags: dedupFolders(mapped) });
        } catch {
          // Keep existing tags on error — don't clear them
        } finally {
          tagsInFlight = false;
        }
      },

      smartCollections: [],
      apiKeys: [],

      tags: [],

      highlights: [],

      trash:                     [],
      isLoading:                 false,
      focusedHighlightIdx:       0,
      newFolderDialogOpen:       false,
      newHighlightDialogOpen:    false,

      setSidebarCollapsed: (v)     => set({ sidebarCollapsed: v }),
      setActiveFolder: (id) => {
        set({ activeFolder: id, isLoading: true });
        setTimeout(() => set({ isLoading: false }), 300);
      },
      setSortOrder:        (order) => set({ sortOrder: order }),
      toggleSidebar:       ()      => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleDomainFilter: (domain) =>
        set((s) => ({
          activeDomainFilters: s.activeDomainFilters.includes(domain)
            ? s.activeDomainFilters.filter((d) => d !== domain)
            : [...s.activeDomainFilters, domain],
        })),

      toggleTagFilter: (tagId) =>
        set((s) => ({
          activeTagFilters: s.activeTagFilters.includes(tagId)
            ? s.activeTagFilters.filter((t) => t !== tagId)
            : [...s.activeTagFilters, tagId],
        })),

      setSearchQuery: (q) => set({ searchQuery: q }),

      toggleHighlightSelect: (id) =>
        set((s) => ({
          selectedHighlightIds: s.selectedHighlightIds.includes(id)
            ? s.selectedHighlightIds.filter((x) => x !== id)
            : [...s.selectedHighlightIds, id],
        })),

      selectAllHighlights: (ids) => set({ selectedHighlightIds: ids }),

      clearHighlightSelection: () => set({ selectedHighlightIds: [] }),

      addFolder: async (name, parentId) => {
        const trimmedName = name.trim().slice(0, 100);
        if (!trimmedName) return;
        const emoji = nextEmoji();
        const numericParentId = parentId && /^\d+$/.test(parentId) ? Number(parentId) : null;
        const { ok, data } = await apiFetch<{ id: number; name: string; emoji: string; parentId: number | null; isPinned: boolean }>(
          "/api/folders",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedName, emoji, parentId: numericParentId, isPinned: false }),
          },
        );
        if (!ok || !data) return;
        const newFolder = {
          id:       String(data.id),
          name:     data.name,
          emoji:    data.emoji ?? emoji,
          count:    0,
          parentId: data.parentId != null ? String(data.parentId) : parentId,
          isPinned: data.isPinned ?? false,
        };
        set((s) => {
          // Deduplicate in case WebSocket already delivered this
          if (s.folders.some((f) => f.id === newFolder.id)) return s;
          return { folders: [...s.folders, newFolder] };
        });
      },

      deleteFolder: async (id) => {
        // Collect this folder and all descendants
        const state = get();
        const idsToDelete = new Set<string>();
        function collectChildren(parentId: string) {
          idsToDelete.add(parentId);
          for (const f of state.folders) {
            if (f.parentId === parentId && !idsToDelete.has(f.id)) {
              collectChildren(f.id);
            }
          }
        }
        collectChildren(id);

        // Optimistic UI update
        set((s) => ({
          folders: s.folders.filter((f) => !idsToDelete.has(f.id)),
          highlights: s.highlights.map((h) =>
            h.folderId && idsToDelete.has(h.folderId)
              ? { ...h, folderId: undefined, folder: undefined }
              : h,
          ),
        }));

        // Fire API calls for each folder (server cascades children)
        for (const fid of idsToDelete) {
          void apiFetch(`/api/folders/${encodeURIComponent(fid)}`, { method: "DELETE" });
        }
      },

      renameFolder: (id, name) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
        }));
        void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
      },

      moveFolder: (id, newParentId) => {
        const state = get();
        // Prevent circular parenting
        if (id === newParentId) return;
        function isDescendant(parentId: string, targetId: string): boolean {
          for (const f of state.folders) {
            if (f.parentId === parentId) {
              if (f.id === targetId) return true;
              if (isDescendant(f.id, targetId)) return true;
            }
          }
          return false;
        }
        if (newParentId && isDescendant(id, newParentId)) return;
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)),
        }));
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
        void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
      },

      addTag: async (name, color) => {
        const trimmedName = name.trim().slice(0, 50);
        if (!trimmedName) return;
        const { ok, data } = await apiFetch<{ id: number; name: string; color: string }>(
          "/api/tags",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedName, color }),
          },
        );
        if (!ok || !data) return;
        const newTag = { id: String(data.id), name: data.name, color: data.color };
        set((s) => {
          if (s.tags.some((t) => t.id === newTag.id)) return s;
          return { tags: [...s.tags, newTag] };
        });
      },

      deleteTag: (id) => {
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          activeTagFilters: s.activeTagFilters.filter((t) => t !== id),
        }));
        void apiFetch(`/api/tags/${encodeURIComponent(id)}`, { method: "DELETE" });
      },

      addHighlight: async ({ text, source, folderId, tags }) => {
        if (!text || text.trim().length === 0) return;
        const trimmedText = text.trim();
        const displayText = trimmedText.length > 500 ? trimmedText.slice(0, 500) : trimmedText;
        const numericFolderId = folderId && /^\d+$/.test(folderId) ? Number(folderId) : null;

        const { ok, data } = await apiFetch<Record<string, unknown>>(
          "/api/highlights",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: displayText,
              source: source.trim() || "Manual entry",
              url: "#",
              topic: "Manual",
              topicColor: "bg-purple-500/20 text-purple-300",
              savedAt: new Date().toISOString(),
              folder: null,
              folderId: numericFolderId,
              note: null,
              tags: tags ?? [],
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
          tags:       Array.isArray(data.tags) ? (data.tags as (string | number)[]).map(String) : [],
          isCode:     Boolean(data.isCode),
          isFavorite: Boolean(data.isFavorite),
          isArchived: Boolean(data.isArchived),
          isPinned:   Boolean(data.isPinned),
          highlightColor: data.highlightColor != null ? String(data.highlightColor) : undefined,
          isTruncated: trimmedText.length > 500,
          fullText:   trimmedText.length > 500 ? trimmedText : undefined,
        };

        set((s) => {
          if (s.highlights.some((h) => h.id === newH.id)) return s;
          return { highlights: [newH, ...s.highlights] };
        });
        return true;
      },

      updateHighlight: (id, patch) => {
        set((s) => ({
          highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        }));
        void apiFetch(`/api/highlights/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      },

      moveHighlight: (id, folderId, folderName) => {
        const state = get();
        const folderExists = !folderId || state.folders.some((f) => f.id === folderId);
        if (!folderExists) return;
        set((s) => ({
          highlights: s.highlights.map((h) => (h.id === id ? { ...h, folder: folderName, folderId } : h)),
        }));
        // Send folderId as a number. Use 0 as sentinel meaning "clear folder"
        // (backend treats null as "not provided"; 0 explicitly clears the folder_id column).
        const numericFolderId = folderId && /^\d+$/.test(folderId) ? Number(folderId) : 0;
        void apiFetch(`/api/highlights/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: numericFolderId }),
        });
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

      togglePinFolder: (id) => {
        const target = get().folders.find((f) => f.id === id);
        if (!target) return;
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === id ? { ...f, isPinned: !f.isPinned } : f,
          ),
        }));
        void apiFetch(`/api/folders/${encodeURIComponent(id)}`, {
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
        const state = get();
        const target = state.trash.find((h) => h.id === id);
        if (!target) return;
        // Re-create on the server (the original was hard-deleted)
        const { ok, data } = await apiFetch<Record<string, unknown>>(
          "/api/highlights",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: target.text,
              source: target.source,
              url: target.url,
              topic: target.topic,
              topicColor: target.topicColor,
              savedAt: target.savedAt,
              folder: target.folder ?? null,
              folderId: target.folderId ? Number(target.folderId) : null,
              note: target.note ?? null,
              tags: target.tags ?? [],
              isCode: target.isCode ?? false,
              isFavorite: target.isFavorite,
              isArchived: target.isArchived,
              isPinned: target.isPinned ?? false,
              highlightColor: target.highlightColor ?? null,
            }),
          },
        );
        if (!ok || !data) return;
        const restored: Highlight = {
          ...target,
          id: String(data.id ?? target.id),
        };
        set((s) => ({
          trash: s.trash.filter((h) => h.id !== id),
          highlights: [restored, ...s.highlights.filter((h) => h.id !== restored.id)],
        }));
      },

      setIsLoading:           (v) => set({ isLoading: v }),
      setFocusedHighlightIdx: (n) => set({ focusedHighlightIdx: n }),
      setNewFolderDialogOpen:    (v) => set({ newFolderDialogOpen: v }),
      setNewHighlightDialogOpen: (v) => set({ newHighlightDialogOpen: v }),

      addSmartCollection: (name, tagIds) =>
        set((s) => ({
          smartCollections: [
            ...s.smartCollections,
            { id: nextLocalId(), name: name.trim(), tagIds },
          ],
        })),

      deleteSmartCollection: (id) =>
        set((s) => ({
          smartCollections: s.smartCollections.filter((c) => c.id !== id),
        })),

      addApiKey: async (name) => {
        const newKey = {
          id:        "",
          name:      name.trim(),
          key:       `ctx_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join("")}`,
          createdAt: new Date().toISOString(),
        };
        const { ok, data } = await apiFetch<{ id: number | string; name: string; key: string; createdAt: string }>(
          "/api/developer/api-keys",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newKey),
          },
        );
        if (ok && data) {
          newKey.id = String(data.id);
        } else {
          newKey.id = nextLocalId();
        }
        set((s) => ({ apiKeys: [...s.apiKeys, newKey] }));
      },

      deleteApiKey: (id) => {
        set((s) => ({ apiKeys: s.apiKeys.filter((k) => k.id !== id) }));
        void apiFetch(`/api/developer/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
      },

      populateDemoData: () => {},

      resetStore: () =>
        set({
          highlights:           [],
          folders:              [],
          tags:                 [],
          trash:                [],
          apiKeys:              [],
          smartCollections:     [],
          activeFolder:         null,
          activeTagFilters:     [],
          activeDomainFilters:  [],
          searchQuery:          "",
          selectedHighlightIds: [],
        }),
    }),
    { name: "cortex:dashboard" },
  ),
);

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
  ownerId?:       string;
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
  color: string;
  createdAt?: string;
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
  aiContext?: string;
  aiResponse?: string;
  resourceType?: "TEXT" | "VIDEO";
  videoTimestamp?: number;
  linkAccess?: string;      // RESTRICTED, PUBLIC
  defaultLinkRole?: string; // VIEWER, COMMENTER, EDITOR
  isDeleted?: boolean;      // Soft deletion support
  highlightType?: "web" | "ai_chat" | "manual";
  connectDotsResult?: string;
  actionItemsResult?: string;
  devilsAdvocateResult?: string;
  customPrompt?: string;
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

  isGlobalLoading: boolean;
  setGlobalLoading: (v: boolean) => void;

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
  addFolder:           (name: string, parentId?: string) => Promise<void>;
  deleteFolder:        (id: string) => void;
  unshareFolder:       (id: string) => Promise<void>;
  bulkManagePermissions: (resourceId: number, resourceType: string, updates: any[], removals: number[]) => Promise<void>;
  renameFolder:        (id: string, name: string) => void;
  moveFolder:          (id: string, newParentId: string | undefined) => void;
  setFolderEmoji:      (id: string, emoji: string) => void;
  addTag:              (name: string, color: string) => Promise<void>;
  updateTag:           (id: string, name: string, color: string) => Promise<void>;
  deleteTag:           (id: string) => void;
  addHighlight:        (h: Pick<Highlight, "text" | "source"> & { folderId?: string, tags?: string[], url?: string }) => Promise<boolean>;
  updateHighlight:     (id: string, patch: Partial<Pick<Highlight, "note" | "tags" | "highlightColor" | "aiContext" | "aiResponse" | "connectDotsResult" | "actionItemsResult" | "devilsAdvocateResult" | "customPrompt" | "source">>) => void;
  moveHighlight:       (id: string, folderId: string, folderName: string) => void;
  toggleFavorite:      (id: string) => void;
  toggleArchive:       (id: string) => void;
  togglePinHighlight:  (id: string) => void;
  togglePinFolder:     (id: string) => void;
  populateDemoData:    () => void;

  // Smart Collections
  addSmartCollection:    (name: string, tagIds: string[]) => void;
  deleteSmartCollection: (id: string) => void;
  fetchSmartCollections: () => Promise<void>;

  // API Keys
  apiKeys: Array<{ id: string; name: string; key: string; createdAt: string }>;
  addApiKey:    (name: string) => void;
  deleteApiKey: (id: string) => void;
  lastCreatedApiKey: string | null;
  clearLastCreatedApiKey: () => void;

  // Trash / undo
  trash:               Highlight[];
  deleteHighlight:     (id: string) => void;
  restoreHighlight:    (id: string) => void;

  // Loading reference counter
  loadingCount:           number;
  startLoading:           () => void;
  stopLoading:            () => void;
  isLoading:              boolean; // Deprecated: use loadingCount > 0
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
  updateFolderSynthesis: (id: string, synthesis: string) => void;
  setTagFilterExclusive: (tagIds: string[]) => void;

  // Access Requests
  requestAccess: (folderId: string, role: string) => Promise<boolean>;
  respondToAccessRequest: (requestId: string, action: "APPROVE" | "REJECT") => Promise<boolean>;

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

// Forward declaration for recompute helper — used inside store
type RecomputeFn = () => void;
let _recomputeFolderCounts: RecomputeFn = () => {};

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
            ownerId:       (f as any).ownerId != null ? String((f as any).ownerId) : undefined,
          }));
          set({ folders: dedupFolders(mapped) });
          // Recompute folder counts from current highlights
          const { highlights: currentHighlights } = get();
          const counts: Record<string, number> = {};
          for (const h of currentHighlights) {
            if (h.folderId && !h.isArchived && !h.isDeleted) {
              counts[h.folderId] = (counts[h.folderId] ?? 0) + 1;
            }
          }
          set((s) => ({ folders: s.folders.map((f) => ({ ...f, count: counts[f.id] ?? 0 })) }));
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
          const mapped = raw.map((t) => ({
            id: String(t.id),
            name: t.name,
            color: t.color ?? "",
            createdAt: (t as any).createdAt || undefined
          }));
          set({ tags: dedupFolders(mapped) });
        } catch {
          // Keep existing tags on error — don't clear them
        } finally {
          tagsInFlight = false;
        }
      },

      smartCollections: [],
      apiKeys: [],
      lastCreatedApiKey: null,

      tags: [],

      highlights: [],

      trash:                     [],
      loadingCount:              0,
      startLoading:              () => set((s) => {
        const next = s.loadingCount + 1;
        return { loadingCount: next, isLoading: next > 0 };
      }),
      stopLoading:               () => set((s) => {
        const next = Math.max(0, s.loadingCount - 1);
        return { loadingCount: next, isLoading: next > 0 };
      }),
      isLoading:                 false,
      focusedHighlightIdx:       0,
      newFolderDialogOpen:       false,
      newHighlightDialogOpen:    false,

      isGlobalLoading: false,
    setGlobalLoading: (isGlobalLoading) => set({ isGlobalLoading }),

    setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setActiveFolder: (id) => {
        set({ activeFolder: id });
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
        const { ok, data, status } = await apiFetch<{ id: number; name: string; emoji: string; parentId: number | null; isPinned: boolean }>(
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
          throw new Error("Failed to create folder. Please try again.");
        }
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
        // Collect this folder and all descendants for optimistic state update
        const state = get();
        const idsToDelete = new Set<string>();

        // Build children map for O(N) traversal
        const childrenMap = new Map<string, string[]>();
        for (const f of state.folders) {
          if (f.parentId) {
            const pid = String(f.parentId);
            if (!childrenMap.has(pid)) childrenMap.set(pid, []);
            childrenMap.get(pid)!.push(String(f.id));
          }
        }

        function collectChildren(parentId: string) {
          idsToDelete.add(parentId);
          const children = childrenMap.get(parentId) || [];
          for (const childId of children) {
            if (!idsToDelete.has(childId)) {
              collectChildren(childId);
            }
          }
        }
        collectChildren(String(id));

        // Optimistic UI update: 
        // 1. Remove folders in the tree
        // 2. Orphan highlights in these folders (set folderId to null)
        set((s) => ({
          folders: s.folders.filter((f) => !idsToDelete.has(String(f.id))),
          highlights: s.highlights.map((h) => 
            h.folderId && idsToDelete.has(String(h.folderId)) 
              ? { ...h, folderId: undefined, folder: undefined } 
              : h
          ),
          // Clear active folder if it was in the deleted tree
          activeFolder: s.activeFolder && idsToDelete.has(String(s.activeFolder)) ? null : s.activeFolder
        }));

        // Fire a single API call for the root folder. The backend will cascade.
        await apiFetch(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
      },

      unshareFolder: async (id) => {
        set({ isGlobalLoading: true });
        try {
          const { ok } = await apiFetch(`/api/folders/${encodeURIComponent(id)}/unshare`, { method: "POST" });
          if (ok) {
            set((s) => ({ folders: s.folders.filter((f) => f.id !== id) }));
            // Redirect if viewing it
            if (window.location.pathname.includes(`/folders/${id}`)) {
              window.location.href = "/dashboard";
            }
          }
        } finally {
          set({ isGlobalLoading: false });
        }
      },

      bulkManagePermissions: async (resourceId, resourceType, updates, removals) => {
        set({ isGlobalLoading: true });
        try {
          const { ok } = await apiFetch(`/api/permissions/bulk-manage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceId, resourceType, updates, removals }),
          });
          if (ok) {
            // Re-fetch folders to ensure local syncing
            await get().fetchFolders();
          }
        } finally {
          set({ isGlobalLoading: false });
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

        // Build children map for O(N) traversal
        const childrenMap = new Map<string, string[]>();
        for (const f of state.folders) {
          if (f.parentId) {
            if (!childrenMap.has(f.parentId)) {
              childrenMap.set(f.parentId, []);
            }
            childrenMap.get(f.parentId)!.push(f.id);
          }
        }

        function isDescendant(parentId: string, targetId: string): boolean {
          const children = childrenMap.get(parentId) || [];
          for (const childId of children) {
            if (childId === targetId) return true;
            if (isDescendant(childId, targetId)) return true;
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
        const { ok, data, status } = await apiFetch<{ id: number; name: string; color: string }>(
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
        const newTag = { id: String(data.id), name: data.name, color: data.color, createdAt: (data as any).createdAt };
        set((s) => {
          if (s.tags.some((t) => t.id === newTag.id)) return s;
          return { tags: [...s.tags, newTag] };
        });
      },

      updateTag: async (id, name, color) => {
        const trimmedName = name.trim().slice(0, 50);
        if (!trimmedName) return;

        // Optimistic UI update
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
          // Revert on error? Or just let real-time sync handle it.
          // For now, if it fails, we fetch tags again to be sure.
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
            tags: h.tags?.filter((tid) => tid !== id),
          })),
        }));
        void apiFetch(`/api/tags/${encodeURIComponent(id)}`, { method: "DELETE" });
      },

      addHighlight: async ({ text, source, folderId, tags, url: explicitUrl }) => {
        if (!text || text.trim().length === 0) return;
        const trimmedText = text.trim();
        const displayText = trimmedText.length > 500 ? trimmedText.slice(0, 500) : trimmedText;
        const numericFolderId = folderId && /^\d+$/.test(folderId) ? Number(folderId) : null;

        // FIX 19: Auto-detect URL from source field
        const isUrl = explicitUrl
          ? true
          : source.trim().startsWith("http://") || source.trim().startsWith("https://");
        const resolvedUrl = explicitUrl ?? (isUrl ? source.trim() : "#");
        const resolvedSource = isUrl && !explicitUrl
          ? (() => { try { return new URL(source.trim()).hostname; } catch { return source.trim(); } })()
          : source.trim() || "Manual entry";

        const { ok, data } = await apiFetch<Record<string, unknown>>(
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

      setIsLoading: (v: boolean) => {
        if (v) get().startLoading();
        else get().stopLoading();
      },
      setFocusedHighlightIdx: (n) => set({ focusedHighlightIdx: n }),
      setNewFolderDialogOpen:    (v) => set({ newFolderDialogOpen: v }),
      setNewHighlightDialogOpen: (v) => set({ newHighlightDialogOpen: v }),

      requestAccess: async (folderId, role) => {
        set({ isGlobalLoading: true });
        try {
          const { ok } = await apiFetch(`/api/folders/${encodeURIComponent(folderId)}/request-access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          });
          return ok;
        } finally {
          set({ isGlobalLoading: false });
        }
      },

      respondToAccessRequest: async (requestId, action) => {
        const { ok } = await apiFetch(`/api/access-requests/${encodeURIComponent(requestId)}/respond?action=${action}`, {
          method: "PUT",
        });
        return ok;
      },

      addSmartCollection: async (name, tagIds) => {
        const trimmedName = name.trim();
        // Optimistic add with local ID
        const localId = nextLocalId();
        set((s) => ({
          smartCollections: [...s.smartCollections, { id: localId, name: trimmedName, tagIds }],
        }));
        const { ok, data } = await apiFetch<{ id: number | string; name: string; tagIds: string[] }>(
          "/api/smart-collections",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedName, tagIds }),
          },
        );
        if (ok && data) {
          // Replace local ID with server ID
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
        // Only call API for server-persisted collections (not local-only)
        if (!id.startsWith("local-")) {
          void apiFetch(`/api/smart-collections/${encodeURIComponent(id)}`, { method: "DELETE" });
        }
      },

      fetchSmartCollections: async () => {
        const { ok, data } = await apiFetch<Array<{ id: number | string; name: string; tagIds: string[] }>>(
          "/api/smart-collections",
        );
        if (ok && Array.isArray(data)) {
          set({
            smartCollections: data.map((c) => ({
              id: String(c.id),
              name: c.name,
              tagIds: Array.isArray(c.tagIds) ? c.tagIds.map(String) : [],
            })),
          });
        }
      },

      addApiKey: async (name) => {
        const { ok, data } = await apiFetch<{ id: number | string; name: string; key: string; createdAt: string }>(
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

      populateDemoData: () => {
        const now = new Date();
        const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
        set((s) => ({
          highlights: [
            ...s.highlights,
            {
              id: "demo-1", text: "Large language models are trained on vast corpora of text data, allowing them to generate coherent and contextually relevant responses across a wide range of topics.", source: "OpenAI Research Blog", url: "https://openai.com/research", topic: "AI & Machine Learning", topicColor: "bg-violet-500/20 text-violet-300", savedAt: daysAgo(1), isFavorite: false, isArchived: false, isPinned: true, tags: ["demo-tag-1"], highlightType: "web" as const,
            },
            {
              id: "demo-2", text: "The Feynman Technique is a mental model for learning: if you can't explain something simply, you don't understand it well enough.", source: "Farnam Street", url: "https://fs.blog/feynman-technique", topic: "Learning", topicColor: "bg-emerald-500/20 text-emerald-300", savedAt: daysAgo(3), isFavorite: true, isArchived: false, isPinned: false, tags: ["demo-tag-3"], highlightType: "web" as const,
            },
            {
              id: "demo-3", text: "Product-market fit means being in a good market with a product that can satisfy that market.", source: "Marc Andreessen", url: "#", topic: "Product", topicColor: "bg-blue-500/20 text-blue-300", savedAt: daysAgo(5), isFavorite: false, isArchived: false, isPinned: false, tags: ["demo-tag-2"], highlightType: "manual" as const,
            },
            {
              id: "demo-4", text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", source: "Aristotle", url: "#", topic: "Philosophy", topicColor: "bg-amber-500/20 text-amber-300", savedAt: daysAgo(7), isFavorite: true, isArchived: false, isPinned: false, tags: ["demo-tag-3"], highlightType: "manual" as const,
            },
            {
              id: "demo-5", text: "The best code is no code at all. Every new line of code you willingly bring into the world is code that has to be debugged.", source: "Jeff Atwood / Coding Horror", url: "https://blog.codinghorror.com", topic: "Engineering", topicColor: "bg-teal-500/20 text-teal-300", savedAt: daysAgo(10), isFavorite: false, isArchived: false, isPinned: false, tags: ["demo-tag-1", "demo-tag-2"], highlightType: "web" as const,
            },
          ].filter((d) => !s.highlights.some((h) => h.id === d.id)),
          folders: [
            ...s.folders,
            { id: "demo-folder-1", name: "AI & Tech", emoji: "🧠", count: 2, isPinned: false },
            { id: "demo-folder-2", name: "Reading List", emoji: "📚", count: 2, isPinned: false },
          ].filter((d) => !s.folders.some((f) => f.id === d.id)),
          tags: [
            ...s.tags,
            { id: "demo-tag-1", name: "Research",   color: "#7c3aed" },
            { id: "demo-tag-2", name: "Product",    color: "#2563eb" },
            { id: "demo-tag-3", name: "Philosophy", color: "#059669" },
          ].filter((d) => !s.tags.some((t) => t.id === d.id)),
        }));
      },

      updateFolderSynthesis: (id, synthesis) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, synthesis } : f)),
        }));
      },

      setTagFilterExclusive: (tagIds) => {
        set({ activeTagFilters: tagIds });
      },

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

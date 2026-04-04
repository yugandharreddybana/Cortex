import { StateCreator } from "zustand";
import { DashboardState } from "../types";

export interface UISlice {
  sidebarCollapsed: boolean;
  activeFolder:     string | null;
  sortOrder:        "recent" | "oldest" | "site";
  viewMode:            "grid" | "list";
  activeDomainFilters: string[];
  activeTagFilters:    string[];
  searchQuery:         string;
  selectedHighlightIds: string[];
  isGlobalLoading: boolean;
  loadingCount:           number;
  isLoading:              boolean;
  focusedHighlightIdx:    number;
  newFolderDialogOpen:       boolean;
  newHighlightDialogOpen:    boolean;

  setSidebarCollapsed: (v: boolean) => void;
  setActiveFolder:     (id: string | null) => void;
  setSortOrder:        (order: "recent" | "oldest" | "site") => void;
  toggleSidebar:       () => void;
  setViewMode:              (mode: "grid" | "list") => void;
  toggleDomainFilter:       (domain: string) => void;
  toggleTagFilter:          (tagId: string) => void;
  setSearchQuery:           (q: string) => void;
  toggleHighlightSelect:    (id: string) => void;
  selectAllHighlights:      (ids: string[]) => void;
  clearHighlightSelection:  () => void;
  setGlobalLoading: (v: boolean) => void;
  startLoading:           () => void;
  stopLoading:            () => void;
  setIsLoading:           (v: boolean) => void;
  setFocusedHighlightIdx: (n: number) => void;
  setNewFolderDialogOpen:    (v: boolean) => void;
  setNewHighlightDialogOpen: (v: boolean) => void;
}

export const createUISlice: StateCreator<DashboardState, [], [], UISlice> = (set) => ({
  sidebarCollapsed: false,
  activeFolder:     null,
  sortOrder:        "recent",
  viewMode:            "grid",
  activeDomainFilters: [],
  activeTagFilters:    [],
  searchQuery:         "",
  selectedHighlightIds: [],
  isGlobalLoading: false,
  loadingCount:           0,
  isLoading:              false,
  focusedHighlightIdx:    0,
  newFolderDialogOpen:       false,
  newHighlightDialogOpen:    false,

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setActiveFolder: (id) => set({ activeFolder: id }),
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
  setGlobalLoading: (v) => set({ isGlobalLoading: v }),
  startLoading: () => set((s) => {
    const next = s.loadingCount + 1;
    return { loadingCount: next, isLoading: next > 0 };
  }),
  stopLoading: () => set((s) => {
    const next = Math.max(0, s.loadingCount - 1);
    return { loadingCount: next, isLoading: next > 0 };
  }),
  setIsLoading: (v) => {
    if (v) set((s) => {
      const next = s.loadingCount + 1;
      return { loadingCount: next, isLoading: next > 0 };
    });
    else set((s) => {
      const next = Math.max(0, s.loadingCount - 1);
      return { loadingCount: next, isLoading: next > 0 };
    });
  },
  setFocusedHighlightIdx: (n) => set({ focusedHighlightIdx: n }),
  setNewFolderDialogOpen: (v) => set({ newFolderDialogOpen: v }),
  setNewHighlightDialogOpen: (v) => set({ newHighlightDialogOpen: v }),
});

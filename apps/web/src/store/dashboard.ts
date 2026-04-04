import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { DashboardState } from "./types";
import { createUISlice } from "./slices/uiSlice";
import { createFolderSlice } from "./slices/folderSlice";
import { createTagSlice } from "./slices/tagSlice";
import { createHighlightSlice } from "./slices/highlightSlice";
import { createNotificationSlice } from "./slices/notificationSlice";
import { createAccessRequestSlice } from "./slices/accessRequestSlice";
import { createSmartCollectionSlice } from "./slices/smartCollectionSlice";
import { createAPIKeySlice } from "./slices/apiKeySlice";

/**
 * Main dashboard store for Cortex.
 * Refactored into modular slices for better maintainability (Phase 3).
 * Total line reduction from 1100+ to ~100.
 */
export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set, get, api) => ({
      ...createUISlice(set, get, api),
      ...createFolderSlice(set, get, api),
      ...createTagSlice(set, get, api),
      ...createHighlightSlice(set, get, api),
      ...createNotificationSlice(set, get, api),
      ...createAccessRequestSlice(set, get, api),
      ...createSmartCollectionSlice(set, get, api),
      ...createAPIKeySlice(set, get, api),

      bulkManagePermissions: async (resourceId, resourceType, updates, removals) => {
        set({ isGlobalLoading: true });
        try {
          const res = await fetch(`/api/permissions/bulk-manage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resourceId, resourceType, updates, removals }),
          });
          if (res.ok) {
            get().invalidateFolders();
            await get().fetchFolders();
          }
        } finally {
          set({ isGlobalLoading: false });
        }
      },


      resetStore: () =>
        set({
          highlights:           [],
          folders:              [],
          tags:                 [],
          trash:                [],
          apiKeys:              [],
          smartCollections:     [],
          notifications:        [],
          unreadNotifCount:     0,
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

// Re-export types for convenience
export * from "./types";

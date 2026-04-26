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
 * Refactored into modular slices for better maintainability.
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

      /**
       * Bulk update / remove permissions for a resource.
       *
       * Backend DTO:
       *   POST /api/permissions/bulk-manage
       *   { resourceId, resourceType, permissions: [{userId, accessLevel}], removals: [userId] }
       *
       * Note: do NOT call setGlobalLoading here — the fetch interceptor in Providers.tsx
       * already handles startLoading / stopLoading for every /api/ call.
       */
      bulkManagePermissions: async (resourceId, resourceType, updates, removals) => {
        const res = await fetch(`/api/permissions/bulk-manage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId,
            resourceType,
            permissions: updates,   // backend key is `permissions`, not `updates`
            removals,
          }),
        });
        if (res.ok) {
          get().invalidateFolders();
          await get().fetchFolders();
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

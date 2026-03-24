"use client";

import { useEffect } from "react";
import { useDashboardStore, type Folder, type Tag } from "@/store/dashboard";

/**
 * useExtensionSync — listens for window.postMessage events from the
 * Cortex Chrome Extension and merges incoming highlights, folders, and
 * tags into the Zustand store.
 *
 * Server persistence is handled by the store actions (API-first) and
 * real-time cross-client sync is handled by WebSocket (useWebSocket).
 * This hook only handles the local postMessage / chrome.runtime bridge
 * so the dashboard reflects extension activity immediately.
 */

interface ExtensionHighlight {
  id:              string;
  text:            string;
  url:             string;
  pageTitle?:      string;
  title?:          string;
  faviconUrl?:     string;
  folderId?:       string;
  folderName?:     string;
  highlightColor?: string;
  tagIds?:         string[];
  timestamp?:      number;
  date?:           string;
  isCode?:         boolean;
  isAI?:           boolean;
  aiBookmarkName?: string;
  chatName?:       string;
  chatUrl?:        string;
  isDeleted?:      boolean;
  resource_type?:  string;
}

interface ExtensionFolder {
  id:       string;
  name:     string;
  emoji:    string;
  parentId?: string;
}

interface ExtensionTag {
  id:    string;
  name:  string;
  color: string;
}

function mapExtensionHighlight(ext: ExtensionHighlight) {
  const source = ext.aiBookmarkName || ext.chatName || ext.pageTitle || ext.title || "Extension";

  return {
    id:         String(ext.id),  // always coerce to string — server JSON sends numeric ids
    text:       ext.text,
    source,
    url:        ext.url,
    topic:      ext.resource_type === "YOUTUBE" || ext.resource_type === "VIDEO" ? "YouTube" : (ext.isAI ? "AI Chat" : "Web"),
    topicColor: ext.resource_type === "YOUTUBE" || ext.resource_type === "VIDEO"
      ? "bg-red-500/20 text-red-300"
      : (ext.isAI ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"),
    savedAt:    ext.date ?? (ext.timestamp ? new Date(ext.timestamp).toISOString() : new Date().toISOString()),
    folder:     ext.folderName,
    folderId:   ext.folderId,
    highlightColor: ext.highlightColor,
    tags:       ext.tagIds,
    isCode:     ext.isCode,
    isFavorite: false,
    isArchived: false,
    isDeleted:  ext.isDeleted ?? false,
  };
}

function mapExtensionFolder(ext: ExtensionFolder): Folder {
  return {
    id:       String(ext.id),
    name:     ext.name,
    emoji:    ext.emoji,
    count:    0,
    parentId: ext.parentId != null ? String(ext.parentId) : undefined,
  };
}

function mapExtensionTag(ext: ExtensionTag): Tag {
  return {
    id:    String(ext.id),
    name:  ext.name,
    color: ext.color,
  };
}

/** Remove duplicate entries by string-coerced id. First occurrence wins. */
function dedupById<T extends { id: string | number }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const sid = String(item.id);
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
}

export function useExtensionSync() {
  useEffect(() => {
    let knownExtensionIds = new Set<string>();

    function reconcileSync(extHighlights: ExtensionHighlight[]) {
      // Always use string IDs — server JSON sends numeric ids (Long), extension
      // stores them as-is, so ext.id may be a number at runtime despite the
      // TypeScript type saying string. Coerce everywhere to prevent "123" !== 123
      // false-negative dedup that causes the last-created highlight to appear twice.
      const currentExtIds = new Set(extHighlights.map((h) => String(h.id)));

      const mapped = extHighlights.map((h) => ({ ext: h, mapped: mapExtensionHighlight(h) }));

      useDashboardStore.setState((s) => {
        const existingIds = new Set(s.highlights.map((h) => h.id));

        const newHighlights = mapped
          .filter(({ ext }) => !existingIds.has(String(ext.id)) && !ext.isDeleted)
          .map(({ mapped: m }) => m);

        const updateMap = new Map(
          mapped.filter(({ ext }) => existingIds.has(String(ext.id))).map(({ ext, mapped: m }) => [String(ext.id), m]),
        );

        let highlights = s.highlights;

        if (updateMap.size > 0) {
          highlights = highlights
            .map((h) => {
              const updated = updateMap.get(h.id);
              return updated ? { ...h, ...updated } : h;
            })
            .filter((h) => !h.isDeleted);
        }

        if (newHighlights.length > 0) {
          highlights = [...newHighlights, ...highlights];
        }

        if (knownExtensionIds.size > 0) {
          const deletedIds = new Set<string>();
          for (const id of knownExtensionIds) {
            if (!currentExtIds.has(id)) deletedIds.add(id);
          }
          if (deletedIds.size > 0) {
            highlights = highlights.filter((h) => !deletedIds.has(h.id));
          }
        }

        // Safety dedup: remove any negative-ID (temp) highlights that weren't
        // replaced by a real server ID — these are stale artifacts from old saves.
        // Also deduplicate by ID in case multiple code paths added the same entry.
        const positiveIds = new Set(
          highlights.filter((h) => Number(h.id) >= 0).map((h) => h.id)
        );
        highlights = dedupById(
          highlights.filter((h) => Number(h.id) >= 0 || !positiveIds.has(h.id))
        );

        return { highlights };
      });

      knownExtensionIds = currentExtIds;
    }

    function reconcileFolders(rawExtFolders: ExtensionFolder[]) {
      // Dedup within the incoming array first (extension storage can accumulate duplicates)
      const extFolders = dedupById(
        rawExtFolders.map((f) => ({ ...f, id: String(f.id), parentId: f.parentId != null ? String(f.parentId) : undefined }))
      );
      const extMap = new Map(extFolders.map((f) => [String(f.id), f]));

      useDashboardStore.setState((s) => {
        const existingIds = new Set(s.folders.map((f) => String(f.id)));

        const newFolders = extFolders
          .filter((f) => !existingIds.has(f.id))
          .map(mapExtensionFolder);

        if (newFolders.length === 0 && extMap.size === 0) return s;

        return {
          folders: dedupById([
            ...s.folders.map((f) => {
              const ext = extMap.get(String(f.id));
              if (ext) {
                return { ...f, name: ext.name, emoji: ext.emoji, parentId: ext.parentId };
              }
              return f;
            }),
            ...newFolders,
          ]),
        };
      });
    }

    function reconcileTags(rawExtTags: ExtensionTag[]) {
      // Dedup within the incoming array first
      const extTags = dedupById(rawExtTags.map((t) => ({ ...t, id: String(t.id) })));
      const extMap = new Map(extTags.map((t) => [t.id, t]));

      useDashboardStore.setState((s) => {
        const existingIds = new Set(s.tags.map((t) => String(t.id)));

        const newTags = extTags
          .filter((t) => !existingIds.has(t.id))
          .map(mapExtensionTag);

        if (newTags.length === 0 && extMap.size === 0) return s;

        return {
          tags: dedupById([
            ...s.tags.map((t) => {
              const ext = extMap.get(t.id);
              if (ext) {
                return { ...t, name: ext.name, color: ext.color };
              }
              return t;
            }),
            ...newTags,
          ]),
        };
      });
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data) return;

      if (data.type === "CORTEX_EXTENSION_SYNC") {
        const extHighlights: ExtensionHighlight[] = data.highlights;
        if (!Array.isArray(extHighlights)) return;
        reconcileSync(extHighlights);
      } else if (data.type === "CORTEX_EXTENSION_FOLDERS_SYNC") {
        const extFolders: ExtensionFolder[] = data.folders;
        if (!Array.isArray(extFolders)) return;
        reconcileFolders(extFolders);
      } else if (data.type === "CORTEX_EXTENSION_TAGS_SYNC") {
        const extTags: ExtensionTag[] = data.tags;
        if (!Array.isArray(extTags)) return;
        reconcileTags(extTags);
      } else if (data.type === "CORTEX_LOGOUT") {
        useDashboardStore.getState().resetStore();
      }
    }

    window.addEventListener("message", handleMessage);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    let runtimeListener: ((message: { type: string; payload: unknown }) => void) | null = null;
    if (g.chrome?.runtime?.onMessage) {
      runtimeListener = (message) => {
        if (message.type === "CORTEX_SYNC") {
          const extHighlights = message.payload as ExtensionHighlight[];
          if (!Array.isArray(extHighlights)) return;
          reconcileSync(extHighlights);
        } else if (message.type === "CORTEX_FOLDERS_SYNC") {
          const extFolders = message.payload as ExtensionFolder[];
          if (!Array.isArray(extFolders)) return;
          reconcileFolders(extFolders);
        } else if (message.type === "CORTEX_TAGS_SYNC") {
          const extTags = message.payload as ExtensionTag[];
          if (!Array.isArray(extTags)) return;
          reconcileTags(extTags);
        }
      };
      g.chrome.runtime.onMessage.addListener(runtimeListener);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      if (runtimeListener && g.chrome?.runtime?.onMessage) {
        g.chrome.runtime.onMessage.removeListener(runtimeListener);
      }
    };
  }, []);
}

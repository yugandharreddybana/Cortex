/**
 * syncQueue — sequential offline mutation engine.
 *
 * Scenario 7 (Deep-Nest Offline Race): When the user creates
 *   ParentFolder → SubFolder(parentId=tmpParent) → Tag → Highlight(folderId=tmpSub, tagIds=[tmpTag])
 * all while offline, the queue must process them in strict dependency order:
 *
 *   1. parentFolder   — no deps
 *   2. subFolder      — depends on parentFolder real-id
 *   3. tag            — no deps
 *   4. highlight      — depends on subFolder real-id + tag real-id
 *
 * Each item type has a canonical sort weight so the queue always self-orders
 * regardless of insertion order.
 *
 * Phase 16.1: NEW file.
 */

import { secureGet, secureSet } from "./secure-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncItemType = "folder" | "subfolder" | "tag" | "highlight";

export interface SyncQueueItem {
  type:         SyncItemType;
  tempId:       string;         // client-assigned temp id
  parentTempId?: string;         // if subfolder — the parent's temp id
  payload:      Record<string, unknown>;
}

interface ResolvedItem extends SyncQueueItem {
  resolvedParentId?: string;
}

// ─── Sort weights (process leafs last) ───────────────────────────────────────

const TYPE_ORDER: Record<SyncItemType, number> = {
  folder:    0,
  subfolder: 1,
  tag:       2,
  highlight: 3,
};

// ─── Queue processor ─────────────────────────────────────────────────────────

/**
 * Process the given items in dependency order.
 * Returns a map of tempId → realId so callers can patch follow-on references.
 */
export async function processSyncQueue(
  items: SyncQueueItem[],
  token: string,
  apiBase: string,
): Promise<Map<string, string>> {
  const realIds = new Map<string, string>();

  // Sort by dependency layer
  const sorted = [...items].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

  for (const item of sorted) {
    const resolved: ResolvedItem = { ...item };

    // Patch parent temp-id → real-id for subfolders
    if (item.type === "subfolder" && item.parentTempId) {
      resolved.resolvedParentId = realIds.get(item.parentTempId) ?? item.parentTempId;
    }

    const realId = await processItem(resolved, token, apiBase);
    realIds.set(item.tempId, realId);
  }

  return realIds;
}

// ─── Per-item processor ───────────────────────────────────────────────────────

async function processItem(
  item: ResolvedItem,
  token: string,
  base:  string,
): Promise<string> {
  const authHeader = {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  switch (item.type) {
    case "folder":
    case "subfolder": {
      const res = await fetch(`${base}/api/folders`, {
        method:  "POST",
        headers: authHeader,
        body:    JSON.stringify({
          id:       item.tempId,
          name:     item.payload["name"]  ?? "Untitled",
          emoji:    item.payload["emoji"] ?? "📁",
          parentId: item.resolvedParentId  ?? item.payload["parentId"] ?? null,
          isPinned: false,
        }),
      });
      if (res.ok) {
        const json = await res.json() as { id?: string };
        const realId = json.id ?? item.tempId;
        if (realId !== item.tempId) {
          await swapFolderId(item.tempId, realId);
        }
        return realId;
      }
      return item.tempId;
    }

    case "tag": {
      const res = await fetch(`${base}/api/tags`, {
        method:  "POST",
        headers: authHeader,
        body:    JSON.stringify({
          id:    item.tempId,
          name:  item.payload["name"],
          color: item.payload["color"] ?? "blue",
        }),
      });
      if (res.ok) {
        const json = await res.json() as { id?: string };
        const realId = json.id ?? item.tempId;
        if (realId !== item.tempId) {
          await swapTagId(item.tempId, realId);
        }
        return realId;
      }
      return item.tempId;
    }

    case "highlight": {
      // Highlights are saved by the caller — we just return the tempId as-is
      return item.tempId;
    }
  }
}

// ─── Storage swap helpers ─────────────────────────────────────────────────────

async function swapFolderId(tempId: string, realId: string): Promise<void> {
  const folders = await secureGet<Array<Record<string, unknown>>>("cortex_folders", []);
  await secureSet("cortex_folders",
    folders.map((f) => f["id"] === tempId ? { ...f, id: realId } : f),
  );
}

async function swapTagId(tempId: string, realId: string): Promise<void> {
  const tags = await secureGet<Array<Record<string, unknown>>>("cortex_tags", []);
  await secureSet("cortex_tags",
    tags.map((t) => t["id"] === tempId ? { ...t, id: realId } : t),
  );
}

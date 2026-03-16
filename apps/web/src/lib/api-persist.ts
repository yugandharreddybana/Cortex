/**
 * API persistence helpers with offline outbox support.
 * Local UI state is optimistic; server writes execute immediately when online
 * and are queued to syncQueue when offline.
 */

import { mutateOrQueue } from "@/lib/sync-queue";

function post(url: string, body: Record<string, unknown>, entityType?: "folder" | "highlight" | "tag" | "apiKey") {
  void mutateOrQueue({
    endpoint: url,
    method: "POST",
    body,
    offlineFallback: { endpoint: url, method: "POST", body, entityType },
  });
}

function put(url: string, body: Record<string, unknown>, entityType?: "folder" | "highlight" | "tag" | "apiKey") {
  void mutateOrQueue({
    endpoint: url,
    method: "PUT",
    body,
    offlineFallback: { endpoint: url, method: "PUT", body, entityType },
  });
}

function del(url: string, entityType?: "folder" | "highlight" | "tag" | "apiKey") {
  void mutateOrQueue({
    endpoint: url,
    method: "DELETE",
    offlineFallback: {
      endpoint: url,
      method: "PATCH",
      body: { is_deleted: true },
      entityType,
    },
  });
}

// ─── Highlights ─────────────────────────────────────────────────────────────

/** POST /api/highlights — create a new highlight on the server */
export function createHighlight(h: {
  text: string;
  source?: string;
  url?: string;
  topic?: string;
  topicColor?: string;
  savedAt?: string;
  folder?: string;
  folderId?: string;
  note?: string;
  tags?: string[];
  isCode?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  highlightColor?: string;
}) {
  // Only send a numeric (server-assigned) folderId; temp ids (negative integers) are unknown to the server
  const numericFolderId = h.folderId && /^\d+$/.test(h.folderId) ? Number(h.folderId) : null;
  post(
    "/api/highlights",
    {
      // No `id` field — the DB assigns the PK via IDENTITY auto-increment
      text: h.text,
      source: h.source ?? "",
      url: h.url ?? "",
      topic: h.topic ?? "Web",
      topicColor: h.topicColor ?? "bg-blue-500/20 text-blue-300",
      savedAt: h.savedAt ?? new Date().toISOString(),
      folder: h.folder ?? null,
      folderId: numericFolderId,
      note: h.note ?? null,
      tags: h.tags ?? [],
      isCode: h.isCode ?? false,
      isFavorite: h.isFavorite ?? false,
      isArchived: h.isArchived ?? false,
      isPinned: h.isPinned ?? false,
      highlightColor: h.highlightColor ?? null,
    },
    "highlight",
  );
}

/** PUT /api/highlights/:id — update an existing highlight on the server */
export function updateHighlight(id: string, patch: Record<string, unknown>) {
  put(`/api/highlights/${encodeURIComponent(id)}`, patch, "highlight");
}

/** DELETE /api/highlights/:id — permanently delete a highlight on the server */
export function deleteHighlight(id: string) {
  del(`/api/highlights/${encodeURIComponent(id)}`, "highlight");
}

// ─── Folders ──────────────────────────────────────────────────────────────────

/** POST /api/folders — create a new folder on the server */
export function createFolder(f: {
  name: string;
  emoji?: string;
  parentId?: string;
  isPinned?: boolean;
}) {
  // Only send a numeric (server-assigned) parentId; temp ids (negative integers) are unknown to the server
  const numericParentId = f.parentId && /^\d+$/.test(f.parentId) ? Number(f.parentId) : null;
  post(
    "/api/folders",
    {
      // No `id` field — the DB assigns the PK via IDENTITY auto-increment
      name: f.name,
      emoji: f.emoji ?? "📁",
      parentId: numericParentId,
      isPinned: f.isPinned ?? false,
    },
    "folder",
  );
}

/** PUT /api/folders/:id — update a folder name, emoji, parent, or pin state */
export function updateFolder(id: string, patch: Record<string, unknown>) {
  put(`/api/folders/${encodeURIComponent(id)}`, patch, "folder");
}

/** DELETE /api/folders/:id — permanently delete a folder on the server */
export function deleteFolder(id: string) {
  del(`/api/folders/${encodeURIComponent(id)}`, "folder");
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/** POST /api/tags — create a new tag on the server */
export function createTag(t: { name: string; color: string }) {
  // No `id` field — the DB assigns the PK via IDENTITY auto-increment
  post("/api/tags", { name: t.name, color: t.color }, "tag");
}

/** DELETE /api/tags/:id — permanently delete a tag on the server */
export function deleteTag(id: string) {
  del(`/api/tags/${encodeURIComponent(id)}`, "tag");
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

/** POST /api/developer/api-keys — create a new API key on the server */
export function createApiKey(k: { id: string; name: string; key: string; createdAt: string }) {
  post("/api/developer/api-keys", k, "apiKey");
}

/** DELETE /api/developer/api-keys/:id — revoke/delete an API key on the server */
export function deleteApiKey(id: string) {
  del(`/api/developer/api-keys/${encodeURIComponent(id)}`, "apiKey");
}

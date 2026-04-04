"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { z } from "zod";
import { secureIdbStorage } from "@/lib/secure-vault";
import { toast } from "sonner";

const MutationSchema = z.object({
  id: z.string().min(1),
  endpoint: z.string().min(1),
  method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  retryCount: z.number().int().min(0).default(0),
  entityType: z.enum(["folder", "highlight", "tag", "apiKey"]).optional(),
  tempId: z.string().optional(),
  clientUpdatedAt: z.string(),
});

export type QueuedMutation = z.infer<typeof MutationSchema>;

interface SyncQueueState {
  syncQueue: QueuedMutation[];
  deadLetterQueue: QueuedMutation[];
  pausedByAuth: boolean;
  tempIdMap: Record<string, string>;
  enqueue: (item: Omit<QueuedMutation, "id" | "retryCount" | "clientUpdatedAt">) => void;
  processQueue: () => Promise<void>;
  clearQueues: () => void;
  setPausedByAuth: (paused: boolean) => void;
}

function nowIso() {
  return new Date().toISOString();
}

function mapTempIds(input: unknown, tempIdMap: Record<string, string>): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = input as Record<string, unknown>;
  const mapped = { ...obj };
  // Map both camelCase and snake_case folder ID references
  for (const key of ["folderId", "folder_id", "parentId"] as const) {
    const val = mapped[key];
    if (typeof val === "string" && tempIdMap[val]) {
      mapped[key] = tempIdMap[val];
    }
  }
  return mapped;
}

function classifyStatus(status: number) {
  if (status === 401) return "auth" as const;
  if (status === 409) return "conflict" as const;
  if (status >= 400 && status < 500) return "client" as const;
  if (status >= 500) return "server" as const;
  return "ok" as const;
}

function normalizeHighlights(raw: unknown[]) {
  return raw.map((h) => {
    const r = h as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      text: String(r.text ?? ""),
      source: String(r.source ?? ""),
      url: String(r.url ?? ""),
      topic: String(r.topic ?? "Web"),
      topicColor: String(r.topicColor ?? "bg-blue-500/20 text-blue-300"),
      savedAt: String(r.savedAt ?? new Date().toISOString()),
      folder: typeof r.folder === "string" ? r.folder : undefined,
      folderId:
        typeof r.folderId === "string"
          ? r.folderId
          : typeof r.folder_id === "string"
            ? r.folder_id
            : undefined,
      note: typeof r.note === "string" ? r.note : undefined,
      tags: Array.isArray(r.tags) ? (r.tags as any[]) : [],
      isCode: Boolean(r.isCode),
      isFavorite: Boolean(r.isFavorite),
      isArchived: Boolean(r.isArchived),
      isPinned: Boolean(r.isPinned),
      highlightColor: typeof r.highlightColor === "string" ? r.highlightColor : undefined,
    } as any;
  });
}

async function refreshAfterConflict(endpoint: string) {
  try {
    const { useDashboardStore } = await import("@/store/dashboard");

    if (endpoint.includes("/api/highlights")) {
      const res = await fetch("/api/highlights", { credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : [];
      useDashboardStore.setState({ highlights: normalizeHighlights(rows) });
      return;
    }

    if (endpoint.includes("/api/folders")) {
      const res = await fetch("/api/folders", { credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : [];
      const normalized = rows.map((f: Record<string, unknown>) => ({
        id: String(f.id ?? ""),
        name: String(f.name ?? ""),
        emoji: String(f.emoji ?? ""),
        count: 0,
        parentId: f.parentId != null ? String(f.parentId) : undefined,
        isPinned: Boolean(f.isPinned),
      }));
      useDashboardStore.setState({ folders: normalized });
      return;
    }

    if (endpoint.includes("/api/tags")) {
      const res = await fetch("/api/tags", { credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : [];
      const normalized = rows.map((t: Record<string, unknown>) => ({
        id: String(t.id ?? ""),
        name: String(t.name ?? ""),
        color: String(t.color ?? ""),
      }));
      useDashboardStore.setState({ tags: normalized });
    }
  } catch {
    // Leave current optimistic state if refresh fails.
  }
}

export const useSyncQueueStore = create<SyncQueueState>()(
  persist(
    (set, get) => ({
      syncQueue: [],
      deadLetterQueue: [],
      pausedByAuth: false,
      tempIdMap: {},

      enqueue: (item) => {
        const parsed = MutationSchema.parse({
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          retryCount: 0,
          clientUpdatedAt: nowIso(),
        });
        set((s) => ({ syncQueue: [...s.syncQueue, parsed] }));
      },

      processQueue: async () => {
        const state = get();
        if (state.pausedByAuth || state.syncQueue.length === 0) return;

        const queue = [...state.syncQueue];
        const nextQueue: QueuedMutation[] = [];
        const dead: QueuedMutation[] = [...state.deadLetterQueue];
        const tempMap = { ...state.tempIdMap };

        // Build dependency graph to batch independent requests
        const itemBatchIndex = new Map<QueuedMutation, number>();
        const batches: QueuedMutation[][] = [];

        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];
          let requiredBatch = 0;

          for (let j = 0; j < i; j++) {
            const prev = queue[j];
            let depends = false;

            // 1. Strict ordering for identical endpoints to prevent race conditions
            if (item.endpoint === prev.endpoint) {
              depends = true;
            }

            // 2. Dependency on a previously generated tempId
            if (prev.tempId && item.body) {
              const body = item.body as Record<string, unknown>;
              if (
                body.folderId === prev.tempId ||
                body.folder_id === prev.tempId ||
                body.parentId === prev.tempId
              ) {
                depends = true;
              }
            }

            if (depends) {
              requiredBatch = Math.max(requiredBatch, (itemBatchIndex.get(prev) ?? 0) + 1);
            }
          }

          itemBatchIndex.set(item, requiredBatch);
          if (!batches[requiredBatch]) batches[requiredBatch] = [];
          batches[requiredBatch].push(item);
        }

        let authPaused = false;

        for (const batch of batches) {
          if (authPaused) {
            nextQueue.push(...batch);
            continue;
          }

          await Promise.all(
            batch.map(async (item) => {
              if (authPaused) {
                nextQueue.push(item);
                return;
              }

              try {
                const mappedBody = mapTempIds(item.body ?? null, tempMap);
                const res = await fetch(item.endpoint, {
                  method: item.method,
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: mappedBody
                    ? JSON.stringify({ ...mappedBody, client_updated_at: item.clientUpdatedAt })
                    : undefined,
                });

                const statusType = classifyStatus(res.status);
                if (statusType === "ok") {
                  if (item.entityType === "folder" && item.tempId) {
                    const json = (await res.json().catch(() => null)) as { id?: string } | null;
                    if (json?.id) tempMap[item.tempId] = json.id;
                  }
                  return; // continue in Promise.all is return
                }

                if (statusType === "auth") {
                  if (!authPaused) {
                    authPaused = true;
                    set({ pausedByAuth: true });
                    toast.error("Session expired", {
                      description: "Synchronization has been paused. Please sign in again to resume your work.",
                      duration: Infinity, // keep until action
                    });
                  }
                  nextQueue.push(item);
                  return;
                }

                if (statusType === "conflict") {
                  toast.warning("Sync conflict", {
                    description: "A conflict was detected. The server version has been retained to prevent data loss.",
                  });
                  await refreshAfterConflict(item.endpoint);
                  return;
                }

                if (statusType === "client") {
                  dead.push(item);
                  toast.error("Action rejected", {
                    description: "The requested update was invalid and has been moved to the dead-letter queue.",
                  });
                  return;
                }

                if (statusType === "server") {
                  const bumped = { ...item, retryCount: item.retryCount + 1 };
                  if (bumped.retryCount >= 3) {
                    dead.push(bumped);
                  toast.error("Persistent failure", {
                    description: "Synchronization failed repeatedly. The action has been quarantined for review.",
                  });
                } else {
                  nextQueue.push(bumped);
                }
              }
            } catch {
              nextQueue.push({ ...item, retryCount: item.retryCount + 1 });
            }
          })
        );
      }

      set({ syncQueue: nextQueue, deadLetterQueue: dead, tempIdMap: tempMap });
    },

    clearQueues: () => set({ syncQueue: [], deadLetterQueue: [], tempIdMap: {}, pausedByAuth: false }),
    setPausedByAuth: (paused) => set({ pausedByAuth: paused }),
  }),
  {
    name: "cortex:sync-queue",
    version: 2,
    storage: createJSONStorage(() => secureIdbStorage),
    migrate: () => ({ syncQueue: [], deadLetterQueue: [], tempIdMap: {}, pausedByAuth: false }),
  },
),
);

export async function mutateOrQueue(input: {
endpoint: string;
method: "POST" | "PUT" | "PATCH" | "DELETE";
body?: Record<string, unknown> | null;
offlineFallback?: Omit<QueuedMutation, "id" | "retryCount" | "clientUpdatedAt">;
rollback?: () => void;
/** Called with the parsed JSON response body on a successful (2xx) request. */
onSuccess?: (data: unknown) => void;
}) {
const offline = typeof navigator !== "undefined" && !navigator.onLine;

// Never hard-delete while offline. Tombstone using PATCH for safety.
if (offline && input.method === "DELETE") {
  useSyncQueueStore.getState().enqueue({
    endpoint: input.endpoint,
    method: "PATCH",
    body: { is_deleted: true },
    entityType: input.offlineFallback?.entityType,
    tempId: input.offlineFallback?.tempId,
  });
  return;
}

if (offline) {
  useSyncQueueStore.getState().enqueue({
    endpoint: input.offlineFallback?.endpoint ?? input.endpoint,
    method: input.offlineFallback?.method ?? input.method,
    body: input.offlineFallback?.body ?? input.body,
    entityType: input.offlineFallback?.entityType,
    tempId: input.offlineFallback?.tempId,
  });
  return;
}

// Attempt a silent token refresh before giving up on a potential auth failure
async function attemptRefresh(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    return r.ok;
  } catch {
    return false;
  }
}

async function doFetch() {
  return fetch(input.endpoint, {
    method: input.method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: input.body ? JSON.stringify({ ...input.body, client_updated_at: nowIso() }) : undefined,
  });
}

try {
  let res = await doFetch();

  // On 401: silently refresh the token once and retry
  if (res.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (res.ok) {
    if (input.onSuccess) {
      const data = await res.json().catch(() => null);
      input.onSuccess(data);
    }
  } else {
    if (res.status === 401) {
      useSyncQueueStore.getState().setPausedByAuth(true);
    }
    if (res.status === 409) {
      toast.warning("Conflict detected", {
        description: "A version conflict was resolved by retaining the server state.",
      });
      await refreshAfterConflict(input.endpoint);
    } else {
      input.rollback?.();
    }
  }
} catch {
  useSyncQueueStore.getState().enqueue({
    endpoint: input.offlineFallback?.endpoint ?? input.endpoint,
    method: input.offlineFallback?.method ?? input.method,
    body: input.offlineFallback?.body ?? input.body,
    entityType: input.offlineFallback?.entityType,
    tempId: input.offlineFallback?.tempId,
  });
}
}

"use client";

import { useEffect, useRef } from "react";
import { useDashboardStore, type Highlight } from "@/store/dashboard";
import type { AuthUser } from "@/store/authStore";

/**
 * useServerSync — on mount, fetches the user's highlights, folders, and tags
 * from the server and hydrates the Zustand store.
 *
 * Server is the sole source of truth — no local merge or offline push.
 */
export function useServerSync(user: AuthUser | null, authFetched: boolean) {
  const lastUserId = useRef<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    // Wait for auth to settle. If we're not logged in, don't even try to sync.
    if (!authFetched || !user) {
      hydrated.current = false;
      return;
    }
    
    // Reset hydration state if the user has changed (e.g. switch account)
    if (user.id !== lastUserId.current) {
      hydrated.current = false;
      lastUserId.current = user.id;
    }

    const state = useDashboardStore.getState();
    const isStoreEmpty = state.highlights.length === 0 && state.folders.length === 0 && state.tags.length === 0;

    // Only sync if we haven't hydrated yet OR if the store was cleared/reset
    if (hydrated.current && !isStoreEmpty) return;
    hydrated.current = true;

    const timer = setTimeout(() => {
      async function pull() {
        try {
          const [hRes, fRes, tRes] = await Promise.all([
            fetch("/api/highlights?t=" + Date.now(), { credentials: "include" }),
            fetch("/api/folders?t=" + Date.now(), { credentials: "include" }),
            fetch("/api/tags?t=" + Date.now(), { credentials: "include" }),
          ]);

          // Handle 401 — attempt token refresh once
          if (hRes.status === 401 || fRes.status === 401 || tRes.status === 401) {
            const refreshRes = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
            if (!refreshRes.ok) return;
            // Re-fetch after refresh
            const [hRes2, fRes2, tRes2] = await Promise.all([
              fetch("/api/highlights?t=" + Date.now(), { credentials: "include" }),
              fetch("/api/folders?t=" + Date.now(), { credentials: "include" }),
              fetch("/api/tags?t=" + Date.now(), { credentials: "include" }),
            ]);
            if (hRes2.status === 401 || fRes2.status === 401 || tRes2.status === 401) return;
            await applyResponses(hRes2, fRes2, tRes2);
            return;
          }

          await applyResponses(hRes, fRes, tRes);
        } catch {
          // Server unreachable — leave store empty
        }
      }

      pull();
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [user, authFetched]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function applyResponses(hRes: Response, fRes: Response, tRes: Response) {
  const [rawHighlights, rawFolders, rawTags] = await Promise.all([
    hRes.ok ? hRes.json() : null,
    fRes.ok ? fRes.json() : null,
    tRes.ok ? tRes.json() : null,
  ]);

  const patch: Partial<ReturnType<typeof useDashboardStore.getState>> = {};

  if (rawHighlights !== null) {
    patch.highlights = dedupById(
      (Array.isArray(rawHighlights) ? rawHighlights : [])
        .filter((h: ServerHighlight) => !h.isDeleted)
        .map(mapServerHighlight)
    );
  }

  if (rawFolders !== null) {
    patch.folders = dedupById(
      (Array.isArray(rawFolders) ? rawFolders : []).map(
        (f: ServerFolder) => ({
          id:            String(f.id),
          name:          f.name,
          emoji:         f.emoji ?? "📁",
          count:         0,
          parentId:      f.parentId != null ? String(f.parentId) : undefined,
          isPinned:      f.isPinned ?? false,
          effectiveRole: f.effectiveRole ?? undefined,
          ownerId:       f.ownerId != null ? String(f.ownerId) : undefined,
        }),
      )
    );
  }

  if (rawTags !== null) {
    patch.tags = dedupById(
      (Array.isArray(rawTags) ? rawTags : []).map(
        (t: ServerTag) => ({
          id:    String(t.id),
          name:  t.name,
          color: t.color ?? "",
          createdAt: (t as any).createdAt || undefined
        }),
      )
    );
  }

  if (Object.keys(patch).length > 0) {
    useDashboardStore.setState(patch as unknown as Parameters<typeof useDashboardStore.setState>[0]);
  }
}

interface ServerHighlight {
  id: string | number;
  text: string;
  source: string;
  url: string;
  topic: string;
  topicColor: string;
  savedAt: string;
  folder: string | null;
  folderId: string | number | null;
  note: string | null;
  tags: ServerTag[];

  isCode: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isPinned: boolean;
  highlightColor: string | null;
  isDeleted: boolean;
}

interface ServerFolder {
  id: string | number;
  name: string;
  emoji: string;
  parentId: string | number | null;
  isPinned: boolean;
  effectiveRole?: string;
  ownerId?: string | number | null;
}

interface ServerTag {
  id: string | number;
  name: string;
  color: string;
}

function mapServerHighlight(h: ServerHighlight): Highlight {
  return {
    id:             String(h.id),
    text:           h.text,
    source:         h.source,
    url:            h.url,
    topic:          h.topic ?? "Web",
    topicColor:     h.topicColor ?? "bg-blue-500/20 text-blue-300",
    savedAt:        h.savedAt,
    folder:         h.folder ?? undefined,
    folderId:       h.folderId != null ? String(h.folderId) : undefined,
    note:           h.note ?? undefined,
    tags:           (h.tags ?? []).map(t => ({
      id:    String(t.id),
      name:  t.name,
      color: t.color ?? "",
    })),

    isCode:         h.isCode,
    isFavorite:     h.isFavorite,
    isArchived:     h.isArchived,
    isPinned:       h.isPinned ?? false,
    highlightColor: h.highlightColor ?? undefined,
  };
}

"use client";

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { useDashboardStore, type Highlight, type Folder, type Tag } from "@/store/dashboard";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";

/**
 * useWebSocket — connects to the Java backend via STOMP-over-WebSocket and
 * keeps the Zustand dashboard store in sync across all connected clients
 * (web tabs, browser extensions).
 *
 * On receiving a WebSocket event the store is updated in-place so every
 * open tab/extension instance reflects the mutation immediately.
 */
export function useWebSocket() {
  const clientRef = useRef<Client | null>(null);
  const tokenRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function connect() {
      // Fetch JWT from BFF
      try {
        const res = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (!res.ok) {
          // 401 = user signed out, don't reconnect. Other errors (502, 429) → retry.
          if (res.status !== 401) scheduleReconnect();
          return;
        }
        const { token } = (await res.json()) as { token: string };
        if (!token || !mountedRef.current) return;
        tokenRef.current = token;
      } catch {
        scheduleReconnect();
        return;
      }

      // Tear down any existing client
      if (clientRef.current?.active) {
        try { clientRef.current.deactivate(); } catch { /* ok */ }
      }

      const stompClient = new Client({
        brokerURL: WS_URL,
        connectHeaders: { Authorization: `Bearer ${tokenRef.current}` },
        reconnectDelay: 0, // We manage reconnection ourselves
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,

        onConnect: () => {
          console.log("[Cortex WS-Web] Connected");
          subscribe(stompClient);
        },

        onStompError: () => scheduleReconnect(),
        onWebSocketError: () => scheduleReconnect(),
        onWebSocketClose: () => scheduleReconnect(),
      });

      clientRef.current = stompClient;
      stompClient.activate();
    }

    function scheduleReconnect(delay = 10_000) {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (!mountedRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (mountedRef.current) connect();
      }, delay);
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (clientRef.current?.active) {
        try { clientRef.current.deactivate(); } catch { /* ok */ }
      }
    };
  }, []);
}

// ─── Subscription handlers ──────────────────────────────────────────────────

function subscribe(client: Client) {
  // ── Highlights ──────────────────────────────────────────────────────────
  client.subscribe("/user/topic/highlights", (msg) => {
    try {
      const h = normalizeHighlight(JSON.parse(msg.body));
      useDashboardStore.setState((s) => {
        if (s.highlights.some((x) => x.id === h.id)) return s; // deduplicate
        return { highlights: [h, ...s.highlights] };
      });
    } catch { /* malformed frame — skip */ }
  });

  client.subscribe("/user/topic/highlights/updated", (msg) => {
    try {
      const h = normalizeHighlight(JSON.parse(msg.body));
      useDashboardStore.setState((s) => ({
        highlights: s.highlights.map((x) => (x.id === h.id ? h : x)),
      }));
    } catch { /* malformed frame — skip */ }
  });

  client.subscribe("/user/topic/highlights/deleted", (msg) => {
    try {
      const id = String(JSON.parse(msg.body));
      useDashboardStore.setState((s) => ({
        highlights: s.highlights.filter((x) => x.id !== id),
      }));
    } catch { /* malformed frame — skip */ }
  });

  // ── Folders ──────────────────────────────────────────────────────────────
  client.subscribe("/user/topic/folders", (msg) => {
    try {
      const f = normalizeFolder(JSON.parse(msg.body));
      useDashboardStore.setState((s) => {
        const exists = s.folders.some((x) => x.id === f.id);
        if (exists) {
          // Update in place — server data wins (upsert, not skip)
          return { folders: s.folders.map((x) => (x.id === f.id ? { ...x, ...f } : x)) };
        }
        return { folders: [...s.folders, f] };
      });
    } catch { /* malformed frame — skip */ }
  });

  client.subscribe("/user/topic/folders/updated", (msg) => {
    try {
      const f = normalizeFolder(JSON.parse(msg.body));
      useDashboardStore.setState((s) => ({
        folders: s.folders.map((x) => (x.id === f.id ? { ...x, ...f } : x)),
      }));
    } catch { /* malformed frame — skip */ }
  });

  client.subscribe("/user/topic/folders/deleted", (msg) => {
    try {
      const id = String(JSON.parse(msg.body));
      useDashboardStore.setState((s) => ({
        folders: s.folders.filter((x) => x.id !== id),
      }));
    } catch { /* malformed frame — skip */ }
  });

  // ── Permissions / Real-time Revocation ────────────────────────────────
  client.subscribe("/user/topic/permissions/revoked", (msg) => {
    try {
      const { resourceId, resourceType } = JSON.parse(msg.body);
      if (resourceType === "FOLDER") {
        const id = String(resourceId);
        useDashboardStore.setState((s) => ({
          folders: s.folders.filter((x) => x.id !== id),
        }));
        
        // Redirection logic if user is currently viewing this folder
        if (window.location.pathname.includes(`/folders/${id}`)) {
          window.location.href = "/dashboard";
        }
      }
    } catch { /* malformed frame — skip */ }
  });

  // ── Tags ─────────────────────────────────────────────────────────────────
  client.subscribe("/user/topic/tags", (msg) => {
    try {
      const t = normalizeTag(JSON.parse(msg.body));
      useDashboardStore.setState((s) => {
        const exists = s.tags.some((x) => x.id === t.id);
        if (exists) {
          return { tags: s.tags.map((x) => (x.id === t.id ? { ...x, ...t } : x)) };
        }
        return { tags: [...s.tags, t] };
      });
    } catch { /* malformed frame — skip */ }
  });

  client.subscribe("/user/topic/tags/updated", (msg) => {
    try {
      const t = normalizeTag(JSON.parse(msg.body));
      useDashboardStore.setState((s) => ({
        tags: s.tags.map((x) => (x.id === t.id ? { ...x, ...t } : x)),
      }));
    } catch { /* malformed frame — skip */ }
  });

  client.subscribe("/user/topic/tags/deleted", (msg) => {
    try {
      const id = String(JSON.parse(msg.body));
      useDashboardStore.setState((s) => ({
        tags: s.tags.filter((x) => x.id !== id),
      }));
    } catch { /* malformed frame — skip */ }
  });

  // ── Notifications (for role refresh on access request resolution) ─────────
  client.subscribe("/user/queue/notifications", (msg) => {
    try {
      const notification = JSON.parse(msg.body) as { type?: string };
      // When the user's access request is resolved (approved/rejected), re-fetch
      // folders so their effectiveRole updates in the store immediately.
      if (notification.type === "ACCESS_REQUEST_RESOLVED") {
        void useDashboardStore.getState().fetchFolders();
      }
    } catch { /* malformed frame — skip */ }
  });
}

// ─── Normalizers (server → store shape) ──────────────────────────────────────

function normalizeHighlight(raw: Record<string, unknown>): Highlight {
  return {
    id:             String(raw.id ?? ""),
    text:           String(raw.text ?? ""),
    source:         String(raw.source ?? ""),
    url:            String(raw.url ?? ""),
    topic:          String(raw.topic ?? "Web"),
    topicColor:     String(raw.topicColor ?? "bg-blue-500/20 text-blue-300"),
    savedAt:        String(raw.savedAt ?? new Date().toISOString()),
    folder:         raw.folder != null ? String(raw.folder) : undefined,
    folderId:       raw.folderId != null ? String(raw.folderId) : undefined,
    note:           raw.note != null ? String(raw.note) : undefined,
    tags:           Array.isArray(raw.tags) ? (raw.tags as (string | number)[]).map(String) : [],
    isCode:         Boolean(raw.isCode),
    isFavorite:     Boolean(raw.isFavorite),
    isArchived:     Boolean(raw.isArchived),
    isPinned:       Boolean(raw.isPinned),
    highlightColor: raw.highlightColor != null ? String(raw.highlightColor) : undefined,
  };
}

function normalizeFolder(raw: Record<string, unknown>): Folder {
  return {
    id:       String(raw.id ?? ""),
    name:     String(raw.name ?? ""),
    emoji:    String(raw.emoji ?? "📁"),
    count:    0,
    parentId: raw.parentId != null ? String(raw.parentId) : undefined,
    isPinned: Boolean(raw.isPinned),
    effectiveRole: raw.effectiveRole ? String(raw.effectiveRole) : undefined,
  };
}

function normalizeTag(raw: Record<string, unknown>): Tag {
  return {
    id:    String(raw.id ?? ""),
    name:  String(raw.name ?? ""),
    color: String(raw.color ?? ""),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
  };
}

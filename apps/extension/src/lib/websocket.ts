import { Client } from "@stomp/stompjs";
import { secureGet, secureSet } from "./secure-storage";

/** Returns true if the JWT is expired or malformed. */
function isJwtExpired(jwt: string): boolean {
  try {
    const [, payloadB64] = jwt.split(".");
    const b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(b64)) as { exp: number };
    return exp * 1000 < Date.now();
  } catch { return true; }
}

/** Broadcast updated storage data to all open tabs. */
async function broadcastUpdate(data: Record<string, unknown>): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "STORAGE_UPDATED", data }).catch(() => {});
      }
    }
  } catch { /* tabs API may not be ready */ }
}

// ─── State ────────────────────────────────────────────────────────────────────
let client: Client | null = null;
let isActivating = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  try {
    const session = await chrome.storage.session.get("cortex_ext_token");
    if (session.cortex_ext_token) return session.cortex_ext_token;
    const local = await chrome.storage.local.get("cortex_ext_token");
    return local.cortex_ext_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Pre-flight check: verify the Java backend is actually reachable
 * BEFORE opening a WebSocket — this prevents the browser-level
 * "WebSocket connection failed" error from ever appearing.
 */
async function isBackendReachable(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 800);
    const r = await fetch(`http://localhost:${port}/api/v1/auth/login`, {
      method: "HEAD",
      signal: ctrl.signal,
    });
    clearTimeout(id);
    return r.status !== 0;
  } catch {
    return false;
  }
}

function setupSubscriptions(stompClient: Client): void {
  // ── Folder events ────────────────────────────────────────────────────────
  stompClient.subscribe("/user/topic/folders", async (message) => {
    try {
      const folder = JSON.parse(message.body) as Record<string, string>;
      const folders = await secureGet<Array<Record<string, unknown>>>("cortex_folders", []);
      const idx = folders.findIndex((f) => f["id"] === folder["id"]);
      const updated = idx >= 0
        ? folders.map((f) => f["id"] === folder["id"] ? { ...f, ...folder } : f)
        : [folder, ...folders];
      await secureSet("cortex_folders", updated);
      await broadcastUpdate({ folders: updated });
    } catch { /* malformed frame — skip */ }
  });

  stompClient.subscribe("/user/topic/folders/deleted", async (message) => {
    try {
      const folderId = JSON.parse(message.body) as string;
      const folders = await secureGet<Array<Record<string, unknown>>>("cortex_folders", []);
      const updated = folders.filter((f) => f["id"] !== folderId);
      await secureSet("cortex_folders", updated);
      await broadcastUpdate({ folders: updated });
    } catch { /* malformed frame — skip */ }
  });

  // ── Tag events ───────────────────────────────────────────────────────────
  stompClient.subscribe("/user/topic/tags", async (message) => {
    try {
      const tag = JSON.parse(message.body) as Record<string, string>;
      const tags = await secureGet<Array<Record<string, unknown>>>("cortex_tags", []);
      const idx = tags.findIndex((t) => t["id"] === tag["id"]);
      const updated = idx >= 0
        ? tags.map((t) => t["id"] === tag["id"] ? { ...t, ...tag } : t)
        : [tag, ...tags];
      await secureSet("cortex_tags", updated);
      await broadcastUpdate({ tags: updated });
    } catch { /* malformed frame — skip */ }
  });

  stompClient.subscribe("/user/topic/tags/deleted", async (message) => {
    try {
      const tagId = JSON.parse(message.body) as string;
      const tags = await secureGet<Array<Record<string, unknown>>>("cortex_tags", []);
      const updated = tags.filter((t) => t["id"] !== tagId);
      await secureSet("cortex_tags", updated);
      await broadcastUpdate({ tags: updated });
    } catch { /* malformed frame — skip */ }
  });

  // ── Highlight events ─────────────────────────────────────────────────────
  stompClient.subscribe("/user/topic/highlights", async (message) => {
    try {
      const highlight = JSON.parse(message.body) as Record<string, unknown>;
      const highlights = await secureGet<Array<Record<string, unknown>>>("highlights", []);
      if (!highlights.find((h) => h["id"] === highlight["id"])) {
        // Evict any stale temp (negative-ID) entries that represent the same highlight
        // (can occur if a previous save stored with a temp ID before Fix A was deployed)
        const withoutStaleTempIds = highlights.filter((h) => {
          const id = Number(h["id"]);
          if (id >= 0) return true; // real server ID — keep it
          // Negative ID = temp: remove if it matches the same text+url
          return !(h["text"] === highlight["text"] && h["url"] === highlight["url"]);
        });
        const updated = [highlight, ...withoutStaleTempIds].slice(0, 2000);
        await secureSet("highlights", updated);
        await broadcastUpdate({ highlights: updated });
      }
    } catch { /* malformed frame — skip */ }
  });

  stompClient.subscribe("/user/topic/highlights/updated", async (message) => {
    try {
      const highlight = JSON.parse(message.body) as Record<string, unknown>;
      const highlights = await secureGet<Array<Record<string, unknown>>>("highlights", []);
      const updated = highlights.map((h) =>
        h["id"] === highlight["id"] ? { ...h, ...highlight } : h,
      );
      await secureSet("highlights", updated);
      await broadcastUpdate({ highlights: updated });
    } catch { /* malformed frame — skip */ }
  });

  stompClient.subscribe("/user/topic/highlights/deleted", async (message) => {
    try {
      const highlightId = JSON.parse(message.body) as string;
      const highlights = await secureGet<Array<Record<string, unknown>>>("highlights", []);
      const updated = highlights.filter((h) => h["id"] !== highlightId);
      await secureSet("highlights", updated);
      await broadcastUpdate({ highlights: updated });
    } catch { /* malformed frame — skip */ }
  });
}

/** Schedule a reconnect attempt after a delay (with pre-flight probe). */
function scheduleReconnect(delayMs = 10000): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    activateWebsocket();
  }, delayMs);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function activateWebsocket(): Promise<void> {
  // Prevent concurrent activations
  if (isActivating) return;
  isActivating = true;

  try {
    // 1. Must have a valid, non-expired token
    const token = await getToken();
    if (!token || isJwtExpired(token)) {
      console.log("[Cortex WS] No valid token — skipping WebSocket activation");
      return;
    }

    // 2. Deactivate any existing connection
    if (client?.active) {
      try { await client.deactivate(); } catch { /* ok */ }
      client = null;
    }

    // 3. Pre-flight: verify the Java backend is reachable BEFORE opening WS.
    //    This prevents the browser from logging a "WebSocket connection failed"
    //    error on the chrome://extensions page.
    const port = 8080;
    const reachable = await isBackendReachable(port);
    if (!reachable) {
      console.log("[Cortex WS] Backend not reachable on port", port, "— will retry in 10s");
      scheduleReconnect(10000);
      return;
    }

    // 4. Create a new STOMP client with auth and error handling
    //    IMPORTANT: reconnectDelay = 0 disables STOMP's built-in auto-reconnect.
    //    We handle reconnection ourselves via scheduleReconnect() so we can re-probe
    //    the backend before each attempt (prevents browser-level WS errors).
    client = new Client({
      brokerURL: `ws://localhost:${port}/ws?token=${token}`,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      // Disable STOMP's built-in reconnect — we manage reconnection ourselves
      // to ensure we always probe the backend before attempting a WS connection.
      reconnectDelay: 0,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        console.log("[Cortex WS] Connected");
        setupSubscriptions(client!);
      },
      onStompError: (frame) => {
        console.debug("[Cortex WS] STOMP error:", frame.headers["message"] ?? "");
        // Don't auto-reconnect on STOMP errors — schedule a probed reconnect
        scheduleReconnect(10000);
      },
      onWebSocketError: () => {
        // Silently handle — schedule probed reconnect
        console.debug("[Cortex WS] Connection lost — will retry in 10s");
        scheduleReconnect(10000);
      },
      onWebSocketClose: () => {
        // Server closed the connection — schedule probed reconnect
        scheduleReconnect(10000);
      },
      onDisconnect: () => {
        console.debug("[Cortex WS] Disconnected");
      },
    });

    client.activate();
    console.log("[Cortex WS] Connecting to ws://localhost:" + port + "/ws");
  } catch (err) {
    console.debug("[Cortex WS] Activation failed:", (err as Error).message);
    scheduleReconnect(10000);
  } finally {
    isActivating = false;
  }
}

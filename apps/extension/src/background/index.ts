import { activateWebsocket } from "../lib/websocket";
import { secureGet, secureSet, setVaultKeyFromSessionSeed } from "../lib/secure-storage";

const CORTEX_HOURLY_SYNC_ALARM = "cortexHourlySync";

// ─── Temp-ID counter (negative integers, never conflict with server PKs) ──────
let _tempIdCounter = 0;
function nextTempId(): string { return String(--_tempIdCounter); }

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/** Extract just the message from an error, not "Error: message". */
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Returns true if the JWT is expired or malformed. */
function isJwtExpired(jwt: string): boolean {
  try {
    const [, payloadB64] = jwt.split(".");
    // Convert base64url → standard base64 before decoding
    const b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(b64)) as { exp: number };
    return exp * 1000 < Date.now();
  } catch { return true; }
}

// ─── Token rehydration ────────────────────────────────────────────────────────
// Called at the top of every onMessage handler to ensure session storage has
// the token even after the service worker was killed and restarted (MV3 behaviour).
async function ensureTokenHydrated(): Promise<void> {
  try {
    const session = await chrome.storage.session.get("cortex_ext_token");
    if (!session.cortex_ext_token) {
      const local = await chrome.storage.local.get("cortex_ext_token");
      if (local.cortex_ext_token) {
        await chrome.storage.session.set({ cortex_ext_token: local.cortex_ext_token });
      }
    }
  } catch { /* ignore — storage may not be available yet */ }
}

chrome.runtime.onStartup.addListener(async () => {
  await ensureTokenHydrated();
});

// Also run on service worker load (for MV3, service worker may not get onStartup)
(async () => {
  await ensureTokenHydrated();
  chrome.alarms.create(CORTEX_HOURLY_SYNC_ALARM, { periodInMinutes: 60 });
})();

// ─── Dashboard base URL (try production, dev is used for local testing) ───────
// content scripts and background both reference this for API calls.
const DASHBOARD_PROD = "https://app.cortex.so";
const DASHBOARD_DEV  = "http://localhost:3001";
const JAVA_BASE      = "http://localhost:8080";

/**
 * Map a BFF path to the correct Java path when calling Java directly.
 * /api/highlights  → /api/v1/highlights
 * /api/folders     → /api/v1/folders
 * /api/tags        → /api/v1/tags
 */
function jPath(base: string, bffPath: string): string {
  if (base === JAVA_BASE) return bffPath.replace(/^\/api\//, "/api/v1/");
  return bffPath;
}

/** Login URL — when base is Java-direct, fall back to the production dashboard */
function jLoginUrl(base: string): string {
  return base === JAVA_BASE ? `${DASHBOARD_PROD}/login?ext=1` : `${base}/login?ext=1`;
}

// ─── Temp-ID resolution maps (Hub-and-Spoke storage isolation) ───────────────
// ONLY the background service worker may own these — content scripts never
// touch chrome.storage.local directly (MV3 context isolation).
// WARN: these maps are reset when the SW is killed (MV3 5-min idle limit).
//       PANEL_CREATE_* handlers re-populate them; resolveTempIds() reads them.
const tempIdMap              = new Map<string, string>();                       // resolved: tempId → realId
const pendingFolderCreations = new Map<string, Promise<string>>();              // in-flight: tempId → Promise<realId>
const pendingTagCreations    = new Map<string, Promise<string>>();              // in-flight: tempId → Promise<realId>

/**
 * Cortex Background Service Worker (Manifest V3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles:
 *   - SAVE_HIGHLIGHT: Persists highlight to chrome.storage.local & syncs to dashboard
 *   - OPEN_POPUP_WITH_QUERY: Opens popup with pre-filled query
 *   - GET_HIGHLIGHTS: Returns all stored highlights
 *   - Context menu save action
 *   - Broadcasts storage changes to localhost:3002 (Next.js dashboard)
 */

// ─── AI site detection (mirrored from content for context-menu saves) ─────────

const AI_DOMAINS = [
  "chatgpt.com",
  "gemini.google.com",
  "claude.ai",
  "www.perplexity.ai",
];

function isAISiteUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return AI_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

// ─── Context menu setup ───────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "https://app.cortex.so/welcome" });
  }

  chrome.contextMenus.create({
    id:       "cortex-save",
    title:    "Save to Cortex",
    contexts: ["selection"],
  });

  chrome.alarms.create(CORTEX_HOURLY_SYNC_ALARM, { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CORTEX_HOURLY_SYNC_ALARM) return;
  await runHourlySync();
});

// ─── Context menu click ───────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "cortex-save" && info.selectionText) {
    const url  = tab?.url ?? "";
    const isAI = isAISiteUrl(url);
    const highlightData = {
      text:  info.selectionText,
      url,
      title: tab?.title ?? "",
      date:  new Date().toISOString(),
      isAI,
      ...(isAI ? { chatName: tab?.title ?? "", chatUrl: url } : {}),
    };
    ensureAuthenticated().then(async (isAuth) => {
      if (!isAuth) {
        if (typeof tab?.id === "number") {
          chrome.tabs.sendMessage(tab.id as number, {
            type:    "SHOW_TOAST",
            message: "You must be signed in to Cortex to save highlights.",
          });
        }
        return;
      }
      saveHighlight(highlightData).then(() => {
        if (typeof tab?.id === "number") {
          chrome.tabs.sendMessage(tab.id as number, {
            type:    "SHOW_TOAST",
            message: isAI ? "\u2728 AI snippet saved to Cortex!" : "Saved to Cortex!",
          });
        }
      }).catch(() => {});
    }).catch(() => {});
  }
});

// ─── Keyboard shortcut command ────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-capture-drawer") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id === "number") {
    ensureAuthenticated().then(async (isAuth) => {
      if (!isAuth) {
        chrome.tabs.sendMessage(tab.id as number, {
          type:    "SHOW_TOAST",
          message: "You must be signed in to Cortex to use this feature.",
        });
        return;
      }
      try {
        chrome.tabs.sendMessage(tab.id as number, { type: "OPEN_CAPTURE_DRAWER" });
      } catch {
        // Content script might not be loaded yet — inject it first
        chrome.scripting.executeScript({
          target: { tabId: tab.id as number },
          files:  ["content.js"],
        }).then(() => {
          setTimeout(() => {
            try {
              chrome.tabs.sendMessage(tab.id as number, { type: "OPEN_CAPTURE_DRAWER" });
            } catch {}
          }, 300);
        }).catch(() => {});
      }
    });
  }
});

// ─── Message handler ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Rehydrate token on every message so actions work immediately after SW wakes
  ensureTokenHydrated();

  switch (message.type) {
    // ── WAKE_UP: keeps the service worker alive; sent before every data fetch ──
    // Content scripts ping this before GET_STORAGE_DATA so the SW is awake when
    // the actual data request arrives (important on stale tabs after 5+ min idle).
    case "WAKE_UP": {
      sendResponse({ ok: true, ts: Date.now() });
      return false; // synchronous — no async needed
    }

    // Phase 16.1 — MV3: Content scripts cannot access chrome.storage directly.
    // Provide message handlers so content script can request enabled state & token hydration.

    // ── Get enabled state (for content script) ──
    case "GET_ENABLED_STATE": {
      chrome.storage.local.get("cortex_enabled", (result) => {
        const enabled = result.cortex_enabled !== false;
        sendResponse({ enabled });
      });
      return true;
    }

    // ── Hydrate extension token into session storage (from content script request) ──
    case "HYDRATE_EXTENSION_TOKEN": {
      (async () => {
        try {
          const { cortex_ext_token } = await chrome.storage.local.get("cortex_ext_token");
          if (typeof cortex_ext_token === "string" && cortex_ext_token.length > 0) {
            await chrome.storage.session.set({ cortex_ext_token });
          }
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: errMsg(err) });
        }
      })();
      return true;
    }

    // ── Content script requests storage data ──
    case "GET_STORAGE_DATA": {
      (async () => {
        try {
          const token = await getExtensionToken();
          const [folders, tags] = await Promise.all([
            secureGet<unknown[]>("cortex_folders", []),
            secureGet<unknown[]>("cortex_tags", []),
          ]);

          // Derive auth state directly from the JWT — never trust stale stored state.
          let authState: { status: string };
          if (!token) {
            authState = { status: "unauthenticated" };
          } else if (isJwtExpired(token)) {
            authState = { status: "expired" };
          } else {
            authState = { status: "authenticated" };
          }

          // Phase 1 — respond immediately with cached data so the sidebar opens fast.
          sendResponse({ folders, tags, token, authState });

          // Phase 2 — always refresh from the API when authenticated, regardless of
          // whether storage already has data. Fresh results are pushed to ALL open
          // tabs via STORAGE_UPDATED so the sidebar updates without another round-trip.
          if (token && !isJwtExpired(token)) {
            (async () => {
              try {
                const base = await getApiBase();
                const authHeaders = { Authorization: `Bearer ${token}` };
                const [fRes, tRes] = await Promise.all([
                  fetch(`${base}${jPath(base, "/api/folders")}`, { headers: authHeaders }),
                  fetch(`${base}${jPath(base, "/api/tags")}`, { headers: authHeaders }),
                ]);
                const update: Record<string, unknown> = {};
                if (fRes.ok) {
                  const raw = await fRes.json();
                  const freshFolders = (Array.isArray(raw) ? raw : []).map(
                    (f: Record<string, unknown>) => ({
                      ...f,
                      id:       String(f.id),
                      parentId: f.parentId != null ? String(f.parentId) : null,
                    }),
                  );
                  await secureSet("cortex_folders", freshFolders);
                  update.folders = freshFolders;
                }
                if (tRes.ok) {
                  const raw = await tRes.json();
                  const freshTags = (Array.isArray(raw) ? raw : []).map(
                    (t: Record<string, unknown>) => ({ ...t, id: String(t.id) }),
                  );
                  await secureSet("cortex_tags", freshTags);
                  update.tags = freshTags;
                }
                if (Object.keys(update).length > 0) {
                  await broadcastStorageUpdateToAllTabs(update);
                }
              } catch { /* non-critical — hourly sync will catch up */ }
            })();
          }
        } catch {
          sendResponse({ folders: [], tags: [], token: null, authState: { status: "unauthenticated" } });
        }
      })();
      return true;
    }

    // ── Dashboard login hydration: write server data into extension storage ──
    case "CORTEX_INIT": {
      const { folders = [], tags = [], highlights = [] } = (message.payload ?? {}) as {
        folders: unknown[]; tags: unknown[]; highlights: unknown[];
      };
      Promise.all([
        secureSet("cortex_folders", folders),
        secureSet("cortex_tags",    tags),
        secureSet("highlights",     highlights),
        // Phase 16.1: mark extension session as authenticated on login hydration
        chrome.storage.local.set({ cortex_auth_state: { status: "authenticated" } }),
      ]).then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;
    }

    // ── Web dashboard logout: clear session cache only.
    // ─────────────────────────────────────────────────────────────────────────
    // Phase 16.1 — Decoupled Logout (Scenario 2):
    // The extension's own session is governed solely by cortex_ext_token in
    // chrome.storage.local.  Web app logout must NOT invalidate that token so
    // the extension keeps working after the user signs out of the web UI.
    // However, we MUST NOT clear the entire chrome.storage.session because
    // getExtensionToken() now relies on 'cortex_ext_token' in session storage
    // as an in-memory fast-path, which breaks the extension if cleared here.
    case "CORTEX_LOGOUT":
      chrome.storage.session.remove(["pendingQuery"])
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;

    case "SAVE_HIGHLIGHT":
      ensureAuthenticated().then(async (isAuth) => {
        if (!isAuth) {
          const { pending_highlight = [] } = await chrome.storage.local.get("pending_highlight");
          const queue = Array.isArray(pending_highlight) ? pending_highlight : pending_highlight ? [pending_highlight] : [];
          queue.push(message.payload);
          await chrome.storage.local.set({ pending_highlight: queue });
          sendResponse({ ok: false, error: "NOT_AUTHENTICATED", queued: true });
          return;
        }
        saveHighlight(message.payload)
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      }).catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;
    // After login, check for pending highlights and save them all
    case "CORTEX_AUTH_TOKEN":
      if (typeof message.token === "string" && message.token.length > 0) {
        // Extract the sender's origin so we know the correct API base URL
        // (avoids fallback-to-production when probing fails).
        const senderUrl = _sender.tab?.url;
        const senderOrigin = senderUrl ? (() => { try { return new URL(senderUrl).origin; } catch { return null; } })() : null;

        Promise.resolve()
          .then(() => setVaultKeyFromSessionSeed(message.token))
          .then(() => {
            const storageUpdate: Record<string, unknown> = {
              cortex_ext_token: message.token,
              cortex_auth_state: { status: "authenticated" }, // clear any stale "expired" state
            };
            // Persist the dashboard origin so getApiBase() can use it
            if (senderOrigin) {
              storageUpdate["cortex_api_base"] = senderOrigin;
              _cachedApiBase = senderOrigin;
              _cachedApiBaseTs = Date.now();
            }
            return Promise.all([
              chrome.storage.session.set({ cortex_ext_token: message.token }),
              chrome.storage.local.set(storageUpdate),
            ]);
          })
          .then(async () => {
            // Activate WebSocket now that we have a valid token
            activateWebsocket();
            // Check for pending highlights (array)
            const { pending_highlight } = await chrome.storage.local.get("pending_highlight");
            if (pending_highlight) {
              const queue = Array.isArray(pending_highlight) ? pending_highlight : [pending_highlight];
              for (const h of queue) {
                await saveHighlight(h);
              }
              await chrome.storage.local.remove("pending_highlight");
            }
            sendResponse({ ok: true });
          })
          .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      } else {
        sendResponse({ ok: false, error: "Missing token" });
      }
      return true;


    case "DELETE_HIGHLIGHT":
      deleteHighlight(message.payload.id)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;

    case "OPEN_POPUP_WITH_QUERY":
      chrome.storage.session.set({ pendingQuery: message.payload.text }).then(() => {
        chrome.action.openPopup();
      });
      return false;

    case "GET_HIGHLIGHTS":
      getHighlights().then((highlights) => sendResponse({ highlights }));
      return true;

    case "SYNC_HIGHLIGHTS":
      secureSet("highlights", message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;

    case "SYNC_FOLDERS":
      secureSet("cortex_folders", message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;

    case "SYNC_TAGS":
      secureSet("cortex_tags", message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;

    case "MOVE_HIGHLIGHT": {
      const { id, folderId, folderName } = message.payload as { id: string; folderId?: string; folderName?: string };
      secureGet<unknown[]>("highlights", [])
        .then((highlights) => {
          const updated = highlights.map((h) => {
            const hl = h as Record<string, unknown>;
            if (hl.id === id) return { ...hl, folderId: folderId ?? null, folderName: folderName ?? null };
            return hl;
          });
          return secureSet("highlights", updated);
        })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;
    }

    case "GET_FOLDERS_TAGS":
      Promise.all([
        secureGet("cortex_folders", [] as unknown[]),
        secureGet("cortex_tags", [] as unknown[]),
      ]).then(([folders, tags]) => {
        sendResponse({
          folders,
          tags,
        });
      });
      return true;

    case "GET_AUTH_TOKEN":
      getExtensionToken().then((token) => {
        sendResponse({ token });
      });
      return true;

    case "OPEN_LOGIN":
      getApiBase().then((base) => {
        chrome.tabs.create({ url: jLoginUrl(base) });
        sendResponse({ ok: true });
      });
      return true;

    case "CLEAR_AUTH_TOKEN":
      Promise.all([
        chrome.storage.session.clear(),
        chrome.storage.local.clear(),
      ])
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;

    // ── Scenario 1 & 2: Web app mutation forwarded via the content-script bridge ──
    // The ONLY writer to chrome.storage is the background SW (Hub-and-Spoke).
    case "WEB_MUTATION": {
      const { action, entity, payload = {}, offline = false } = message as {
        action: string; entity: string; payload: Record<string, unknown>; offline?: boolean;
      };
      console.log(`[Cortex Sync - SW] WEB_MUTATION ${action}:${entity}`, payload.id ?? "", offline ? "(offline)" : "");
      (async () => {
        try {
          switch (`${action}:${entity}`) {
            // ── Folder mutations ──────────────────────────────────────────────
            case "CREATE:folder":
            case "UPDATE:folder": {
              const folders = await secureGet<Record<string, unknown>[]>("cortex_folders", []);
              const idx = folders.findIndex((f) => f["id"] === payload.id);
              if (idx >= 0) { folders[idx] = { ...folders[idx], ...payload }; } else { folders.unshift(payload); }
              await secureSet("cortex_folders", folders);
              await broadcastStorageUpdateToAllTabs({ folders });
              break;
            }
            case "DELETE:folder": {
              const folders = await secureGet<Record<string, unknown>[]>("cortex_folders", []);
              await secureSet("cortex_folders", folders.filter((f) => f["id"] !== payload.id));
              await broadcastStorageUpdateToAllTabs({ folders: await secureGet("cortex_folders", []) });
              break;
            }
            // ── Tag mutations ─────────────────────────────────────────────────
            case "CREATE:tag":
            case "UPDATE:tag": {
              const tags = await secureGet<Record<string, unknown>[]>("cortex_tags", []);
              const idx = tags.findIndex((t) => t["id"] === payload.id);
              if (idx >= 0) { tags[idx] = { ...tags[idx], ...payload }; } else { tags.unshift(payload); }
              await secureSet("cortex_tags", tags);
              await broadcastStorageUpdateToAllTabs({ tags });
              break;
            }
            case "DELETE:tag": {
              const tags = await secureGet<Record<string, unknown>[]>("cortex_tags", []);
              await secureSet("cortex_tags", tags.filter((t) => t["id"] !== payload.id));
              await broadcastStorageUpdateToAllTabs({ tags: await secureGet("cortex_tags", []) });
              break;
            }
            // ── Highlight mutations ───────────────────────────────────────────
            case "DELETE:highlight":
              await deleteHighlight(payload.id as string);
              break;
            case "MOVE:highlight": {
              const { id, folderId: mFolderId, folderName } = payload as {
                id: string; folderId?: string; folderName?: string;
              };
              const hl = await secureGet<Record<string, unknown>[]>("highlights", []);
              await secureSet("highlights", hl.map((h) =>
                h["id"] === id ? { ...h, folderId: mFolderId ?? null, folderName: folderName ?? null } : h,
              ));
              break;
            }
          }
          sendResponse({ ok: true });
        } catch (err) {
          console.error(`[Cortex Sync - SW] WEB_MUTATION error`, err);
          sendResponse({ ok: false, error: errMsg(err) });
        }
      })();
      return true;
    }

    // ── Scenarios 2, 3, 4: Side panel created a folder ───────────────────────
    // API-first: POST to server first, then persist to encrypted storage.
    // Deduped via pendingFolderCreations so concurrent SAVE_HIGHLIGHT calls
    // sharing the same temp folder id correctly await one single POST (Scenario 6).
    case "PANEL_CREATE_FOLDER": {
      const folderPayload = (message.payload ?? {}) as Record<string, unknown>;
      const tempId = folderPayload["id"] as string;
      console.log(`[Cortex Sync - SW] PANEL_CREATE_FOLDER id=${tempId}`);

      if (!pendingFolderCreations.has(tempId)) {
        const p = (async (): Promise<string> => {
          try {
            // 1. Require auth before doing anything
            const token = await getExtensionToken();
            if (!token || isJwtExpired(token)) {
              broadcastSessionExpired();
              throw new Error("NOT_AUTHENTICATED");
            }
            const base = await getApiBase();

            // 2. POST to API FIRST — no local save until server confirms
            const res = await fetch(`${base}${jPath(base, "/api/folders")}`, {
              method:  "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                // No `id` field — DB assigns PK via IDENTITY auto-increment
                name:     folderPayload["name"] ?? "Untitled",
                emoji:    folderPayload["emoji"] ?? "📁",
                parentId: folderPayload["parentId"] ?? null,
                isPinned: false,
              }),
            });

            if (res.status === 401) {
              broadcastSessionExpired();
              throw new Error("SESSION_EXPIRED");
            }

            if (!res.ok) {
              const errText = await res.text().catch(() => res.statusText);
              throw new Error(`Server error ${res.status}: ${errText}`);
            }

            const serverFolder = await res.json() as Record<string, unknown>;
            const realId = serverFolder["id"] != null ? String(serverFolder["id"]) : tempId;

            // 3. Save to encrypted storage ONLY after server confirms
            const folders = await secureGet<Record<string, unknown>[]>("cortex_folders", []);
            if (!folders.find((f) => f["id"] === realId)) {
              folders.unshift({ ...folderPayload, ...serverFolder, id: realId });
              await secureSet("cortex_folders", folders);
            }

            // 4. Broadcast to all tabs
            if (realId !== tempId) {
              tempIdMap.set(tempId, realId);
              broadcastRealIdUpdate("folder", tempId, realId);
            }
            await broadcastStorageUpdateToAllTabs({ folders: await secureGet("cortex_folders", []) });

            console.log(`[Cortex Sync - SW] PANEL_CREATE_FOLDER saved id=${realId}`);
            return realId;
          } catch (err) {
            console.error(`[Cortex Sync - SW] PANEL_CREATE_FOLDER error`, err);
            throw err;
          } finally {
            pendingFolderCreations.delete(tempId);
          }
        })();
        pendingFolderCreations.set(tempId, p);
      }

      pendingFolderCreations.get(tempId)!
        .then((realId) => sendResponse({ ok: true, realId }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;
    }

    // ── Scenarios 2, 3, 4: Side panel created a tag ──────────────────────────
    // API-first: POST to server first, then persist to encrypted storage.
    case "PANEL_CREATE_TAG": {
      const tagPayload = (message.payload ?? {}) as Record<string, unknown>;
      const tempTagId = tagPayload["id"] as string;
      console.log(`[Cortex Sync - SW] PANEL_CREATE_TAG id=${tempTagId}`);

      if (!pendingTagCreations.has(tempTagId)) {
        const p = (async (): Promise<string> => {
          try {
            // 1. Require auth before doing anything
            const token = await getExtensionToken();
            if (!token || isJwtExpired(token)) {
              broadcastSessionExpired();
              throw new Error("NOT_AUTHENTICATED");
            }
            const base = await getApiBase();

            // 2. POST to API FIRST — no local save until server confirms
            const res = await fetch(`${base}${jPath(base, "/api/tags")}`, {
              method:  "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                // No `id` field — DB assigns PK via IDENTITY auto-increment
                name:  tagPayload["name"],
                color: tagPayload["color"] ?? "blue",
              }),
            });

            if (res.status === 401) {
              broadcastSessionExpired();
              throw new Error("SESSION_EXPIRED");
            }

            if (!res.ok) {
              const errText = await res.text().catch(() => res.statusText);
              throw new Error(`Server error ${res.status}: ${errText}`);
            }

            const serverTag = await res.json() as Record<string, unknown>;
            const realId = serverTag["id"] != null ? String(serverTag["id"]) : tempTagId;

            // 3. Save to encrypted storage ONLY after server confirms
            const tags = await secureGet<Record<string, unknown>[]>("cortex_tags", []);
            if (!tags.find((t) => t["id"] === realId)) {
              tags.unshift({ ...tagPayload, ...serverTag, id: realId });
              await secureSet("cortex_tags", tags);
            }

            // 4. Broadcast to all tabs
            if (realId !== tempTagId) {
              tempIdMap.set(tempTagId, realId);
              broadcastRealIdUpdate("tag", tempTagId, realId);
            }
            await broadcastStorageUpdateToAllTabs({ tags: await secureGet("cortex_tags", []) });

            console.log(`[Cortex Sync - SW] PANEL_CREATE_TAG saved id=${realId}`);
            return realId;
          } catch (err) {
            console.error(`[Cortex Sync - SW] PANEL_CREATE_TAG error`, err);
            throw err;
          } finally {
            pendingTagCreations.delete(tempTagId);
          }
        })();
        pendingTagCreations.set(tempTagId, p);
      }

      pendingTagCreations.get(tempTagId)!
        .then((realId) => sendResponse({ ok: true, realId }))
        .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
      return true;
    }

    case "OFFLINE_FLUSH": {
      runHourlySync()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
  }
});

// ─── Sync to localhost dashboard on storage change ────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  
  // Phase 16.1 — MV3: broadcast enabled state changes to all content scripts
  if (changes["cortex_enabled"]) {
    const enabled = changes["cortex_enabled"].newValue !== false;
    chrome.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        if (tab.id != null) {
          chrome.tabs.sendMessage(tab.id, { type: "CORTEX_ENABLED_STATE", enabled }).catch(() => {});
        }
      }
    }).catch(() => {});
  }
  
  if (changes["highlights"]) {
    secureGet("highlights", [] as unknown[]).then((highlights) => {
      broadcastToDashboard("CORTEX_SYNC", "CORTEX_EXTENSION_SYNC", "highlights", highlights);
    });
  }
  if (changes["cortex_folders"]) {
    secureGet("cortex_folders", [] as unknown[]).then((folders) => {
      broadcastToDashboard("CORTEX_FOLDERS_SYNC", "CORTEX_EXTENSION_FOLDERS_SYNC", "folders", folders);
    });
  }
  if (changes["cortex_tags"]) {
    secureGet("cortex_tags", [] as unknown[]).then((tags) => {
      broadcastToDashboard("CORTEX_TAGS_SYNC", "CORTEX_EXTENSION_TAGS_SYNC", "tags", tags);
    });
  }
});

async function broadcastToDashboard(runtimeType: string, postMessageType: string, payloadKey: string, data: unknown) {
  try {
    // Query dev dashboard tabs on common dev ports (3000-3005)
    const devPortQueries = [3000, 3001, 3002, 3003, 3004, 3005].map((p) =>
      chrome.tabs.query({ url: `http://localhost:${p}/*` }).catch(() => [] as chrome.tabs.Tab[])
    );
    const [prodTabs, ...devTabArrays] = await Promise.all([
      chrome.tabs.query({ url: "https://app.cortex.so/*" }).catch(() => [] as chrome.tabs.Tab[]),
      ...devPortQueries,
    ]);
    const tabs = [...prodTabs, ...devTabArrays.flat()];
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, {
          type:    runtimeType,
          payload: data,
        }).catch(() => {
          // Tab might not have content script — fall back to scripting API
          chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            func:   (msgType: string, key: string, payload: unknown) => {
              window.postMessage(
                { type: msgType, [key]: payload },
                window.location.origin,
              );
            },
            args: [postMessageType, payloadKey, data],
          }).catch(() => { /* tab not scriptable */ });
        });
      }
    }
  } catch {
    // No matching tabs — normal when dashboard isn't open
  }
}

// ─── Hub-and-Spoke broadcast helpers ─────────────────────────────────────────

/**
 * Broadcast STORAGE_UPDATED to ALL open tabs (not just the dashboard).
 * This keeps any open Side Panel (content-script) instantly up-to-date
 * without requiring another GET_STORAGE_DATA round-trip.
 */
async function broadcastStorageUpdateToAllTabs(data: Record<string, unknown>): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "STORAGE_UPDATED", data }).catch(() => {});
      }
    }
    console.log(`[Cortex Sync - SW] STORAGE_UPDATED broadcast to ${tabs.length} tab(s)`);
  } catch { /* tabs API may not be ready during SW startup */ }
}

/**
 * Broadcast SW_REAL_ID_UPDATE to all tabs so the web app (Zustand) and any
 * open side panels can atomically swap a client-assigned temp-id for the
 * server-assigned real UUID (Scenario 3 & 6).
 */
function broadcastRealIdUpdate(entity: string, tempId: string, realId: string): void {
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "SW_REAL_ID_UPDATE", entity, tempId, realId },
        ).catch(() => {});
      }
    }
  }).catch(() => {});
}

/**
 * Phase 16.1 — Scenario 3: Broadcast SESSION_EXPIRED to all open tabs.
 * The Side Panel picks this up via STORAGE_UPDATED to show a re-login banner.
 */
function broadcastSessionExpired(): void {
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "SESSION_EXPIRED" }).catch(() => {});
      }
    }
    // Also include authState in a STORAGE_UPDATED broadcast so SidebarCapture
    // can reactively update without needing GET_STORAGE_DATA again.
    void broadcastStorageUpdateToAllTabs({ authState: { status: "expired" } });
  }).catch(() => {});
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

interface Highlight {
  id:    string;
  text:  string;
  url:   string;
  title: string;
  date:  string;
  tags:  string[];
  [key: string]: unknown;
}

/** Returns true if id is a server-assigned positive integer, false for temp ids (negative integers). */
function isRealId(id: string): boolean {
  return /^[1-9]\d*$/.test(id);
}

/**
 * Scenario 5 — Temp-ID Queue:
 * Before persisting a highlight to the server, ensure any new folder / tag
 * referenced by a temp id (negative integer, e.g. "-1", "-2") is first
 * created on the server and its real server-assigned id is swapped in.
 *
 * Phase 16.1 — Scenario 7 fix: resolves the full ancestor chain recursively.
 * If folder A (temp) is a parent of folder B (temp), we first POST A, get its
 * real server id, then POST B with that real parentId — guaranteeing depth-first
 * resolution regardless of nesting depth.
 */
async function resolveTempIds(data: Record<string, unknown>, token: string, base: string): Promise<Record<string, unknown>> {
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const resolved = { ...data };

  // ── Resolve folder temp id (with recursive parent chain) ──────────────────
  const folderId = resolved["folderId"] as string | undefined;
  if (folderId && !isRealId(folderId)) {
    const realId = await resolveOneFolderTempId(folderId, authHeader, base);
    // If still unresolved (resolution failed), null it out — never send a temp ID to the API.
    const finalFolderId = isRealId(realId) ? realId : null;
    resolved["folderId"]  = finalFolderId;
    resolved["folder_id"] = finalFolderId;
  }

  // ── Resolve tag temp ids ────────────────────────────────────────────────────
  const tagIds = resolved["tagIds"] as string[] | undefined;
  if (Array.isArray(tagIds) && tagIds.length > 0) {
    const resolvedTagIds: string[] = [];
    const storedTags = await secureGet<Array<Record<string, unknown>>>("cortex_tags", []);
    for (const tagId of tagIds) {
      if (isRealId(tagId)) {
        resolvedTagIds.push(tagId);
        continue;
      }
      // Check in-flight pending tag creation first
      if (pendingTagCreations.has(tagId)) {
        try {
          const realId = await pendingTagCreations.get(tagId)!;
          if (isRealId(realId)) resolvedTagIds.push(realId);
          // else: creation failed — skip this tag rather than FK violation
        } catch { /* skip unresolvable tag */ }
        continue;
      }
      if (tempIdMap.has(tagId)) {
        const mappedId = tempIdMap.get(tagId)!;
        if (isRealId(mappedId)) resolvedTagIds.push(mappedId);
        continue;
      }
      const tag = storedTags.find((t) => t["id"] === tagId);
      if (!tag) { /* tag not in storage — skip rather than FK violation */ continue; }
      try {
        const res = await fetch(`${base}${jPath(base, "/api/tags")}`, {
          method:  "POST",
          headers: authHeader,
          body:    JSON.stringify({ name: tag["name"], color: tag["color"] ?? "blue" }),
        });
        if (res.ok) {
          const json = await res.json() as { id?: string | number };
          const realId = json.id != null ? String(json.id) : tagId;
          if (realId !== tagId) {
            const updatedTags = storedTags.map((t) =>
              t["id"] === tagId ? { ...t, id: realId } : t,
            );
            await secureSet("cortex_tags", updatedTags);
            tempIdMap.set(tagId, realId);
          }
          if (isRealId(realId)) resolvedTagIds.push(realId);
          // else: server returned a bad ID — skip
        }
        // POST failed — skip rather than FK violation
      } catch { /* skip unresolvable tag */ }
    }
    resolved["tagIds"] = resolvedTagIds;
    resolved["tags"]   = resolvedTagIds;
  }

  return resolved;
}

/**
 * Recursively resolves a single folder temp-id to its real server-assigned id.
 * If the folder itself has a temp parentId, that parent is resolved first
 * (depth-first), satisfying the Scenario 7 deep-nest ordering requirement.
 */
async function resolveOneFolderTempId(
  folderId:   string,
  authHeader: Record<string, string>,
  base:       string,
): Promise<string> {
  // 1. In-flight PANEL_CREATE_FOLDER for this id? Await it (Scenario 6 dedup).
  if (pendingFolderCreations.has(folderId)) {
    console.log(`[Cortex Sync - SW] Scenario 6: awaiting pending folder tempId=${folderId}`);
    try { return await pendingFolderCreations.get(folderId)!; } catch { return folderId; }
  }

  // 2. Already cached in the SW's temp-id map?
  if (tempIdMap.has(folderId)) return tempIdMap.get(folderId)!;

  // 3. Look up in encrypted storage, then POST to server.
  try {
    const storedFolders = await secureGet<Array<Record<string, unknown>>>("cortex_folders", []);
    const folder = storedFolders.find((f) => f["id"] === folderId);
    if (!folder) return folderId;

    // Phase 16.1 — Scenario 7: recursively resolve parent BEFORE creating this folder.
    let resolvedParentId: string | null = (folder["parentId"] as string | undefined) ?? null;
    if (resolvedParentId && !isRealId(resolvedParentId)) {
      resolvedParentId = await resolveOneFolderTempId(resolvedParentId, authHeader, base);
    }

    const res = await fetch(`${base}${jPath(base, "/api/folders")}`, {
      method:  "POST",
      headers: authHeader,
      body:    JSON.stringify({
        // No `id` — DB assigns PK via IDENTITY auto-increment
        name:     folder["name"]  ?? "Untitled",
        emoji:    folder["emoji"] ?? "📁",
        parentId: resolvedParentId,
        isPinned: false,
      }),
    });

    if (res.ok) {
      const json = await res.json() as { id?: string | number };
      const realId = json.id != null ? String(json.id) : folderId;
      if (realId !== folderId) {
        const updatedFolders = storedFolders.map((f) =>
          f["id"] === folderId ? { ...f, id: realId } : f,
        );
        await secureSet("cortex_folders", updatedFolders);
        tempIdMap.set(folderId, realId);
      }
      return realId;
    }
  } catch { /* keep temp id; server sync will retry later */ }

  return folderId;
}

async function saveHighlight(data: Record<string, unknown>): Promise<void> {
  const token = await getExtensionToken();

  const newHighlight: Highlight = {
    id:   (data["id"] as string) || nextTempId(),
    text:  (data["text"] as string) ?? "",
    url:   (data["url"] as string) ?? "",
    title: (data["title"] ?? data["pageTitle"] ?? "") as string,
    date:  (data["date"] as string) ?? new Date().toISOString(),
    tags:  (data["tagIds"] as string[]) ?? (data["tags"] as string[]) ?? [],
    ...data,
  };

  if (!token) {
    // Unauthenticated: queue locally for later sync, do NOT persist as "saved"
    throw new Error("NOT_AUTHENTICATED");
  }

  // 1. Resolve any temp folder/tag IDs to real server UUIDs
  const base = await getApiBase();
  const resolvedData = await resolveTempIds({ ...data, id: newHighlight.id }, token, base);
  const finalHighlight: Highlight = { ...newHighlight, ...resolvedData };

  // 2. POST to server FIRST — captures the server-assigned ID from the response
  const serverAssignedId = await syncHighlightToServer(finalHighlight, base);

  // Use the server-confirmed ID so local storage is always consistent with the server.
  // This prevents temp-ID vs real-ID duplicates when the WebSocket push arrives.
  const confirmedHighlight: Highlight = { ...finalHighlight, id: serverAssignedId };

  // 3. Save to encrypted local storage AFTER server confirmed, always with real server ID
  const highlights = await secureGet<Highlight[]>("highlights", []);
  // Dedup: skip if either the real ID or the temp ID is already present
  const alreadyStored = highlights.some(
    (h) => String(h.id) === serverAssignedId || String(h.id) === String(finalHighlight.id)
  );
  if (!alreadyStored) {
    // Also evict any stale temp (negative) entry for the same text+url before inserting
    const cleaned = highlights.filter(
      (h) => Number(h.id) >= 0 || !(h.text === confirmedHighlight.text && h.url === confirmedHighlight.url)
    );
    await secureSet("highlights", [confirmedHighlight, ...cleaned].slice(0, 2000));
    await broadcastStorageUpdateToAllTabs({ highlights: await secureGet("highlights", []) });
  }
}

async function deleteHighlight(id: string): Promise<void> {
  // 1. Delete from server FIRST
  await deleteHighlightFromServer(id);

  // 2. Remove from local encrypted storage only after server confirms
  const highlights = await secureGet<Highlight[]>("highlights", []);
  await secureSet("highlights", highlights.filter((h) => h.id !== id));
  await broadcastStorageUpdateToAllTabs({ highlights: await secureGet("highlights", []) });
}

async function getHighlights(): Promise<Highlight[]> {
  return secureGet<Highlight[]>("highlights", []);
}

async function runHourlySync(): Promise<void> {
  const token = await getExtensionToken();
  if (!token || isJwtExpired(token)) return;

  const base = await getApiBase();
  try {
    const [hRes, fRes, tRes] = await Promise.all([
      fetch(`${base}${jPath(base, "/api/highlights")}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${base}${jPath(base, "/api/folders")}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${base}${jPath(base, "/api/tags")}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (hRes.ok) {
      const highlights = await hRes.json();
      await secureSet("highlights", Array.isArray(highlights) ? highlights : []);
    }

    if (fRes.ok) {
      const folders = await fRes.json();
      // Normalize IDs to strings before storing — Java API returns Long (numeric JSON)
      // to prevent string/number ID conflicts in the web dashboard.
      const normalizedFolders = (Array.isArray(folders) ? folders : []).map(
        (f: Record<string, unknown>) => ({ ...f, id: String(f.id), parentId: f.parentId != null ? String(f.parentId) : null })
      );
      await secureSet("cortex_folders", normalizedFolders);
    }

    if (tRes.ok) {
      const tags = await tRes.json();
      // Normalize IDs to strings before storing
      const normalizedTags = (Array.isArray(tags) ? tags : []).map(
        (t: Record<string, unknown>) => ({ ...t, id: String(t.id) })
      );
      await secureSet("cortex_tags", normalizedTags);
    }

    // Broadcast fresh data to all open tabs so side panels and dashboard are up-to-date
    const [highlights, folders, tags] = await Promise.all([
      secureGet("highlights", [] as unknown[]),
      secureGet("cortex_folders", [] as unknown[]),
      secureGet("cortex_tags", [] as unknown[]),
    ]);
    await broadcastStorageUpdateToAllTabs({ highlights, folders, tags });
  } catch {
    // Keep current local encrypted cache on background sync failure.
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Returns the live BFF base URL: prefers localhost dev, falls back to production. */
// ─── Cached API base ──────────────────────────────────────────────────────────
let _cachedApiBase: string | null = null;
let _cachedApiBaseTs = 0;
const API_BASE_CACHE_MS = 5 * 60 * 1000; // 5 minutes

function invalidateApiBaseCache(): void {
  _cachedApiBase = null;
  _cachedApiBaseTs = 0;
  // Also clear the persisted base so next getApiBase() re-probes
  chrome.storage.local.remove("cortex_api_base").catch(() => {});
}

async function getApiBase(): Promise<string> {
  // Return cached value if fresh enough
  if (_cachedApiBase && Date.now() - _cachedApiBaseTs < API_BASE_CACHE_MS) {
    return _cachedApiBase;
  }

  // Check if the CORTEX_AUTH_TOKEN handler saved a known base URL
  try {
    const { cortex_api_base } = await chrome.storage.local.get("cortex_api_base");
    if (typeof cortex_api_base === "string" && cortex_api_base.length > 0) {
      _cachedApiBase = cortex_api_base;
      _cachedApiBaseTs = Date.now();
      return cortex_api_base;
    }
  } catch { /* storage not available */ }

  // Probe common dev ports in order (3001, 3000 per project convention).
  // Only accept HTTP 200 so we don't accidentally pick a non-Cortex server (e.g.
  // an unrelated Express app that returns 404 for /api/auth/me).
  const devPorts = [3001, 3000, 3002, 3003, 3004, 3005];
  for (const port of devPorts) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 600);
      const r = await fetch(`http://localhost:${port}/api/auth/me`, { method: "HEAD", signal: ctrl.signal });
      clearTimeout(id);
      if (r.ok) {
        _cachedApiBase = `http://localhost:${port}`;
        _cachedApiBaseTs = Date.now();
        return _cachedApiBase;
      }
    } catch { /* port not running — try next */ }
  }
  // No BFF found — try Java directly at port 8080.
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 800);
    const r = await fetch(`${JAVA_BASE}/api/v1/auth/probe`, { method: "GET", signal: ctrl.signal });
    clearTimeout(id);
    if (r.ok) {
      _cachedApiBase = JAVA_BASE;
      _cachedApiBaseTs = Date.now();
      return JAVA_BASE;
    }
  } catch { /* Java not running either */ }

  _cachedApiBase = DASHBOARD_PROD;
  _cachedApiBaseTs = Date.now();
  return DASHBOARD_PROD;
}

async function getExtensionToken(): Promise<string | null> {
  // Try session storage first (fast path)
  try {
    const sessionResult = await chrome.storage.session.get("cortex_ext_token");
    if (sessionResult.cortex_ext_token) return sessionResult.cortex_ext_token;
  } catch { /* session storage not available */ }
  // Persistent fallback
  const localResult = await chrome.storage.local.get("cortex_ext_token");
  return localResult.cortex_ext_token ?? null;
}

async function ensureAuthenticated(): Promise<boolean> {
  const token = await getExtensionToken();
  if (token && !isJwtExpired(token)) return true;
  // Token missing or expired — open login page
  const base = await getApiBase();
  chrome.tabs.create({ url: jLoginUrl(base) });
  return false;
}

/**
 * Push a highlight to the server via BFF API.
 * Uses the extension's short-lived bearer token.
 * On 401, invalidates the API base cache and retries once with a fresh base.
 */
async function syncHighlightToServer(highlight: Highlight, base = DASHBOARD_DEV): Promise<string> {
  const token = await getExtensionToken();
  if (!token) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const rawFolderId = (highlight as Record<string, unknown>).folderId;
  // Strip any temp/negative IDs — only send real positive server-assigned IDs to the API
  const folderId = rawFolderId != null && Number(rawFolderId) > 0 ? rawFolderId : null;
  const resourceType = (highlight as Record<string, unknown>).resource_type ?? "TEXT";
  const videoTimestamp = (highlight as Record<string, unknown>).video_timestamp;

  const body = JSON.stringify({
    text:       highlight.text,
    source:     highlight.title,
    url:        highlight.url,
    topic:      (highlight as Record<string, unknown>).isAI ? "AI Chat" : "Web",
    topicColor: (highlight as Record<string, unknown>).isAI
      ? "bg-purple-500/20 text-purple-300"
      : "bg-blue-500/20 text-blue-300",
    savedAt:    highlight.date,
    tags:       highlight.tags,
    folderId:   folderId ?? null,
    resourceType: resourceType,
    videoTimestamp: videoTimestamp ?? null,
    isCode:     false,
    isFavorite: false,
    isArchived: false,
    isPinned:   false,
    isAI:       !!(highlight as Record<string, unknown>).isAI,
    chatName:   (highlight as Record<string, unknown>).chatName ?? null,
    chatUrl:    (highlight as Record<string, unknown>).chatUrl ?? null,
  });

  const doPost = async (url: string) =>
    fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body,
    });

  let res = await doPost(`${base}${jPath(base, "/api/highlights")}`);

  // On 401, the cached API base may be stale (e.g. pointed to production while
  // the token was generated by a local Java server). Invalidate and retry once.
  if (res.status === 401) {
    invalidateApiBaseCache();
    const freshBase = await getApiBase();
    if (freshBase !== base) {
      res = await doPost(`${freshBase}${jPath(freshBase, "/api/highlights")}`);
    }
  }

  if (res.status === 401) {
    await chrome.storage.local.set({ cortex_auth_state: { status: "expired" } });
    broadcastSessionExpired();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Server error ${res.status}: ${errText}`);
  }

  // Parse and return the server-assigned ID from the 201 response body
  try {
    const body = await res.json() as Record<string, unknown>;
    return String(body["id"] ?? highlight.id);
  } catch {
    return String(highlight.id); // fallback: keep temp ID (will be fixed by hourly sync)
  }
}

/**
 * Delete a highlight from the server via BFF API.
 */
async function deleteHighlightFromServer(id: string): Promise<void> {
  const token = await getExtensionToken();
  if (!token) throw new Error("NOT_AUTHENTICATED");

  let base = await getApiBase();
  const doDelete = (b: string) =>
    fetch(`${b}${jPath(b, "/api/highlights/")}${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await doDelete(base);

  if (res.status === 401) {
    invalidateApiBaseCache();
    const freshBase = await getApiBase();
    if (freshBase !== base) {
      base = freshBase;
      res = await doDelete(base);
    }
  }

  if (res.status === 401) {
    await chrome.storage.local.set({ cortex_auth_state: { status: "expired" } });
    broadcastSessionExpired();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok && res.status !== 404) {
    // 404 is acceptable — highlight may already be gone on the server
    throw new Error(`Server error ${res.status}`);
  }
}

// ─── Initialize WebSocket after extension rehydration (on service worker startup) ───
(async () => {
  const token = await getExtensionToken();
  if (token) {
    // Service worker restarted with valid token in storage — reconnect WebSocket
    activateWebsocket();
  }
})();

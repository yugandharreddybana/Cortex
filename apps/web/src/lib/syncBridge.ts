/**
 * syncBridge.ts — Web App → Extension mutation bridge.
 *
 * Hub-and-Spoke architecture (MV3 storage isolation):
 *   Web App  ──postMessage──►  Content Script (dumb forwarder)
 *                              ──sendMessage──►  Background SW  ──chrome.storage.local.set
 *
 * THIS IS THE ONLY FILE THAT SHOULD CALL window.postMessage TO THE EXTENSION.
 * The background service worker is the ONLY environment that writes to chrome.storage.
 * Content scripts and the web app NEVER touch chrome.storage directly.
 *
 * Implements all 8 synchronisation scenarios:
 *   1. Web App Online Mutation  (pushToExtension)
 *   2. Web App Offline Mutation (pushToExtension with offline:true → SW queues it)
 *   3. Panel Online Mutation, web open  (SW broadcasts SW_REAL_ID_UPDATE → CORTEX_REAL_ID_UPDATE)
 *   4. Panel Online Mutation, web closed (SW updates storage; web picks up on next load)
 *   5. Panel Offline Mutation (SW queues in chrome.storage, drains on online)
 *   6. Temp-ID Race Condition  (handled by pendingFolderCreations in background.ts)
 *   7. Hourly Background Wakeup (runHourlySync in background.ts)
 *   8. Explicit Logout  (CORTEX_LOGOUT → cryptographic shred across all environments)
 */

"use client";

const LOG = "[Cortex Sync - Web]";

export type SyncEntity = "highlight" | "folder" | "tag";
export type SyncAction = "CREATE" | "UPDATE" | "DELETE" | "MOVE";

/** Universal mutation payload sent from web app → content script → background. */
export interface SyncMessage {
  type:      "CORTEX_WEB_MUTATION";
  action:    SyncAction;
  entity:    SyncEntity;
  /** The data for this mutation (folder/tag/highlight object, or {id} for DELETE). */
  payload:   Record<string, unknown>;
  /** Client-assigned temp ID, if this is a brand-new entity (before server confirms). */
  tempId?:   string;
  timestamp: number;
  /** True when the web app is offline; the SW will queue it instead of fetching immediately. */
  offline?:  boolean;
}

/**
 * Push a single mutation from the web app to the extension background worker.
 *
 * The content script in content/index.tsx intercepts this postMessage and
 * forwards it as WEB_MUTATION to the background via chrome.runtime.sendMessage.
 * The background then:
 *   - Writes to chrome.storage.local (encrypted)
 *   - Broadcasts STORAGE_UPDATED to all open tabs (so side panels update)
 *   - For CREATE actions: POSTs to the API and broadcasts SW_REAL_ID_UPDATE
 *
 * @example
 *   pushToExtension("DELETE", "folder", { id: folder.id });
 *   pushToExtension("CREATE", "tag",    { id: newTag.id, name, color }, { tempId: newTag.id });
 */
export function pushToExtension(
  action:  SyncAction,
  entity:  SyncEntity,
  payload: Record<string, unknown>,
  opts?: { tempId?: string; offline?: boolean },
): void {
  if (typeof window === "undefined") return;

  const msg: SyncMessage = {
    type:      "CORTEX_WEB_MUTATION",
    action,
    entity,
    payload,
    tempId:    opts?.tempId,
    timestamp: Date.now(),
    offline:   opts?.offline,
  };

  console.log(`${LOG} → Mutation`, action, entity, opts?.tempId ?? String(payload.id ?? ""));

  try {
    window.postMessage(msg, window.location.origin);
  } catch (err) {
    console.warn(`${LOG} postMessage failed`, err);
  }
}

/**
 * Register a handler that fires when the browser comes back online.
 * Sends CORTEX_OFFLINE_FLUSH so the SW can drain its offline mutation queue.
 * Returns an unsubscribe function for use in useEffect cleanup.
 *
 * Usage in a provider or root layout:
 *   useEffect(() => registerOnlineFlush(), []);
 */
export function registerOnlineFlush(): () => void {
  if (typeof window === "undefined") return () => {};

  const flush = () => {
    console.log(`${LOG} Network restored — flushing offline extension queue`);
    try {
      window.postMessage(
        { type: "CORTEX_OFFLINE_FLUSH", timestamp: Date.now() },
        window.location.origin,
      );
    } catch { /* noop */ }
  };

  window.addEventListener("online", flush);
  return () => window.removeEventListener("online", flush);
}

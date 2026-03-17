// Always rehydrate session token from local storage on content script load
import("../lib/extension-auth").then(({ sendExtensionToken }) => {
  sendExtensionToken();
}).catch(() => {
  // Silently ignore if context is invalidated during initial load
});

// Listen for background request to refresh extension token
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === "REFRESH_EXTENSION_TOKEN") {
    import("../lib/extension-auth").then(({ sendExtensionToken }) => {
      sendExtensionToken();
    }).catch(() => {
      // Silently ignore if context is invalidated
    });
  }
});
// Listen for SHOW_TOAST messages from background and display a toast
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    try {
      if (message && message.type === "SHOW_TOAST" && typeof message.message === "string") {
        showToast(message.message);
      }
    } catch { /* context may be invalidated */ }
  });
}

// Listen for cortex:toast custom events dispatched from anywhere in the page (including shadow DOM)
document.addEventListener("cortex:toast", (event: Event) => {
  try {
    const detail = (event as CustomEvent).detail;
    if (typeof detail === "string") {
      showToast(detail);
    }
  } catch { /* context may be invalidated */ }
});
/**
 * Content script entry — injects the Shadow DOM host and mounts
 * the Cortex SidebarCapture React component triggered by Cmd+K / Ctrl+K.
 *
 * Also runs the Deep DOM Locator on AI chat sites when triggered
 * via `?cortex_locate=true&text=...` URL parameters.
 *
 * Shadow DOM guarantees complete CSS isolation from the host page:
 * the extension's styles never interfere with the page's styles and
 * vice versa.
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { SidebarCapture } from "./SidebarCapture";
import { runLocator } from "../locator";

// Re-export AI detection utilities for external consumers
export { isAISite, getAIContext } from "./ai-detect";

// ─── Shadow DOM mount ─────────────────────────────────────────────────────────

let reactRoot: Root | null = null;
let container: HTMLDivElement | null = null;

function ensureShadowHost(): { shadow: ShadowRoot; container: HTMLDivElement } {
  let host = document.getElementById("cortex-root");

  if (!host) {
    host = document.createElement("div");
    host.id = "cortex-root";
    Object.assign(host.style, {
      all:            "initial",
      position:       "fixed",
      top:            "0",
      right:          "0",
      width:          "0",
      height:         "0",
      zIndex:         "2147483647",
      pointerEvents:  "none",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      :host {
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        color-scheme: dark;
      }
      * {
        color-scheme: dark;
      }
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.12);
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.20);
      }
    `;
    shadow.appendChild(style);

    container = document.createElement("div");
    container.style.pointerEvents = "auto";
    shadow.appendChild(container);

    reactRoot = createRoot(container);
  }

  return {
    shadow: host.shadowRoot!,
    container: container!,
  };
}

function renderDrawer(selectedText: string) {
  ensureShadowHost();
  reactRoot!.render(
    <React.StrictMode>
      <SidebarCapture
        selectedText={selectedText}
        onClose={() => {
          reactRoot!.render(<></>);
        }}
      />
    </React.StrictMode>,
  );
}

// ─── Enabled state (cached, refreshed via message passing) ──────────────────
// Phase 16.1 — Content scripts cannot access chrome.storage directly (MV3).
// Background SW sends CORTEX_ENABLED_STATE with the enabled flag.

let cortexEnabled = true;

function setEnabledState(enabled: boolean): void {
  cortexEnabled = enabled;
}

// ─── Open drawer from selected text ──────────────────────────────────────────

function openDrawerWithSelection() {
  if (!cortexEnabled) return;
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";

  // On YouTube watch pages, allow opening with empty text (video bookmark)
  const isYouTubeWatch =
    window.location.hostname.includes("youtube.com") &&
    window.location.pathname === "/watch";

  if (!text && !isYouTubeWatch) return;

  renderDrawer(text);
}

// ─── Keyboard listener (capture phase for priority) ──────────────────────────

function handleCmdK(e: KeyboardEvent) {
  if (!cortexEnabled) return;
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod || e.key.toLowerCase() !== "k") return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  openDrawerWithSelection();
}

// ─── SPA Navigator ────────────────────────────────────────────────────────────
// Survives client-side routing (React Router, Next.js, etc.) that swaps the DOM
// without a real page reload.  The `isCmdKBound` guard prevents double-binding if
// the observer fires on the same URL multiple times.

let isCmdKBound = false;
let lastHref    = "";

function rebindListeners() {
  if (isCmdKBound) {
    document.removeEventListener("keydown", handleCmdK, { capture: true });
    window.removeEventListener(  "keydown", handleCmdK, { capture: true });
  }
  document.addEventListener("keydown", handleCmdK, { capture: true });
  window.addEventListener(  "keydown", handleCmdK, { capture: true });
  isCmdKBound = true;
  console.log("[SPA Navigator] Cmd+K rebound on", window.location.href);
}

function pingWakeAndRefreshState() {
  try {
    chrome.runtime.sendMessage({ type: "WAKE_UP" }, () => {
      // Silently ignore errors — extension may have been reloaded
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message ?? "";
        if (msg.includes("Extension context invalidated") || msg.includes("context invalidated")) {
          console.log("[Cortex] Extension context invalidated — silently continuing");
        }
        return;
      }
      // SW is awake — now safely request enabled state
      try {
        chrome.runtime.sendMessage({ type: "GET_ENABLED_STATE" }, (response) => {
          if (!chrome.runtime.lastError && response?.enabled !== undefined) {
            cortexEnabled = response.enabled;
          }
        });
      } catch { /* context invalidated after wake */ }
    });
  } catch (err) {
    // Silently ignore — context may be invalidated
    const msg = (err as Error).message ?? "";
    if (!msg.includes("context invalidated")) {
      console.warn("[Cortex] Unexpected error in pingWakeAndRefreshState:", msg);
    }
  }
}

let _spaDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function onUrlChange() {
  const href = window.location.href;
  if (href === lastHref) return;
  lastHref = href;
  console.log("[SPA Navigator] URL changed →", href);

  // Debounce: React/Vue re-renders fire MutationObserver many times per navigation
  if (_spaDebounceTimer) clearTimeout(_spaDebounceTimer);
  _spaDebounceTimer = setTimeout(() => {
    rebindListeners();
    pingWakeAndRefreshState();
    _spaDebounceTimer = null;
  }, 100);
}

function mount() {
  // Seed lastHref so the first onUrlChange call has a baseline
  lastHref = window.location.href;

  // Wake the SW and request initial enabled state
  pingWakeAndRefreshState();

  // Bind Cmd+K on both capture layers (prevents SPA frameworks from eating it)
  rebindListeners();

  // ── Monkey-patch History API (pushState / replaceState) ─────────────────
  // These are the primary SPA navigation events; they do NOT fire popstate.
  const _origPushState    = history.pushState.bind(history);
  const _origReplaceState = history.replaceState.bind(history);

  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    _origPushState(...args);
    onUrlChange();
  };
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    _origReplaceState(...args);
    onUrlChange();
  };

  // Back/forward navigation fires popstate
  window.addEventListener("popstate", onUrlChange);

  // ── MutationObserver: secondary SPA detection ────────────────────────────
  // Catches frameworks that mutate the DOM without calling history APIs
  // (e.g., hash-router, Turbolinks).  Only watches direct children of body to
  // avoid O(n) overhead on deep subtrees.
  const _spaObserver = new MutationObserver(() => {
    if (window.location.href !== lastHref) onUrlChange();
  });
  _spaObserver.observe(document.body, { childList: true, subtree: false });

  // Listen for messages from background script
  try {
    const ALLOWED_MESSAGES_WHEN_DISABLED = [
      "CORTEX_SYNC",
      "CORTEX_FOLDERS_SYNC",
      "CORTEX_TAGS_SYNC",
      "CORTEX_ENABLED_STATE",
    ];

    chrome.runtime.onMessage.addListener((message) => {
      try {
        // Phase 16.1 — MV3: background sends enabled state updates via message
        if (message?.type === "CORTEX_ENABLED_STATE") {
          setEnabledState(message.enabled === true);
        }

        if (!cortexEnabled && !ALLOWED_MESSAGES_WHEN_DISABLED.includes(message?.type)) {
          return;
        }

        if (message?.type === "OPEN_CAPTURE_DRAWER") {
          openDrawerWithSelection();
        }
        if (message?.type === "SHOW_TOAST" && message.message) {
          showToast(message.message);
        }
        // Bridge background storage broadcasts to the dashboard window
        if (message?.type === "CORTEX_SYNC" && message.payload) {
          window.postMessage({ type: "CORTEX_EXTENSION_SYNC", highlights: message.payload }, window.location.origin);
        }
        if (message?.type === "CORTEX_FOLDERS_SYNC" && message.payload) {
          window.postMessage({ type: "CORTEX_EXTENSION_FOLDERS_SYNC", folders: message.payload }, window.location.origin);
        }
        if (message?.type === "CORTEX_TAGS_SYNC" && message.payload) {
          window.postMessage({ type: "CORTEX_EXTENSION_TAGS_SYNC", tags: message.payload }, window.location.origin);
        }
        // Hub-and-Spoke: background resolved a temp-id → broadcast to web app (Scenario 3 & 6)
        if (message?.type === "SW_REAL_ID_UPDATE") {
          console.log("[Cortex Sync - Bridge] SW_REAL_ID_UPDATE →",
            message.entity, message.tempId, "→", message.realId);
          window.postMessage({
            type:   "CORTEX_REAL_ID_UPDATE",
            entity: message.entity,
            tempId: message.tempId,
            realId: message.realId,
          }, window.location.origin);
        }
        // Phase 16.1 — Scenario 3: forward session expiry to web app
        if (message?.type === "SESSION_EXPIRED") {
          window.postMessage({ type: "CORTEX_SESSION_EXPIRED" }, window.location.origin);
        }
      } catch (err) {
        // Silently ignore errors in message handler
        console.debug("[Cortex] Error in onMessage handler:", (err as Error).message);
      }
    });
  } catch { /* extension context invalidated */ }

  // Listen for save events from SidebarCapture → show page-level toast after drawer closes
  document.addEventListener("cortex:saved", () => {
    showToast("✅ Saved to Cortex!");
  });

  // Listen for delete events from the dashboard (localhost:3000) → forward to background
  // Also listen for folder/tag sync events from dashboard → forward to background
  // Also listen for auth token handoff from dashboard → forward to background
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const type = event.data?.type;
    if (!type) return;

    try {
      if (type === "CORTEX_DASHBOARD_DELETE") {
        const id = event.data.id;
        if (typeof id !== "string") return;
        chrome.runtime.sendMessage({ type: "DELETE_HIGHLIGHT", payload: { id } }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_DASHBOARD_SYNC") {
        const highlights = event.data.highlights;
        if (!Array.isArray(highlights)) return;
        chrome.runtime.sendMessage({ type: "SYNC_HIGHLIGHTS", payload: highlights }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_DASHBOARD_FOLDERS") {
        const folders = event.data.folders;
        if (!Array.isArray(folders)) return;
        chrome.runtime.sendMessage({ type: "SYNC_FOLDERS", payload: folders }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_DASHBOARD_TAGS") {
        const tags = event.data.tags;
        if (!Array.isArray(tags)) return;
        chrome.runtime.sendMessage({ type: "SYNC_TAGS", payload: tags }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_DASHBOARD_MOVE") {
        const id = event.data.id;
        const folderId = event.data.folderId;
        const folderName = event.data.folderName;
        if (typeof id !== "string") return;
        chrome.runtime.sendMessage({ type: "MOVE_HIGHLIGHT", payload: { id, folderId, folderName } }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_INIT") {
        // Dashboard just logged in — hydrate extension storage with fresh data
        const payload = event.data.payload;
        if (payload) {
          chrome.runtime.sendMessage({ type: "CORTEX_INIT", payload }, () => {
            if (chrome.runtime.lastError) { /* background waking up */ }
          });
        }
      } else if (type === "CORTEX_LOGOUT") {
        chrome.runtime.sendMessage({ type: "CORTEX_LOGOUT" }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_AUTH_TOKEN") {
        const token = event.data.token;
        if (typeof token !== "string" || !token) return;
        chrome.runtime.sendMessage({ type: "CORTEX_AUTH_TOKEN", token }, () => {
          if (chrome.runtime.lastError) { /* background waking up */ }
        });
      } else if (type === "CORTEX_WEB_MUTATION") {
        // Hub-and-Spoke: web app mutation → background (ONLY the SW writes chrome.storage)
        console.log("[Cortex Sync - Bridge] WEB_MUTATION →", event.data.action, event.data.entity);
        chrome.runtime.sendMessage({
          type:    "WEB_MUTATION",
          action:  event.data.action,
          entity:  event.data.entity,
          payload: event.data.payload,
          offline: event.data.offline,
        }, () => { if (chrome.runtime.lastError) { /* SW waking */ } });
      } else if (type === "CORTEX_OFFLINE_FLUSH") {
        // Web app is back online — tell the SW to drain queued extension mutations
        console.log("[Cortex Sync - Bridge] OFFLINE_FLUSH →");
        chrome.runtime.sendMessage({ type: "OFFLINE_FLUSH" }, () => {
          if (chrome.runtime.lastError) { /* SW waking */ }
        });
      }
    } catch (err) {
      // Silently ignore — context may be invalidated
      const msg = (err as Error).message ?? "";
      if (!msg.includes("context invalidated")) {
        console.debug("[Cortex] Error in message listener:", msg);
      }
    }
  });

  // ── Run locator if triggered via URL params ──
  runLocator();

  console.log("[Cortex Extension] Content script mounted on", window.location.hostname);
}

// Only mount once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}

// ─── Toast notification (context-menu feedback) ──────────────────────────────

function showToast(message: string) {
  try {
    const existing = document.getElementById("cortex-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "cortex-toast";
    Object.assign(toast.style, {
      position:       "fixed",
      bottom:         "16px",
      right:          "16px",
      zIndex:         "2147483647",
      padding:        "8px 16px",
      borderRadius:   "12px",
      background:     "rgba(22, 22, 28, 0.95)",
      backdropFilter: "blur(12px)",
      border:         "1px solid rgba(255, 255, 255, 0.10)",
      boxShadow:      "0 8px 32px rgba(0, 0, 0, 0.5)",
      fontFamily:     "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      fontSize:       "13px",
      fontWeight:     "500",
      color:          "rgba(255, 255, 255, 0.90)",
      transition:     "opacity 0.3s ease, transform 0.3s ease",
      opacity:        "0",
      transform:      "translateY(8px)",
      pointerEvents:  "none",
    });
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity   = "1";
      toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity   = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  } catch (err) {
    // Silently ignore — context may be invalidated, document may not be ready, etc.
    console.debug("[Cortex Toast] Error showing toast:", (err as Error).message);
  }
}

// Attach to window for SidebarCapture
(window as any).showToast = showToast;

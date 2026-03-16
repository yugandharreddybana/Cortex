// extension-auth.ts
// Phase 16.1 — MV3 compliant: content scripts NEVER access chrome.storage directly.
// All storage operations must go through the background service worker via message passing.

export async function sendExtensionToken(): Promise<void> {
  // Tell the background SW to hydrate the token from its local storage.
  // The background SW will then notify us via messages if needed.
  try {
    chrome.runtime.sendMessage({ type: "HYDRATE_EXTENSION_TOKEN" }, () => {
      if (chrome.runtime.lastError) {
        // Background script may not be ready yet, which is OK
      }
    });
  } catch (err) {
    // Content script context may be invalidated or extension disabled
  }
}

/**
 * After a successful login/signup on the dashboard, fetch a short-lived
 * extension token from the BFF and broadcast it to the Cortex Chrome
 * Extension via window.postMessage.
 *
 * The content script picks up the message and forwards it to the
 * background service worker → chrome.storage.session.
 */
export async function sendExtensionToken() {
  try {
    const res = await fetch("/api/auth/extension-token", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json() as { success: boolean; token?: string };
    if (data.success && data.token) {
      window.postMessage(
        { type: "CORTEX_AUTH_TOKEN", token: data.token },
        window.location.origin,
      );
    }
  } catch {
    // Extension not installed or BFF unreachable — silently ignore
  }
}

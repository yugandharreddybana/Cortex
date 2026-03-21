/**
 * storageManager — typed CRUD wrappers over secureGet / secureSet.
 *
 * All reads/writes to chrome.storage MUST go through the background SW.
 * This module is imported only by the background SW itself.
 *
 * Phase 16.1: extracted from background/index.ts for clarity and testability.
 */

import { secureGet, secureSet } from "./secure-storage";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface StoredFolder {
  id:        string;
  name:      string;
  emoji:     string;
  parentId?: string;
  isPinned?: boolean;
  accessRole?: string;
}

export interface StoredTag {
  id:    string;
  name:  string;
  color: string;
}

export interface StoredHighlight {
  id:    string;
  text:  string;
  url:   string;
  title: string;
  date:  string;
  tags:  string[];
  [key: string]: unknown;
}

export type AuthStatus = "authenticated" | "expired" | "unauthenticated";

export interface AuthState {
  status:     AuthStatus;
  expiresAt?: number;
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export const getFolders  = (): Promise<StoredFolder[]> =>
  secureGet<StoredFolder[]>("cortex_folders", []);

export const setFolders  = (v: StoredFolder[]): Promise<void> =>
  secureSet("cortex_folders", v);

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const getTags     = (): Promise<StoredTag[]> =>
  secureGet<StoredTag[]>("cortex_tags", []);

export const setTags     = (v: StoredTag[]): Promise<void> =>
  secureSet("cortex_tags", v);

// ─── Highlights ───────────────────────────────────────────────────────────────

export const getHighlightsFromStorage = (): Promise<StoredHighlight[]> =>
  secureGet<StoredHighlight[]>("highlights", []);

export const setHighlightsInStorage = (v: StoredHighlight[]): Promise<void> =>
  secureSet("highlights", v);

// ─── Extension Token ──────────────────────────────────────────────────────────

/**
 * Returns the extension token — prefer session storage for speed,
 * fall back to local storage (survives SW restart) for resilience.
 */
export async function getExtToken(): Promise<string | null> {
  const session = await chrome.storage.session.get("cortex_ext_token");
  if (session.cortex_ext_token) return session.cortex_ext_token as string;
  const local = await chrome.storage.local.get("cortex_ext_token");
  return (local.cortex_ext_token as string) ?? null;
}

export async function setExtToken(token: string): Promise<void> {
  await Promise.all([
    chrome.storage.session.set({ cortex_ext_token: token }),
    chrome.storage.local.set({ cortex_ext_token: token }),
  ]);
}

// ─── Auth State ───────────────────────────────────────────────────────────────

export async function getAuthState(): Promise<AuthState> {
  const { cortex_auth_state } = await chrome.storage.local.get("cortex_auth_state");
  return (cortex_auth_state as AuthState) ?? { status: "unauthenticated" };
}

export async function setAuthState(state: AuthState): Promise<void> {
  await chrome.storage.local.set({ cortex_auth_state: state });
}

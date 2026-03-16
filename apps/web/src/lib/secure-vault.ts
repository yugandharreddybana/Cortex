"use client";

import CryptoJS from "crypto-js";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

const VAULT_KEY_IDB_KEY = "cortex:vault:key";
const SESSION_VAULT_KEY = "cortex:vault:session-key";
const VAULT_PREFIX = "cortex:v1:";

let inMemoryKey: string | null = null;

async function getOrCreateDeviceSecret() {
  const existing = await idbGet<string>(VAULT_KEY_IDB_KEY);
  if (existing && existing.length >= 32) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const generated = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await idbSet(VAULT_KEY_IDB_KEY, generated);
  return generated;
}

async function resolveVaultKey(): Promise<string> {
  if (inMemoryKey) return inMemoryKey;

  if (typeof window !== "undefined") {
    const fromSession = window.sessionStorage.getItem(SESSION_VAULT_KEY);
    if (fromSession) {
      inMemoryKey = fromSession;
      return fromSession;
    }
  }

  // Fallback key for unauthenticated sessions; rotated when initializeVaultKey runs.
  const fallback = CryptoJS.SHA256(`anon:${location.hostname}`).toString();
  inMemoryKey = fallback;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_VAULT_KEY, fallback);
  }
  return fallback;
}

export async function initializeVaultKey(userScopedSeed: string) {
  const deviceSecret = await getOrCreateDeviceSecret();
  const nextKey = CryptoJS.SHA256(`${userScopedSeed}:${deviceSecret}`).toString();
  inMemoryKey = nextKey;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_VAULT_KEY, nextKey);
  }
}

export function clearVaultKey() {
  inMemoryKey = null;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_VAULT_KEY);
  }
}

export async function shredClientVault() {
  await idbDel("cortex:dashboard");
  await idbDel("cortex:sync-queue");
  await idbDel(VAULT_KEY_IDB_KEY);
  clearVaultKey();
}

export const secureIdbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const raw = await idbGet<string>(name);
    if (!raw) return null;
    if (!raw.startsWith(VAULT_PREFIX)) return raw;

    try {
      const key = await resolveVaultKey();
      const bytes = CryptoJS.AES.decrypt(raw.slice(VAULT_PREFIX.length), key);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      return plaintext || null;
    } catch {
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const key = await resolveVaultKey();
    const encrypted = CryptoJS.AES.encrypt(value, key).toString();
    await idbSet(name, `${VAULT_PREFIX}${encrypted}`);
  },

  removeItem: async (name: string): Promise<void> => {
    await idbDel(name);
  },
};

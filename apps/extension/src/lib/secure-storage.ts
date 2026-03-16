import CryptoJS from "crypto-js";

const PREFIX = "cortex:v1:";
const VAULT_KEY_STORAGE_KEY = "cortex_vault_key";

async function getVaultKey(): Promise<string | null> {
  const local = await chrome.storage.local.get(VAULT_KEY_STORAGE_KEY);
  return typeof local[VAULT_KEY_STORAGE_KEY] === "string" ? local[VAULT_KEY_STORAGE_KEY] : null;
}

export async function setVaultKeyFromSessionSeed(seed: string) {
  const key = CryptoJS.SHA256(seed).toString();
  await chrome.storage.local.set({ [VAULT_KEY_STORAGE_KEY]: key });
}

function encryptWithKey(value: unknown, key: string) {
  return `${PREFIX}${CryptoJS.AES.encrypt(JSON.stringify(value), key).toString()}`;
}

function decryptWithKey<T>(value: string, key: string): T | null {
  if (!value.startsWith(PREFIX)) return null;
  const bytes = CryptoJS.AES.decrypt(value.slice(PREFIX.length), key);
  const plaintext = bytes.toString(CryptoJS.enc.Utf8);
  if (!plaintext) return null;
  return JSON.parse(plaintext) as T;
}

export async function secureSet<T>(storageKey: string, value: T) {
  const key = await getVaultKey();
  if (!key) {
    await chrome.storage.local.set({ [storageKey]: value });
    return;
  }
  await chrome.storage.local.set({ [storageKey]: encryptWithKey(value, key) });
}

export async function secureGet<T>(storageKey: string, fallback: T): Promise<T> {
  const payload = await chrome.storage.local.get(storageKey);
  const raw = payload[storageKey];

  if (raw == null) return fallback;
  if (typeof raw !== "string") return raw as T;

  const key = await getVaultKey();
  if (!key) return fallback;

  try {
    return decryptWithKey<T>(raw, key) ?? fallback;
  } catch {
    return fallback;
  }
}

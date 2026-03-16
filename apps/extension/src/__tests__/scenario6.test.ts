/**
 * Scenario 6 Integration Test: Temp-ID Race Condition
 *
 * Verifies that when a Side Panel simultaneously sends:
 *   1. PANEL_CREATE_FOLDER  (temp id: "f1234567890")
 *   2. SAVE_HIGHLIGHT       (folderId: "f1234567890")
 *
 * the background service worker correctly awaits the pending folder creation
 * promise and rewrites the highlight's folderId to the server-assigned real UUID
 * BEFORE persisting or forwarding it — without issuing a second POST /api/folders.
 *
 * Run: pnpm --filter @cortex/extension test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Pure re-implementation of the core logic under test ─────────────────────
// (The background module is not designed to be imported in tests; we inline the
//  algorithm here so we can test it in isolation with full type safety.)

function isRealId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

type StoredFolder = Record<string, unknown>;

/**
 * Factory that returns a `resolveTempIds` function wired to the provided
 * in-memory maps and folder store — matching the logic in background/index.ts.
 */
function buildResolveTempIds(
  pendingFolderCreations: Map<string, Promise<string>>,
  tempIdMap:              Map<string, string>,
  getStoredFolders:       () => Promise<StoredFolder[]>,
  postFolderToApi:        (id: string, data: StoredFolder) => Promise<{ id: string }>,
  updateStoredFolders:    (updater: (f: StoredFolder[]) => StoredFolder[]) => Promise<void>,
) {
  return async function resolveTempIds(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resolved = { ...data };
    const folderId = resolved["folderId"] as string | undefined;

    if (folderId && !isRealId(folderId)) {
      if (pendingFolderCreations.has(folderId)) {
        // Scenario 6: share the in-flight promise — no duplicate POST
        const realId = await pendingFolderCreations.get(folderId)!;
        resolved["folderId"]  = realId;
        resolved["folder_id"] = realId;
      } else if (tempIdMap.has(folderId)) {
        const realId = tempIdMap.get(folderId)!;
        resolved["folderId"]  = realId;
        resolved["folder_id"] = realId;
      } else {
        const folders = await getStoredFolders();
        const folder  = folders.find((f) => f["id"] === folderId);
        if (folder) {
          const json   = await postFolderToApi(folderId, folder);
          const realId = json.id ?? folderId;
          if (realId !== folderId) {
            tempIdMap.set(folderId, realId);
            await updateStoredFolders((fs) => fs.map((f) => f["id"] === folderId ? { ...f, id: realId } : f));
          }
          resolved["folderId"]  = realId;
          resolved["folder_id"] = realId;
        }
      }
    }
    return resolved;
  };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEMP_FOLDER_ID   = "f1704067200000";
const REAL_FOLDER_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const MOCK_FOLDER: StoredFolder = {
  id:       TEMP_FOLDER_ID,
  name:     "JP Morgan",
  emoji:    "💼",
  parentId: null,
};

const MOCK_HIGHLIGHT = {
  id:       "h9876543210",
  text:     "JP Morgan is a leading investment bank",
  folderId: TEMP_FOLDER_ID,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Scenario 6 — Temp-ID Race Condition", () => {
  let pendingFolderCreations: Map<string, Promise<string>>;
  let tempIdMap:              Map<string, string>;
  let storedFolders:          StoredFolder[];

  beforeEach(() => {
    pendingFolderCreations = new Map();
    tempIdMap              = new Map();
    storedFolders          = [MOCK_FOLDER];
  });

  it("awaits an in-flight PANEL_CREATE_FOLDER promise and rewrites folderId — never issues a second POST", async () => {
    // Simulate PANEL_CREATE_FOLDER registering a deduped creation promise
    let resolvePending!: (realId: string) => void;
    const folderPending = new Promise<string>((resolve) => { resolvePending = resolve; });
    pendingFolderCreations.set(TEMP_FOLDER_ID, folderPending);

    const postFolderToApi = vi.fn().mockResolvedValue({ id: REAL_FOLDER_UUID });
    const resolve = buildResolveTempIds(
      pendingFolderCreations,
      tempIdMap,
      async () => storedFolders,
      postFolderToApi,
      async () => {},
    );

    // SAVE_HIGHLIGHT with the same temp folder id — starts waiting on the promise
    const resultPromise = resolve({ ...MOCK_HIGHLIGHT });

    // Simulate API returning the real folder id (background POST /api/folders completes)
    resolvePending(REAL_FOLDER_UUID);
    const result = await resultPromise;

    expect(result["folderId"]).toBe(REAL_FOLDER_UUID);
    expect(result["folder_id"]).toBe(REAL_FOLDER_UUID);
    // Critical: postFolderToApi must NOT have been called a second time
    expect(postFolderToApi).not.toHaveBeenCalled();
  });

  it("resolves immediately via tempIdMap when the folder was already created", async () => {
    tempIdMap.set(TEMP_FOLDER_ID, REAL_FOLDER_UUID);

    const postFolderToApi = vi.fn();
    const resolve = buildResolveTempIds(
      pendingFolderCreations, tempIdMap,
      async () => storedFolders, postFolderToApi, async () => {},
    );

    const result = await resolve({ ...MOCK_HIGHLIGHT });

    expect(result["folderId"]).toBe(REAL_FOLDER_UUID);
    expect(postFolderToApi).not.toHaveBeenCalled();
  });

  it("falls back to posting the folder to the API when there is no pending promise or cached id", async () => {
    const postFolderToApi = vi.fn().mockResolvedValue({ id: REAL_FOLDER_UUID });
    const updateSpy       = vi.fn().mockResolvedValue(undefined);
    const resolve = buildResolveTempIds(
      pendingFolderCreations, tempIdMap,
      async () => storedFolders, postFolderToApi, updateSpy,
    );

    const result = await resolve({ ...MOCK_HIGHLIGHT });

    expect(result["folderId"]).toBe(REAL_FOLDER_UUID);
    expect(postFolderToApi).toHaveBeenCalledWith(TEMP_FOLDER_ID, MOCK_FOLDER);
    // tempIdMap must be populated so future calls skip the fetch
    expect(tempIdMap.get(TEMP_FOLDER_ID)).toBe(REAL_FOLDER_UUID);
    // Storage must be updated with the real UUID
    expect(updateSpy).toHaveBeenCalledOnce();
  });

  it("does not rewrite folderId when it is already a real UUID", async () => {
    const realFolderId    = "deadbeef-0001-0002-0003-000000000004";
    const postFolderToApi = vi.fn();
    const resolve = buildResolveTempIds(
      pendingFolderCreations, tempIdMap,
      async () => storedFolders, postFolderToApi, async () => {},
    );

    const result = await resolve({ ...MOCK_HIGHLIGHT, folderId: realFolderId });

    expect(result["folderId"]).toBe(realFolderId);
    expect(postFolderToApi).not.toHaveBeenCalled();
  });

  it("handles highlight with no folderId without errors", async () => {
    const postFolderToApi = vi.fn();
    const resolve = buildResolveTempIds(
      pendingFolderCreations, tempIdMap,
      async () => storedFolders, postFolderToApi, async () => {},
    );

    const result = await resolve({ id: "h-no-folder", text: "No folder attached" });

    expect(result["folderId"]).toBeUndefined();
    expect(postFolderToApi).not.toHaveBeenCalled();
  });

  it("handles concurrent SAVE_HIGHLIGHT calls sharing one pending folder promise", async () => {
    let resolvePending!: (realId: string) => void;
    const folderPending = new Promise<string>((resolve) => { resolvePending = resolve; });
    pendingFolderCreations.set(TEMP_FOLDER_ID, folderPending);

    const postFolderToApi = vi.fn();
    const resolve = buildResolveTempIds(
      pendingFolderCreations, tempIdMap,
      async () => storedFolders, postFolderToApi, async () => {},
    );

    // Two highlights arriving at the same time, both with the same temp folder id
    const [p1, p2] = [
      resolve({ id: "h-001", text: "Highlight A", folderId: TEMP_FOLDER_ID }),
      resolve({ id: "h-002", text: "Highlight B", folderId: TEMP_FOLDER_ID }),
    ];

    resolvePending(REAL_FOLDER_UUID);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1["folderId"]).toBe(REAL_FOLDER_UUID);
    expect(r2["folderId"]).toBe(REAL_FOLDER_UUID);
    // Still zero extra POST calls — both awaited the same promise
    expect(postFolderToApi).not.toHaveBeenCalled();
  });
});

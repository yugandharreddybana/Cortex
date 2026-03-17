/**
 * Scenario 7 Integration Test: Deep-Nest Offline Race Condition
 *
 * Verifies that when a user creates the following chain entirely offline
 * and then comes back online:
 *
 *   ParentFolder (tempId: "f_parent")
 *     └── SubFolder (tempId: "f_sub", parentId: "f_parent")
 *           └── Highlight (folderId: "f_sub", tagIds: ["t_tag"])
 *                           Tag (tempId: "t_tag")
 *
 * the resolveTempIds function must:
 *   1. Detect that "f_sub" is a temp id.
 *   2. Look up "f_sub" in storage, find parentId = "f_parent" (also temp).
 *   3. Recursively resolve "f_parent" FIRST → POST /api/folders → real UUID "uuid-parent".
 *   4. POST "f_sub" with parentId = "uuid-parent" → real UUID "uuid-sub".
 *   5. Resolve tag "t_tag" → real UUID "uuid-tag".
 *   6. Return highlight with folderId = "uuid-sub" and tagIds = ["uuid-tag"].
 *
 * The critical invariant: /api/folders is called twice (parent then sub),
 * and the second call uses the REAL parentId from the first call.
 *
 * Run: pnpm --filter @cortex/extension test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRealId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

type StoredRecord = Record<string, unknown>;

// ─── Inline resolveTempIds with recursive parent resolution ──────────────────
// This mirrors the Phase 16.1 algorithm in background/index.ts exactly.

function buildResolver(
  pendingFolderCreations: Map<string, Promise<string>>,
  tempIdMap:              Map<string, string>,
  getStoredFolders:       () => StoredRecord[],
  setStoredFolders:       (f: StoredRecord[]) => void,
  postFolderToApi:        (id: string, name: string, emoji: string, parentId: string | null) => Promise<{ id: string }>,
  getStoredTags:          () => StoredRecord[],
  setStoredTags:          (t: StoredRecord[]) => void,
  postTagToApi:           (id: string, name: string, color: string) => Promise<{ id: string }>,
) {
  async function resolveOneFolderTempId(folderId: string): Promise<string> {
    if (pendingFolderCreations.has(folderId)) {
      return pendingFolderCreations.get(folderId)!;
    }
    if (tempIdMap.has(folderId)) return tempIdMap.get(folderId)!;

    const folders = getStoredFolders();
    const folder = folders.find((f) => f["id"] === folderId);
    if (!folder) return folderId;

    // Recursively resolve parent FIRST (Scenario 7 core logic)
    let resolvedParentId: string | null = (folder["parentId"] as string | undefined) ?? null;
    if (resolvedParentId && !isRealId(resolvedParentId)) {
      resolvedParentId = await resolveOneFolderTempId(resolvedParentId);
    }

    const json = await postFolderToApi(
      folderId,
      folder["name"] as string ?? "Untitled",
      folder["emoji"] as string ?? "📁",
      resolvedParentId,
    );
    const realId = json.id;
    if (realId !== folderId) {
      setStoredFolders(folders.map((f) => f["id"] === folderId ? { ...f, id: realId } : f));
      tempIdMap.set(folderId, realId);
    }
    return realId;
  }

  return async function resolveTempIds(data: StoredRecord): Promise<StoredRecord> {
    const resolved = { ...data };

    const folderId = resolved["folderId"] as string | undefined;
    if (folderId && !isRealId(folderId)) {
      const realId = await resolveOneFolderTempId(folderId);
      resolved["folderId"]  = realId;
      resolved["folder_id"] = realId;
    }

    const tagIds = resolved["tagIds"] as string[] | undefined;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const resolvedTagIds: string[] = [];
      const storedTags = getStoredTags();
      for (const tagId of tagIds) {
        if (isRealId(tagId)) { resolvedTagIds.push(tagId); continue; }
        if (tempIdMap.has(tagId)) { resolvedTagIds.push(tempIdMap.get(tagId)!); continue; }
        const tag = storedTags.find((t) => t["id"] === tagId);
        if (!tag) { resolvedTagIds.push(tagId); continue; }
        const json = await postTagToApi(tagId, tag["name"] as string, tag["color"] as string ?? "blue");
        const realId = json.id;
        if (realId !== tagId) {
          setStoredTags(storedTags.map((t) => t["id"] === tagId ? { ...t, id: realId } : t));
          tempIdMap.set(tagId, realId);
        }
        resolvedTagIds.push(realId);
      }
      resolved["tagIds"] = resolvedTagIds;
      resolved["tags"]   = resolvedTagIds;
    }

    return resolved;
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEMP_PARENT   = "f_parent_1704000000";
const TEMP_SUB      = "f_sub_1704000001";
const TEMP_TAG      = "t_tag_1704000002";
const REAL_PARENT   = "aaaaaaaa-0000-0000-0000-000000000001";
const REAL_SUB      = "bbbbbbbb-0000-0000-0000-000000000002";
const REAL_TAG      = "cccccccc-0000-0000-0000-000000000003";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Scenario 7 — Deep-Nest Offline Race Condition", () => {
  let storedFolders: StoredRecord[];
  let storedTags:    StoredRecord[];
  let pendingFolderCreations: Map<string, Promise<string>>;
  let tempIdMap: Map<string, string>;
  let postFolderToApi: ReturnType<typeof vi.fn>;
  let postTagToApi:    ReturnType<typeof vi.fn>;
  let resolveTempIds: ReturnType<typeof buildResolver>;

  beforeEach(() => {
    storedFolders = [
      { id: TEMP_PARENT, name: "Research", emoji: "📚", parentId: null },
      { id: TEMP_SUB,    name: "Finance",  emoji: "💰", parentId: TEMP_PARENT },
    ];
    storedTags = [
      { id: TEMP_TAG, name: "important", color: "blue" },
    ];
    pendingFolderCreations = new Map();
    tempIdMap = new Map();

    // API mocks: parent → REAL_PARENT, sub → REAL_SUB, tag → REAL_TAG
    postFolderToApi = vi.fn().mockImplementation((id: string) => {
      if (id === TEMP_PARENT) return Promise.resolve({ id: REAL_PARENT });
      if (id === TEMP_SUB)    return Promise.resolve({ id: REAL_SUB });
      return Promise.resolve({ id });
    });
    postTagToApi = vi.fn().mockResolvedValue({ id: REAL_TAG });

    resolveTempIds = buildResolver(
      pendingFolderCreations,
      tempIdMap,
      () => storedFolders,
      (f) => { storedFolders = f; },
      postFolderToApi,
      () => storedTags,
      (t) => { storedTags = t; },
      postTagToApi,
    );
  });

  it("resolves deep-nested subfolder folderId in correct order (parent first)", async () => {
    const highlight: StoredRecord = {
      id:      "h_1704000003",
      text:    "Fed raises rates",
      folderId: TEMP_SUB,
      tagIds:  [TEMP_TAG],
    };

    const resolved = await resolveTempIds(highlight);

    // folderId is now the sub-folder's real UUID
    expect(resolved["folderId"]).toBe(REAL_SUB);
    expect(resolved["folder_id"]).toBe(REAL_SUB);

    // tagIds is resolved too
    expect(resolved["tagIds"]).toEqual([REAL_TAG]);
    expect(resolved["tags"]).toEqual([REAL_TAG]);
  });

  it("calls /api/folders for parent BEFORE subfolder (correct dependency order)", async () => {
    const callOrder: string[] = [];
    postFolderToApi.mockImplementation((id: string) => {
      callOrder.push(id);
      if (id === TEMP_PARENT) return Promise.resolve({ id: REAL_PARENT });
      if (id === TEMP_SUB)    return Promise.resolve({ id: REAL_SUB });
      return Promise.resolve({ id });
    });

    await resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });

    expect(callOrder[0]).toBe(TEMP_PARENT);  // parent created first
    expect(callOrder[1]).toBe(TEMP_SUB);     // sub created second with real parentId
  });

  it("passes the REAL parent UUID as parentId when creating subfolder", async () => {
    await resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });

    const subCall = postFolderToApi.mock.calls.find(([id]) => id === TEMP_SUB);
    expect(subCall).toBeDefined();
    // Third arg is the resolved parentId
    expect(subCall![3]).toBe(REAL_PARENT);
  });

  it("does NOT call /api/folders twice for the same temp parent (tempIdMap cache)", async () => {
    // First highlight referencing sub → resolves parent
    await resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });
    const firstCount = postFolderToApi.mock.calls.length;

    // Second highlight with same sub → tempIdMap hits, no re-creation of parent
    await resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });

    // Parent should NOT be POSTed again (cached); sub is also cached
    expect(postFolderToApi.mock.calls.length).toBe(firstCount);
  });

  it("resolves REAL_SUB folderId even when parent was already created (parent real UUID in storage)", async () => {
    // Pre-populate: parent already has a real UUID
    storedFolders = [
      { id: REAL_PARENT, name: "Research", emoji: "📚", parentId: null },
      { id: TEMP_SUB,    name: "Finance",  emoji: "💰", parentId: REAL_PARENT },
    ];

    const resolved = await resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });

    expect(resolved["folderId"]).toBe(REAL_SUB);
    // Parent was NOT posted again (it already has a real UUID)
    const parentCalls = postFolderToApi.mock.calls.filter(([id]) => id === REAL_PARENT);
    expect(parentCalls.length).toBe(0);
  });

  it("deduplicates concurrent resolutions via pendingFolderCreations (Scenario 6 compat)", async () => {
    // Simulate an in-flight PANEL_CREATE_FOLDER for TEMP_SUB
    let resolvePromise!: (id: string) => void;
    const inflight = new Promise<string>((res) => { resolvePromise = res; });
    pendingFolderCreations.set(TEMP_SUB, inflight);

    // Issue resolve while promise is pending
    const pending = resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });
    resolvePromise(REAL_SUB);
    const resolved = await pending;

    expect(resolved["folderId"]).toBe(REAL_SUB);
    // postFolderToApi was never called (used the pending promise)
    expect(postFolderToApi).not.toHaveBeenCalled();
  });

  it("handles triple-deep nesting (grandparent → parent → child)", async () => {
    const TEMP_GRANDPARENT = "f_gp_1704000099";
    const REAL_GRANDPARENT = "dddddddd-0000-0000-0000-000000000004";
    const callOrder: string[] = [];

    storedFolders = [
      { id: TEMP_GRANDPARENT, name: "Level 1", emoji: "1️⃣",  parentId: null           },
      { id: TEMP_PARENT,      name: "Level 2", emoji: "2️⃣",  parentId: TEMP_GRANDPARENT },
      { id: TEMP_SUB,         name: "Level 3", emoji: "3️⃣",  parentId: TEMP_PARENT      },
    ];

    postFolderToApi.mockImplementation((id: string) => {
      callOrder.push(id);
      const map: Record<string, string> = {
        [TEMP_GRANDPARENT]: REAL_GRANDPARENT,
        [TEMP_PARENT]:      REAL_PARENT,
        [TEMP_SUB]:         REAL_SUB,
      };
      return Promise.resolve({ id: map[id] ?? id });
    });

    const resolved = await resolveTempIds({ folderId: TEMP_SUB, tagIds: [] });

    expect(resolved["folderId"]).toBe(REAL_SUB);
    expect(callOrder).toEqual([TEMP_GRANDPARENT, TEMP_PARENT, TEMP_SUB]);
  });
});

// ─── syncQueue module tests ───────────────────────────────────────────────────

import { processSyncQueue, type SyncQueueItem } from "../lib/syncQueue";

vi.mock("../lib/secure-storage", () => ({
  secureGet: vi.fn().mockResolvedValue([]),
  secureSet: vi.fn().mockResolvedValue(undefined),
}));

describe("syncQueue — processSyncQueue", () => {
  it("sorts and processes items in type-order (folder → subfolder → tag → highlight)", async () => {
    const order: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      const body = JSON.parse((opts?.body ?? "{}") as string) as { id?: string };
      order.push(body.id ?? "unknown");
      return Promise.resolve({ ok: true, json: async () => ({ id: body.id }) });
    }) as typeof fetch;

    const items: SyncQueueItem[] = [
      { type: "highlight", tempId: "h_001",      payload: {} },
      { type: "tag",       tempId: "t_001",      payload: { name: "x", color: "blue" } },
      { type: "subfolder", tempId: "f_sub",      parentTempId: "f_par", payload: { name: "Sub" } },
      { type: "folder",    tempId: "f_par",      payload: { name: "Par" } },
    ];

    await processSyncQueue(items, "tok", "http://localhost:3000");

    // folder and subfolder both call /api/folders (highlight skipped, tag calls /api/tags)
    const folderCalls = order.filter((_, i) => {
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[i]?.[0] as string;
      return typeof url === "string" && url.includes("/api/folders");
    });
    // f_par must appear before f_sub in the folder calls
    const parIdx = order.indexOf("f_par");
    const subIdx = order.indexOf("f_sub");
    expect(parIdx).toBeLessThan(subIdx);
  });
});

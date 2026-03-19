import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted variables for mock
const mockSetState = vi.fn();

vi.mock("@/store/dashboard", () => ({
  useDashboardStore: {
    setState: (...args: any[]) => mockSetState(...args),
  },
}));

let effectCallback: (() => void | (() => void)) | undefined;
let cleanupCallback: void | (() => void) | undefined;

vi.mock("react", () => ({
  useEffect: vi.fn((cb) => {
    effectCallback = cb;
  }),
  useRef: vi.fn(() => ({ current: false })),
}));

import { useServerSync } from "../useServerSync";

describe("useServerSync — error path (Sync Queue Server Fetch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSetState.mockClear();
    effectCallback = undefined;
    cleanupCallback = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (typeof cleanupCallback === "function") {
      cleanupCallback();
    }
  });

  it("attempts token refresh on 401 and bails if refresh fails", async () => {
    let fetchCallCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      fetchCallCount++;
      if (url.includes("/api/auth/refresh")) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return { ok: false, status: 401, json: async () => ({}) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    useServerSync();

    expect(effectCallback).toBeDefined();
    if (effectCallback) {
      cleanupCallback = effectCallback();
    }

    vi.runAllTimers();

    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/highlights"), expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/folders"), expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/tags"), expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({ method: "POST" }));
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it("attempts token refresh on 401 and retries fetch if refresh succeeds", async () => {
    let isRefreshed = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/highlights") || url.includes("/api/folders") || url.includes("/api/tags")) {
        if (!isRefreshed) {
          return { ok: false, status: 401, json: async () => [] };
        } else {
          if (url.includes("/api/highlights")) {
            return {
              ok: true,
              status: 200,
              json: async () => [{
                id: "1", text: "Test", source: "src", url: "url", isDeleted: false,
                topic: "Web", topicColor: "blue", savedAt: new Date().toISOString(),
                isCode: false, isFavorite: false, isArchived: false, isPinned: false
              }],
            };
          }
          if (url.includes("/api/folders")) {
            return { ok: true, status: 200, json: async () => [{ id: "f1", name: "Folder" }] };
          }
          if (url.includes("/api/tags")) {
            return { ok: true, status: 200, json: async () => [{ id: "t1", name: "Tag" }] };
          }
        }
      }
      if (url.includes("/api/auth/refresh")) {
        isRefreshed = true;
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    useServerSync();
    if (effectCallback) {
      cleanupCallback = effectCallback();
    }

    vi.runAllTimers();
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(mockSetState).toHaveBeenCalledTimes(1);

    const patch = mockSetState.mock.calls[0][0];
    expect(patch).toHaveProperty("highlights");
    expect(patch.highlights.length).toBe(1);
    expect(patch).toHaveProperty("folders");
    expect(patch.folders.length).toBe(1);
    expect(patch).toHaveProperty("tags");
    expect(patch.tags.length).toBe(1);
  });

  it("handles network failure silently (catch block)", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.reject(new Error("Network Error")));
    global.fetch = fetchMock as unknown as typeof fetch;

    useServerSync();
    if (effectCallback) {
      cleanupCallback = effectCallback();
    }

    vi.runAllTimers();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mockSetState).not.toHaveBeenCalled();
  });
});

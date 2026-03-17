import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  broadcastHighlights,
  broadcastFolders,
  broadcastTags,
  attachCrossTabListener
} from "./cross-tab-sync";
import { useDashboardStore, type Highlight, type Folder, type Tag } from "@/store/dashboard";

const mockPostMessage = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

class MockBroadcastChannel {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  postMessage = mockPostMessage;
  addEventListener = mockAddEventListener;
  removeEventListener = mockRemoveEventListener;
  close = vi.fn();
}

vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

// Mock the zustand store setState
const originalSetState = useDashboardStore.setState;
let mockSetState = vi.fn();

describe("cross-tab-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.setState = mockSetState;
  });

  afterEach(() => {
    useDashboardStore.setState = originalSetState;
  });

  describe("broadcasting", () => {
    it("should broadcast highlights", () => {
      const highlights: Highlight[] = [{ id: "1", content: "test highlight" } as any];
      broadcastHighlights(highlights);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const payload = mockPostMessage.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({
          type: "highlights:set",
          highlights: highlights,
        })
      );
      expect(payload).toHaveProperty("tabId");
    });

    it("should broadcast folders", () => {
      const folders: Folder[] = [{ id: "1", name: "test folder" } as any];
      broadcastFolders(folders);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const payload = mockPostMessage.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({
          type: "folders:set",
          folders: folders,
        })
      );
      expect(payload).toHaveProperty("tabId");
    });

    it("should broadcast tags", () => {
      const tags: Tag[] = [{ id: "1", name: "test tag" } as any];
      broadcastTags(tags);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const payload = mockPostMessage.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({
          type: "tags:set",
          tags: tags,
        })
      );
      expect(payload).toHaveProperty("tabId");
    });
  });

  describe("listener", () => {
    it("should attach and remove event listener", () => {
      const cleanup = attachCrossTabListener();
      expect(mockAddEventListener).toHaveBeenCalledWith("message", expect.any(Function));

      cleanup();
      expect(mockRemoveEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    });

    it("should handle highlights:set message", () => {
      attachCrossTabListener();
      const handler = mockAddEventListener.mock.calls[0][1];

      const highlights = [{ id: "2" }];
      handler({
        data: {
          tabId: "different-tab",
          type: "highlights:set",
          highlights,
        }
      });

      expect(mockSetState).toHaveBeenCalledWith({ highlights });
    });

    it("should handle folders:set message", () => {
      attachCrossTabListener();
      const handler = mockAddEventListener.mock.calls[0][1];

      const folders = [{ id: "2" }];
      handler({
        data: {
          tabId: "different-tab",
          type: "folders:set",
          folders,
        }
      });

      expect(mockSetState).toHaveBeenCalledWith({ folders });
    });

    it("should handle tags:set message", () => {
      attachCrossTabListener();
      const handler = mockAddEventListener.mock.calls[0][1];

      const tags = [{ id: "2" }];
      handler({
        data: {
          tabId: "different-tab",
          type: "tags:set",
          tags,
        }
      });

      expect(mockSetState).toHaveBeenCalledWith({ tags });
    });

    it("should ignore messages from the same tab", () => {
      // First, get the current tab ID by sending a message
      broadcastHighlights([]);
      const tabId = mockPostMessage.mock.calls[0][0].tabId;

      attachCrossTabListener();
      const handler = mockAddEventListener.mock.calls[0][1];

      handler({
        data: {
          tabId: tabId, // same tab
          type: "highlights:set",
          highlights: [{ id: "1" }],
        }
      });

      expect(mockSetState).not.toHaveBeenCalled();
    });

    it("should ignore empty messages", () => {
      attachCrossTabListener();
      const handler = mockAddEventListener.mock.calls[0][1];

      handler({ data: null });
      expect(mockSetState).not.toHaveBeenCalled();
    });
  });

  describe("SSR support", () => {
    it("should not error if window is undefined", () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      expect(() => broadcastHighlights([])).not.toThrow();
      const cleanup = attachCrossTabListener();
      expect(cleanup).toBeInstanceOf(Function);
      cleanup(); // should not throw

      global.window = originalWindow;
    });
  });
});

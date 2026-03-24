import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pushToExtension, registerOnlineFlush } from "./syncBridge";

describe("syncBridge", () => {
  const mockPostMessage = vi.fn();
  const mockDateNow = 1234567890;

  beforeEach(() => {
    vi.stubGlobal("window", {
      postMessage: mockPostMessage,
      location: { origin: "http://localhost:3000" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("navigator", {
      onLine: true,
    });
    vi.spyOn(Date, "now").mockReturnValue(mockDateNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("pushToExtension", () => {
    it("should send a CORTEX_WEB_MUTATION message via window.postMessage", () => {
      const payload = { id: "123", name: "Test Folder" };
      pushToExtension("CREATE", "folder", payload);

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "CORTEX_WEB_MUTATION",
          action: "CREATE",
          entity: "folder",
          payload,
          tempId: undefined,
          timestamp: mockDateNow,
          offline: undefined,
        },
        "http://localhost:3000"
      );
    });

    it("should handle tempId and offline options", () => {
      const payload = { name: "New Tag" };
      pushToExtension("CREATE", "tag", payload, { tempId: "temp-456", offline: true });

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "CORTEX_WEB_MUTATION",
          action: "CREATE",
          entity: "tag",
          payload,
          tempId: "temp-456",
          timestamp: mockDateNow,
          offline: true,
        },
        "http://localhost:3000"
      );
    });

    it("should handle postMessage failures gracefully", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockPostMessage.mockImplementationOnce(() => {
        throw new Error("postMessage error");
      });

      pushToExtension("DELETE", "highlight", { id: "h1" });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("postMessage failed"),
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe("registerOnlineFlush", () => {
    it("should register an 'online' event listener", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      registerOnlineFlush();

      expect(addEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
    });

    it("should send CORTEX_OFFLINE_FLUSH when online event is triggered", () => {
      let onlineHandler: () => void = () => {};
      vi.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
        if (event === "online") onlineHandler = handler as () => void;
      });

      registerOnlineFlush();
      onlineHandler();

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: "CORTEX_OFFLINE_FLUSH",
          timestamp: mockDateNow,
        },
        "http://localhost:3000"
      );
    });

    it("should return an unsubscribe function that removes the event listener", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const unsubscribe = registerOnlineFlush();

      unsubscribe();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateWebsocket } from "./websocket";
import { useSyncStore } from "@/store/useSyncStore";
import { Client } from "@stomp/stompjs";

const mocks = vi.hoisted(() => {
  return {
    activate: vi.fn(),
    subscribe: vi.fn(),
    onConnectCallback: undefined as (() => void) | undefined,
    onStompErrorCallback: undefined as ((frame: any) => void) | undefined,
    onWebSocketErrorCallback: undefined as ((error: any) => void) | undefined,
    onWebSocketCloseCallback: undefined as ((error: any) => void) | undefined,
  };
});

vi.mock("@stomp/stompjs", () => {
  return {
    Client: vi.fn().mockImplementation((config) => {
      if (config && config.onConnect) mocks.onConnectCallback = config.onConnect;
      if (config && config.onStompError) mocks.onStompErrorCallback = config.onStompError;
      if (config && config.onWebSocketError) mocks.onWebSocketErrorCallback = config.onWebSocketError;
      if (config && config.onWebSocketClose) mocks.onWebSocketCloseCallback = config.onWebSocketClose;
      return {
        activate: mocks.activate,
        subscribe: mocks.subscribe,
      };
    }),
  };
});

describe("websocket", () => {
  beforeEach(() => {
    // We cannot clear all mocks since the Client constructor is called on module load
    mocks.activate.mockClear();
    mocks.subscribe.mockClear();
    useSyncStore.setState({ folders: [], tags: [] });
  });

  it("should initialize client with correct brokerURL", () => {
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerURL: "ws://localhost:8082/ws",
      })
    );
  });

  it("activateWebsocket should call client.activate", () => {
    activateWebsocket();
    expect(mocks.activate).toHaveBeenCalledTimes(1);
  });

  it("should handle onConnect and setup subscriptions", () => {
    expect(mocks.onConnectCallback).toBeDefined();
    mocks.onConnectCallback!();

    expect(mocks.subscribe).toHaveBeenCalledTimes(3);
    expect(mocks.subscribe).toHaveBeenCalledWith("/user/topic/folders", expect.any(Function));
    expect(mocks.subscribe).toHaveBeenCalledWith("/user/topic/folders/deleted", expect.any(Function));
    expect(mocks.subscribe).toHaveBeenCalledWith("/user/topic/tags", expect.any(Function));
  });

  it("should add folder to store when message received on /user/topic/folders", () => {
    mocks.onConnectCallback!();
    const folderSubCall = mocks.subscribe.mock.calls.find(call => call[0] === "/user/topic/folders");
    const callback = folderSubCall![1];

    const mockFolder = { id: "1", name: "Test Folder", emoji: "📁" };
    callback({ body: JSON.stringify(mockFolder) });

    const storeState = useSyncStore.getState();
    expect(storeState.folders).toHaveLength(1);
    expect(storeState.folders[0]).toEqual(mockFolder);
  });

  it("should delete folder from store when message received on /user/topic/folders/deleted", () => {
    useSyncStore.getState().addFolder({ id: "1", name: "Test Folder", emoji: "📁" });
    mocks.onConnectCallback!();
    const folderDeletedSubCall = mocks.subscribe.mock.calls.find(call => call[0] === "/user/topic/folders/deleted");
    const callback = folderDeletedSubCall![1];

    callback({ body: JSON.stringify("1") });

    const storeState = useSyncStore.getState();
    expect(storeState.folders).toHaveLength(0);
  });

  it("should add tag to store when message received on /user/topic/tags", () => {
    mocks.onConnectCallback!();
    const tagSubCall = mocks.subscribe.mock.calls.find(call => call[0] === "/user/topic/tags");
    const callback = tagSubCall![1];

    const mockTag = { id: "t1", name: "Test Tag", color: "red" };
    callback({ body: JSON.stringify(mockTag) });

    const storeState = useSyncStore.getState();
    expect(storeState.tags).toHaveLength(1);
    expect(storeState.tags[0]).toEqual(mockTag);
  });

  it("should handle STOMP errors", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mocks.onStompErrorCallback).toBeDefined();

    const mockFrame = {
      headers: { message: "Test STOMP Error" },
      body: "Error details",
    };

    mocks.onStompErrorCallback!(mockFrame);

    expect(consoleErrorSpy).toHaveBeenCalledWith("STOMP error:", "Test STOMP Error", "Error details");
    consoleErrorSpy.mockRestore();
  });

  it("should handle WebSocket errors", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mocks.onWebSocketErrorCallback).toBeDefined();

    const mockError = new Error("WebSocket connection failed");

    mocks.onWebSocketErrorCallback!(mockError);

    expect(consoleErrorSpy).toHaveBeenCalledWith("WebSocket error:", mockError);
    consoleErrorSpy.mockRestore();
  });
});

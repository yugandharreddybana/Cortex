import { Client } from "@stomp/stompjs";
import { useSyncStore } from "@/store/useSyncStore";

const client = new Client({
  brokerURL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws",
  onConnect: () => {
    client.subscribe("/user/topic/folders", (message) => {
      const folder = JSON.parse(message.body);
      useSyncStore.getState().addFolder(folder);
    });
    client.subscribe("/user/topic/folders/deleted", (message) => {
        const folderId = JSON.parse(message.body);
        useSyncStore.getState().deleteFolder(folderId);
      });
    client.subscribe("/user/topic/tags", (message) => {
        const tag = JSON.parse(message.body);
        useSyncStore.getState().addTag(tag);
    });
  },
  onWebSocketError: (error) => {
    console.error("WebSocket error:", error);
  },
  onStompError: (frame) => {
    console.error("STOMP error:", frame.headers["message"], frame.body);
  },
});

export function activateWebsocket() {
  client.activate();
}

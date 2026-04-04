"use client";

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { useAuthStore } from "@/store/authStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";

export type ResourceUpdateEvent = {
  type: string;
  data: any;
  timestamp: string;
};

/**
 * useResourceSync — dynamically subscribes to a specific resource's activity topic.
 * Useful for real-time updates of comments, edits, or deletions on a specific
 * highlight or folder page.
 */
export function useResourceSync(
  resourceType: "highlight" | "folder",
  resourceId: string | number | undefined,
  onEvent: (event: ResourceUpdateEvent) => void
) {
  const { user } = useAuthStore();
  const clientRef = useRef<Client | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!resourceId || !user) return;
    mountedRef.current = true;

    let stompClient: Client;

    async function connect() {
      try {
        const res = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (!res.ok || !mountedRef.current) return;
        const { token } = (await res.json()) as { token: string };

        stompClient = new Client({
          brokerURL: WS_URL,
          connectHeaders: { Authorization: `Bearer ${token}` },
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          onConnect: () => {
            if (!mountedRef.current) return;
            const topic = `/topic/resource-updates/${resourceType}/${resourceId}`;
            stompClient.subscribe(topic, (msg) => {
              try {
                const event = JSON.parse(msg.body) as ResourceUpdateEvent;
                onEvent(event);
              } catch (e) {
                console.error("[ResourceSync] Failed to parse event", e);
              }
            });
          },
        });

        clientRef.current = stompClient;
        stompClient.activate();
      } catch (err) {
        console.error("[ResourceSync] Connection error", err);
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [resourceType, resourceId, user, onEvent]);
}

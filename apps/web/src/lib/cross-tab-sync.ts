"use client";

import { useDashboardStore, type Folder, type Highlight, type Tag } from "@/store/dashboard";

const CHANNEL_NAME = "cortex_sync";
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type DeltaMessage =
  | { tabId: string; type: "highlights:set"; highlights: Highlight[] }
  | { tabId: string; type: "folders:set"; folders: Folder[] }
  | { tabId: string; type: "tags:set"; tags: Tag[] };

let channel: BroadcastChannel | null = null;

function getChannel() {
  if (typeof window === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastHighlights(highlights: Highlight[]) {
  getChannel()?.postMessage({ tabId: TAB_ID, type: "highlights:set", highlights } satisfies DeltaMessage);
}

export function broadcastFolders(folders: Folder[]) {
  getChannel()?.postMessage({ tabId: TAB_ID, type: "folders:set", folders } satisfies DeltaMessage);
}

export function broadcastTags(tags: Tag[]) {
  getChannel()?.postMessage({ tabId: TAB_ID, type: "tags:set", tags } satisfies DeltaMessage);
}

export function attachCrossTabListener() {
  const bc = getChannel();
  if (!bc) return () => {};

  const handler = (event: MessageEvent<DeltaMessage>) => {
    if (!event.data || event.data.tabId === TAB_ID) return;
    if (event.data.type === "highlights:set") {
      useDashboardStore.setState({ highlights: event.data.highlights });
    }
    if (event.data.type === "folders:set") {
      useDashboardStore.setState({ folders: event.data.folders });
    }
    if (event.data.type === "tags:set") {
      useDashboardStore.setState({ tags: event.data.tags });
    }
  };

  bc.addEventListener("message", handler);
  return () => bc.removeEventListener("message", handler);
}

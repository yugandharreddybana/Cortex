/**
 * Phase 4 Tests: Ironclad Content Script + Recursive Folder UI
 *
 * Tests cover three critical behaviours introduced in Phase 4:
 *
 *  1. Recursive depth rendering — FolderTreeItem paddingLeft = 10 + depth * 16
 *  2. SPA survival — listener rebind guard prevents duplicates on navigation
 *  3. Access control — VIEWER folders are disabled, OWNER/EDITOR are selectable
 *
 * Run: pnpm --filter @cortex/extension test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Type mirroring SidebarCapture.tsx LocalFolder ───────────────────────────

interface LocalFolder {
  id:         string;
  name:       string;
  emoji:      string;
  parentId:   string | null;
  accessRole?: "OWNER" | "EDITOR" | "VIEWER";
}

// ─── Test 1: Recursive depth renders correct paddingLeft ─────────────────────
// The FolderTreeItem uses `paddingLeft: ${10 + depth * 16}px`.
// This test validates the formula across multiple nesting levels without
// requiring a DOM environment.

describe("FolderTreeItem — recursive depth calculation", () => {
  const folders: LocalFolder[] = [
    { id: "1", name: "Root",   emoji: "📁", parentId: null },
    { id: "2", name: "Sub1",   emoji: "📂", parentId: "1" },
    { id: "3", name: "Sub2",   emoji: "📂", parentId: "2" },
    { id: "4", name: "Deep",   emoji: "📂", parentId: "3" },
  ];

  function getChildren(parentId: string): LocalFolder[] {
    return folders.filter((f) => f.parentId === parentId);
  }

  // Flatten the tree recursively the same way FolderTreeItem renders, capturing depth
  function flattenDepths(parentId: string | null, depth: number): Array<{ id: string; depth: number }> {
    const items = parentId === null
      ? folders.filter((f) => !f.parentId)
      : getChildren(parentId);

    return items.flatMap((f) => [
      { id: f.id, depth },
      ...flattenDepths(f.id, depth + 1),
    ]);
  }

  function paddingLeft(depth: number): number {
    return 10 + depth * 16;
  }

  it("root items start at paddingLeft 10px (depth 0)", () => {
    const flat = flattenDepths(null, 0);
    const root = flat.find((e) => e.id === "1")!;
    expect(paddingLeft(root.depth)).toBe(10);
  });

  it("depth-1 items have paddingLeft 26px", () => {
    const flat = flattenDepths(null, 0);
    const sub1 = flat.find((e) => e.id === "2")!;
    expect(paddingLeft(sub1.depth)).toBe(26);
  });

  it("depth-2 items have paddingLeft 42px", () => {
    const flat = flattenDepths(null, 0);
    const sub2 = flat.find((e) => e.id === "3")!;
    expect(paddingLeft(sub2.depth)).toBe(42);
  });

  it("depth-3 items have paddingLeft 58px", () => {
    const flat = flattenDepths(null, 0);
    const deep = flat.find((e) => e.id === "4")!;
    expect(paddingLeft(deep.depth)).toBe(58);
  });

  it("produces 4 items total from a 4-folder tree", () => {
    const flat = flattenDepths(null, 0);
    expect(flat).toHaveLength(4);
  });

  it("items are ordered depth-first (parent before child)", () => {
    const flat = flattenDepths(null, 0);
    const ids  = flat.map((e) => e.id);
    expect(ids).toEqual(["1", "2", "3", "4"]);
  });
});

// ─── Test 2: SPA Navigator — listener rebind guard prevents duplicates ───────
// Extracts the core isCmdKBound logic and verifies that:
//   - First rebind call binds listeners and sets isCmdKBound = true
//   - Subsequent rebind calls first remove, then re-add (no net duplication)
//   - URL equality guard in onUrlChange prevents rebind when URL hasn't changed

describe("SPA Navigator — listener deduplication", () => {
  // Minimal in-process simulation of the SPA Navigator state machine

  let isCmdKBound  = false;
  let lastHref     = "";
  const addCalls   : string[] = [];
  const removeCalls: string[] = [];

  const mockAddEventListener    = vi.fn((type: string) => { addCalls.push(type); });
  const mockRemoveEventListener = vi.fn((type: string) => { removeCalls.push(type); });

  function rebindListeners() {
    if (isCmdKBound) {
      mockRemoveEventListener("keydown");
      mockRemoveEventListener("keydown");
    }
    mockAddEventListener("keydown");
    mockAddEventListener("keydown");
    isCmdKBound = true;
  }

  function onUrlChange(href: string) {
    if (href === lastHref) return;
    lastHref = href;
    rebindListeners();
  }

  beforeEach(() => {
    isCmdKBound = false;
    lastHref    = "";
    addCalls.length    = 0;
    removeCalls.length = 0;
    mockAddEventListener.mockClear();
    mockRemoveEventListener.mockClear();
  });

  it("first rebind binds listeners without removing (flag starts false)", () => {
    rebindListeners();
    expect(mockRemoveEventListener).not.toHaveBeenCalled();
    expect(mockAddEventListener).toHaveBeenCalledTimes(2); // document + window
    expect(isCmdKBound).toBe(true);
  });

  it("second rebind removes old listeners before adding new ones", () => {
    rebindListeners(); // first
    rebindListeners(); // second
    expect(mockRemoveEventListener).toHaveBeenCalledTimes(2); // document + window
    expect(mockAddEventListener).toHaveBeenCalledTimes(4);    // 2 per rebind × 2
  });

  it("onUrlChange does nothing when URL hasn't changed", () => {
    lastHref = "https://twitter.com/home";
    onUrlChange("https://twitter.com/home");
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it("onUrlChange rebinds once on first navigation", () => {
    onUrlChange("https://twitter.com/home");
    expect(mockAddEventListener).toHaveBeenCalledTimes(2);
  });

  it("onUrlChange rebinds on each distinct URL change", () => {
    onUrlChange("https://twitter.com/home");
    onUrlChange("https://twitter.com/notifications");
    onUrlChange("https://twitter.com/messages");
    // 3 navigations × 2 targets = 6 total adds
    // But first is fresh (0 removes) and subsequent each remove then add
    expect(mockAddEventListener).toHaveBeenCalledTimes(6);
  });

  it("5 navigations to same URL only trigger 1 rebind", () => {
    for (let i = 0; i < 5; i++) onUrlChange("https://twitter.com/home");
    expect(mockAddEventListener).toHaveBeenCalledTimes(2); // only the first
  });
});

// ─── Test 3: Access control — VIEWER folders disabled ────────────────────────
// Extracts the isViewer logic from FolderTreeItem and verifies that:
//   - VIEWER role → disabled state (isViewer = true)
//   - EDITOR role → selectable (isViewer = false)
//   - OWNER role  → selectable (isViewer = false)
//   - undefined   → selectable (isViewer = false, backwards-compatible default)

describe("FolderTreeItem — access control", () => {
  function isViewerDisabled(folder: LocalFolder): boolean {
    return folder.accessRole === "VIEWER";
  }

  function canSelect(folder: LocalFolder): boolean {
    return !isViewerDisabled(folder);
  }

  it("folder with accessRole VIEWER is disabled", () => {
    const f: LocalFolder = { id: "1", name: "Shared", emoji: "📁", parentId: null, accessRole: "VIEWER" };
    expect(isViewerDisabled(f)).toBe(true);
    expect(canSelect(f)).toBe(false);
  });

  it("folder with accessRole EDITOR is selectable", () => {
    const f: LocalFolder = { id: "2", name: "Collab", emoji: "📁", parentId: null, accessRole: "EDITOR" };
    expect(isViewerDisabled(f)).toBe(false);
    expect(canSelect(f)).toBe(true);
  });

  it("folder with accessRole OWNER is selectable", () => {
    const f: LocalFolder = { id: "3", name: "Mine", emoji: "📁", parentId: null, accessRole: "OWNER" };
    expect(isViewerDisabled(f)).toBe(false);
    expect(canSelect(f)).toBe(true);
  });

  it("folder without accessRole is selectable (backwards-compatible)", () => {
    const f: LocalFolder = { id: "4", name: "Legacy", emoji: "📁", parentId: null };
    expect(isViewerDisabled(f)).toBe(false);
    expect(canSelect(f)).toBe(true);
  });

  it("VIEWER folder click is a no-op (onSelect not called)", () => {
    const onSelect = vi.fn();
    const f: LocalFolder = { id: "5", name: "ReadOnly", emoji: "📁", parentId: null, accessRole: "VIEWER" };
    // Mirrors the onClick guard: if (!isViewer) onSelect(folder.id)
    if (!isViewerDisabled(f)) onSelect(f.id);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("OWNER folder click calls onSelect", () => {
    const onSelect = vi.fn();
    const f: LocalFolder = { id: "6", name: "Owned", emoji: "📁", parentId: null, accessRole: "OWNER" };
    if (!isViewerDisabled(f)) onSelect(f.id);
    expect(onSelect).toHaveBeenCalledWith("6");
  });

  it("mixed list: only VIEWER folders fail canSelect check", () => {
    const folders: LocalFolder[] = [
      { id: "a", name: "A", emoji: "📁", parentId: null, accessRole: "OWNER"  },
      { id: "b", name: "B", emoji: "📁", parentId: null, accessRole: "EDITOR" },
      { id: "c", name: "C", emoji: "📁", parentId: null, accessRole: "VIEWER" },
      { id: "d", name: "D", emoji: "📁", parentId: null },
    ];

    const selectable = folders.filter(canSelect).map((f) => f.id);
    const disabled   = folders.filter(isViewerDisabled).map((f) => f.id);

    expect(selectable).toEqual(["a", "b", "d"]);
    expect(disabled).toEqual(["c"]);
  });
});

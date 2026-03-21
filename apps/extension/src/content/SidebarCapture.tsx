import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAIContext } from "./ai-detect";

// ─── Temp-ID counter (negative integers, never conflict with server PKs) ──────
let _tempIdCounter = 0;
function nextTempId(): string { return String(--_tempIdCounter); }

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalFolder {
  id:         string;
  name:       string;
  emoji:      string;
  parentId:   string | null;
  /** Phase 4 — collaboration access control; VIEWER folders cannot be
   *  selected as a save destination but remain visible for context. */
  accessRole?: "OWNER" | "EDITOR" | "VIEWER";
}

interface LocalTag {
  id:    string;
  name:  string;
  color: string;
}

type AuthStatus = "authenticated" | "expired" | "unauthenticated";
interface AuthState { status: AuthStatus; }

interface SidebarCaptureProps {
  selectedText: string;
  onClose:      () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE_SNAPPY: [number, number, number, number] = [0.16, 1, 0.3, 1];

const HIGHLIGHT_COLORS = [
  { id: "purple", value: "#6C63FF", label: "Purple" },
  { id: "green",  value: "#22C55E", label: "Green"  },
  { id: "amber",  value: "#F59E0B", label: "Amber"  },
  { id: "red",    value: "#EF4444", label: "Red"    },
];

const TAG_COLORS = ["blue", "violet", "emerald", "amber", "pink", "teal"];

const TAG_COLOR_MAP: Record<string, string> = {
  blue:    "#3B82F6",
  violet:  "#8B5CF6",
  emerald: "#10B981",
  amber:   "#F59E0B",
  pink:    "#EC4899",
  teal:    "#14B8A6",
};

// ─── Extension context guard ──────────────────────────────────────────────────

function isContextValid(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPageContext() {
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
  ];
  let faviconUrl = new URL("/favicon.ico", window.location.href).href;
  for (const sel of selectors) {
    const el = document.querySelector<HTMLLinkElement>(sel);
    if (el?.href) { faviconUrl = el.href; break; }
  }
  return { pageTitle: document.title || window.location.hostname, faviconUrl };
}

function isInCodeBlock(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let node: Node | null = sel.anchorNode;
  while (node) {
    const name = (node as Element).tagName?.toUpperCase?.();
    if (name === "PRE" || name === "CODE") return true;
    node = node.parentNode;
  }
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SidebarCapture({ selectedText, onClose }: SidebarCaptureProps) {
  const [text, setText] = useState(selectedText);
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [tags, setTags] = useState<LocalTag[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null); // null = root folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  // Phase 16.1 — Scenario 3: track auth state from background
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const savingRef = useRef(false);
  const unmountedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aiCtx = getAIContext();

  // ── YouTube detection ──
  const isYouTube = typeof window !== "undefined"
    && window.location.hostname.includes("youtube.com")
    && window.location.pathname === "/watch";

  const ytTimestamp = isYouTube ? (() => {
    const video = document.querySelector("video");
    return video ? Math.floor(video.currentTime) : 0;
  })() : 0;

  const ytFormattedTime = (() => {
    const hrs  = Math.floor(ytTimestamp / 3600);
    const mins = Math.floor((ytTimestamp % 3600) / 60);
    const secs = ytTimestamp % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  })();

  // Extract YouTube video ID for thumbnail
  const ytVideoId = isYouTube ? (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("v") ?? null;
    } catch { return null; }
  })() : null;

  // Helper to stop events from leaking to host page (e.g. YouTube spacebar)
  const stopProp = (e: React.KeyboardEvent) => e.stopPropagation();

  // Load local folders + tags + auth token from background script
  useEffect(() => {
    if (!isContextValid()) return;
    
    // Request initial data from background script
    chrome.runtime.sendMessage(
      { type: "GET_STORAGE_DATA" },
      (response) => {
        if (!chrome.runtime.lastError && response) {
          setFolders(response.folders ?? []);
          setTags(response.tags ?? []);
          setToken(response.token ?? null);
          if (response.authState) setAuthState(response.authState as AuthState);
        }
      }
    );

    // Listen for storage updates from background script
    const handleMessage = (msg: Record<string, unknown>) => {
      if (msg.type === "STORAGE_UPDATED") {
        const data = msg.data as Record<string, unknown> | undefined;
        if (data) {
          if ("folders" in data) {
            const folders = data.folders as unknown[];
            setFolders(Array.isArray(folders) ? (folders as LocalFolder[]) : []);
          }
          if ("tags" in data) {
            const tags = data.tags as unknown[];
            setTags(Array.isArray(tags) ? (tags as LocalTag[]) : []);
          }
          if ("token" in data) setToken((data.token as string | null) ?? null);
          // Phase 16.1 — update auth state from broadcast
          if ("authState" in data) setAuthState(data.authState as AuthState);
        }
      }
      // Phase 16.1 — SESSION_EXPIRED from background (Scenario 3)
      if (msg.type === "SESSION_EXPIRED") {
        setAuthState({ status: "expired" });
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      unmountedRef.current = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Save handler ──
  const handleSave = useCallback(() => {
    if (savingRef.current || isSaving) return;

    const trimmedText = text.trim();
    const finalText = trimmedText
      ? trimmedText
      : isYouTube
        ? `📍 Video Bookmark at ${ytFormattedTime}`
        : "";
    if (!finalText) return;

    savingRef.current = true;
    setIsSaving(true);

    const { pageTitle, faviconUrl } = getPageContext();
    const isCode = isInCodeBlock();
    const currentAiCtx = getAIContext();
    const folder = folders.find((f) => f.id === selectedFolderId);
    const baseUrl = window.location.href.split("#")[0].split("?")[0];
    const encodedText = encodeURIComponent(finalText.slice(0, 300));
    const finalUrl = isYouTube
      ? `${baseUrl}?t=${ytTimestamp}`
      : `${baseUrl}?cortex_locate=true&text=${encodedText}#:~:text=${encodedText}`;

    const payload: Record<string, unknown> = {
      id:              nextTempId(),
      text:            finalText,
      url:             finalUrl,
      pageTitle,
      faviconUrl,
      folderId:        selectedFolderId ?? undefined,
      folderName:      folder?.name,
      highlightColor:  selectedColor.value,
      timestamp:       Date.now(),
      isCode,
      isAI:            currentAiCtx.isAI,
      tagIds:          selectedTagIds,
    };
    if (isYouTube) {
      payload.resource_type   = "VIDEO";
      payload.video_timestamp = ytTimestamp;
    }

    if (!isContextValid()) {
      savingRef.current = false;
      setIsSaving(false);
      return;
    }

    try {
      chrome.runtime.sendMessage({ type: "SAVE_HIGHLIGHT", payload }, (response) => {
        if (unmountedRef.current) return;
        if (chrome.runtime.lastError) {
          savingRef.current = false;
          setIsSaving(false);
          return;
        }

        if (response && response.error === "NOT_AUTHENTICATED") {
          if (response.queued) {
            // Highlight was queued in pending_highlight — will drain on next login
            const evt = new CustomEvent("cortex:toast", {
              detail: "Queued! Your highlight will be saved once you sign in.",
            });
            document.dispatchEvent(evt);
            // Automatically open the Cortex login page so the user can sign in
            chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
            savingRef.current = false;
            setIsSaving(false);
            onClose();
          } else {
            const evt = new CustomEvent("cortex:toast", { detail: "You must be signed in to Cortex to save highlights." });
            document.dispatchEvent(evt);
            setAuthState({ status: "unauthenticated" });
            savingRef.current = false;
            setIsSaving(false);
          }
          return;
        }

        if (response && response.ok) {
          setSaved(true);
          try {
            document.dispatchEvent(new CustomEvent("cortex:saved"));
          } catch { /* noop */ }

          saveTimeoutRef.current = setTimeout(() => {
            if (unmountedRef.current) return;
            savingRef.current = false;
            setIsSaving(false);
            onClose();
          }, 1500);
        } else {
          // General save error or SESSION_EXPIRED
          const errMessage = response?.error === "SESSION_EXPIRED"
            ? "Session expired. Please re-login."
            : response?.error || "Failed to save highlight.";

          if (response?.error === "SESSION_EXPIRED") {
            setAuthState({ status: "expired" });
          }

          const evt = new CustomEvent("cortex:toast", { detail: errMessage });
          document.dispatchEvent(evt);
          savingRef.current = false;
          setIsSaving(false);
        }
      });
    } catch {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [text, folders, selectedFolderId, selectedColor, selectedTagIds, onClose, isSaving, isYouTube, ytFormattedTime, ytTimestamp]);

  // ── Folder creation ──
  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) return;
    const newFolder: LocalFolder = {
      id:       nextTempId(),
      name,
      emoji:    "📁",
      parentId: newFolderParent || null,
    };
    // Optimistic UI update — temp-id used until background confirms the real UUID
    setFolders((prev) => [...prev, newFolder]);
    setSelectedFolderId(newFolder.id);
    setNewFolderName("");
    setNewFolderParent(null);
    setShowNewFolder(false);
    // Hub-and-Spoke: ONLY the background SW may write to chrome.storage.local
    if (isContextValid()) {
      chrome.runtime.sendMessage({ type: "PANEL_CREATE_FOLDER", payload: newFolder }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.realId && response.realId !== newFolder.id) {
          // Swap temp-id with server-assigned id in local React state
          setFolders((prev) => prev.map((f) => f.id === newFolder.id ? { ...f, id: response.realId } : f));
          setSelectedFolderId((prev) => prev === newFolder.id ? response.realId : prev);
        }
      });
    }
  }, [newFolderName, newFolderParent]);

  // ── Tag toggle / create ──
  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }, []);

  const handleCreateTag = useCallback((name: string) => {
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    const newTag: LocalTag = { id: nextTempId(), name: name.trim(), color };
    // Optimistic UI update
    setTags((prev) => [...prev, newTag]);
    setSelectedTagIds((prev) => [...prev, newTag.id]);
    setTagQuery("");
    // Hub-and-Spoke: ONLY the background SW may write to chrome.storage.local
    if (isContextValid()) {
      chrome.runtime.sendMessage({ type: "PANEL_CREATE_TAG", payload: newTag }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.realId && response.realId !== newTag.id) {
          // Swap temp-id with server-assigned id in local React state
          setTags((prev) => prev.map((t) => t.id === newTag.id ? { ...t, id: response.realId } : t));
          setSelectedTagIds((prev) => prev.map((id) => id === newTag.id ? response.realId : id));
        }
      });
    }
  }, [tags.length]);

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(tagQuery.toLowerCase()),
  );
  const showCreateTag =
    tagQuery.trim().length > 0 &&
    !tags.some((t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase());

  const rootFolders = folders.filter((f) => !f.parentId);
  const getChildren = (parentId: string) => folders.filter((f) => f.parentId === parentId);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // ─── Styles (inline for Shadow DOM isolation) ─────────────────────────────

  const s = {
    overlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0,0,0,0.20)",
      zIndex: 2147483646,
    },
    drawer: {
      position: "fixed" as const,
      top: 0,
      right: 0,
      width: "400px",
      height: "100dvh",
      background: "rgba(18,18,18,0.95)",
      backdropFilter: "blur(40px) saturate(180%)",
      WebkitBackdropFilter: "blur(40px) saturate(180%)",
      borderLeft: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "-20px 0 40px rgba(0,0,0,0.5)",
      zIndex: 2147483647,
      display: "flex",
      flexDirection: "column" as const,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      color: "rgba(255,255,255,0.9)",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    },
    headerTitle: {
      fontSize: "15px",
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    closeBtn: {
      all: "unset" as const,
      width: "28px",
      height: "28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "8px",
      cursor: "pointer",
      color: "rgba(255,255,255,0.4)",
      transition: "background 0.15s, color 0.15s",
    },
    body: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "20px",
    },
    label: {
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      color: "rgba(255,255,255,0.35)",
      marginBottom: "6px",
    },
    textarea: {
      all: "unset" as const,
      width: "100%",
      minHeight: "120px",
      maxHeight: "240px",
      overflowY: "auto" as const,
      padding: "12px",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      fontSize: "13px",
      lineHeight: "1.6",
      color: "rgba(255,255,255,0.80)",
      caretColor: "#6C63FF",
      resize: "vertical" as const,
      display: "block",
      boxSizing: "border-box" as const,
    },
    folderBtn: {
      all: "unset" as const,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      fontSize: "13px",
      cursor: "pointer",
      color: "rgba(255,255,255,0.70)",
      transition: "border-color 0.15s",
      width: "100%",
      boxSizing: "border-box" as const,
    },
    folderItem: {
      all: "unset" as const,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 10px",
      borderRadius: "8px",
      fontSize: "13px",
      cursor: "pointer",
      color: "rgba(255,255,255,0.70)",
      width: "100%",
      boxSizing: "border-box" as const,
      transition: "background 0.1s",
    },
    tagInput: {
      all: "unset" as const,
      width: "100%",
      padding: "8px 12px",
      borderRadius: "10px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      fontSize: "13px",
      color: "rgba(255,255,255,0.80)",
      caretColor: "#6C63FF",
      boxSizing: "border-box" as const,
    },
    tagPill: (selected: boolean) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.15s",
      background: selected ? "rgba(108,99,255,0.20)" : "rgba(255,255,255,0.06)",
      border: selected ? "1px solid rgba(108,99,255,0.40)" : "1px solid rgba(255,255,255,0.08)",
      color: selected ? "rgba(108,99,255,1)" : "rgba(255,255,255,0.55)",
      boxShadow: selected ? "0 0 8px rgba(108,99,255,0.15)" : "none",
    }),
    footer: {
      padding: "16px 20px",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      gap: "10px",
    },
    saveBtn: (isSaved: boolean, isSaving?: boolean) => ({
      all: "unset" as const,
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      padding: "10px 16px",
      borderRadius: "10px",
      fontWeight: 600,
      fontSize: "13px",
      cursor: (isSaved || isSaving) ? "default" : "pointer",
      background: isSaved
        ? "linear-gradient(135deg, #22c55e, #16a34a)"
        : isSaving
          ? "rgba(108,99,255,0.4)"
          : "linear-gradient(135deg, #6C63FF, #5a52e0)",
      color: "#fff",
      transition: "all 0.2s",
      boxShadow: isSaved
        ? "0 0 16px rgba(34,197,94,0.3)"
        : (isSaving ? "none" : "0 0 16px rgba(108,99,255,0.25)"),
      opacity: isSaving ? 0.8 : 1,
    }),
    cancelBtn: {
      all: "unset" as const,
      padding: "10px 16px",
      borderRadius: "10px",
      fontSize: "13px",
      fontWeight: 500,
      cursor: "pointer",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.50)",
      transition: "all 0.15s",
    },
    newFolderInput: {
      all: "unset" as const,
      flex: 1,
      padding: "6px 10px",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      fontSize: "12px",
      color: "rgba(255,255,255,0.80)",
      caretColor: "#6C63FF",
      boxSizing: "border-box" as const,
    },
  };

  // ── Unauthenticated state ──
  if (token === undefined) return null; // still loading from storage

  if (!token) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={s.overlay}
          onClick={onClose}
        />
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          style={s.drawer}
        >
          <div style={s.header}>
            <span style={s.headerTitle}>Cortex</span>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={{ ...s.body, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
            <p style={{ fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>Sign in to save</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", marginBottom: "20px" }}>
              You need a Cortex account to save and sync highlights.
            </p>
            <button
              style={{ ...s.saveBtn(false), flex: "unset", padding: "10px 24px" }}
              onClick={async () => {
                if (isContextValid()) {
                  chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
                } else {
                  // Context invalid — probe for the running Cortex server directly
                  let loginUrl = "https://app.cortex.so/login?ext=1";
                  for (const port of [3001, 3000, 3002, 3003]) {
                    try {
                      const r = await fetch(`http://localhost:${port}/api/auth/me`, { method: "HEAD", signal: AbortSignal.timeout(600) });
                      if (r.ok) { loginUrl = `http://localhost:${port}/login?ext=1`; break; }
                    } catch { /* skip */ }
                  }
                  window.open(loginUrl, "_blank");
                }
                onClose();
              }}
            >
              Sign in to Cortex
            </button>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={s.overlay}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: EASE_SNAPPY }}
        style={s.drawer}
      >
        {/* ── Header ── */}
        <div style={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isYouTube && (
              <svg width="20" height="14" viewBox="0 0 24 17" fill="#FF0000" style={{ flexShrink: 0 }}>
                <path d="M23.5 2.7a3 3 0 00-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 00.5 2.7 31.3 31.3 0 000 8.5a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1 31.3 31.3 0 00.5-5.8 31.3 31.3 0 00-.5-5.8zM9.5 12.1V4.9L16 8.5l-6.5 3.6z"/>
              </svg>
            )}
            <span style={s.headerTitle}>{isYouTube ? "YouTube Capture" : "Save Highlight"}</span>
            {isYouTube && (
              <span style={{
                background: "rgba(255,0,0,0.12)",
                color: "#FF6B6B",
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}>[{ytFormattedTime}]</span>
            )}
          </div>
          <button
            style={s.closeBtn}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.4)";
            }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={s.body}>
          {/* Success banner */}
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 14px", borderRadius: "10px",
                  background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                  fontSize: "13px", fontWeight: 500, color: "rgb(74,222,128)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3.5 3.5L13 5" />
                </svg>
                Highlight saved to Cortex
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase 16.1 — Scenario 3: Session expired banner */}
          <AnimatePresence>
            {authState?.status === "expired" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: "10px",
                  background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)",
                  fontSize: "12px", fontWeight: 500, color: "rgba(252,165,165,1)",
                  gap: "10px",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="7" cy="7" r="6" />
                    <path d="M7 4v3.5M7 10h.01" />
                  </svg>
                  Session expired
                </span>
                <button
                  onClick={() => {
                    if (isContextValid()) {
                      // Background resolves dev vs prod URL via getApiBase()
                      chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
                    } else {
                      window.open("https://app.cortex.so/login?ext=1", "_blank");
                    }
                  }}
                  style={{
                    all: "unset",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    background: "rgba(239,68,68,0.20)",
                    color: "rgba(252,165,165,1)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Re-login
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI badge */}
          {aiCtx.isAI && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 10px", borderRadius: "8px",
              background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.20)",
              fontSize: "11px", fontWeight: 500, color: "rgb(192,132,252)",
            }}>
              ✨ AI Snippet Detected
            </div>
          )}

          {/* ── YouTube video snapshot ── */}
          {isYouTube && ytVideoId && (
            <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden" }}>
              <img
                src={`https://img.youtube.com/vi/${ytVideoId}/maxresdefault.jpg`}
                alt="Video Thumbnail"
                style={{
                  width: "100%",
                  height: "128px",
                  objectFit: "cover",
                  display: "block",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "10px",
                }}
              />
              <span style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                background: "rgba(0,0,0,0.80)",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "4px",
                fontVariantNumeric: "tabular-nums",
              }}>
                {ytFormattedTime}
              </span>
            </div>
          )}

          {/* ── YouTube metadata note ── */}
          {isYouTube && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 10px", borderRadius: "8px",
              background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.12)",
              fontSize: "11px", fontWeight: 500, color: "rgba(255,100,100,0.85)",
            }}>
              🔒 Timestamp and metadata captured securely.
            </div>
          )}

          {/* ── Content preview ── */}
          <div>
            <div style={s.label}>Content</div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={stopProp}
              placeholder={isYouTube ? `📍 Video Bookmark at ${ytFormattedTime}` : ""}
              style={s.textarea}
              spellCheck={false}
            />
          </div>

          {/* ── Folder selector ── */}
          <div>
            <div style={s.label}>Folder</div>
            <button
              style={s.folderBtn}
              onClick={() => setFolderPickerOpen((v) => !v)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <span>{selectedFolder?.emoji ?? "📂"}</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                {selectedFolder?.name ?? "Select folder…"} {selectedFolder?.accessRole && selectedFolder.accessRole !== "OWNER" && "🤝"}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                style={{ transform: folderPickerOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
                <path d="M2 3.5L5 6.5L8 3.5" />
              </svg>
            </button>

            <AnimatePresence>
              {folderPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: "hidden", marginTop: "6px" }}
                >
                  <div style={{
                    borderRadius: "10px",
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.07)",
                    padding: "4px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}>
                    {/* Unassigned option */}
                    <button
                      style={{
                        ...s.folderItem,
                        background: !selectedFolderId ? "rgba(108,99,255,0.10)" : "#1a1a1a",
                      }}
                      onClick={() => { setSelectedFolderId(null); setFolderPickerOpen(false); }}
                      onMouseEnter={(e) => { if (selectedFolderId) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={(e) => { if (selectedFolderId) e.currentTarget.style.background = "#1a1a1a"; }}
                    >
                      <span>📂</span> No folder
                    </button>

                    {rootFolders.map((f) => (
                      <FolderTreeItem
                        key={f.id}
                        folder={f}
                        depth={0}
                        selectedId={selectedFolderId}
                        getChildren={getChildren}
                        onSelect={(id) => { setSelectedFolderId(id); setFolderPickerOpen(false); }}
                        itemStyle={s.folderItem}
                      />
                    ))}

                    {/* Create folder */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "4px", paddingTop: "4px" }}>
                      {!showNewFolder ? (
                        <button
                          style={{ ...s.folderItem, color: "rgba(108,99,255,0.80)" }}
                          onClick={() => setShowNewFolder(true)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(108,99,255,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M6 2v8M2 6h8" />
                          </svg>
                          Create Folder
                        </button>
                      ) : (
                        <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input
                              autoFocus
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              onKeyDown={(e) => { stopProp(e); if (e.key === "Enter") handleCreateFolder(); }}
                              placeholder="Folder name"
                              style={s.newFolderInput}
                            />
                            <button
                              onClick={handleCreateFolder}
                              style={{
                                all: "unset",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: "rgba(108,99,255,0.25)",
                                color: "#6C63FF",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Add
                            </button>
                          </div>
                          {/* Parent folder selector — custom dropdown (native <select> has unstyled white bg in Shadow DOM) */}
                          <ParentFolderPicker
                            folders={folders}
                            value={newFolderParent}
                            onChange={setNewFolderParent}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Color picker ── */}
          <div>
            <div style={s.label}>Color</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => setSelectedColor(c)}
                  style={{
                    all: "unset",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: c.value,
                    cursor: "pointer",
                    border: selectedColor.id === c.id ? "2.5px solid #fff" : "2.5px solid transparent",
                    transform: selectedColor.id === c.id ? "scale(1.15)" : "scale(1)",
                    transition: "all 0.15s",
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Tag manager ── */}
          <div>
            <div style={s.label}>Tags</div>
            <input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onKeyDown={stopProp}
              placeholder="Search or create tags…"
              style={s.tagInput}
            />

            {/* Tag list — always visible */}
            <div style={{
              marginTop: "6px",
              borderRadius: "10px",
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "4px",
              maxHeight: "140px",
              overflowY: "auto",
            }}>
              {filteredTags.length > 0 ? filteredTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  style={{
                    ...s.folderItem,
                    background: selectedTagIds.includes(t.id) ? "rgba(108,99,255,0.10)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!selectedTagIds.includes(t.id)) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { if (!selectedTagIds.includes(t.id)) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: t.color.startsWith("#") ? t.color : (TAG_COLOR_MAP[t.color] ?? "#6C63FF"),
                    flexShrink: 0,
                  }}/>
                  {t.name}
                  {selectedTagIds.includes(t.id) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" style={{ marginLeft: "auto" }}>
                      <path d="M2 5l2.5 2.5L8 3" />
                    </svg>
                  )}
                </button>
              )) : (
                <div style={{ padding: "8px 10px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                  {tagQuery.trim() ? "No matching tags" : "No tags yet — type above to create one"}
                </div>
              )}
              {showCreateTag && (
                <button
                  onClick={() => handleCreateTag(tagQuery)}
                  style={{ ...s.folderItem, color: "rgba(108,99,255,0.80)", borderTop: filteredTags.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", marginTop: filteredTags.length > 0 ? "2px" : "0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(108,99,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M5 1v8M1 5h8" />
                  </svg>
                  Create &ldquo;{tagQuery.trim()}&rdquo;
                </button>
              )}
            </div>

            {/* Selected tags as pills */}
            {selectedTagIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                {selectedTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <span
                      key={id}
                      onClick={() => toggleTag(id)}
                      style={s.tagPill(true)}
                    >
                      {tag.name}
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
                      </svg>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={s.footer}>
          <button
            style={s.cancelBtn}
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          >
            Cancel
          </button>
          <button
            style={s.saveBtn(saved, isSaving)}
            onClick={handleSave}
            disabled={saved || isSaving}
            onMouseEnter={(e) => { if (!saved && !isSaving) e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {isSaving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                  style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Saving…
              </>
            ) : saved ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 7l3.5 3.5L12 4" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 1v12M1 7h12" />
                </svg>
                Save to Cortex
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Custom Parent Folder Picker (replaces unstyled <select>) ─────────────────

function ParentFolderPicker({
  folders,
  value,
  onChange,
}: {
  folders:  LocalFolder[];
  value:    string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = folders.find((f) => f.id === value);

  // Build a set of all ancestor IDs to prevent selecting descendants as parents
  const getAncestors = (id: string): Set<string> => {
    const ancestors = new Set<string>();
    let current = folders.find((f) => f.id === id);
    while (current && current.parentId) {
      ancestors.add(current.parentId);
      current = folders.find((f) => f.id === current!.parentId);
    }
    return ancestors;
  };

  const ancestors = value ? getAncestors(value) : new Set();

  const renderFolderOptions = (parentId: string | null = null, depth = 0): React.ReactNode[] => {
    return folders
      .filter((f) => (f.parentId === parentId || (parentId === null && !f.parentId)) && f.id !== value && !ancestors.has(f.id))
      .map((f) => [
        <button
          key={f.id}
          onClick={() => { onChange(f.id); setOpen(false); }}
          style={{
            all: "unset",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            width: "100%",
            padding: "5px 8px",
            paddingLeft: `${8 + depth * 12}px`,
            borderRadius: "6px",
            fontSize: "11px",
            color: value === f.id ? "#6C63FF" : "rgba(255,255,255,0.60)",
            background: value === f.id ? "rgba(108,99,255,0.10)" : "#171717",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => { if (value !== f.id) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { if (value !== f.id) e.currentTarget.style.background = "#171717"; }}
        >
          {f.emoji} {f.name}
        </button>,
        ...renderFolderOptions(f.id, depth + 1),
      ]);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px",
          borderRadius: "6px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontSize: "11px",
          color: "rgba(255,255,255,0.60)",
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <span>{selected ? `${selected.emoji} ${selected.name}` : "No parent (root)"}</span>
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
          <path d="M2 3.5L5 6.5L8 3.5" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: "4px",
          borderRadius: "8px",
          background: "#171717",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          zIndex: 2147483650,
          maxHeight: "140px",
          overflowY: "auto",
          padding: "3px",
        }}>
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            style={{
              all: "unset",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              width: "100%",
              padding: "5px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              color: !value ? "#6C63FF" : "rgba(255,255,255,0.60)",
              background: !value ? "rgba(108,99,255,0.10)" : "#171717",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => { if (value) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { if (value) e.currentTarget.style.background = "#171717"; }}
          >
            No parent (root)
          </button>
          {renderFolderOptions()}
        </div>
      )}
    </div>
  );
}

// ─── Recursive Folder Tree Item ───────────────────────────────────────────────

function FolderTreeItem({
  folder,
  depth,
  selectedId,
  getChildren,
  onSelect,
  itemStyle,
}: {
  folder:      LocalFolder;
  depth:       number;
  selectedId:  string | null;
  getChildren: (parentId: string) => LocalFolder[];
  onSelect:    (id: string) => void;
  itemStyle:   React.CSSProperties;
}) {
  const children   = getChildren(folder.id);
  const isSelected = selectedId === folder.id;
  // VIEWER folders are visible for context but cannot be chosen as a save destination
  const isViewer   = folder.accessRole === "VIEWER";

  return (
    <>
      <button
        disabled={isViewer}
        aria-disabled={isViewer}
        style={{
          ...itemStyle,
          paddingLeft:   `${10 + depth * 16}px`,
          background:    isSelected ? "rgba(108,99,255,0.10)" : "inherit",
          opacity:       isViewer ? 0.4 : 1,
          cursor:        isViewer ? "not-allowed" : "pointer",
          pointerEvents: isViewer ? "none" : "auto",
        }}
        onClick={() => { if (!isViewer) onSelect(folder.id); }}
        onMouseEnter={(e) => { if (!isSelected && !isViewer) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        onMouseLeave={(e) => { if (!isSelected && !isViewer) e.currentTarget.style.background = "inherit"; }}
      >
        <span>{folder.emoji}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{folder.name}</span>
        {folder.accessRole && folder.accessRole !== "OWNER" && (
          <span style={{ fontSize: "10px", marginRight: "6px" }} title="Shared Folder">
            🤝
          </span>
        )}
        {isViewer && (
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginLeft: "auto", flexShrink: 0 }}>
            view&nbsp;only
          </span>
        )}
        {isSelected && !isViewer && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" style={{ marginLeft: "auto" }}>
            <path d="M2 5l2.5 2.5L8 3" />
          </svg>
        )}
      </button>
      {children.map((child) => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          selectedId={selectedId}
          getChildren={getChildren}
          onSelect={onSelect}
          itemStyle={itemStyle}
        />
      ))}
    </>
  );
}

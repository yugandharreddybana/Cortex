import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Highlight {
  id:       string;
  text:     string;
  url:      string;
  source:   string;
  savedAt?: string;
  tags:     string[];
  folderId?: string | null;
  folder?:   string | null;
  isFavorite?: boolean;
  isPinned?:   boolean;
  isAI?:       boolean;
  checked?: boolean; // for UI selection only
}

interface Folder {
  id:        string;
  name:      string;
  emoji?:    string | null;
  parentId?: string | null;
  isPinned?: boolean;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface UserProfile {
  email: string;
  fullName?:  string | null;
  tier?:  string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DASHBOARD_PROD = "https://app.cortex.so";
const EASE = [0.16, 1, 0.3, 1] as const;
const JAVA_BASE      = "http://localhost:8080";

/** Map BFF path to Java /api/v1/... path when calling Java directly */
function jPath(base: string, bffPath: string): string {
  if (base === JAVA_BASE) return bffPath.replace(/^\/api\//, "/api/v1/");
  return bffPath;
}
function jLoginUrl(base: string):     string { return base === JAVA_BASE ? `${DASHBOARD_PROD}/login?ext=1` : `${base}/login?ext=1`; }
function jSignupUrl(base: string):    string { return base === JAVA_BASE ? `${DASHBOARD_PROD}/signup`      : `${base}/signup`; }
function jDashboardUrl(base: string): string { return base === JAVA_BASE ? `${DASHBOARD_PROD}/dashboard`   : `${base}/dashboard`; }

// Cache resolved API base to avoid probing on every call
let _apiBaseCache: string | null = null;

/** Probe common dev ports, fall back to Java direct, then production */
async function getApiBase(): Promise<string> {
  if (_apiBaseCache) return _apiBaseCache;
  const devPorts = [3001, 3000, 3002, 3003, 3004, 3005];
  for (const port of devPorts) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 600);
      const r = await fetch(`http://localhost:${port}/api/auth/me`, { method: "HEAD", signal: ctrl.signal });
      clearTimeout(id);
      // Only accept 200 — a 404 from an unrelated server must not be mistaken for Cortex.
      if (r.ok) { _apiBaseCache = `http://localhost:${port}`; return _apiBaseCache; }
    } catch { /* port not running */ }
  }
  // No BFF found — try Java directly at port 8080.
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 800);
    const r = await fetch(`${JAVA_BASE}/api/v1/auth/probe`, { method: "GET", signal: ctrl.signal });
    clearTimeout(id);
    if (r.ok) { _apiBaseCache = JAVA_BASE; return _apiBaseCache; }
  } catch { /* Java not running either */ }
  _apiBaseCache = DASHBOARD_PROD;
  return _apiBaseCache;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  try {
    // Try session storage first
    const sessionResult = await chrome.storage.session.get("cortex_ext_token");
    if (sessionResult.cortex_ext_token) return sessionResult.cortex_ext_token;
    // Fallback to local storage
    const localResult = await chrome.storage.local.get("cortex_ext_token");
    return localResult.cortex_ext_token ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}${jPath(base, path)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── View type ────────────────────────────────────────────────────────────────
type View =
  | { type: "folders" }
  | { type: "highlights"; folderId: string | null; folderName: string };


// Popup doesn't show toasts — toasts only work in content script context
// All operations in popup fail silently to browser storage/background

export function App() {
  const [token, setToken]             = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser]               = useState<UserProfile | null>(null);
  const [folders, setFolders]         = useState<Folder[]>([]);
  const [highlights, setHighlights]   = useState<Highlight[]>([]);
  const [tags, setTags]               = useState<Tag[]>([]);

    // Bulk delete selected highlights
    const handleBulkDelete = useCallback(async () => {
      if (!window.confirm("Are you sure you want to delete the selected highlights? This cannot be undone.")) return;
      const selectedIds = highlights.filter((h) => h.checked).map((h) => h.id);
      if (selectedIds.length === 0) return;
      setHighlights((prev) => prev.filter((h) => !selectedIds.includes(h.id)));
      // Delete each highlight via the background SW (which handles server + local storage)
      for (const id of selectedIds) {
        chrome.runtime.sendMessage(
          { type: "DELETE_HIGHLIGHT", payload: { id } },
          () => { if (chrome.runtime.lastError) { /* ok */ } },
        );
      }
    }, [highlights]);
  const [loading, setLoading]         = useState(true);
  const [enabled, setEnabled]         = useState(true);
  const [view, setView]               = useState<View>({ type: "folders" });
  const [query, setQuery]             = useState("");

  // ── Check auth on mount ──
  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        const res = await apiFetch<{ authenticated: boolean; user: UserProfile }>(
          "/api/auth/me",
          t,
        );
        if (res?.authenticated && res.user) {
          setToken(t);
          setUser(res.user);
        }
      }
      setAuthChecked(true);
    })();

    chrome.storage.local.get("cortex_enabled", (result) => {
      if (chrome.runtime.lastError) return;
      setEnabled(result.cortex_enabled !== false);
    });

    // ── Auto sign-in: react when web app posts a new token (e.g. user logs in
    // on the dashboard while the popup is open, or clicks "Refresh Page").
    function onStorageChanged(
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) {
      if (area !== "local" && area !== "session") return;
      const newToken = changes["cortex_ext_token"]?.newValue as string | undefined;
      if (!newToken) return;
      // Clear the probe cache so the next apiFetch picks the right base
      _apiBaseCache = null;
      (async () => {
        const res = await apiFetch<{ authenticated: boolean; user: UserProfile }>(
          "/api/auth/me",
          newToken,
        );
        if (res?.authenticated && res.user) {
          setToken(newToken);
          setUser(res.user);
          setAuthChecked(true);
        }
      })();
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, []);

  // ── Fetch folders, tags, highlights when authenticated ──
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [foldersData, highlightsData, tagsData] = await Promise.all([
          apiFetch<Folder[]>("/api/folders", token),
          apiFetch<Highlight[]>("/api/highlights", token),
          apiFetch<Tag[]>("/api/tags", token),
        ]);
        // Silently handle fetch failures — popup doesn't have a content script to show toasts
        setFolders(foldersData ?? []);
        setHighlights(highlightsData ?? []);
        setTags(tagsData ?? []);
      } catch (err) {
        // Silently handle errors in the popup
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const toggleEnabled = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.set({ cortex_enabled: next });
  }, [enabled]);

  const handleLogout = useCallback(() => {
    chrome.runtime.sendMessage({ type: "CLEAR_AUTH_TOKEN" }, () => {
      if (chrome.runtime.lastError) { /* ok */ }
    });
    setToken(null);
    setUser(null);
    setFolders([]);
    setHighlights([]);
    setView({ type: "folders" });
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      // Delete via background SW — it handles both server and local storage
      chrome.runtime.sendMessage(
        { type: "DELETE_HIGHLIGHT", payload: { id } },
        () => { if (chrome.runtime.lastError) { /* ok */ } },
      );
    },
    [],
  );


  // ── Sync handler ──
  // Triggers the background SW's hourly sync to pull fresh data from the server
  const handleSync = useCallback(async () => {
    setLoading(true);
    const t = await getToken();
    if (!t) {
      // Not logged in — open login page
      const base = await getApiBase();
      chrome.tabs.create({ url: jLoginUrl(base) });
      setLoading(false);
      return;
    }
    // Fetch fresh data from server via BFF
    const base = await getApiBase();
    try {
      const [hRes, fRes, tRes] = await Promise.all([
        fetch(`${base}${jPath(base, "/api/highlights")}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${base}${jPath(base, "/api/folders")}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${base}${jPath(base, "/api/tags")}`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (hRes.ok) {
        const data = await hRes.json();
        setHighlights(Array.isArray(data) ? data.map((h: any) => ({ ...h, checked: false })) : []);
        // Also sync to background storage
        chrome.runtime.sendMessage({ type: "SYNC_HIGHLIGHTS", payload: data }, () => {
          if (chrome.runtime.lastError) { /* ok */ }
        });
      }
      if (fRes.ok) {
        const data = await fRes.json();
        setFolders(Array.isArray(data) ? data : []);
        chrome.runtime.sendMessage({ type: "SYNC_FOLDERS", payload: data }, () => {
          if (chrome.runtime.lastError) { /* ok */ }
        });
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTags(Array.isArray(data) ? data : []);
        chrome.runtime.sendMessage({ type: "SYNC_TAGS", payload: data }, () => {
          if (chrome.runtime.lastError) { /* ok */ }
        });
      }
    } catch {
      // Silently handle errors
    }
    setLoading(false);
  }, []);

  // Auto-sync after login if sync was pending
  useEffect(() => {
    (async () => {
      const syncPending = (await chrome.storage.local.get("cortex_sync_pending")).cortex_sync_pending;
      const t = await getToken();
      if (syncPending && t) {
        await handleSync();
      }
    })();
  }, [handleSync]);

  // ── Auth not checked yet → skeleton ──
  if (!authChecked) {
    return (
      <Shell>
        <SkeletonList />
      </Shell>
    );
  }

  // ── Not authenticated → login screen ──
  if (!token) {
    return (
      <Shell>
        <LoginScreen />
        {/* Sync button for unauthenticated users */}
        <div style={{ padding: 16, textAlign: "center" }}>
          <button
            onClick={handleSync}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#6C63FF",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              marginTop: 12,
            }}
          >
            Sync with Application
          </button>
        </div>
      </Shell>
    );
  }

  // ── Compute viewed highlights ──
  const viewHighlights =
    view.type === "highlights"
      ? view.folderId === null
        ? highlights
        : highlights.filter((h) => h.folderId === view.folderId)
      : [];

  const filtered = query.trim()
    ? viewHighlights.filter((h) => {
        const q = query.trim().toLowerCase();
        return (
          h.text?.toLowerCase().includes(q) ||
          h.source?.toLowerCase().includes(q)
        );
      })
    : viewHighlights;

  return (
    <Shell>
      {/* ── Header ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(23,23,23,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "8px",
            background: "#6C63FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 12px rgba(108,99,255,0.4)",
          }}
        >
          <CortexIcon />
        </div>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            letterSpacing: "-0.01em",
          }}
        >
          Cortex
        </span>
        <div style={{ flex: 1 }} />

        {/* Sync with Application button */}
        <button
          onClick={handleSync}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            background: "#22C55E",
            color: "#fff",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            marginRight: 10,
          }}
        >
          Sync with Application
        </button>

        {/* User avatar */}
        <div
          title={user?.email ?? ""}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "rgba(108,99,255,0.25)",
            border: "1px solid rgba(108,99,255,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 600,
            color: "#a5b4fc",
            flexShrink: 0,
            textTransform: "uppercase",
          }}
        >
          {(user?.fullName?.[0] ?? user?.email?.[0] ?? "U")}
        </div>

      </header>

      {/* ── Enable / Disable toggle ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: enabled ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.35)",
            transition: "color 0.15s",
          }}
        >
          {enabled ? "Cortex is active" : "Cortex is paused"}
        </span>
        <button
          onClick={toggleEnabled}
          aria-label={enabled ? "Disable Cortex" : "Enable Cortex"}
          style={{
            all: "unset",
            position: "relative",
            width: "36px",
            height: "20px",
            borderRadius: "10px",
            background: enabled ? "#6C63FF" : "rgba(255,255,255,0.12)",
            cursor: "pointer",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: enabled ? "18px" : "2px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#ffffff",
              transition: "left 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            }}
          />
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view.type === "folders" ? (
          loading ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px" }}>
              <SkeletonList />
            </div>
          ) : (
            <FolderListView
              folders={folders}
              highlights={highlights}
              onSelectFolder={(folderId, folderName) =>
                setView({ type: "highlights", folderId, folderName })
              }
            />
          )
        ) : (
          <>
            {/* Back + folder label */}
            <button
              onClick={() => {
                setView({ type: "folders" });
                setQuery("");
              }}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.60)",
                cursor: "pointer",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.90)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.60)";
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7.5 9.5L4 6l3.5-3.5" />
              </svg>
              {view.folderName}
            </button>

            {/* Search */}
            <div style={{ padding: "10px 16px 6px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <SearchIcon />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search highlights…"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: "12px",
                    color: "#ffffff",
                    fontFamily: "inherit",
                  }}
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      color: "#52525b",
                      fontSize: "16px",
                      lineHeight: 1,
                      padding: "0 2px",
                    }}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Highlights list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px" }}>
              {loading ? (
                <SkeletonList />
              ) : filtered.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <AnimatePresence initial={false}>
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every(h => h.checked)}
                        onChange={e => {
                          const checked = e.target.checked;
                          setHighlights(prev => prev.map(h =>
                            filtered.some(f => f.id === h.id)
                              ? { ...h, checked }
                              : { ...h, checked: false }
                          ));
                        }}
                        style={{ marginRight: 8 }}
                      />
                      <span style={{ fontSize: 12, color: '#fff' }}>Select All</span>
                      <button
                        onClick={handleBulkDelete}
                        style={{
                          marginLeft: 16,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        disabled={filtered.filter(h => h.checked).length === 0}
                      >
                        Delete Selected
                      </button>
                    </div>
                    {filtered.slice(0, 50).map((h, i) => (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          delay: i * 0.03,
                          duration: 0.3,
                          ease: EASE,
                        }}
                      >
                        <HighlightItem highlight={h} onDelete={handleDelete} />
                      </motion.div>
                    ))}
                  </>
                </AnimatePresence>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(23,23,23,0.6)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "11px", color: "#52525b" }}>
          {view.type === "highlights" && query.trim()
            ? `${filtered.length} of ${viewHighlights.length}`
            : `${highlights.length} saved`}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "#3f3f46",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Cortex v0.1
        </span>
      </div>
    </Shell>
  );
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "360px",
        minHeight: "480px",
        maxHeight: "580px",
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
        gap: "20px",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "16px",
          background: "#6C63FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 32px rgba(108,99,255,0.4)",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 12 12"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="4" />
          <path d="M6 4v2l1.5 1.5" />
        </svg>
      </div>

      <div>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#ffffff",
            marginBottom: "6px",
          }}
        >
          Sign in to Cortex
        </h2>
        <p style={{ fontSize: "12px", color: "#71717a", lineHeight: "1.5" }}>
          Log in to your account to access your highlights and folders.
        </p>
      </div>

      <button
        onClick={async () => {
          const base = await getApiBase();
          chrome.tabs.create({ url: jLoginUrl(base) });
        }}
        style={{
          all: "unset",
          cursor: "pointer",
          padding: "10px 28px",
          borderRadius: "12px",
          background: "#6C63FF",
          fontSize: "13px",
          fontWeight: 600,
          color: "#ffffff",
          boxShadow: "0 0 20px rgba(108,99,255,0.3)",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#5b54e6";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#6C63FF";
        }}
      >
        Sign in
      </button>

      <p style={{ fontSize: "11px", color: "#3f3f46" }}>
        Don't have an account?{" "}
        <a
          href="#"
          onClick={async (e) => {
            e.preventDefault();
            const base = await getApiBase();
            chrome.tabs.create({ url: jSignupUrl(base) });
          }}
          style={{ color: "#6C63FF", textDecoration: "none" }}
        >
          Sign up free
        </a>
      </p>
    </div>
  );
}

// ─── Folder list view ─────────────────────────────────────────────────────────
function FolderListView({
  folders,
  highlights,
  onSelectFolder,
}: {
  folders: Folder[];
  highlights: Highlight[];
  onSelectFolder: (folderId: string | null, folderName: string) => void;
}) {
  const folderCounts = new Map<string, number>();
  for (const h of highlights) {
    if (h.folderId) {
      folderCounts.set(h.folderId, (folderCounts.get(h.folderId) ?? 0) + 1);
    }
  }

  // Build a map of parentId → children for tree rendering
  const childrenMap = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const pid = f.parentId ?? null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(f);
  }

  // Sort each group: pinned first, then alphabetically
  for (const [, children] of childrenMap) {
    children.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Recursively render the folder tree
  function renderTree(parentId: string | null, depth: number): React.ReactNode[] {
    const children = childrenMap.get(parentId);
    if (!children || children.length === 0) return [];

    const nodes: React.ReactNode[] = [];
    for (const f of children) {
      nodes.push(
        <FolderRow
          key={f.id}
          emoji={f.emoji || "📁"}
          name={f.name}
          count={folderCounts.get(f.id) ?? 0}
          isPinned={!!f.isPinned}
          depth={depth}
          onClick={() => onSelectFolder(f.id, f.name)}
        />,
      );
      // Render children recursively (subfolders are always expanded)
      nodes.push(...renderTree(f.id, depth + 1));
    }
    return nodes;
  }

  const topLevel = childrenMap.get(null) ?? [];

  return (
    <div
      style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}
    >
      {/* All Highlights */}
      <FolderRow
        emoji="📚"
        name="All Highlights"
        count={highlights.length}
        isPinned={false}
        depth={0}
        onClick={() => onSelectFolder(null, "All Highlights")}
      />

      {/* Divider */}
      {topLevel.length > 0 && (
        <div
          style={{
            height: "1px",
            background: "rgba(255,255,255,0.06)",
            margin: "6px 10px",
          }}
        />
      )}

      {/* Folder tree */}
      {renderTree(null, 0)}

      {/* Empty state if no folders */}
      {topLevel.length === 0 && (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#52525b",
            fontSize: "12px",
            lineHeight: "1.6",
          }}
        >
          No folders yet.
          <br />
          Create folders in the{" "}
          <a
            href="#"
            onClick={async (e) => {
              e.preventDefault();
              const base = await getApiBase();
              chrome.tabs.create({ url: jDashboardUrl(base) });
            }}
            style={{ color: "#6C63FF", textDecoration: "none" }}
          >
            dashboard
          </a>
          .
        </div>
      )}
    </div>
  );
}

// ─── Folder row ───────────────────────────────────────────────────────────────
function FolderRow({
  emoji,
  name,
  count,
  isPinned,
  depth,
  onClick,
}: {
  emoji: string;
  name: string;
  count: number;
  isPinned: boolean;
  depth: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "10px",
        paddingLeft: `${10 + depth * 20}px`,
        borderRadius: "10px",
        cursor: "pointer",
        background: hovered ? "rgba(255,255,255,0.05)" : "transparent",
        transition: "background 0.15s",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontSize: "16px", flexShrink: 0 }}>{emoji}</span>
      <span
        style={{
          flex: 1,
          fontSize: "13px",
          fontWeight: 500,
          color: "#d4d4d8",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      {isPinned && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="#6C63FF"
          stroke="none"
          aria-label="Pinned"
        >
          <path d="M16 2l5 5-3.5 3.5 2 5.5L14 22l-2-6-4.5 4.5L6 19l4.5-4.5L5 12l5.5 2L14 10.5z" />
        </svg>
      )}
      <span
        style={{
          fontSize: "11px",
          color: "#52525b",
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {count}
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="#3f3f46"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4.5 2.5L8 6l-3.5 3.5" />
      </svg>
    </button>
  );
}

// ─── Highlight item ───────────────────────────────────────────────────────────
function HighlightItem({
  highlight: h,
  onDelete,
}: {
  highlight: Highlight;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px",
        borderRadius: "12px",
        marginBottom: "4px",
        background: hovered ? "rgba(255,255,255,0.05)" : "transparent",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.10)" : "transparent"}`,
        cursor: "pointer",
        transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative",
      }}
      onClick={() => {
        if (h.url && h.url !== "#") window.open(h.url, "_blank");
      }}
    >
      {/* Delete button */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(h.id);
          }}
          aria-label="Delete highlight"
          style={{
            all: "unset",
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239, 68, 68, 0.30)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(239, 68, 68, 0.15)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#EF4444"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2 3h8M4.5 3V2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M9.5 3l-.5 7a1 1 0 01-1 1H4a1 1 0 01-1-1l-.5-7" />
          </svg>
        </button>
      )}

      {/* Badges */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginBottom: "6px",
        }}
      >
        {h.isPinned && (
          <span
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "6px",
              background: "rgba(108,99,255,0.15)",
              color: "#a5b4fc",
              fontWeight: 600,
            }}
          >
            Pinned
          </span>
        )}
        {h.isFavorite && (
          <span
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "6px",
              background: "rgba(250,204,21,0.12)",
              color: "#fbbf24",
              fontWeight: 600,
            }}
          >
            ★
          </span>
        )}
        {h.isAI && (
          <span
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "6px",
              background: "rgba(168,85,247,0.15)",
              color: "#c084fc",
              fontWeight: 600,
            }}
          >
            AI
          </span>
        )}
      </div>

      {/* Text */}
      <p
        style={{
          fontSize: "12px",
          color: "#d4d4d8",
          lineHeight: "1.5",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
          marginBottom: "6px",
          fontStyle: "italic",
        }}
      >
        &ldquo;{h.text}&rdquo;
      </p>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: "#52525b",
            maxWidth: "180px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {h.source ||
            (() => {
              try {
                return new URL(h.url).hostname;
              } catch {
                return h.url;
              }
            })()}
        </span>
        <span style={{ fontSize: "10px", color: "#3f3f46" }}>
          {formatDate(h.savedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div style={{ paddingTop: "4px" }}>
      {[80, 60, 90, 70].map((w, i) => (
        <div
          key={i}
          style={{
            padding: "10px",
            marginBottom: "4px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              height: "12px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "6px",
              marginBottom: "6px",
              width: `${w}%`,
            }}
          />
          <div
            style={{
              height: "12px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "6px",
              marginBottom: "6px",
              width: "95%",
            }}
          />
          <div
            style={{
              height: "10px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "6px",
              width: "40%",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ query }: { query: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        gap: "10px",
        color: "#52525b",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="9" />
        <path d="M21 21l7 7" />
      </svg>
      <p style={{ fontSize: "13px", textAlign: "center" }}>
        {query
          ? `No results for "${query}"`
          : "No highlights yet.\nSelect text on any page to save."}
      </p>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CortexIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="4" />
      <path d="M6 4v2l1.5 1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="#52525b"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="5.5" r="3.5" />
      <path d="M8.5 8.5L11 11" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(value: string | number | undefined): string {
  if (!value) return "just now";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "just now";
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

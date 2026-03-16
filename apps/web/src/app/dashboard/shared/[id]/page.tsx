"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@cortex/ui";
import { toast } from "sonner";
import { Client } from "@stomp/stompjs";

type AccessLevel = "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";

const ease = [0.16, 1, 0.3, 1] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedHighlight {
  id: string;
  text: string;
  source: string;
  url: string | null;
  note: string | null;
  topic: string;
  topicColor: string;
  isCode: boolean;
  isAI: boolean;
  highlightColor: string | null;
  chatName: string | null;
}

interface SharedFolder {
  id: string;
  name: string;
  emoji: string;
  highlights: SharedHighlight[];
  subFolders: SharedFolder[];
}

interface ResourcePayload {
  resourceType: "HIGHLIGHT" | "FOLDER";
  sharedBy: string;
  highlight?: SharedHighlight;
  folder?: SharedFolder;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharedCollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [accessLevel, setAccessLevel] = React.useState<AccessLevel | null>(null);
  const [payload, setPayload] = React.useState<ResourcePayload | null>(null);
  const [noteValue, setNoteValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [liveViewers, setLiveViewers] = React.useState<string[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = React.useState<string | null>(null);

  // Determine the resource type from query params
  const resourceType = React.useMemo(() => {
    if (typeof window === "undefined") return "HIGHLIGHT";
    const params = new URLSearchParams(window.location.search);
    return (params.get("type")?.toUpperCase() ?? "HIGHLIGHT") as "HIGHLIGHT" | "FOLDER";
  }, []);

  React.useEffect(() => {
    if (!id) return;

    Promise.all([
      // 1. Get user's access level
      fetch(`/api/permissions/access-level?resourceId=${id}&type=${resourceType}`)
        .then((r) => {
          if (!r.ok) throw new Error("No access");
          return r.json();
        }),
      // 2. Get resource data via share resolve (if hash-based) or direct
      fetch(`/api/share?action=resource&resourceId=${id}&type=${resourceType}`)
        .then((r) => {
          if (!r.ok) throw new Error("Resource not found");
          return r.json();
        }),
    ])
      .then(([accessData, resourceData]) => {
        setAccessLevel(accessData.accessLevel);
        setPayload(resourceData);
        if (resourceData.highlight?.note) {
          setNoteValue(resourceData.highlight.note);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, resourceType]);

  // ── Fetch current user + connect presence WebSocket ───────────────────────

  React.useEffect(() => {
    if (!id) return;

    let stompClient: Client | null = null;
    let userEmail: string | null = null;

    async function connect() {
      let token: string | null = null;
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!meRes.ok) return;
        const me = await meRes.json();
        userEmail = me.user?.email ?? null;
        setCurrentUserEmail(me.user?.email ?? null);

        // Fetch WebSocket JWT for the STOMP connect header
        const wsTokenRes = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (wsTokenRes.ok) {
          const wsData = await wsTokenRes.json() as { token?: string };
          token = wsData.token ?? null;
        }
      } catch {
        return;
      }

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL ??
        (typeof window !== "undefined" && window.location.protocol === "https:"
          ? `wss://${window.location.host}/ws`
          : "ws://localhost:8080/ws");

      stompClient = new Client({
        brokerURL: wsUrl,
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 5000,
        onConnect: () => {
          stompClient?.subscribe(`/topic/resource/${id}`, (message) => {
            try {
              const data = JSON.parse(message.body);
              if (Array.isArray(data.viewers)) {
                setLiveViewers(data.viewers);
              }
            } catch {
              // ignore
            }
          });

          stompClient?.publish({
            destination: `/app/join/${id}`,
            body: JSON.stringify({ email: userEmail }),
          });
        },
      });

      stompClient.activate();
    }

    connect();

    return () => {
      if (stompClient?.connected && userEmail) {
        stompClient.publish({
          destination: `/app/leave/${id}`,
          body: JSON.stringify({ email: userEmail }),
        });
      }
      stompClient?.deactivate();
    };
  }, [id]);

  // ── Save note (COMMENTER+ only) ──────────────────────────────────────────

  async function handleSaveNote() {
    if (!accessLevel || accessLevel === "VIEWER") return;

    setSaving(true);
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteValue }),
      });
      if (!res.ok) throw new Error();
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (error || !accessLevel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-400">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path d="M15 9l-6 6M9 9l6 6" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">Access Denied</h2>
        <p className="text-sm text-white/50">
          {error ?? "You don't have permission to view this resource."}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-2 h-9 px-5 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const canComment = accessLevel !== "VIEWER";
  const canEdit = accessLevel === "EDITOR" || accessLevel === "OWNER";

  return (
    <div className="flex-1 overflow-y-auto">
      <motion.div
        className="max-w-3xl mx-auto px-6 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        {/* ── Access level badge + Presence avatars ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <AccessBadge level={accessLevel} />
            {payload?.sharedBy && (
              <span className="text-xs text-white/40">
                Shared by {payload.sharedBy}
              </span>
            )}
          </div>
          <PresenceAvatars viewers={liveViewers} currentUser={currentUserEmail} />
        </div>

        {/* ── Highlight view ── */}
        {payload?.resourceType === "HIGHLIGHT" && payload.highlight && (
          <HighlightViewer
            highlight={payload.highlight}
            accessLevel={accessLevel}
            canComment={canComment}
            canEdit={canEdit}
            noteValue={noteValue}
            onNoteChange={setNoteValue}
            onSaveNote={handleSaveNote}
            saving={saving}
          />
        )}

        {/* ── Folder view ── */}
        {payload?.resourceType === "FOLDER" && payload.folder && (
          <FolderViewer
            folder={payload.folder}
            accessLevel={accessLevel}
            canEdit={canEdit}
          />
        )}
      </motion.div>
    </div>
  );
}

// ─── Access Badge ─────────────────────────────────────────────────────────────

function AccessBadge({ level }: { level: AccessLevel }) {
  const config: Record<AccessLevel, { label: string; icon: string; color: string }> = {
    VIEWER:    { label: "View Only",  icon: "👁️",  color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    COMMENTER: { label: "Commenter",  icon: "💬",  color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    EDITOR:    { label: "Editor",     icon: "✏️",  color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    OWNER:     { label: "Owner",      icon: "👑",  color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  };

  const c = config[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
        c.color,
      )}
    >
      {c.icon} {c.label}
    </span>
  );
}

// ─── Presence Avatars ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500",
];
const MAX_VISIBLE = 3;

function PresenceAvatars({
  viewers,
  currentUser,
}: {
  viewers: string[];
  currentUser: string | null;
}) {
  // Filter out current user — they already know they're here
  const others = viewers.filter((v) => v !== currentUser);
  if (others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - MAX_VISIBLE;

  return (
    <div className="flex items-center">
      <div className="flex items-center -space-x-2">
        {visible.map((email, i) => {
          const initial = email[0]?.toUpperCase() ?? "?";
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={email} className="group relative">
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 border-[#0A0A0A] flex items-center justify-center text-xs font-bold text-white",
                  color,
                )}
              >
                {initial}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-white/10 backdrop-blur-md text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                {email}
              </div>
            </div>
          );
        })}
        {overflow > 0 && (
          <div className="group relative">
            <div className="w-8 h-8 rounded-full border-2 border-[#0A0A0A] bg-white/10 flex items-center justify-center text-xs font-medium text-white/70">
              +{overflow}
            </div>
            {/* Overflow tooltip */}
            <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 rounded-md bg-white/10 backdrop-blur-md text-[10px] text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity space-y-0.5">
              {others.slice(MAX_VISIBLE).map((email) => (
                <div key={email}>{email}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      <span className="ml-3 text-xs text-white/40">
        {others.length} viewing
      </span>
    </div>
  );
}

// ─── Highlight Viewer ─────────────────────────────────────────────────────────

function HighlightViewer({
  highlight,
  accessLevel,
  canComment,
  canEdit,
  noteValue,
  onNoteChange,
  onSaveNote,
  saving,
}: {
  highlight: SharedHighlight;
  accessLevel: AccessLevel;
  canComment: boolean;
  canEdit: boolean;
  noteValue: string;
  onNoteChange: (v: string) => void;
  onSaveNote: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* ── Topic badge ── */}
      {highlight.topic && (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${highlight.topicColor}20`,
            color: highlight.topicColor,
          }}
        >
          {highlight.topic}
        </span>
      )}

      {/* ── Text content ── */}
      <div
        className={cn(
          "rounded-xl border p-6",
          highlight.isCode
            ? "bg-[#0d1117] border-white/[0.08] font-mono text-sm"
            : "bg-white/[0.03] border-white/[0.06]",
        )}
        style={
          highlight.highlightColor
            ? { borderLeftWidth: 4, borderLeftColor: highlight.highlightColor }
            : undefined
        }
      >
        {highlight.isCode ? (
          <pre className="text-green-300 whitespace-pre-wrap break-words">
            {highlight.text}
          </pre>
        ) : (
          <p className="text-white/90 leading-relaxed text-[15px]">
            {highlight.text}
          </p>
        )}
      </div>

      {/* ── Source ── */}
      {highlight.source && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <SourceIcon />
          <span>{highlight.source}</span>
          {highlight.url && !highlight.isAI && (
            <a
              href={highlight.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline ml-1"
            >
              Open source →
            </a>
          )}
        </div>
      )}

      {/* ── AI badge (redacted source) ── */}
      {highlight.isAI && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          🔒 AI highlight — source link omitted for privacy
          {highlight.chatName && (
            <span className="text-white/40 ml-1">({highlight.chatName})</span>
          )}
        </div>
      )}

      {/* ── Notes section (COMMENTER+) ── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
          Notes
        </label>
        {canComment ? (
          <div className="space-y-2">
            <textarea
              value={noteValue}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-white/20 resize-none outline-none focus:border-white/20 transition-colors"
            />
            <button
              onClick={onSaveNote}
              disabled={saving}
              className="h-8 px-4 rounded-lg text-xs font-medium bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-sm text-white/50 min-h-[60px]">
            {noteValue || "No notes yet"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Folder Viewer ────────────────────────────────────────────────────────────

function FolderViewer({
  folder,
  accessLevel,
  canEdit,
}: {
  folder: SharedFolder;
  accessLevel: AccessLevel;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* ── Folder header ── */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{folder.emoji}</span>
        <h1 className="text-2xl font-bold text-white">{folder.name}</h1>
      </div>

      {/* ── Highlights in this folder ── */}
      {folder.highlights.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
            {folder.highlights.length} highlight{folder.highlights.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-3">
            {folder.highlights.map((h) => (
              <FolderHighlightCard
                key={h.id}
                highlight={h}
                editable={canEdit}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Subfolders (recursive) ── */}
      {folder.subFolders.length > 0 && (
        <div className="space-y-3 mt-6">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Subfolders
          </p>
          <div className="space-y-4 pl-4 border-l border-white/[0.06]">
            {folder.subFolders.map((sf) => (
              <FolderViewer
                key={sf.id}
                folder={sf}
                accessLevel={accessLevel}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FolderHighlightCard({
  highlight,
  editable,
}: {
  highlight: SharedHighlight;
  editable: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors",
        editable ? "hover:border-white/[0.12] hover:bg-white/[0.04]" : "",
      )}
      style={
        highlight.highlightColor
          ? { borderLeftWidth: 4, borderLeftColor: highlight.highlightColor }
          : undefined
      }
    >
      {highlight.topic && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mb-2"
          style={{
            backgroundColor: `${highlight.topicColor}20`,
            color: highlight.topicColor,
          }}
        >
          {highlight.topic}
        </span>
      )}

      <p className="text-sm text-white/80 line-clamp-4">
        {highlight.isCode ? (
          <code className="text-green-300 font-mono text-xs">{highlight.text}</code>
        ) : (
          highlight.text
        )}
      </p>

      {highlight.source && (
        <p className="text-xs text-white/30 mt-2">{highlight.source}</p>
      )}

      {highlight.isAI && (
        <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-amber-400">
          🔒 AI — source redacted
        </span>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SourceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M5.5 8.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 5.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

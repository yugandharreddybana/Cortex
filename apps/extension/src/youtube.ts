/**
 * YouTube Content Script — DOM-based metadata & timestamp extractor.
 *
 * ToS-compliant: No video downloading, no ad-bypassing. We only read
 * the current playback timestamp from the native HTML5 <video> element
 * and extract publicly visible page metadata (title, channel, URL).
 *
 * Triggered by Cmd+K / Ctrl+K while on a YouTube watch page.
 */

// ─── Temp-ID counter (negative integers, never conflict with server PKs) ──────
let _tempIdCounter = 0;
function nextTempId(): string { return String(--_tempIdCounter); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVideoId(): string | null {
  return new URLSearchParams(window.location.search).get("v");
}

function getVideoTimestamp(): number {
  const video = document.querySelector("video");
  return video ? Math.floor(video.currentTime) : 0;
}

function getVideoTitle(): string {
  return document.title.replace(/ - YouTube$/, "").trim() || "YouTube Video";
}

function getChannelName(): string {
  const el = document.querySelector<HTMLElement>(
    "ytd-channel-name yt-formatted-string",
  );
  return el?.innerText?.trim() || "YouTube";
}

function formatTimestamp(totalSeconds: number): string {
  const hrs  = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
}

function getSelectedTranscriptText(): string {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  return text && text.length > 0 ? text : "";
}

// ─── Keyboard listener ────────────────────────────────────────────────────────

function handleYouTubeCapture(e: KeyboardEvent) {
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod || e.key.toLowerCase() !== "k") return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const videoId = getVideoId();
  if (!videoId) return;

  const currentTime    = getVideoTimestamp();
  const title          = getVideoTitle();
  const channel        = getChannelName();
  const transcriptText = getSelectedTranscriptText();
  const timestamp      = formatTimestamp(currentTime);
  const deepLink       = `https://www.youtube.com/watch?v=${videoId}&t=${currentTime}s`;

  // Use selected transcript text, or default bookmark
  const highlightText = transcriptText || `📍 Video Bookmark`;

  const payload = {
    id:             nextTempId(),
    text:           highlightText,
    url:            deepLink,
    pageTitle:      title,
    faviconUrl:     "https://www.youtube.com/favicon.ico",
    timestamp:      Date.now(),
    isCode:         false,
    isAI:           false,
    // YouTube-specific metadata
    resourceType:   "VIDEO",
    videoTimestamp:  currentTime,
    videoChannel:   channel,
    videoTitle:     title,
  };

  try {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ type: "SAVE_HIGHLIGHT", payload }, () => {
      if (chrome.runtime.lastError) { /* background waking up */ }
    });
  } catch {
    return;
  }

  // Show visual confirmation toast
  showYouTubeToast(title, timestamp);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showYouTubeToast(title: string, timestamp: string) {
  const existing = document.getElementById("cortex-yt-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "cortex-yt-toast";
  Object.assign(toast.style, {
    position:       "fixed",
    bottom:         "16px",
    right:          "16px",
    zIndex:         "2147483647",
    padding:        "10px 16px",
    borderRadius:   "12px",
    background:     "rgba(22, 22, 28, 0.95)",
    backdropFilter: "blur(12px)",
    border:         "1px solid rgba(255, 255, 255, 0.10)",
    boxShadow:      "0 8px 32px rgba(0, 0, 0, 0.5)",
    fontFamily:     "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontSize:       "13px",
    fontWeight:     "500",
    color:          "rgba(255, 255, 255, 0.90)",
    display:        "flex",
    alignItems:     "center",
    gap:            "8px",
    transition:     "opacity 0.3s ease, transform 0.3s ease",
    opacity:        "0",
    transform:      "translateY(8px)",
    pointerEvents:  "none",
    maxWidth:       "360px",
  });

  // YouTube red play icon + timestamp badge
  toast.innerHTML = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "#FF0000");
  svg.style.flexShrink = "0";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.3 31.3 0 000 12a31.3 31.3 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.3 31.3 0 0024 12a31.3 31.3 0 00-.5-5.8zM9.5 15.6V8.4L16 12l-6.5 3.6z");
  svg.appendChild(path);

  const savedSpan = document.createElement("span");
  savedSpan.style.color = "rgba(255,255,255,0.5)";
  savedSpan.textContent = "Saved";

  const tsSpan = document.createElement("span");
  Object.assign(tsSpan.style, {
    background: "rgba(255,0,0,0.15)",
    color: "#FF6B6B",
    padding: "2px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    fontVariantNumeric: "tabular-nums",
  });
  tsSpan.textContent = `[${timestamp}]`;

  toast.appendChild(svg);
  toast.appendChild(savedSpan);
  toast.appendChild(tsSpan);

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity   = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity   = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Mount ────────────────────────────────────────────────────────────────────

document.addEventListener("keydown", handleYouTubeCapture, { capture: true });
window.addEventListener("keydown", handleYouTubeCapture, { capture: true });

console.log("[Cortex Extension] YouTube extractor mounted");

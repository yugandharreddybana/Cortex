/**
 * Deep DOM Locator v3 — Cookie Buster + Lazy-Load Scroller + AI Chat Support
 * ──────────────────────────────────────────────────────────────────────────────
 * Triggered via query params `?cortex_locate=true&text=...`
 * or Text Fragment `#:~:text=...`
 *
 * Pipeline:
 *   1. Destroy cookie / GDPR banners
 *   2. Detect page type (regular page vs AI chat SPA)
 *   3. Try `window.find()` + DOM text-node walker to locate text
 *   4. Wrap matched text in glowing yellow `<mark>`
 *   5. If not found → auto-scroll the correct container (window or chat pane)
 *      while watching for DOM mutations → retry until found or timeout
 *   6. Show Vercel-style status toast throughout
 */

import { destroyCookieBanners } from "./utils/cookieBuster";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SCROLL_TIME_MS = 30_000;
const SCROLL_STEP_PX     = 800;
const SCROLL_INTERVAL_MS = 1_000;
const SETTLE_DELAY_MS    = 600;   // Wait for SPA hydration before starting
const SETTLE_DELAY_AI_MS = 2_500; // AI SPAs (Gemini/Claude) take longer to hydrate
const MUTATION_WAIT_MS   = 500;   // Extra wait after DOM mutation detected

// ─── AI chat scroll-container selectors ──────────────────────────────────────
// These sites render messages inside an inner scrollable container, not <body>.

const AI_SCROLL_SELECTORS = [
  // ChatGPT (multiple possible layouts)
  'main div[class*="overflow-y"]',
  'main div[role="presentation"]',
  'div[class*="react-scroll-to-bottom"]',
  // Claude
  'div[class*="overflow-y-auto"][class*="flex-1"]',
  'div.conversation-content',
  // Gemini — Angular Material / CDK virtual scroll
  'cdk-virtual-scroll-viewport',
  'infinite-scroller',
  '.conversation-container',
  'main .responses-container',
  'main model-response',
  // Gemini fallback — the chat panel
  'main',
  'div[class*="conversation-container"]',
  // Perplexity
  'div[class*="overflow-y-auto"]',
];

const AI_DOMAINS = [
  "chatgpt.com",
  "gemini.google.com",
  "claude.ai",
  "www.perplexity.ai",
];

// ─── Toast UI (Vercel-style) ─────────────────────────────────────────────────

function createToast(): HTMLDivElement {
  document.getElementById("cortex-locator-toast")?.remove();

  const toast = document.createElement("div");
  toast.id = "cortex-locator-toast";
  Object.assign(toast.style, {
    position:       "fixed",
    bottom:         "24px",
    right:          "24px",
    zIndex:         "2147483647",
    padding:        "12px 20px",
    borderRadius:   "12px",
    background:     "rgba(22, 22, 28, 0.95)",
    backdropFilter: "blur(12px)",
    border:         "1px solid rgba(108, 99, 255, 0.3)",
    boxShadow:      "0 4px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(108, 99, 255, 0.15)",
    fontFamily:     "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    fontSize:       "13px",
    fontWeight:     "500",
    color:          "rgba(255, 255, 255, 0.85)",
    display:        "flex",
    alignItems:     "center",
    gap:            "10px",
    transition:     "opacity 0.3s ease, transform 0.3s ease",
    opacity:        "0",
    transform:      "translateY(8px)",
    pointerEvents:  "none",
  } satisfies Partial<CSSStyleDeclaration>);

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity   = "1";
    toast.style.transform = "translateY(0)";
  });
  return toast;
}

function setToast(toast: HTMLDivElement, icon: string, message: string) {
  toast.innerHTML = "";
  const iconEl = document.createElement("span");
  iconEl.textContent = icon;
  iconEl.style.fontSize = "15px";
  const textEl = document.createElement("span");
  textEl.textContent = message;
  toast.appendChild(iconEl);
  toast.appendChild(textEl);
}

function dismissToast(toast: HTMLDivElement, delayMs = 3000) {
  setTimeout(() => {
    toast.style.opacity   = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, delayMs);
}

// ─── Highlight marker ────────────────────────────────────────────────────────

const MARK_STYLE = [
  "background-color: #FACC15",
  "color: #111827",
  "border-radius: 4px",
  "padding: 2px 0",
  "box-shadow: 0 0 10px rgba(250, 204, 21, 0.5)",
].join("; ");

function wrapSelectionInMark(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  try {
    const range = sel.getRangeAt(0);
    const mark  = document.createElement("mark");
    mark.id = "cortex-highlight-mark";
    mark.setAttribute("style", MARK_STYLE);
    range.surroundContents(mark);
    sel.removeAllRanges();
    return mark;
  } catch {
    return wrapSelectionFallback();
  }
}

function wrapSelectionFallback(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  try {
    const range    = sel.getRangeAt(0);
    const contents = range.extractContents();
    const mark     = document.createElement("mark");
    mark.id = "cortex-highlight-mark";
    mark.setAttribute("style", MARK_STYLE);
    mark.appendChild(contents);
    range.insertNode(mark);
    sel.removeAllRanges();
    return mark;
  } catch {
    return null;
  }
}

// ─── Shadow DOM piercing text-node collector ─────────────────────────────────

/**
 * Collect ALL text nodes under `root`, recursively entering Shadow DOM roots.
 * Gemini / Angular renders content inside web components with shadow roots.
 * Standard TreeWalker cannot see into shadow trees.
 */
function collectTextNodes(root: Node, includeWhitespace = false): Text[] {
  const nodes: Text[] = [];

  function walk(parent: Node) {
    // If this node has a shadow root, recurse into it
    if ((parent as Element).shadowRoot) {
      walk((parent as Element).shadowRoot!);
    }

    let child = parent.firstChild;
    while (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child as Text;
        if (includeWhitespace || (text.textContent && text.textContent.trim())) {
          nodes.push(text);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
      child = child.nextSibling;
    }
  }

  walk(root);
  return nodes;
}

// ─── Text-node walker (fallback when window.find fails) ──────────────────────

function findTextNodeInDOM(target: string, root: Node = document.body): Text | null {
  const norm = target.toLowerCase().trim();

  // First try the standard TreeWalker (fast, handles most cases)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.toLowerCase().includes(norm)) {
      return node;
    }
  }

  // Then try with Shadow DOM piercing (Gemini/Angular web components)
  const shadowNodes = collectTextNodes(root);
  for (const textNode of shadowNodes) {
    if (textNode.textContent && textNode.textContent.toLowerCase().includes(norm)) {
      return textNode;
    }
  }

  return null;
}

function highlightTextNodeManual(textNode: Text, target: string): HTMLElement | null {
  const content = textNode.textContent;
  if (!content) return null;

  const trimmed = target.trim();
  const idx = content.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx === -1) return null;

  const parent = textNode.parentNode;
  if (!parent) return null;

  const before  = content.slice(0, idx);
  const matched = content.slice(idx, idx + trimmed.length);
  const after   = content.slice(idx + trimmed.length);

  const mark = document.createElement("mark");
  mark.id = "cortex-highlight-mark";
  mark.setAttribute("style", MARK_STYLE);
  mark.textContent = matched;

  const frag = document.createDocumentFragment();
  if (before) frag.appendChild(document.createTextNode(before));
  frag.appendChild(mark);
  if (after) frag.appendChild(document.createTextNode(after));

  parent.replaceChild(frag, textNode);
  return mark;
}

// ─── Cross-node text finder (handles text split across elements) ─────────────

/**
 * Walk through text nodes under `root`, accumulate their content, and
 * locate `target` even when it spans multiple sibling elements (common
 * in Gemini / Claude Markdown renderers that wrap words in <span>s).
 * Pierces Shadow DOM and includes whitespace nodes to preserve spacing.
 * Returns a DOM Range encompassing the match.
 */
function findTextAcrossNodes(target: string, root: Node = document.body): Range | null {
  const norm = target.toLowerCase().trim();
  if (!norm) return null;

  // Include whitespace text nodes — they carry important spacing between
  // inline elements (Gemini renders "The quick" as Text("The") + Text(" ") + Text("quick"))
  const textNodes = collectTextNodes(root, true);
  if (textNodes.length === 0) return null;

  // Sliding window across sequential text nodes
  for (let i = 0; i < textNodes.length; i++) {
    let accumulated = "";

    for (let j = i; j < textNodes.length; j++) {
      accumulated += textNodes[j].textContent ?? "";

      const idx = accumulated.toLowerCase().indexOf(norm);
      if (idx !== -1) {
        // Map character offset back to the correct text nodes
        let charCount = 0;
        let startNode: Text | null = null;
        let startOffset = 0;
        let endNode: Text | null = null;
        let endOffset = 0;

        for (let k = i; k <= j; k++) {
          const len = textNodes[k].textContent?.length ?? 0;

          if (!startNode && charCount + len > idx) {
            startNode = textNodes[k];
            startOffset = idx - charCount;
          }
          const endIdx = idx + norm.length;
          if (!endNode && charCount + len >= endIdx) {
            endNode = textNodes[k];
            endOffset = endIdx - charCount;
          }

          charCount += len;
        }

        if (startNode && endNode) {
          try {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            return range;
          } catch { /* offset out of bounds — continue */ }
        }
      }

      // Don't accumulate indefinitely
      if (accumulated.length > norm.length * 5) break;
    }
  }

  return null;
}

/**
 * Highlight a Range by wrapping it in a <mark> element.
 */
function highlightRange(range: Range): HTMLElement | null {
  try {
    const mark = document.createElement("mark");
    mark.id = "cortex-highlight-mark";
    mark.setAttribute("style", MARK_STYLE);
    range.surroundContents(mark);
    return mark;
  } catch {
    // surroundContents fails when the range spans multiple elements
    try {
      const contents = range.extractContents();
      const mark = document.createElement("mark");
      mark.id = "cortex-highlight-mark";
      mark.setAttribute("style", MARK_STYLE);
      mark.appendChild(contents);
      range.insertNode(mark);
      return mark;
    } catch {
      return null;
    }
  }
}

// ─── window.find() wrapper ───────────────────────────────────────────────────

function browserFind(text: string): boolean {
  window.getSelection()?.removeAllRanges();
  return (window as unknown as { find: (s: string, c?: boolean, b?: boolean, w?: boolean) => boolean })
    .find(text, false, false, true);
}

// ─── Locate + highlight pipeline ─────────────────────────────────────────────

function unwrapMark() {
  const mark = document.getElementById("cortex-highlight-mark");
  if (mark) {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark);
    }
    mark.remove();
  }
}

function tryFindAndMark(targetText: string, searchRoot?: Node): HTMLElement | null {
  unwrapMark();

  const roots: Node[] = searchRoot ? [searchRoot, document.body] : [document.body];
  // Deduplicate if searchRoot IS document.body
  const uniqueRoots = searchRoot === document.body ? [document.body] : roots;

  for (const root of uniqueRoots) {
    // Strategy 1: window.find() — works well on regular pages
    if (root === document.body && browserFind(targetText)) {
      const mark = wrapSelectionInMark();
      if (mark) return mark;
    }

    // Strategy 2: Manual DOM text-node walker — single text node match
    const textNode = findTextNodeInDOM(targetText, root);
    if (textNode) {
      const mark = highlightTextNodeManual(textNode, targetText);
      if (mark) return mark;
    }

    // Strategy 3: Cross-node search — handles text split across elements
    const range = findTextAcrossNodes(targetText, root);
    if (range) {
      const mark = highlightRange(range);
      if (mark) return mark;
    }

    // Strategy 4: Whitespace-agnostic search (strips ALL whitespace)
    // The saved text from getSelection() adds newlines for block elements,
    // but the DOM text nodes might not contain whitespace between blocks.
    const solidTarget = targetText.replace(/\s+/g, "").toLowerCase();
    if (solidTarget !== targetText.toLowerCase()) {
      const allNodes = collectTextNodes(root, true);
      for (let i = 0; i < allNodes.length; i++) {
        let accumulated = "";
        for (let j = i; j < allNodes.length; j++) {
          accumulated += allNodes[j].textContent ?? "";
          const solidAccum = accumulated.replace(/\s+/g, "");
          const idx = solidAccum.toLowerCase().indexOf(solidTarget);
          if (idx !== -1) {
            // Found a match — map the solid position back to the exact text nodes
            let startNode: Text | null = null;
            let startOffset = 0;
            let endNode: Text | null = null;
            let endOffset = 0;

            let solidPos = 0;
            const rawConcat = allNodes.slice(i, j + 1).map(n => n.textContent ?? "").join("");

            for (let r = 0; r < rawConcat.length; r++) {
              if (solidPos === idx && !startNode) {
                let nodeStart = 0;
                for (let k = i; k <= j; k++) {
                  const len = allNodes[k].textContent?.length ?? 0;
                  if (nodeStart + len > r) {
                    startNode = allNodes[k];
                    startOffset = r - nodeStart;
                    break;
                  }
                  nodeStart += len;
                }
              }
              if (solidPos === idx + solidTarget.length && !endNode) {
                let nodeStart = 0;
                for (let k = i; k <= j; k++) {
                  const len = allNodes[k].textContent?.length ?? 0;
                  if (nodeStart + len >= r) {
                    endNode = allNodes[k];
                    endOffset = r - nodeStart;
                    break;
                  }
                  nodeStart += len;
                }
              }

              if (!/\s/.test(rawConcat[r])) {
                solidPos++;
              }
            }

            // Handle end at the very end of the string
            if (!endNode && solidPos >= idx + solidTarget.length) {
              let nodeStart = 0;
              for (let k = i; k <= j; k++) {
                const len = allNodes[k].textContent?.length ?? 0;
                if (nodeStart + len >= rawConcat.length) {
                  endNode = allNodes[k];
                  endOffset = len;
                  break;
                }
                nodeStart += len;
              }
            }

            if (startNode && endNode) {
              try {
                const r = document.createRange();
                r.setStart(startNode, startOffset);
                r.setEnd(endNode, endOffset);
                const mark = highlightRange(r);
                if (mark) return mark;
              } catch { /* continue */ }
            }
          }
          if (accumulated.length > targetText.length * 5) break;
        }
      }
    }
  }

  return null;
}

// ─── AI site detection ───────────────────────────────────────────────────────

function isAISite(): boolean {
  try {
    const hostname = window.location.hostname;
    return AI_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

/**
 * Find the inner scrollable container on AI chat sites.
 * These sites don't scroll `<body>` — they have an inner pane.
 * Pierces Shadow DOM for Angular-based sites like Gemini.
 */
function findAIScrollContainer(): HTMLElement | null {
  // Helper to query selectors including inside shadow roots
  function querySelectorDeep(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      // Try in light DOM first
      const els = document.querySelectorAll<HTMLElement>(selector);
      for (const el of els) {
        if (el.scrollHeight > el.clientHeight + 50) {
          return el;
        }
      }
    }

    // Traverse shadow roots
    const shadowHosts: Element[] = [];
    function collectShadowHosts(root: Node) {
      const children = (root as Element).querySelectorAll?.('*') ?? [];
      for (const child of children) {
        if (child.shadowRoot) {
          shadowHosts.push(child);
          collectShadowHosts(child.shadowRoot);
        }
      }
    }
    collectShadowHosts(document);

    for (const host of shadowHosts) {
      const shadow = host.shadowRoot!;
      for (const selector of selectors) {
        const els = shadow.querySelectorAll<HTMLElement>(selector);
        for (const el of els) {
          if (el.scrollHeight > el.clientHeight + 50) {
            return el;
          }
        }
      }
    }

    return null;
  }

  const fromSelectors = querySelectorDeep(AI_SCROLL_SELECTORS);
  if (fromSelectors) return fromSelectors;

  // Heuristic fallback: find the largest scrollable element on the page
  // (including inside shadow roots)
  let best: HTMLElement | null = null;
  let bestArea = 0;

  function checkScrollable(el: HTMLElement) {
    if (el.scrollHeight > el.clientHeight + 100) {
      const style = getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") {
        const area = el.clientWidth * el.clientHeight;
        if (area > bestArea) {
          bestArea = area;
          best = el;
        }
      }
    }
  }

  document.querySelectorAll<HTMLElement>("div, main, section").forEach(checkScrollable);

  // Also check inside shadow roots
  const allEls = document.querySelectorAll('*');
  for (const el of allEls) {
    if (el.shadowRoot) {
      el.shadowRoot.querySelectorAll<HTMLElement>("div, main, section").forEach(checkScrollable);
    }
  }

  return best;
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

function extractTargetText(): string | null {
  // Get the original URL used to load the page (bypasses SPA routers that strip query params
  // and Chrome's native stripping of the Text Fragment).
  const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const origUrlStr = navEntries.length > 0 ? navEntries[0].name : window.location.href;
  let origUrl;
  try {
    origUrl = new URL(origUrlStr);
  } catch {
    origUrl = new URL(window.location.href);
  }

  // Priority 1: Query parameter (?cortex_locate=true&text=...)
  if (origUrl.searchParams.get("cortex_locate") === "true") {
    const text = origUrl.searchParams.get("text");
    if (text) return text; // Already decoded by URLSearchParams
  }
  
  // Fallback to window.location.search just in case
  const params = new URLSearchParams(window.location.search);
  if (params.get("cortex_locate") === "true") {
    const text = params.get("text");
    if (text) return text;
  }

  // Priority 2: Text Fragment API (#:~:text=...)
  const hash = origUrl.hash || window.location.hash;
  const fragMatch = hash.match(/:~:text=([^&]+)/);
  if (fragMatch) {
    return decodeURIComponent(fragMatch[1]);
  }

  return null;
}

function cleanUrlParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("cortex_locate");
  url.searchParams.delete("text");

  let hash = url.hash;
  if (hash.includes(":~:text=")) {
    hash = hash.replace(/:~:text=[^&]*/, "");
    if (hash === "#" || hash === "") {
      hash = "";
    } else if (hash.endsWith(":")) {
      hash = hash.slice(0, -1);
    }
    url.hash = hash;
  }

  history.replaceState(null, "", url.toString());
}

// ─── Regular page scroller ───────────────────────────────────────────────────

function lazyScrollAndFind(targetText: string, toast: HTMLDivElement): void {
  const startTime = Date.now();
  let lastScrollHeight = document.body.scrollHeight;

  const immediate = tryFindAndMark(targetText);
  if (immediate) {
    immediate.scrollIntoView({ behavior: "smooth", block: "center" });
    setToast(toast, "✅", "Highlight found!");
    dismissToast(toast);
    cleanUrlParams();
    return;
  }

  setToast(toast, "🔍", "Cortex: Locating your highlight...");

  const timer = setInterval(() => {
    if (Date.now() - startTime > MAX_SCROLL_TIME_MS) {
      clearInterval(timer);
      setToast(toast, "⚠️", "Could not locate the exact text on this page.");
      dismissToast(toast, 4000);
      cleanUrlParams();
      return;
    }

    const mark = tryFindAndMark(targetText);
    if (mark) {
      clearInterval(timer);
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      setToast(toast, "✅", "Highlight found!");
      dismissToast(toast);
      cleanUrlParams();
      return;
    }

    const currentHeight = document.body.scrollHeight;
    const atBottom = window.innerHeight + window.scrollY >= currentHeight - 50;

    if (atBottom && currentHeight === lastScrollHeight) {
      clearInterval(timer);
      setToast(toast, "⚠️", "Reached end of page. Text not found.");
      dismissToast(toast, 4000);
      cleanUrlParams();
      return;
    }

    lastScrollHeight = currentHeight;
    window.scrollBy({ top: SCROLL_STEP_PX, behavior: "smooth" });
  }, SCROLL_INTERVAL_MS);
}

// ─── AI chat scroller (inner container + MutationObserver) ───────────────────

function aiScrollAndFind(targetText: string, toast: HTMLDivElement): void {
  const startTime = Date.now();

  // Wait for the chat container to appear (SPA may still be hydrating)
  let retries = 0;
  const containerPoll = setInterval(() => {
    retries++;
    const container = findAIScrollContainer();

    if (container) {
      clearInterval(containerPoll);
      runAILocator(container, targetText, toast, startTime);
      return;
    }

    // Fallback: if no scrollable container after 5s, try regular page approach
    if (retries > 10) {
      clearInterval(containerPoll);
      lazyScrollAndFind(targetText, toast);
    }
  }, 500);
}

function runAILocator(
  container: HTMLElement,
  targetText: string,
  toast: HTMLDivElement,
  startTime: number,
): void {
  // Scroll to the very top first so we scan the entire conversation
  container.scrollTop = 0;

  // Try immediately — the message may already be rendered
  const immediate = tryFindAndMark(targetText, container);
  if (immediate) {
    immediate.scrollIntoView({ behavior: "smooth", block: "center" });
    setToast(toast, "✅", "Highlight found!");
    dismissToast(toast);
    cleanUrlParams();
    return;
  }

  setToast(toast, "🔍", "Cortex: Scanning chat for your highlight...");

  let lastScrollHeight = container.scrollHeight;
  let mutationSeen = false;

  // MutationObserver catches new messages being rendered by the framework
  const observer = new MutationObserver(() => {
    mutationSeen = true;
  });
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const timer = setInterval(() => {
    // Hard timeout
    if (Date.now() - startTime > MAX_SCROLL_TIME_MS) {
      cleanup();
      setToast(toast, "⚠️", "Could not locate the text in this chat.");
      dismissToast(toast, 4000);
      cleanUrlParams();
      return;
    }

    // If mutations were detected, wait for rendering to settle
    if (mutationSeen) {
      mutationSeen = false;
      setTimeout(() => {
        const mark = tryFindAndMark(targetText, container);
        if (mark) {
          cleanup();
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
          setToast(toast, "✅", "Highlight found!");
          dismissToast(toast);
          cleanUrlParams();
        }
      }, MUTATION_WAIT_MS);
      return;
    }

    // Try finding text
    const mark = tryFindAndMark(targetText, container);
    if (mark) {
      cleanup();
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      setToast(toast, "✅", "Highlight found!");
      dismissToast(toast);
      cleanUrlParams();
      return;
    }

    // Scroll the inner container down to trigger lazy-loaded messages
    const currentHeight = container.scrollHeight;
    const atBottom =
      container.scrollTop + container.clientHeight >= currentHeight - 50;

    if (atBottom && currentHeight === lastScrollHeight) {
      cleanup();
      setToast(toast, "⚠️", "Reached end of chat. Text not found.");
      dismissToast(toast, 4000);
      cleanUrlParams();
      return;
    }

    lastScrollHeight = currentHeight;
    container.scrollBy({ top: SCROLL_STEP_PX, behavior: "smooth" });
  }, SCROLL_INTERVAL_MS);

  function cleanup() {
    clearInterval(timer);
    observer.disconnect();
  }
}

// ─── Public entry point ──────────────────────────────────────────────────────

export function runLocator() {
  const targetText = extractTargetText();
  if (!targetText) return;

  // Step 1 — Destroy cookie banners immediately
  destroyCookieBanners();

  const ai = isAISite();

  // Step 2 — Wait for page to settle, then start locate pipeline
  const settleTime = ai ? SETTLE_DELAY_AI_MS : SETTLE_DELAY_MS;
  setTimeout(() => {
    const toast = createToast();

    if (ai) {
      setToast(toast, "🔍", "Cortex: Destroying popups and scanning chat...");
      aiScrollAndFind(targetText, toast);
    } else {
      lazyScrollAndFind(targetText, toast);
    }
  }, settleTime);
}

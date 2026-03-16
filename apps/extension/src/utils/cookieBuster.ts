/**
 * Universal Cookie Buster — destroys GDPR / cookie consent overlays
 * that block the viewport, using a combination of known selectors,
 * XPath text heuristics, and brute-force hiding.
 */

// ─── Known consent-button selectors ──────────────────────────────────────────

const ACCEPT_SELECTORS = [
  // OneTrust (very common)
  "#onetrust-accept-btn-handler",
  "#onetrust-banner-sdk .onetrust-close-btn-handler",
  // Cookiebot
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  // Cookie Consent (Osano / Insites)
  ".cc-btn.cc-allow",
  ".cc-accept-all",
  ".cc-dismiss",
  // Quantcast
  ".qc-cmp2-summary-buttons button[mode='primary']",
  // Didomi
  "#didomi-notice-agree-button",
  // TrustArc / TrustE
  ".truste_popframe .pdynamicbutton .call",
  "#truste-consent-button",
  // Klaro
  ".klaro .cm-btn.cm-btn-success",
  // Complianz
  ".cmplz-accept",
  ".cmplz-btn.cmplz-accept",
  // Generic patterns
  ".cookie-btn",
  ".cookie-consent-accept",
  ".cookie-accept",
  ".consent-accept",
  "[data-testid='cookie-policy-dialog-accept-button']",
  "[data-testid='cookie-accept']",
  "[data-cookiefirst-action='accept']",
  "button[data-cb-id='accept']",
  ".js-cookie-accept",
  ".accept-cookies-button",
  "#accept-cookies",
  "#cookie-accept",
];

// ─── Known overlay / wrapper selectors (for force-hiding) ────────────────────

const BANNER_SELECTORS = [
  "#onetrust-banner-sdk",
  "#onetrust-consent-sdk",
  "#CybotCookiebotDialog",
  "#CybotCookiebotDialogBodyUnderlay",
  ".cc-window",
  ".cc-banner",
  "#qc-cmp2-container",
  "#didomi-host",
  "#didomi-popup",
  ".truste_overlay",
  ".truste_box_overlay",
  "#truste-consent-track",
  ".klaro",
  ".cmplz-cookiebanner",
  ".cookie-banner",
  ".cookie-notice",
  ".cookie-consent",
  ".gdpr-banner",
  ".consent-banner",
  "[class*='cookie-banner']",
  "[class*='cookie-consent']",
  "[id*='cookie-banner']",
  "[id*='cookie-consent']",
];

// ─── Text patterns for XPath heuristic ───────────────────────────────────────

const ACCEPT_TEXTS = [
  "Accept All",
  "Accept all cookies",
  "Accept",
  "Allow cookies",
  "Allow all",
  "Allow All Cookies",
  "Got it",
  "I agree",
  "Agree and proceed",
  "Agree",
  "OK",
  "Continue",
  "Close",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clickElement(el: HTMLElement): boolean {
  try {
    el.click();
    return true;
  } catch {
    return false;
  }
}

/** Check if an element is likely a consent overlay (fixed/sticky positioned, covering viewport). */
function isOverlayLike(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return (
    style.position === "fixed" ||
    style.position === "sticky" ||
    style.position === "absolute"
  );
}

/** Force-hide an element and its likely parent wrappers. */
function forceHide(el: HTMLElement) {
  el.style.setProperty("display", "none", "important");
  el.style.setProperty("visibility", "hidden", "important");
  el.style.setProperty("opacity", "0", "important");
  el.style.setProperty("pointer-events", "none", "important");

  // Walk up to find the overlay container (max 5 levels)
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    if (isOverlayLike(parent) && parent !== document.body) {
      parent.style.setProperty("display", "none", "important");
      break;
    }
    parent = parent.parentElement;
    depth++;
  }

  // Restore body scroll in case the banner locked it
  document.body.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("overflow");
}

// ─── Core engine ─────────────────────────────────────────────────────────────

function tryAcceptBySelector(): boolean {
  for (const selector of ACCEPT_SELECTORS) {
    const btn = document.querySelector<HTMLElement>(selector);
    if (btn && btn.offsetParent !== null) {
      return clickElement(btn);
    }
  }
  return false;
}

function tryAcceptByText(): boolean {
  for (const text of ACCEPT_TEXTS) {
    // XPath: find visible <button> or <a> with matching text
    const xpath = `//button[normalize-space()='${text}'] | //a[normalize-space()='${text}'] | //span[normalize-space()='${text}']/ancestor::button[1]`;
    const result = document.evaluate(
      xpath,
      document.body,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );

    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i) as HTMLElement | null;
      if (node && node.offsetParent !== null && isOverlayLike(node) || (node?.closest("[class*='cookie'], [class*='consent'], [class*='banner'], [id*='cookie'], [id*='consent']"))) {
        if (node && clickElement(node)) return true;
      }
    }
  }
  return false;
}

function forceHideBanners() {
  for (const selector of BANNER_SELECTORS) {
    const els = document.querySelectorAll<HTMLElement>(selector);
    els.forEach((el) => {
      if (el.offsetHeight > 0) forceHide(el);
    });
  }

  // Also hide any fixed/sticky element that looks like a consent overlay
  document.querySelectorAll<HTMLElement>("div, section, aside").forEach((el) => {
    if (!isOverlayLike(el)) return;
    const text = el.textContent?.toLowerCase() ?? "";
    if (
      (text.includes("cookie") || text.includes("consent") || text.includes("gdpr") || text.includes("privacy")) &&
      (text.includes("accept") || text.includes("agree") || text.includes("allow"))
    ) {
      // Likely a consent banner — check size (must be substantial, not a small link)
      const rect = el.getBoundingClientRect();
      if (rect.height > 50 && rect.width > 200) {
        forceHide(el);
      }
    }
  });
}

/**
 * Attempt to dismiss cookie banners using all heuristics.
 * Returns true if something was clicked or hidden.
 */
function destroyOnce(): boolean {
  // Phase 1: Try clicking a known accept button
  if (tryAcceptBySelector()) return true;

  // Phase 2: Try XPath text matching
  if (tryAcceptByText()) return true;

  // Phase 3: Force-hide known banner containers
  forceHideBanners();
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the cookie buster on a repeating interval for a fixed window.
 * Banners may render after JS hydration, so we poll for several seconds.
 *
 * @param durationMs  How long to keep polling (default: 5000ms)
 * @param intervalMs  Polling interval (default: 500ms)
 */
export function destroyCookieBanners(
  durationMs = 5000,
  intervalMs = 500,
): void {
  // Run immediately
  destroyOnce();

  const start = Date.now();
  const timer = setInterval(() => {
    destroyOnce();
    if (Date.now() - start >= durationMs) {
      clearInterval(timer);
    }
  }, intervalMs);
}

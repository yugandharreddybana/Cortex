/**
 * Ensures a URL is absolute by prepending https:// if it lacks a protocol.
 * This prevents relative path resolution which causes 404s in the dashboard.
 */
export function ensureAbsoluteUrl(url: string | undefined): string {
  if (!url || url === "#") return "#";
  
  // Check for common protocols
  const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (hasProtocol) {
    return url;
  }
  
  // Default to https for security
  return `https://${url}`;
}

/**
 * Generates a Chrome-compatible scroll-to-text fragment.
 * Format: #:~:text=[prefix-,]textStart[,textEnd][,-suffix]
 * 
 * Spec: https://github.com/WICG/scroll-to-text-fragment
 */
export function generateTextFragment(text: string): string {
  if (!text) return "";
  
  // Use a meaningful but safe slice of the text for the fragment.
  // 150 characters is usually enough for a unique match on most pages.
  const cleanText = text.trim().slice(0, 150);
  if (!cleanText) return "";
  
  // encodeURIComponent handles most characters, but we need to explicitly
  // handle the reserved characters -, ,, and & according to the spec.
  // encodeURIComponent already handles &, but we'll be safe.
  const encodedText = encodeURIComponent(cleanText)
    .replace(/-/g, "%2d")
    .replace(/,/g, "%2c");
    
  return `#:~:text=${encodedText}`;
}

/**
 * Formats a source URL with an optional text fragment for automatic highlighting.
 */
export function formatSourceUrl(url: string | undefined, highlightText?: string): string {
  const absoluteUrl = ensureAbsoluteUrl(url);
  if (absoluteUrl === "#") return "#";
  
  if (!highlightText) return absoluteUrl;
  
  // Only append fragment if there isn't one already (to avoid breaking deep links)
  if (absoluteUrl.includes("#")) {
    return absoluteUrl;
  }
  
  const fragment = generateTextFragment(highlightText);
  return absoluteUrl + fragment;
}

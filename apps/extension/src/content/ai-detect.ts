/**
 * AI site detection utilities.
 * Extracted to avoid circular imports between index.tsx and FloatingMenu.tsx.
 */

const AI_DOMAINS = [
  "chatgpt.com",
  "gemini.google.com",
  "claude.ai",
  "www.perplexity.ai",
];

export function isAISite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return AI_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
  } catch {
    return false;
  }
}

export function getAIContext(): { isAI: boolean; chatName: string; chatUrl: string } {
  const url = window.location.href;
  const isAI = isAISite(url);
  return {
    isAI,
    chatName: isAI ? document.title : "",
    chatUrl:  isAI ? url : "",
  };
}

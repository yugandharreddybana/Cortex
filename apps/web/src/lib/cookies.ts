export function extractCookieValue(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|,\\s*)${escaped}=([^;]+)`);
  const match = setCookieHeader.match(re);
  return match?.[1] ?? null;
}


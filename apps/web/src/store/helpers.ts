export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: T | null; status: number }> {
  try {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) return { ok: false, data: null, status: res.status };
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T) : null;
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0 };
  }
}

const EMOJIS = ["📁", "🔬", "🎨", "⚙️", "📦", "✨", "🌐", "💡", "🧠", "📝"];
let emojiIdx = 0;

export function nextEmoji() {
  const e = EMOJIS[emojiIdx % EMOJIS.length];
  emojiIdx++;
  return e;
}

export function dedupById<T extends { id: string | number }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const sid = String(item.id);
    if (seen.has(sid)) return false;
    seen.add(sid);
    return true;
  });
}

let _localIdCounter = 0;
export function nextLocalId(): string { return `local-${++_localIdCounter}`; }

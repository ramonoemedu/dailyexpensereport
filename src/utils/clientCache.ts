const PREFIX = 'dex_cache:';

type Entry<T> = { ts: number; value: T };

// In-memory layer for same-session fast access
const memStore = new Map<string, Entry<any>>();

function lsKey(key: string) {
  return PREFIX + key;
}

export function cacheRead<T>(key: string, ttlMs: number): T | null {
  // 1. Check memory first (fastest)
  const mem = memStore.get(key);
  if (mem) {
    if (Date.now() - mem.ts <= ttlMs) return mem.value as T;
    memStore.delete(key);
  }

  // 2. Fall back to localStorage (survives page refresh)
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return null;
    const entry: Entry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > ttlMs) {
      localStorage.removeItem(lsKey(key));
      return null;
    }
    // Warm memory cache from localStorage
    memStore.set(key, entry);
    return entry.value;
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, value: T) {
  const entry: Entry<T> = { ts: Date.now(), value };
  memStore.set(key, entry);
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(entry));
  } catch (e: any) {
    // localStorage quota exceeded — evict oldest entries and retry
    if (e?.name === 'QuotaExceededError') {
      evictOldest();
      try { localStorage.setItem(lsKey(key), JSON.stringify(entry)); } catch { /* give up */ }
    }
  }
}

export function cacheInvalidate(pattern: string) {
  // Clear memory
  for (const key of memStore.keys()) {
    if (key.includes(pattern)) memStore.delete(key);
  }

  // Clear localStorage
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k.includes(pattern)) toDelete.push(k);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  } catch { /* localStorage unavailable */ }
}

/** Drop-in wrapper: returns cached result or fetches fresh and caches it. */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = cacheRead<T>(key, ttlMs);
  if (hit !== null) return hit;
  const value = await fetcher();
  cacheWrite(key, value);
  return value;
}

function evictOldest() {
  try {
    let oldest: { key: string; ts: number } | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      try {
        const e = JSON.parse(localStorage.getItem(k)!);
        if (!oldest || e.ts < oldest.ts) oldest = { key: k, ts: e.ts };
      } catch { /* skip corrupt entry */ }
    }
    if (oldest) localStorage.removeItem(oldest.key);
  } catch { /* ignore */ }
}

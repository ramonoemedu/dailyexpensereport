type Entry<T> = { ts: number; value: T };

// In-memory only — cleared on every page refresh
const memStore = new Map<string, Entry<any>>();

export function cacheRead<T>(key: string, ttlMs: number): T | null {
  const mem = memStore.get(key);
  if (!mem) return null;
  if (Date.now() - mem.ts > ttlMs) {
    memStore.delete(key);
    return null;
  }
  return mem.value as T;
}

export function cacheWrite<T>(key: string, value: T) {
  memStore.set(key, { ts: Date.now(), value });
}

export function cacheInvalidate(pattern: string) {
  for (const key of memStore.keys()) {
    if (key.includes(pattern)) memStore.delete(key);
  }
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

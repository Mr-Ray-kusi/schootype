import { cacheGetResponse, readCachedGet } from './offlineQueue';

const memory = new Map();

/**
 * GET cache. Dashboard uses 5 minutes; lists default to 45s.
 */
export async function cachedGet(key, fetcher, ttlMs = 45000) {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data;
  }
  try {
    const data = await fetcher();
    memory.set(key, { at: Date.now(), data });
    cacheGetResponse(key, data);
    return data;
  } catch (error) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (offline || !error?.response) {
      const cached = hit?.data ?? (await readCachedGet(key));
      if (cached != null) return cached;
    }
    throw error;
  }
}

export function invalidateCache(prefix = '') {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export const DASHBOARD_CACHE_MS = 5 * 60 * 1000;
export const REPORT_CACHE_MS = 5 * 60 * 1000;

import { cacheGetResponse, readCachedGet } from './offlineQueue';

const memory = new Map();
const inflight = new Map();

export function peekCache(key) {
  return memory.get(key)?.data;
}

export function isCacheFresh(key, ttlMs) {
  const hit = memory.get(key);
  return Boolean(hit && Date.now() - hit.at < ttlMs);
}

/**
 * GET cache. Dashboard uses 5 minutes; lists default to 45s.
 * In-flight requests for the same key are deduped.
 */
export async function cachedGet(key, fetcher, ttlMs = 45000) {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data;
  }
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const pending = (async () => {
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
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, pending);
  return pending;
}

/**
 * Return cached data immediately (even if stale) and refresh in the background.
 */
export async function staleGet(key, fetcher, ttlMs = 45000, onFresh) {
  const hit = memory.get(key);
  if (hit?.data !== undefined) {
    if (Date.now() - hit.at >= ttlMs) {
      cachedGet(key, fetcher, 0)
        .then((data) => onFresh?.(data))
        .catch(() => {});
    } else {
      onFresh?.(hit.data);
    }
    return hit.data;
  }
  const data = await cachedGet(key, fetcher, ttlMs);
  onFresh?.(data);
  return data;
}

export function invalidateCache(prefix = '') {
  if (!prefix) {
    memory.clear();
    inflight.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

export const DASHBOARD_CACHE_MS = 5 * 60 * 1000;
export const REPORT_CACHE_MS = 5 * 60 * 1000;

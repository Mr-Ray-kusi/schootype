const memory = new Map();

/**
 * Short-lived GET cache so navigating back to Students/Attendance feels instant.
 * TTL defaults to 45s.
 */
export async function cachedGet(key, fetcher, ttlMs = 45000) {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data;
  }
  const data = await fetcher();
  memory.set(key, { at: Date.now(), data });
  return data;
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

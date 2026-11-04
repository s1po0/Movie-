// Cache only catalog metadata, never short-lived video URLs.
export function createCatalogCache(fetchJson, { ttl = 5 * 60 * 1000, maxEntries = 12, now = Date.now } = {}) {
  const cached = new Map();
  const pending = new Map();
  return async function getCatalog(url) {
    const entry = cached.get(url);
    if (entry && now() - entry.time < ttl) {
      cached.delete(url); cached.set(url, entry);
      return entry.data;
    }
    cached.delete(url);
    if (pending.has(url)) return pending.get(url);
    const request = (async () => {
      const data = await fetchJson(url);
      if (!Array.isArray(data?.metas)) throw new Error('Invalid movie catalog response');
      cached.set(url, { data, time: now() });
      while (cached.size > maxEntries) cached.delete(cached.keys().next().value);
      return data;
    })();
    pending.set(url, request);
    try { return await request; } finally { if (pending.get(url) === request) pending.delete(url); }
  };
}

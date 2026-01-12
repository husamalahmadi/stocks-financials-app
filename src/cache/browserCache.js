// FILE: client/src/cache/browserCache.js
/**
 * Tiny TTL cache for browser storage (localStorage by default).
 * WHY: replaces the server's on-disk 30-day cache for financial statements.
 */

const memory = new Map();

function getStorage(kind) {
  try {
    if (kind === "session") return window.sessionStorage;
    if (kind === "local") return window.localStorage;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getCached(key, { ttlMs, storage = "local" } = {}) {
  const store = getStorage(storage);
  const raw = store ? store.getItem(key) : memory.get(key);

  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const savedAt = Number(parsed?.savedAt ?? 0);
    if (!savedAt) return null;

    const age = Date.now() - savedAt;
    if (Number.isFinite(ttlMs) && ttlMs > 0 && age > ttlMs) {
      delCached(key, { storage });
      return null;
    }
    return parsed?.value ?? null;
  } catch {
    delCached(key, { storage });
    return null;
  }
}

export function setCached(key, value, { storage = "local" } = {}) {
  const store = getStorage(storage);
  const payload = { savedAt: Date.now(), value };

  try {
    if (store) store.setItem(key, JSON.stringify(payload));
    else memory.set(key, payload);
  } catch {
    memory.set(key, payload);
  }
}

export function delCached(key, { storage = "local" } = {}) {
  const store = getStorage(storage);
  try {
    if (store) store.removeItem(key);
  } catch {
    // ignore
  }
  memory.delete(key);
}
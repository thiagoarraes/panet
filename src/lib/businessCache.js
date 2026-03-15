const STORAGE_KEY = "panet.business-cache.v1";
const inflightRequests = new Map();

const now = () => Date.now();

const safeParse = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
};

const readStore = () => {
  if (typeof window === "undefined") return {};
  const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return parsed && typeof parsed === "object" ? parsed : {};
};

const writeStore = (value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value || {}));
  } catch (_err) {
    // no-op
  }
};

const getUserBucket = (store, userId) => {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const bucket = store[uid];
  return bucket && typeof bucket === "object" ? bucket : null;
};

export const readCachedDomain = (userId, domain, maxAgeMs = Infinity) => {
  const store = readStore();
  const bucket = getUserBucket(store, userId);
  if (!bucket) return null;
  const entry = bucket[domain];
  if (!entry || typeof entry !== "object" || !("data" in entry)) return null;
  const age = now() - Number(entry.at || 0);
  if (Number.isFinite(maxAgeMs) && age > maxAgeMs) return null;
  return entry.data;
};

export const writeCachedDomain = (userId, domain, data) => {
  const uid = String(userId || "").trim();
  if (!uid || !domain) return;
  const store = readStore();
  const current = getUserBucket(store, uid) || {};
  store[uid] = {
    ...current,
    [domain]: {
      at: now(),
      data,
    },
  };
  writeStore(store);
};

export const invalidateCachedDomain = (userId, domain) => {
  const uid = String(userId || "").trim();
  if (!uid || !domain) return;
  const store = readStore();
  const bucket = getUserBucket(store, uid);
  if (!bucket || !(domain in bucket)) return;
  const nextBucket = { ...bucket };
  delete nextBucket[domain];
  store[uid] = nextBucket;
  writeStore(store);
};

export const runDedupedRequest = async (key, factory) => {
  if (!key || typeof factory !== "function") return factory();
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }
  const promise = Promise.resolve().then(factory).finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
};

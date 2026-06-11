import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const PERSIST_STORAGE_KEY = "panet.query-cache.v1";
// 24h: primeiro load do dia renderiza instantâneo com dados persistidos;
// staleTime de cada query continua controlando o refetch em background.
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PERSIST_BUSTER = "panet-query-cache-2026-06-11";

const PERSISTED_QUERY_ROOTS = new Set([
  "dashboard-snapshot",
  "postagens",
  "mural",
  "ferias",
  "ausencias",
  "aniversarios",
  "colaboradores",
  "mood-checkins",
]);

let persistenceStarted = false;

const resolveStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const probeKey = "__panet_query_cache_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch (_err) {
    return null;
  }
};

const shouldDehydrateQuery = (query) => {
  if (!query || query.state?.status !== "success") return false;
  const rootKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
  return typeof rootKey === "string" && PERSISTED_QUERY_ROOTS.has(rootKey);
};

export const initQueryPersistence = (queryClient) => {
  if (persistenceStarted || !queryClient) return;

  const storage = resolveStorage();
  if (!storage) return;

  persistenceStarted = true;

  const persister = createSyncStoragePersister({
    key: PERSIST_STORAGE_KEY,
    storage,
    throttleTime: 1000,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: PERSIST_MAX_AGE_MS,
    buster: PERSIST_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery,
    },
  });
};

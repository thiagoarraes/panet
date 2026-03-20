import { SUPABASE_URL, isSupabaseEnabled, supabase } from "./supabase.js";
import {
  getAvatarStoragePathFromUrl,
  getGaleriaStoragePathFromUrl,
  getPostStoragePathFromUrl,
} from "./imageUtils.js";

const SIGNED_MEDIA_TTL_SECONDS = 60 * 60 * 6;

const BUCKET_EXTRACTORS = {
  avatares: getAvatarStoragePathFromUrl,
  galeria: getGaleriaStoragePathFromUrl,
  postagens: getPostStoragePathFromUrl,
};

const isClientOnlyUrl = (value) => /^(data:|blob:)/i.test(String(value || "").trim());
const isAbsoluteWebUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const ensureAbsoluteUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (isAbsoluteWebUrl(trimmed) || !SUPABASE_URL) return trimmed;
  return `${SUPABASE_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
};

const toMediaRef = (bucket, rawValue) => {
  const original = String(rawValue || "").trim();
  if (!original) return { kind: "empty", original: "", path: "" };
  if (isClientOnlyUrl(original)) return { kind: "direct", original, path: "" };

  const extractor = BUCKET_EXTRACTORS[bucket];
  const path = extractor ? extractor(original) : "";
  if (path) return { kind: "storage", original, path };
  return { kind: "direct", original, path: "" };
};

export const normalizeStoredMediaValue = (bucket, rawValue) => {
  const ref = toMediaRef(bucket, rawValue);
  if (ref.kind === "empty") return null;
  if (ref.kind === "storage") return ref.path;
  return ref.original;
};

export const resolveSignedMediaUrl = (bucket, rawValue, signedUrlMap, fallback = "") => {
  const ref = toMediaRef(bucket, rawValue);
  if (ref.kind === "storage") {
    return signedUrlMap?.get(ref.path) || fallback;
  }
  if (ref.kind === "direct") return ref.original || fallback;
  return fallback;
};

export const createSignedUrlMap = async (
  bucket,
  rawValues,
  expiresIn = SIGNED_MEDIA_TTL_SECONDS
) => {
  const values = Array.isArray(rawValues) ? rawValues : [];
  const storagePaths = Array.from(
    new Set(
      values
        .map((value) => toMediaRef(bucket, value))
        .filter((ref) => ref.kind === "storage" && ref.path)
        .map((ref) => ref.path)
    )
  );

  const signedUrls = new Map();
  if (!isSupabaseEnabled || !supabase || storagePaths.length === 0) return signedUrls;

  const bucketApi = supabase.storage.from(bucket);

  if (typeof bucketApi.createSignedUrls === "function") {
    const { data, error } = await bucketApi.createSignedUrls(storagePaths, expiresIn);
    if (error) throw new Error(error.message);

    for (const item of data || []) {
      if (!item?.path || !item?.signedUrl) continue;
      signedUrls.set(item.path, ensureAbsoluteUrl(item.signedUrl));
    }
    return signedUrls;
  }

  await Promise.all(
    storagePaths.map(async (path) => {
      const { data, error } = await bucketApi.createSignedUrl(path, expiresIn);
      if (error) throw error;
      if (data?.signedUrl) signedUrls.set(path, ensureAbsoluteUrl(data.signedUrl));
    })
  );

  return signedUrls;
};

import { createClient } from "@supabase/supabase-js";

const MARKERS = {
  avatares: [
    "/storage/v1/object/public/avatares/",
    "/storage/v1/object/sign/avatares/",
    "/storage/v1/object/authenticated/avatares/",
  ],
  postagens: [
    "/storage/v1/object/public/postagens/",
    "/storage/v1/object/sign/postagens/",
    "/storage/v1/object/authenticated/postagens/",
  ],
  galeria: [
    "/storage/v1/object/public/galeria/",
    "/storage/v1/object/sign/galeria/",
    "/storage/v1/object/authenticated/galeria/",
    "/galerias/",
  ],
};

const CHUNK_SIZE = 100;

const getArg = (flag) => process.argv.includes(flag);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = getArg("--apply");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Required: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const parseStoragePath = (bucket, rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || "");
    for (const marker of MARKERS[bucket] || []) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) return pathname.slice(idx + marker.length);
    }
    return "";
  } catch (_err) {
    return "";
  }
};

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const listBucketObjectPaths = async (bucket) => {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("storage.objects")
      .select("name")
      .eq("bucket_id", bucket)
      .order("name", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(`[${bucket}] list error: ${error.message}`);
    const rows = data || [];
    rows.forEach((row) => all.push(String(row.name || "")));
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return unique(all);
};

const getReferencedPaths = async () => {
  const referenced = {
    avatares: new Set(),
    postagens: new Set(),
    galeria: new Set(),
  };

  const [colabsRes, postsRes, fotosRes] = await Promise.all([
    supabase.from("colaboradores").select("foto_url"),
    supabase.from("postagens").select("imagem_url"),
    supabase.from("galeria_fotos").select("foto_url"),
  ]);

  if (colabsRes.error) throw new Error(`colaboradores query error: ${colabsRes.error.message}`);
  if (postsRes.error) throw new Error(`postagens query error: ${postsRes.error.message}`);
  if (fotosRes.error) throw new Error(`galeria_fotos query error: ${fotosRes.error.message}`);

  (colabsRes.data || []).forEach((row) => {
    const path = parseStoragePath("avatares", row?.foto_url);
    if (path) referenced.avatares.add(path);
  });

  (postsRes.data || []).forEach((row) => {
    const path = parseStoragePath("postagens", row?.imagem_url);
    if (path) referenced.postagens.add(path);
  });

  (fotosRes.data || []).forEach((row) => {
    const path = parseStoragePath("galeria", row?.foto_url);
    if (path) referenced.galeria.add(path);
  });

  return referenced;
};

const removeInChunks = async (bucket, paths) => {
  const list = [...paths];
  let removed = 0;
  for (let i = 0; i < list.length; i += CHUNK_SIZE) {
    const chunk = list.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`[${bucket}] remove error: ${error.message}`);
    removed += chunk.length;
  }
  return removed;
};

const main = async () => {
  const referenced = await getReferencedPaths();
  const bucketNames = ["avatares", "postagens", "galeria"];
  const summary = [];

  for (const bucket of bucketNames) {
    const existing = await listBucketObjectPaths(bucket);
    const existingSet = new Set(existing);
    const refSet = referenced[bucket];
    const orphaned = existing.filter((path) => !refSet.has(path));
    summary.push({
      bucket,
      existing: existing.length,
      referenced: refSet.size,
      orphanedCount: orphaned.length,
      orphaned,
    });
  }

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  summary.forEach((row) => {
    console.log(
      `[${row.bucket}] existing=${row.existing} referenced=${row.referenced} orphaned=${row.orphanedCount}`
    );
  });

  if (!APPLY) {
    console.log("Dry-run complete. Use --apply to remove orphaned files.");
    return;
  }

  for (const row of summary) {
    if (row.orphanedCount === 0) continue;
    const removed = await removeInChunks(row.bucket, row.orphaned);
    console.log(`[${row.bucket}] removed ${removed} orphaned files.`);
  }
  console.log("Cleanup complete.");
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

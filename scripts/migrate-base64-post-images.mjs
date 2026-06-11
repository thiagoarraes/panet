// Migra imagens base64 inline (postagens.imagem_url = "data:...") para o
// bucket público "postagens", trocando o campo pela URL de CDN.
// Uso: node --env-file=.env scripts/migrate-base64-post-images.mjs [--apply]
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Required: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXT_BY_MIME = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/avif": "avif",
};

const parseDataUri = (value) => {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(value || ""));
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
};

const main = async () => {
  const { data: rows, error } = await supabase
    .from("postagens")
    .select("id,imagem_url")
    .like("imagem_url", "data:%");
  if (error) throw new Error(error.message);

  console.log(`${rows.length} post(s) com imagem base64 inline.${APPLY ? "" : " (dry-run — use --apply para migrar)"}`);

  for (const row of rows) {
    const parsed = parseDataUri(row.imagem_url);
    if (!parsed) {
      console.warn(`- ${row.id}: data URI não reconhecido, pulando`);
      continue;
    }
    const ext = EXT_BY_MIME[parsed.contentType] || "bin";
    const path = `${row.id}/${Date.now()}-migrated.${ext}`;
    const sizeKb = Math.round(parsed.buffer.length / 1024);
    console.log(`- ${row.id}: ${parsed.contentType}, ${sizeKb} KB -> ${path}`);
    if (!APPLY) continue;

    const { error: uploadError } = await supabase.storage
      .from("postagens")
      .upload(path, parsed.buffer, { contentType: parsed.contentType });
    if (uploadError) throw new Error(`upload ${row.id}: ${uploadError.message}`);

    const publicUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/postagens/${path}`;
    const { error: updateError } = await supabase
      .from("postagens")
      .update({ imagem_url: publicUrl })
      .eq("id", row.id);
    if (updateError) throw new Error(`update ${row.id}: ${updateError.message}`);
    console.log(`  ok: ${publicUrl}`);
  }

  console.log("Concluído.");
};

main().catch((err) => {
  console.error("Falha na migração:", err.message || err);
  process.exit(1);
});

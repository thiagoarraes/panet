
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const DEFAULT_DESCRIPTION = "Intranet da Agencia Pan.";
const SIGNED_IMAGE_TTL_SECONDS = 60 * 60;

const toPostSlug = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const stripHtml = (value: string) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toExcerpt = (value: string, maxLength = 180) => {
  const clean = stripHtml(value);
  if (!clean) return DEFAULT_DESCRIPTION;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
};

const extractStoragePath = (rawValue: string) => {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0] || "");
    const markers = [
      "/storage/v1/object/public/postagens/",
      "/storage/v1/object/sign/postagens/",
      "/storage/v1/object/authenticated/postagens/",
    ];
    for (const marker of markers) {
      const idx = decoded.indexOf(marker);
      if (idx >= 0) return decoded.slice(idx + marker.length);
    }
    return decoded.replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const markers = [
      "/storage/v1/object/public/postagens/",
      "/storage/v1/object/sign/postagens/",
      "/storage/v1/object/authenticated/postagens/",
    ];
    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx >= 0) return pathname.slice(idx + marker.length);
    }
    return "";
  } catch (_err) {
    return "";
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  if (req.method !== "GET") {
    return jsonError(req, 405, "Method not allowed");
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    if (!supabaseUrl || !serviceRoleKey) return jsonError(req, 503, "Serviço não configurado.");

    const url = new URL(req.url);
    const slug = String(url.searchParams.get("slug") || "").trim();
    if (!slug) {
      return jsonError(req, 400, "Missing slug");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: posts, error: postsError } = await adminClient
      .from("postagens")
      .select("titulo, descricao, imagem_url, categoria, data_post, created_at")
      .order("data_post", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (postsError) {
      return jsonError(req, 500, "Erro ao consultar postagens.", postsError.message);
    }

    const post = (posts || []).find((item) => toPostSlug(String(item?.titulo || "")) === slug);
    if (!post) {
      return jsonError(req, 404, "Post não encontrado.");
    }

    let imageUrl = "";
    const storagePath = extractStoragePath(String(post.imagem_url || ""));
    if (storagePath) {
      const { data: signedData, error: signedError } = await adminClient.storage
        .from("postagens")
        .createSignedUrl(storagePath, SIGNED_IMAGE_TTL_SECONDS);

      if (!signedError && signedData?.signedUrl) {
        imageUrl = signedData.signedUrl.startsWith("http")
          ? signedData.signedUrl
          : `${supabaseUrl}${signedData.signedUrl.startsWith("/") ? "" : "/"}${signedData.signedUrl}`;
      }
    } else if (String(post.imagem_url || "").trim()) {
      imageUrl = String(post.imagem_url).trim();
    }

    return new Response(
      JSON.stringify({
        found: true,
        title: String(post.titulo || "").trim() || "Panet - A intranet da Pan",
        description: toExcerpt(String(post.descricao || "")),
        imageUrl,
        category: String(post.categoria || "").trim(),
        publishedAt: post.data_post || post.created_at || null,
        urlPath: `/${slug}`,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(req),
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (err) {
    console.error("[post-og]", err);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});

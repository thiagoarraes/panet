import { next } from "@vercel/functions";
import { extractPostSlugFromPathname } from "./src/lib/postRouting.js";

const META_BLOCK_RE = /<!-- PANET_META_START -->([\s\S]*?)<!-- PANET_META_END -->/;
const DEFAULT_TITLE = "Panet - A intranet da Pan";
const DEFAULT_DESCRIPTION = "Intranet da Agencia Pan.";
const DEFAULT_IMAGE_PATH = "/opengraph-default.png";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ensureAbsoluteUrl = (origin, value, fallbackPath = "/") => {
  const raw = String(value || "").trim();
  if (!raw) return new URL(fallbackPath, origin).toString();
  try {
    return new URL(raw, origin).toString();
  } catch (_err) {
    return new URL(fallbackPath, origin).toString();
  }
};

const buildMetaBlock = ({ origin, pathname, title, description, imageUrl, category, publishedAt }) => {
  const canonicalUrl = ensureAbsoluteUrl(origin, pathname, pathname || "/");
  const ogImageUrl = ensureAbsoluteUrl(origin, imageUrl, DEFAULT_IMAGE_PATH);
  const safeTitle = escapeHtml(title || DEFAULT_TITLE);
  const safeDescription = escapeHtml(description || DEFAULT_DESCRIPTION);

  return [
    "<!-- PANET_META_START -->",
    `    <title>${safeTitle}</title>`,
    `    <meta name="description" content="${safeDescription}" />`,
    `    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    '    <meta property="og:site_name" content="Panet" />',
    `    <meta property="og:type" content="${publishedAt || category ? "article" : "website"}" />`,
    `    <meta property="og:title" content="${safeTitle}" />`,
    `    <meta property="og:description" content="${safeDescription}" />`,
    `    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`,
    '    <meta property="og:image:width" content="1200" />',
    '    <meta property="og:image:height" content="630" />',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${safeTitle}" />`,
    `    <meta name="twitter:description" content="${safeDescription}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`,
    publishedAt ? `    <meta property="article:published_time" content="${escapeHtml(publishedAt)}" />` : "",
    category ? `    <meta property="article:section" content="${escapeHtml(category)}" />` : "",
    "    <!-- PANET_META_END -->",
  ]
    .filter(Boolean)
    .join("\n");
};

const fetchPostOgPayload = async (slug) => {
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnon = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
  ).trim();
  if (!supabaseUrl || !supabaseAnon) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/post-og?slug=${encodeURIComponent(slug)}`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${supabaseAnon}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload?.found) return null;
  return payload;
};

export const config = {
  matcher: "/:path*",
};

export default async function middleware(request) {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return next();
  }

  if (url.searchParams.has("__og_bypass")) {
    return next();
  }

  const slug = extractPostSlugFromPathname(url.pathname);
  if (!slug) {
    return next();
  }

  try {
    const ogPayload = await fetchPostOgPayload(slug);
    if (!ogPayload) {
      return next();
    }

    const baseHtmlResponse = await fetch(new URL("/index.html?__og_bypass=1", url), {
      headers: {
        "x-panet-meta-bypass": "1",
      },
      cache: "no-store",
    });

    if (!baseHtmlResponse.ok) {
      return next();
    }

    const html = await baseHtmlResponse.text();
    const nextHtml = html.replace(
      META_BLOCK_RE,
      buildMetaBlock({
        origin: url.origin,
        pathname: ogPayload.urlPath || url.pathname,
        title: ogPayload.title,
        description: ogPayload.description,
        imageUrl: ogPayload.imageUrl || DEFAULT_IMAGE_PATH,
        category: ogPayload.category,
        publishedAt: ogPayload.publishedAt,
      })
    );

    return new Response(nextHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (_err) {
    return next();
  }
}

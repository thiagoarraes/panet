export const RESERVED_SINGLE_SEGMENT_PATHS = new Set([
  "dashboard",
  "pannews",
  "posts",
  "post",
  "colaboradores",
  "aniversarios",
  "folgas",
  "eventos",
  "confirmar-presenca",
  "galerias",
  "galeria",
  "perfil",
  "admin",
  "api",
  "storage",
  "favicon.svg",
  "favicon2.svg",
  "apple-touch-icon.png",
  "apple-touch-icon.svg",
  "opengraph-default.png",
  "opengraph-default.svg",
  "robots.txt",
  "sitemap.xml",
  "index.html",
]);

export const toPostSlug = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const extractPostSlugFromPathname = (pathname) => {
  const path = String(pathname || "/").split(/[?#]/, 1)[0] || "/";
  const singleSegmentMatch = path.match(/^\/([^/]+)$/);
  if (!singleSegmentMatch) return "";

  const slug = decodeURIComponent(singleSegmentMatch[1] || "").trim();
  if (!slug) return "";
  if (slug.includes(".")) return "";
  if (RESERVED_SINGLE_SEGMENT_PATHS.has(slug)) return "";
  return slug;
};

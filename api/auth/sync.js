import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Preferimos sempre a publishable (esquema novo de API keys). A anon legada
// fica so como fallback: ela e desativada ao concluir a migracao de chaves, e
// ter ordens de precedencia diferentes por arquivo ja causou incidente antes.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

function buildCookieHeader(name, value, options) {
  let cookie = `${name}=${value}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.secure) cookie += "; Secure";
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`;
  return cookie;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Supabase não configurado" });
  }

  const { access_token, refresh_token, expires_at } = req.body || {};
  if (!access_token || !refresh_token) {
    return res.status(400).json({ error: "Tokens obrigatórios" });
  }

  // Validate the access token before trusting it
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const { error: userError } = await supabase.auth.getUser(access_token);
  if (userError) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const isProd = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure: isProd, sameSite: "Strict", path: "/" };
  const nowSec = Math.floor(Date.now() / 1000);
  const atMaxAge = expires_at ? Math.max(0, Number(expires_at) - nowSec) : 3600;
  const rtMaxAge = 7 * 24 * 60 * 60;

  res.setHeader("Set-Cookie", [
    buildCookieHeader("panet_at", access_token, { ...base, maxAge: atMaxAge }),
    buildCookieHeader("panet_rt", refresh_token, { ...base, maxAge: rtMaxAge }),
    buildCookieHeader("panet_sid", "1", { secure: isProd, sameSite: "Strict", path: "/", maxAge: rtMaxAge }),
  ]);

  return res.status(200).json({ success: true });
}

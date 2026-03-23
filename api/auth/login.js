import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const LOGIN_RETRY_DELAYS_MS = [700, 1500];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  const status = Number(error?.status || error?.code || 0);
  if (Number.isFinite(status) && status >= 500) return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("service unavailable") ||
    message.includes("upstream connect error") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("remote connection failure") ||
    message.includes("gateway") ||
    message.includes("timeout")
  );
};

function buildCookieHeader(name, value, options) {
  let cookie = `${name}=${value}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.secure) cookie += "; Secure";
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`;
  return cookie;
}

function setAuthCookies(res, session) {
  const isProd = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, secure: isProd, sameSite: "Strict", path: "/" };
  const atMaxAge = Math.max(0, (session.expires_at || 0) - Math.floor(Date.now() / 1000));
  const rtMaxAge = 7 * 24 * 60 * 60; // 7 days

  res.setHeader("Set-Cookie", [
    buildCookieHeader("panet_at", session.access_token, { ...base, maxAge: atMaxAge }),
    buildCookieHeader("panet_rt", session.refresh_token, { ...base, maxAge: rtMaxAge }),
    // Non-httpOnly indicator so JS can detect session presence without reading the real token
    buildCookieHeader("panet_sid", "1", { secure: isProd, sameSite: "Strict", path: "/", maxAge: rtMaxAge }),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Supabase não configurado" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  let lastError = null;
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      setAuthCookies(res, data.session);
      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: data.user,
      });
    }

    lastError = error;
    if (!isRetryableError(error) || attempt === LOGIN_RETRY_DELAYS_MS.length) break;
    await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
  }

  const status = lastError?.status >= 400 && lastError?.status < 500 ? 401 : 503;
  return res.status(status).json({ error: lastError?.message || "Falha no login", retryable: isRetryableError(lastError) });
}

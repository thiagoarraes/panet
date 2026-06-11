import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return cookies;
}

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
  const rtMaxAge = 7 * 24 * 60 * 60;

  res.setHeader("Set-Cookie", [
    buildCookieHeader("panet_at", session.access_token, { ...base, maxAge: atMaxAge }),
    buildCookieHeader("panet_rt", session.refresh_token, { ...base, maxAge: rtMaxAge }),
    buildCookieHeader("panet_sid", "1", { secure: isProd, sameSite: "Strict", path: "/", maxAge: rtMaxAge }),
  ]);
}

function clearAuthCookies(res) {
  const isProd = process.env.NODE_ENV === "production";
  const base = `HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=0`;
  res.setHeader("Set-Cookie", [
    `panet_at=; ${base}`,
    `panet_rt=; ${base}`,
    `panet_sid=; ${isProd ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=0`,
  ]);
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8")) || null;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Supabase não configurado" });
  }

  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies.panet_at;
  const refreshToken = cookies.panet_rt;

  if (!accessToken && !refreshToken) {
    return res.status(200).json({ session: null });
  }

  // Fast path: access token still valid (not expiring in < 30s).
  // We skip the supabase.auth.getUser() network round-trip here on purpose:
  // this endpoint only echoes back a token we ourselves stored in an httpOnly
  // cookie, and Supabase verifies the token's signature on every actual API
  // call the client makes with it. A tampered cookie grants nothing.
  if (accessToken) {
    const payload = decodeJwtPayload(accessToken);
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload && Number(payload.exp || 0) > nowSec + 30 && payload.sub) {
      return res.status(200).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Number(payload.exp || 0),
        user: { id: payload.sub, email: payload.email || "" },
      });
    }
  }

  // Access token missing/expired — try refresh
  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(200).json({ session: null });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshError || !refreshData?.session) {
    clearAuthCookies(res);
    return res.status(200).json({ session: null });
  }

  setAuthCookies(res, refreshData.session);

  return res.status(200).json({
    access_token: refreshData.session.access_token,
    refresh_token: refreshData.session.refresh_token,
    expires_at: refreshData.session.expires_at,
    user: refreshData.user,
  });
}

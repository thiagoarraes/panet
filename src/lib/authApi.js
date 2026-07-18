/**
 * Auth helpers that use /api/auth/* (Vercel serverless functions).
 * These routes set/read httpOnly cookies, keeping JWTs out of localStorage.
 *
 * Only active in production (import.meta.env.PROD).
 * In dev mode (vite dev) the app falls back to direct Supabase auth.
 */

export const USE_SECURE_COOKIES = import.meta.env.PROD;

const LOGIN_RETRY_DELAYS_MS = [700, 1500];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status, message) => {
  if (status >= 500) return true;
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("service unavailable") ||
    msg.includes("upstream connect error") ||
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("remote connection failure") ||
    msg.includes("gateway") ||
    msg.includes("timeout")
  );
};

/**
 * Login via httpOnly cookie route.
 * Returns { access_token, refresh_token, expires_at, user }.
 * Throws on failure.
 */
export async function apiLogin(email, password) {
  let lastStatus = 0;
  let lastMessage = "";

  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
    let res;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
    } catch (networkErr) {
      lastStatus = 0;
      lastMessage = networkErr?.message || "Falha de rede";
      if (attempt < LOGIN_RETRY_DELAYS_MS.length) {
        await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error("O serviço de autenticação está instável. Tente novamente.", { cause: networkErr });
    }

    const data = await res.json().catch(() => ({}));

    // Proxy retorna 200 com ok:false para erros de credencial (evita log 4xx no browser)
    if (res.ok && data?.ok === false) {
      lastStatus = 401;
      lastMessage = data?.error || "Falha no login";
      break;
    }
    if (res.ok) return data;

    lastStatus = res.status;
    lastMessage = data?.error || "Falha no login";

    // Rate limit hit — surface immediately, don't retry
    if (res.status === 429) break;

    if (!data?.retryable && !isRetryable(lastStatus, lastMessage)) break;
    if (attempt < LOGIN_RETRY_DELAYS_MS.length) {
      await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
    }
  }

  if (isRetryable(lastStatus, lastMessage)) {
    throw new Error("O serviço de autenticação está instável. Tente novamente em alguns segundos.");
  }
  throw new Error(lastMessage || "Não foi possível fazer login.");
}

/**
 * Logout: clears httpOnly cookies on the server.
 */
export async function apiLogout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (_) {
    // Best-effort — local state is cleared regardless
  }
}

/**
 * Get/refresh session from httpOnly cookie.
 * Returns { access_token, refresh_token?, expires_at?, user } or null.
 */
export async function apiGetSession() {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    // { session: null } means no active session (not an error)
    if (!data || data.session === null) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/**
 * Sync new tokens to httpOnly cookies after an in-memory token refresh.
 * Fire-and-forget — does not throw.
 */
export async function apiSyncSession(accessToken, refreshToken, expiresAt) {
  try {
    await fetch("/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      }),
    });
  } catch (_) {
    // Ignore — next page load will re-authenticate via the stored refresh token
  }
}

/**
 * Returns true if the non-httpOnly session indicator cookie is present.
 * Used to decide whether to show a loading spinner on bootstrap.
 */
export function hasSessionCookie() {
  try {
    return document.cookie.split(";").some((c) => c.trim().startsWith("panet_sid=1"));
  } catch (_) {
    return false;
  }
}

/**
 * Clears only the non-httpOnly session indicator cookie from JS.
 * The httpOnly cookies are cleared server-side via apiLogout().
 */
export function clearSessionIndicatorCookie() {
  try {
    document.cookie = "panet_sid=; SameSite=Strict; Path=/; Max-Age=0";
  } catch (_) {
    // ignore
  }
}

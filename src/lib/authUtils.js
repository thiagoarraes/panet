import { supabase, isSupabaseEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase.js";
import { USE_SECURE_COOKIES, apiSyncSession, hasSessionCookie, clearSessionIndicatorCookie } from "./authApi.js";

// ─── Constants ────────────────────────────────────────────────────────────────
export const AUTH_TIMEOUT_MS = 5000;
export const PROFILE_DEDUP_WINDOW_MS = 3000;
export const PROFILE_BACKGROUND_REFRESH_DELAY_MS = 12000;
export const PROFILE_CACHE_KEY = "panet.profile.cache";
export const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const LOGIN_RETRY_DELAYS_MS = [700, 1500];

// Shared across module instances (e.g. StrictMode double-mount)
export const globalProfileLoadState = { userId: null, promise: null, loadedAt: 0 };

// ─── Session ──────────────────────────────────────────────────────────────────
export const getFreshSessionAccessToken = async () => {
  if (!isSupabaseEnabled) return "";
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = Number(session?.expires_at || 0);
  if (session?.access_token && expiresAt > nowSec + 30) return session.access_token;
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed?.session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (USE_SECURE_COOKIES) {
    apiSyncSession(refreshed.session.access_token, refreshed.session.refresh_token, refreshed.session.expires_at);
  }
  return refreshed.session.access_token;
};

export const hasStoredSupabaseSession = () => {
  if (USE_SECURE_COOKIES) return hasSessionCookie();
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token || parsed?.currentSession?.access_token) return true;
    }
  } catch (_err) { /* ignore */ }
  return false;
};

export const clearStoredSupabaseSession = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (_err) { /* ignore */ }
  if (USE_SECURE_COOKIES) clearSessionIndicatorCookie();
};

// ─── Profile cache ────────────────────────────────────────────────────────────
export const readCachedProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed._cachedAt && Date.now() - parsed._cachedAt > PROFILE_CACHE_TTL_MS) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }
    const profile = { ...parsed };
    delete profile._cachedAt;
    return profile;
  } catch (_err) {
    return null;
  }
};

export const writeCachedProfile = (profile) => {
  try {
    if (!profile) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
      return;
    }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...profile, _cachedAt: Date.now() }));
  } catch (_err) { /* ignore */ }
};

// ─── Edge function ────────────────────────────────────────────────────────────
export const invokeEdgeFunctionHttp = async (fnName, body, accessToken, fallbackMessage) => {
  const baseUrl = String(SUPABASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("Supabase URL ausente.");
  if (!SUPABASE_ANON_KEY) throw new Error("Supabase anon key ausente.");
  const response = await fetch(`${baseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body || {}),
  });
  const rawText = await response.text();
  let parsed = null;
  if (rawText) {
    try { parsed = JSON.parse(rawText); } catch (_err) { parsed = { message: rawText }; }
  }
  if (!response.ok) {
    const message = parsed?.error || parsed?.message || rawText || fallbackMessage || "Não foi possível concluir a ação.";
    throw new Error(String(message));
  }
  return parsed || {};
};

// ─── Utilities ────────────────────────────────────────────────────────────────
export const withTimeout = (promise, timeoutMs, timeoutMessage = "timeout") =>
  new Promise((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timerId); resolve(value); },
      (error) => { clearTimeout(timerId); reject(error); }
    );
  });

export const isTransientAuthTimeout = (err) => {
  const msg = String(err?.message || "");
  return msg === "session_timeout" || msg === "profile_timeout" || msg === "session_recheck_timeout";
};

export const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export const isRetryableLoginError = (error) => {
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
    message.includes("delayed connect error") ||
    message.includes("gateway") ||
    message.includes("timeout")
  );
};

export const friendlyLoginError = (error) => {
  if (isRetryableLoginError(error)) {
    return "O serviço de autenticação está instável. Tente novamente em alguns segundos.";
  }
  const msg = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);
  if (
    status === 400 ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid email or password") ||
    msg.includes("email not confirmed") ||
    msg.includes("wrong password")
  ) {
    return "E-mail ou senha incorretos. Verifique os dados e tente novamente.";
  }
  return error?.message || "Não foi possível fazer login.";
};

export const signInWithPasswordRetry = async (email, password) => {
  let lastError = null;
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { data, error: null };
    lastError = error;
    if (!isRetryableLoginError(error) || attempt === LOGIN_RETRY_DELAYS_MS.length) break;
    await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
  }
  return { data: null, error: lastError };
};

// ─── Profile shape ────────────────────────────────────────────────────────────
export const toAvatar = (profile) => {
  const initials = profile?.nome
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    email: profile.email,
    telefone: profile.telefone,
    aniversario: profile.aniversario || null,
    fotoUrl: profile.foto_url || "",
    foto_url: profile.foto_url || "",
    foto: initials || "U",
    cor: profile.cor_avatar || "#11E7E7",
    redes: {
      instagram: profile.instagram || "",
      linkedin: profile.linkedin || "",
      github: profile.github || "",
    },
  };
};

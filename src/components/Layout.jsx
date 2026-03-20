import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Home, FileText, Users, Cake, Plane, Images, Settings, ChevronDown, ChevronUp, User, Sun, Moon, LogOut, Menu, X, CalendarDays } from "lucide-react";
import { COLABORADORES } from "../data/mockData.js";
import { supabase, isSupabaseEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase.js";
import { getAvatarStoragePathFromUrl, optimizeImageToWebp } from "../lib/imageUtils.js";
import { extractPostSlugFromPathname, toPostSlug } from "../lib/postRouting.js";
import { Avatar } from "./Avatar";
import { LoginPage } from "../pages/LoginPage";
import { PrimeiroAcessoPage } from "../pages/PrimeiroAcesso";
const DashboardPage = lazy(() => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PostagensPage = lazy(() => import("../pages/PostagensPage").then((m) => ({ default: m.PostagensPage })));
const PostDetalhePage = lazy(() => import("../pages/PostDetalhePage").then((m) => ({ default: m.PostDetalhePage })));
const ColaboradoresPage = lazy(() => import("../pages/ColaboradoresPage").then((m) => ({ default: m.ColaboradoresPage })));
const AniversariosPage = lazy(() => import("../pages/AniversariosPage").then((m) => ({ default: m.AniversariosPage })));
const FeriasPage = lazy(() => import("../pages/FeriasPage").then((m) => ({ default: m.FeriasPage })));
const GaleriaPage = lazy(() => import("../pages/GaleriaPage").then((m) => ({ default: m.GaleriaPage })));
const PresencialPage = lazy(() => import("../pages/PresencialPage").then((m) => ({ default: m.PresencialPage })));
const PerfilPage = lazy(() => import("../pages/PerfilPage").then((m) => ({ default: m.PerfilPage })));
const AdminPage = lazy(() => import("../pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })));

const mockMe = COLABORADORES.find((c) => c.isMe);
const THEME_KEY = "panet.theme";
const PROFILE_CACHE_KEY = "panet.profile.cache";
const AUTH_TIMEOUT_MS = 5000;
const PROFILE_DEDUP_WINDOW_MS = 3000;
const PROFILE_BACKGROUND_REFRESH_DELAY_MS = 12000;
const PANZAP_METRICS_STORAGE_KEY = "panet.metrics.panzap.v1";
const globalProfileLoadState = { userId: null, promise: null, loadedAt: 0 };


const getFreshSessionAccessToken = async () => {
  if (!isSupabaseEnabled) return "";
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = Number(session?.expires_at || 0);
  if (session?.access_token && expiresAt > nowSec + 30) return session.access_token;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed?.session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  return refreshed.session.access_token;
};

const invokeEdgeFunctionHttp = async (fnName, body, accessToken, fallbackMessage) => {
  const baseUrl = String(SUPABASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("Supabase URL ausente.");
  if (!SUPABASE_ANON_KEY) throw new Error("Supabase anon key ausente.");

  const response = await fetch(`${baseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "x-client-jwt": accessToken,
    },
    body: JSON.stringify(body || {}),
  });

  const rawText = await response.text();
  let parsed = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch (_err) {
      parsed = { message: rawText };
    }
  }

  if (!response.ok) {
    const message =
      parsed?.error ||
      parsed?.message ||
      rawText ||
      fallbackMessage ||
      "Não foi possível concluir a ação.";
    throw new Error(String(message));
  }

  return parsed || {};
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "postagens", label: "PanNews", icon: FileText },
  { id: "colaboradores", label: "Colaboradores", icon: Users },
  { id: "aniversarios", label: "Aniversários", icon: Cake },
  { id: "ferias", label: "PanOff", icon: Plane },
  { id: "presencial", label: "Confirmar presença", icon: CalendarDays },
  { id: "galeria", label: "Galerias", icon: Images },
];

const PAGE_PATHS = {
  dashboard: "/",
  postagens: "/pannews",
  colaboradores: "/colaboradores",
  aniversarios: "/aniversarios",
  ferias: "/folgas",
  presencial: "/confirmar-presenca",
  galeria: "/galerias",
  perfil: "/perfil",
  admin: "/admin",
};

const ADMIN_TAB_PATHS = {
  colaboradores: "/admin/colaboradores",
  postagens: "/admin/pannews",
  ferias: "/admin/folgas",
  presencial: "/admin/confirmar-presenca",
  galeria: "/admin/galeria",
  mural: "/admin/mural",
};

const resolveRoute = (pathname) => {
  const path = String(pathname || "/");
  if (path.startsWith("/galerias/")) {
    return { pagina: "galeria", adminAba: "colaboradores", known: true };
  }
  switch (path) {
    case "/":
    case "/dashboard":
      return { pagina: "dashboard", adminAba: "colaboradores", known: true };
    case "/pannews":
      return { pagina: "postagens", adminAba: "colaboradores", known: true };
    case "/posts":
      return { pagina: "postagens", adminAba: "colaboradores", known: true };
    case "/post":
      return { pagina: "postagens", adminAba: "colaboradores", known: true };
    case "/colaboradores":
      return { pagina: "colaboradores", adminAba: "colaboradores", known: true };
    case "/aniversarios":
      return { pagina: "aniversarios", adminAba: "colaboradores", known: true };
    case "/folgas":
      return { pagina: "ferias", adminAba: "colaboradores", known: true };
    case "/confirmar-presenca":
      return { pagina: "presencial", adminAba: "colaboradores", known: true };
    case "/galerias":
      return { pagina: "galeria", adminAba: "colaboradores", known: true };
    case "/galeria":
      return { pagina: "galeria", adminAba: "colaboradores", known: true };
    case "/perfil":
      return { pagina: "perfil", adminAba: "colaboradores", known: true };
    case "/admin":
      return { pagina: "admin", adminAba: "colaboradores", known: true };
    case "/admin/colaboradores":
      return { pagina: "admin", adminAba: "colaboradores", known: true };
    case "/admin/pannews":
      return { pagina: "admin", adminAba: "postagens", known: true };
    case "/admin/posts":
      return { pagina: "admin", adminAba: "postagens", known: true };
    case "/admin/folgas":
      return { pagina: "admin", adminAba: "ferias", known: true };
    case "/admin/confirmar-presenca":
      return { pagina: "admin", adminAba: "presencial", known: true };
    case "/admin/galeria":
      return { pagina: "admin", adminAba: "galeria", known: true };
    case "/admin/mural":
      return { pagina: "admin", adminAba: "mural", known: true };
    default:
      break;
  }

  const slug = extractPostSlugFromPathname(path);
  if (slug) {
    return { pagina: "post_detalhe", adminAba: "colaboradores", known: true, postSlug: slug };
  }

  return { pagina: "dashboard", adminAba: "colaboradores", known: false };
};

const toAvatar = (profile) => {
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

const withTimeout = (promise, timeoutMs, timeoutMessage = "timeout") =>
  new Promise((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timerId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timerId);
        reject(error);
      }
    );
  });

const isTransientAuthTimeout = (err) => {
  const msg = String(err?.message || "");
  return msg === "session_timeout" || msg === "profile_timeout" || msg === "session_recheck_timeout";
};

const LOGIN_RETRY_DELAYS_MS = [700, 1500];

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableLoginError = (error) => {
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

const signInWithPasswordRetry = async (email, password) => {
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

const hasStoredSupabaseSession = () => {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.access_token || parsed?.currentSession?.access_token) return true;
    }
  } catch (_err) {
    // ignore
  }
  return false;
};

const clearStoredSupabaseSession = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (_err) {
    // ignore cache failures
  }
};

const readCachedProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_err) {
    return null;
  }
};

const writeCachedProfile = (profile) => {
  try {
    if (!profile) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      return;
    }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch (_err) {
    // ignore cache failures
  }
};

const PageFallback = () => (
  <div className="card">
    <div className="card-body" style={{ padding: 24 }}>
      <div className="section-sub">Carregando página...</div>
    </div>
  </div>
);

export default function PanetApp() {
  const queryClient = useQueryClient();
  const [tela, setTela] = useState("login");
  const [pagina, setPagina] = useState("dashboard");
  const [adminAba, setAdminAba] = useState("colaboradores");
  const [postSlug, setPostSlug] = useState("");
  const [authLoading, setAuthLoading] = useState(isSupabaseEnabled);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [adminServerConfirmed, setAdminServerConfirmed] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const userMenuRef = useRef(null);
  const initialDataLoadRef = useRef({ userId: null, at: 0 });
  const profileLoadInFlightRef = useRef({ userId: null, promise: null });
  const profileBackgroundRefreshRef = useRef(null);
  const firstAccessBypassRef = useRef({ userId: null, expiresAt: 0 });
  const telaRef = useRef(tela);
  const currentProfileIdRef = useRef(currentProfile?.id || null);

  useEffect(() => {
    telaRef.current = tela;
  }, [tela]);

  useEffect(() => {
    currentProfileIdRef.current = currentProfile?.id || null;
  }, [currentProfile?.id]);

  const effectiveUserId = currentProfile?.id || sessionUserId || null;
  const eu = useMemo(() => {
    if (currentProfile) return toAvatar(currentProfile);
    return { ...mockMe, id: effectiveUserId || mockMe.id };
  }, [currentProfile, effectiveUserId]);
  const isAdmin = currentProfile?.perfil === "admin";

  const getPathForState = useCallback((nextPagina, nextAdminAba) => {
    if (nextPagina === "admin") {
      return ADMIN_TAB_PATHS[nextAdminAba] || PAGE_PATHS.admin;
    }
    return PAGE_PATHS[nextPagina] || PAGE_PATHS.dashboard;
  }, []);

  const navigateTo = useCallback(
    (nextPagina, nextAdminAba, options = {}) => {
      const aba = nextAdminAba || adminAba;
      setPagina(nextPagina);
      if (nextPagina === "post_detalhe") setPostSlug(String(options.postSlug || ""));
      else setPostSlug("");
      setMobileNavOpen(false);
      if (nextPagina === "admin") {
        setAdminAba(aba);
      }
      const nextPath = options.path || getPathForState(nextPagina, aba);
      if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
        if (options.replace) window.history.replaceState({}, "", nextPath);
        else window.history.pushState({}, "", nextPath);
      }
    },
    [adminAba, getPathForState]
  );

  const loadProfileAndRoute = useCallback(
    async (activeSession) => {
      if (!activeSession?.user?.id) {
        initialDataLoadRef.current = { userId: null, at: 0 };
        profileLoadInFlightRef.current = { userId: null, promise: null };
        globalProfileLoadState.userId = null;
        globalProfileLoadState.promise = null;
        globalProfileLoadState.loadedAt = 0;
        setSessionUserId(null);
        setCurrentProfile(null);
        setAdminServerConfirmed(false);
        writeCachedProfile(null);
        setTela("login");
        return;
      }
      const userId = String(activeSession.user.id);
      setSessionUserId(userId);
      const globalInFlightForSameUser =
        String(globalProfileLoadState.userId || "") === userId && globalProfileLoadState.promise;
      if (globalInFlightForSameUser) {
        await globalInFlightForSameUser;
        return;
      }
      const inFlightForSameUser =
        String(profileLoadInFlightRef.current.userId || "") === userId && profileLoadInFlightRef.current.promise;
      if (inFlightForSameUser) {
        await inFlightForSameUser;
        return;
      }

      const now = Date.now();
      const globalRecentLoad =
        String(globalProfileLoadState.userId || "") === userId &&
        now - Number(globalProfileLoadState.loadedAt || 0) < PROFILE_DEDUP_WINDOW_MS;
      if (globalRecentLoad) return;

      const recentLoad =
        String(initialDataLoadRef.current.userId || "") === userId &&
        now - Number(initialDataLoadRef.current.at || 0) < 2000;
      if (recentLoad) return;

      const loadPromise = (async () => {
        const { data, error } = await withTimeout(
          supabase.from("colaboradores").select("*").eq("id", userId).maybeSingle(),
          AUTH_TIMEOUT_MS,
          "profile_timeout"
        );
        if (error) throw new Error("Não foi possível carregar o perfil do colaborador.");
        if (!data) throw new Error("Seu usuário não está vinculado na tabela de colaboradores.");
        const bypass =
          firstAccessBypassRef.current.userId === activeSession.user.id &&
          Date.now() < Number(firstAccessBypassRef.current.expiresAt || 0);
        const resolvedProfile = bypass ? { ...data, primeiro_acesso: false } : data;
        setCurrentProfile(resolvedProfile);
        writeCachedProfile(resolvedProfile);
        setAdminServerConfirmed(resolvedProfile.perfil === "admin");
        setTela(resolvedProfile.primeiro_acesso ? "primeiro_acesso" : "app");
        const loadedAt = Date.now();
        initialDataLoadRef.current = { userId, at: loadedAt };
        globalProfileLoadState.userId = userId;
        globalProfileLoadState.loadedAt = loadedAt;
      })();

      profileLoadInFlightRef.current = { userId, promise: loadPromise };
      globalProfileLoadState.userId = userId;
      globalProfileLoadState.promise = loadPromise;
      try {
        await loadPromise;
      } finally {
        if (profileLoadInFlightRef.current.promise === loadPromise) {
          profileLoadInFlightRef.current = { userId: null, promise: null };
        }
        if (globalProfileLoadState.promise === loadPromise) {
          globalProfileLoadState.promise = null;
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isSupabaseEnabled) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    const scheduleProfileBackgroundRefresh = (session) => {
      if (!session?.user?.id) return;
      if (profileBackgroundRefreshRef.current) {
        clearTimeout(profileBackgroundRefreshRef.current);
      }
      profileBackgroundRefreshRef.current = setTimeout(() => {
        loadProfileAndRoute(session).catch((err) => {
          if (!isTransientAuthTimeout(err)) {
            console.warn("Falha ao sincronizar perfil em background:", err?.message || err);
          }
        });
      }, PROFILE_BACKGROUND_REFRESH_DELAY_MS);
    };

    const bootstrapAuth = async () => {
      const cachedProfile = readCachedProfile();
      if (cachedProfile && isMounted) {
        // Open immediately on refresh; confirm session/profile in background.
        setSessionUserId(String(cachedProfile.id || ""));
        setCurrentProfile(cachedProfile);
        setAdminServerConfirmed(cachedProfile.perfil === "admin");
        setTela(cachedProfile.primeiro_acesso ? "primeiro_acesso" : "app");
        setAuthLoading(false);
      }
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, "session_timeout");
        if (error) throw error;
        if (!isMounted) return;
        const session = data.session;
        if (!session?.user?.id) {
          setSessionUserId(null);
          setCurrentProfile(null);
          setAdminServerConfirmed(false);
          writeCachedProfile(null);
          profileLoadInFlightRef.current = { userId: null, promise: null };
          globalProfileLoadState.userId = null;
          globalProfileLoadState.promise = null;
          globalProfileLoadState.loadedAt = 0;
          setTela("login");
          return;
        }
        const sessionId = String(session.user.id);
        setSessionUserId(sessionId);
        if (cachedProfile && String(cachedProfile.id || "") === sessionId) {
          scheduleProfileBackgroundRefresh(session);
          return;
        }
        await loadProfileAndRoute(session);
      } catch (err) {
        const transientAuthFailure = isTransientAuthTimeout(err);
        if (!transientAuthFailure) {
          console.error("Falha no bootstrap de autenticação:", err);
        }
        if (isMounted) {
          if (!cachedProfile || !transientAuthFailure) {
            clearStoredSupabaseSession();
            setTela("login");
            setSessionUserId(null);
            setCurrentProfile(null);
            setAdminServerConfirmed(false);
            writeCachedProfile(null);
          }
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    bootstrapAuth();

    const { data: subscriptionData } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return;
      if (event === "INITIAL_SESSION") {
        // bootstrapAuth already reconciles the initial session state.
        return;
      }
      if (!nextSession) {
        if (event === "SIGNED_OUT") {
          setSessionUserId(null);
          setCurrentProfile(null);
          writeCachedProfile(null);
          setTela("login");
          return;
        }
        try {
          const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, "session_recheck_timeout");
          if (error) throw error;
          const recoveredSession = data?.session;
          if (recoveredSession?.user?.id) {
            await loadProfileAndRoute(recoveredSession);
            return;
          }
        } catch (_err) {
          // falha transitória de recheck: não altera UI nem polui console
        }
        if (!hasStoredSupabaseSession()) {
          setSessionUserId(null);
          setCurrentProfile(null);
          writeCachedProfile(null);
          profileLoadInFlightRef.current = { userId: null, promise: null };
          globalProfileLoadState.userId = null;
          globalProfileLoadState.promise = null;
          globalProfileLoadState.loadedAt = 0;
          setTela("login");
        }
        return;
      }

      setSessionUserId(String(nextSession?.user?.id || ""));

      if (
        event === "SIGNED_IN" &&
        currentProfileIdRef.current &&
        String(currentProfileIdRef.current) === String(nextSession?.user?.id || "") &&
        (telaRef.current === "primeiro_acesso" || telaRef.current === "app")
      ) {
        return;
      }

      // Avoid expensive profile/data reload on token refresh while app is already active.
      if (
        event === "TOKEN_REFRESHED" &&
        telaRef.current === "app" &&
        currentProfileIdRef.current &&
        String(currentProfileIdRef.current) === String(nextSession?.user?.id || "")
      ) {
        return;
      }

      // Password update in first access can emit USER_UPDATED.
      // Ignore it for the same user to avoid a redundant heavy reload and unblock entry.
      if (
        event === "USER_UPDATED" &&
        currentProfileIdRef.current &&
        String(currentProfileIdRef.current) === String(nextSession?.user?.id || "") &&
        (telaRef.current === "primeiro_acesso" || telaRef.current === "app")
      ) {
        return;
      }

      try {
        await loadProfileAndRoute(nextSession);
      } catch (err) {
        if (!isTransientAuthTimeout(err)) {
          console.error("Falha transitória ao atualizar sessão no listener de auth:", err);
        }
      }
    });

    return () => {
      isMounted = false;
      if (profileBackgroundRefreshRef.current) {
        clearTimeout(profileBackgroundRefreshRef.current);
        profileBackgroundRefreshRef.current = null;
      }
      subscriptionData.subscription.unsubscribe();
    };
  }, [loadProfileAndRoute]);

  useEffect(() => {
    if (tela !== "app" || typeof window === "undefined") return;
    const applyLocation = () => {
      const { pagina: nextPagina, adminAba: nextAdminAba, known, postSlug: nextPostSlug } = resolveRoute(window.location.pathname);
      if (!known) {
        navigateTo("dashboard", "colaboradores", { replace: true });
        return;
      }
      if (nextPagina === "admin" && !isAdmin) {
        navigateTo("dashboard", "colaboradores", { replace: true });
        return;
      }
      if (nextPagina === "admin" && !adminServerConfirmed) {
        setPagina("dashboard");
        return;
      }
      setPagina(nextPagina);
      setAdminAba(nextAdminAba);
      setPostSlug(nextPagina === "post_detalhe" ? String(nextPostSlug || "") : "");
    };
    applyLocation();
    const onPopState = () => applyLocation();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isAdmin, adminServerConfirmed, navigateTo, tela]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__PANET_GET_PANZAP_METRICS = () => {
      try {
        const raw = localStorage.getItem(PANZAP_METRICS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_err) {
        return [];
      }
    };
    window.__PANET_CLEAR_PANZAP_METRICS = () => {
      try {
        localStorage.removeItem(PANZAP_METRICS_STORAGE_KEY);
      } catch (_err) {
        // ignore
      }
    };
    return () => {
      delete window.__PANET_GET_PANZAP_METRICS;
      delete window.__PANET_CLEAR_PANZAP_METRICS;
    };
  }, []);

  const handleLogin = async (email, password) => {
    if (!isSupabaseEnabled) {
      setTela("primeiro_acesso");
      return;
    }
    const { data, error } = await signInWithPasswordRetry(email, password);
    if (error) {
      const msg = isRetryableLoginError(error)
        ? "O serviço de autenticação está instável no momento. Tente novamente em alguns segundos."
        : error.message || "Não foi possível fazer login.";
      throw new Error(msg);
    }
    const activeSession = data?.session || (await supabase.auth.getSession()).data.session;
    if (!activeSession) throw new Error("Sessão não iniciada. Tente novamente.");
    setSessionUserId(String(activeSession?.user?.id || ""));
    await loadProfileAndRoute(activeSession);
  };

  const handleConcluirPrimeiroAcesso = async (novaSenha) => {
    if (!isSupabaseEnabled) {
      setTela("app");
      return;
    }
    const fallbackUserId = currentProfile?.id || null;

    const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
    if (authError) {
      const authMessage = (authError.message || "").toLowerCase();
      if (authError.status === 422 || authMessage.includes("password")) {
        throw new Error(
          "Senha rejeitada pelo Supabase. Use pelo menos 8 caracteres com maiúscula, minúscula, número e símbolo, e diferente da senha temporária."
        );
      }
      throw new Error(authError.message);
    }

    const userId = fallbackUserId || (await supabase.auth.getUser()).data?.user?.id || null;
    if (userId) {
      firstAccessBypassRef.current = { userId, expiresAt: Date.now() + 60000 };
    }
    setCurrentProfile((prev) => (prev ? { ...prev, primeiro_acesso: false } : prev));
    setTela("app");

    // Do not block navigation after password change. Persist first-access flag in background.
    if (userId) {
      supabase
        .from("colaboradores")
        .update({ primeiro_acesso: false })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.warn("Falha ao persistir primeiro acesso:", error.message);
        })
        .catch(() => {});
    }

    supabase.auth.getSession().catch(() => {});
  };

  const handleSalvarPerfil = async (payload) => {
    if (!currentProfile?.id) return;

    const updatePayload = {
      nome: payload.nome || currentProfile.nome || "",
      cargo: payload.cargo || currentProfile.cargo || "",
      telefone: payload.telefone || null,
      instagram: payload.instagram || null,
      linkedin: payload.linkedin || null,
      aniversario: payload.aniversario || null,
    };

    if (!isSupabaseEnabled) {
      const localUpdated = { ...currentProfile, ...updatePayload };
      setCurrentProfile(localUpdated);
      return;
    }

    const accessToken = await getFreshSessionAccessToken();

    let updatedProfile = { ...currentProfile, ...updatePayload };
    const previousAvatarPath = getAvatarStoragePathFromUrl(currentProfile?.foto_url || "");
    let uploadedAvatarPath = "";

    if (payload.avatarBlob instanceof Blob) {
      const optimizedAvatarBlob = await optimizeImageToWebp(payload.avatarBlob, 720, 0.88);
      uploadedAvatarPath = `${currentProfile.id}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from("avatares").upload(uploadedAvatarPath, optimizedAvatarBlob, {
        contentType: "image/webp",
      });
      if (uploadError) throw new Error(uploadError.message);
      updatePayload.foto_url = uploadedAvatarPath;
    }

    let fnData = null;
    let fnError = null;
    try {
      fnData = await invokeEdgeFunctionHttp("update-profile", updatePayload, accessToken, "Não foi possível salvar o perfil.");
    } catch (error) {
      fnError = error;
    }

    if (fnError || fnData?.error) {
      const { data, error } = await supabase
        .from("colaboradores")
        .update(updatePayload)
        .eq("id", currentProfile.id)
        .select("*")
        .maybeSingle();
      if (error) {
        const msg = error.message || fnData?.error || fnError?.message || "Não foi possível salvar o perfil.";
        throw new Error(msg);
      }
      updatedProfile = data || updatedProfile;
    } else if (fnData?.profile) {
      updatedProfile = fnData.profile;
    }

    if (updatePayload.foto_url && updatedProfile?.foto_url !== updatePayload.foto_url) {
      const { data: refreshed, error: refreshError } = await supabase
        .from("colaboradores")
        .update({ foto_url: updatePayload.foto_url })
        .eq("id", currentProfile.id)
        .select("*")
        .maybeSingle();
      if (!refreshError && refreshed) {
        updatedProfile = refreshed;
      } else {
        updatedProfile = { ...updatedProfile, foto_url: updatePayload.foto_url };
      }
    }

    if (uploadedAvatarPath && previousAvatarPath && previousAvatarPath !== uploadedAvatarPath) {
      supabase.storage
        .from("avatares")
        .remove([previousAvatarPath])
        .catch((err) => console.warn("Falha ao remover avatar antigo:", err?.message || err));
    }

    setCurrentProfile(updatedProfile);
    writeCachedProfile(updatedProfile);
    queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
  };

  const handleOpenPost = (post) => {
    const slug = toPostSlug(post?.titulo || "");
    if (!slug) return;
    navigateTo("post_detalhe", "colaboradores", { path: `/${slug}`, postSlug: slug });
  };

  const handleLogout = () => {
    initialDataLoadRef.current = { userId: null, at: 0 };
    profileLoadInFlightRef.current = { userId: null, promise: null };
    globalProfileLoadState.userId = null;
    globalProfileLoadState.promise = null;
    globalProfileLoadState.loadedAt = 0;
    if (profileBackgroundRefreshRef.current) {
      clearTimeout(profileBackgroundRefreshRef.current);
      profileBackgroundRefreshRef.current = null;
    }
    clearStoredSupabaseSession();
    setSessionUserId(null);
    setCurrentProfile(null);
    writeCachedProfile(null);
    setAdminServerConfirmed(false);
    setTela("login");
    setPagina("dashboard");
    setAdminAba("colaboradores");
    setMobileNavOpen(false);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", PAGE_PATHS.dashboard);
    }
    setUserMenuOpen(false);

    if (isSupabaseEnabled) {
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setTimeout(() => {
        supabase.auth.signOut().catch(() => {});
      }, 0);
    }
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 900;
    document.body.style.overflow = mobileNavOpen && isMobile ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const PAGINAS = {
    dashboard: (
      <DashboardPage
        onOpenPost={handleOpenPost}
        onOpenAniversarios={() => navigateTo("aniversarios")}
        onOpenFolgas={() => navigateTo("ferias")}
        currentUser={eu}
        currentUserId={effectiveUserId}
      />
    ),
    postagens: <PostagensPage onOpen={handleOpenPost} currentUserId={effectiveUserId} />,
    post_detalhe: (
      <PostDetalhePage
        currentUser={eu}
        currentUserId={effectiveUserId}
        postSlug={postSlug}
        onOpenAniversarios={() => navigateTo("aniversarios")}
        onOpenFolgas={() => navigateTo("ferias")}
      />
    ),
    colaboradores: <ColaboradoresPage currentUserId={effectiveUserId} />,
    aniversarios: (
      <AniversariosPage
        currentUserId={effectiveUserId}
      />
    ),
    ferias: <FeriasPage currentUserId={effectiveUserId} />,
    presencial: <PresencialPage currentUserId={effectiveUserId} />,
    galeria: <GaleriaPage currentUserId={effectiveUserId} />,
    perfil: <PerfilPage profile={currentProfile} onSalvar={handleSalvarPerfil} />,
    admin: (
      <AdminPage
        aba={adminAba}
        onChangeAba={(aba) => navigateTo("admin", aba)}
        currentProfile={currentProfile}
        currentUserId={effectiveUserId}
      />
    ),
  };

  if (authLoading) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-title">Carregando...</div>
        </div>
      </div>
    );
  }

  if (tela === "login") {
    return <LoginPage onLogin={handleLogin} theme={theme} />;
  }
  if (tela === "primeiro_acesso") return <PrimeiroAcessoPage onConcluir={handleConcluirPrimeiroAcesso} theme={theme} />;

  return (
    <>
      <nav className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <img src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"} alt="Panet" className="logo-image" />
        </div>
        <div className="nav-section">
          <div className="nav-label">MENU</div>
          {NAV_ITEMS.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${pagina === n.id || (n.id === "postagens" && pagina === "post_detalhe") ? "active" : ""}`}
              onClick={() => navigateTo(n.id)}
            >
              <span className="nav-icon"><n.icon size={16} /></span>
              {n.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="nav-section">
            <div className="nav-label">Administração</div>
            <button
              className={`nav-item ${pagina === "admin" ? "active" : ""}`}
              onClick={() => navigateTo("admin", "colaboradores", { path: PAGE_PATHS.admin })}
            >
              <span className="nav-icon"><Settings size={16} /></span>
              Painel Administrativo
            </button>
          </div>
        )}
        <div className="sidebar-user-wrap" ref={userMenuRef}>
          {userMenuOpen && (
            <div className="user-menu">
              <button
                className="user-menu-item"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                onClick={() => {
                  navigateTo("perfil");
                  setUserMenuOpen(false);
                }}
              >
                <User size={14} />
                Editar perfil
              </button>
              <button className="user-menu-item" style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={handleToggleTheme}>
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                {theme === "dark" ? "Tema claro" : "Tema escuro"}
              </button>
              <button className="user-menu-item danger" style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={handleLogout}>
                <LogOut size={14} />
                Deslogar
              </button>
            </div>
          )}
          <div className="sidebar-user" onClick={() => setUserMenuOpen((prev) => !prev)}>
            <Avatar col={eu} size={34} />
            <div className="user-info">
              <div className="user-name">{eu.nome}</div>
              <div className="user-role">{eu.cargo}</div>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{userMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          </div>
        </div>
      </nav>
      {mobileNavOpen && <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)} />}

      <div className="main-wrap">
        <div className="mobile-topbar">
          <img src={theme === "light" ? "/pan-logo-animado-light.svg" : "/pan-logo-animado.svg"} alt="Panet" className="mobile-topbar-logo" />
          <button className="mobile-menu-btn" aria-label="Abrir menu" onClick={() => setMobileNavOpen((prev) => !prev)}>
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <div className="content">
          <Suspense fallback={<PageFallback />}>{PAGINAS[pagina]}</Suspense>
        </div>
      </div>
    </>
  );
}

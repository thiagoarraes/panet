import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { COLABORADORES } from "../data/mockData.js";
import { supabase, isSupabaseEnabled } from "../lib/supabase.js";
import { USE_SECURE_COOKIES, apiLogin, apiLogout, apiGetSession, apiSyncSession } from "../lib/authApi.js";
import { getAvatarStoragePathFromUrl, optimizeImageToWebp } from "../lib/imageUtils.js";
import { toPostSlug } from "../lib/postRouting.js";
import {
  AUTH_TIMEOUT_MS,
  PROFILE_DEDUP_WINDOW_MS,
  PROFILE_BACKGROUND_REFRESH_DELAY_MS,
  PANZAP_METRICS_STORAGE_KEY,
  globalProfileLoadState,
  getFreshSessionAccessToken,
  invokeEdgeFunctionHttp,
  withTimeout,
  isTransientAuthTimeout,
  signInWithPasswordRetry,
  friendlyLoginError,
  hasStoredSupabaseSession,
  clearStoredSupabaseSession,
  readCachedProfile,
  writeCachedProfile,
  toAvatar,
} from "../lib/authUtils.js";
import { PAGE_PATHS, ADMIN_TAB_PATHS, resolveRoute } from "../lib/router.js";
import { getDashboardSnapshotQueryOptions } from "../hooks/queries/useDashboardSnapshot.js";
import { DASHBOARD_SNAPSHOT_INITIAL_LIMITS, DASHBOARD_SNAPSHOT_FULL_LIMITS } from "../lib/dashboardLimits.js";

const THEME_KEY = "panet.theme";
const mockMe = COLABORADORES.find((c) => c.isMe);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  // ─── State ─────────────────────────────────────────────────────────────────
  const [tela, setTela] = useState("login");
  const [pagina, setPagina] = useState("dashboard");
  const [adminAba, setAdminAba] = useState("colaboradores");
  const [postSlug, setPostSlug] = useState("");
  const [authLoading, setAuthLoading] = useState(isSupabaseEnabled);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [adminServerConfirmed, setAdminServerConfirmed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const initialDataLoadRef = useRef({ userId: null, at: 0 });
  const profileLoadInFlightRef = useRef({ userId: null, promise: null });
  const profileBackgroundRefreshRef = useRef(null);
  const firstAccessBypassRef = useRef({ userId: null, expiresAt: 0 });
  const telaRef = useRef(tela);
  const currentProfileIdRef = useRef(currentProfile?.id || null);

  useEffect(() => { telaRef.current = tela; }, [tela]);
  useEffect(() => { currentProfileIdRef.current = currentProfile?.id || null; }, [currentProfile?.id]);

  // ─── Derived values ────────────────────────────────────────────────────────
  const effectiveUserId = currentProfile?.id || sessionUserId || null;
  const eu = useMemo(() => {
    if (currentProfile) return toAvatar(currentProfile);
    return { ...mockMe, id: effectiveUserId || mockMe.id };
  }, [currentProfile, effectiveUserId]);
  const isAdmin = currentProfile?.perfil === "admin";

  // ─── Navigation ────────────────────────────────────────────────────────────
  const getPathForState = useCallback((nextPagina, nextAdminAba) => {
    if (nextPagina === "admin") return ADMIN_TAB_PATHS[nextAdminAba] || PAGE_PATHS.admin;
    return PAGE_PATHS[nextPagina] || PAGE_PATHS.dashboard;
  }, []);

  const navigateTo = useCallback((nextPagina, nextAdminAba, options = {}) => {
    const aba = nextAdminAba || adminAba;
    setPagina(nextPagina);
    if (nextPagina === "post_detalhe") setPostSlug(String(options.postSlug || ""));
    else setPostSlug("");
    setMobileNavOpen(false);
    if (nextPagina === "admin") setAdminAba(aba);
    const nextPath = options.path || getPathForState(nextPagina, aba);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      if (options.replace) window.history.replaceState({}, "", nextPath);
      else window.history.pushState({}, "", nextPath);
    }
  }, [adminAba, getPathForState]);

  // ─── Profile loader ────────────────────────────────────────────────────────
  const loadProfileAndRoute = useCallback(async (activeSession) => {
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
    if (globalInFlightForSameUser) { await globalInFlightForSameUser; return; }

    const inFlightForSameUser =
      String(profileLoadInFlightRef.current.userId || "") === userId && profileLoadInFlightRef.current.promise;
    if (inFlightForSameUser) { await inFlightForSameUser; return; }

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

      // Prefetch do snapshot enquanto o app ainda está navegando para o dashboard
      if (!resolvedProfile.primeiro_acesso && isSupabaseEnabled) {
        queryClient.prefetchQuery(getDashboardSnapshotQueryOptions(userId, DASHBOARD_SNAPSHOT_INITIAL_LIMITS)).catch(() => {});
        const scheduleFullPrefetch = () =>
          queryClient.prefetchQuery(getDashboardSnapshotQueryOptions(userId, DASHBOARD_SNAPSHOT_FULL_LIMITS)).catch(() => {});
        if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(scheduleFullPrefetch, { timeout: 1500 });
        } else {
          setTimeout(scheduleFullPrefetch, 1500);
        }
      }

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
      if (profileLoadInFlightRef.current.promise === loadPromise)
        profileLoadInFlightRef.current = { userId: null, promise: null };
      if (globalProfileLoadState.promise === loadPromise)
        globalProfileLoadState.promise = null;
    }
  }, []);

  // ─── Bootstrap auth ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled) { setAuthLoading(false); return; }
    let isMounted = true;

    const scheduleProfileBackgroundRefresh = (session) => {
      if (!session?.user?.id) return;
      if (profileBackgroundRefreshRef.current) clearTimeout(profileBackgroundRefreshRef.current);
      profileBackgroundRefreshRef.current = setTimeout(() => {
        loadProfileAndRoute(session).catch((err) => {
          if (!isTransientAuthTimeout(err))
            console.warn("Falha ao sincronizar perfil em background:", err?.message || err);
        });
      }, PROFILE_BACKGROUND_REFRESH_DELAY_MS);
    };

    const bootstrapAuth = async () => {
      const cachedProfile = readCachedProfile();
      if (cachedProfile && isMounted) {
        setSessionUserId(String(cachedProfile.id || ""));
        setCurrentProfile(cachedProfile);
        setAdminServerConfirmed(cachedProfile.perfil === "admin");
        setTela(cachedProfile.primeiro_acesso ? "primeiro_acesso" : "app");
        if (!USE_SECURE_COOKIES) setAuthLoading(false);

        // Prefetch antecipado — sessão em cache, dispara antes de validar com o servidor
        if (!cachedProfile.primeiro_acesso && isSupabaseEnabled) {
          queryClient.prefetchQuery(
            getDashboardSnapshotQueryOptions(String(cachedProfile.id || ""))
          ).catch(() => {});
        }
      }
      try {
        let session = null;
        if (USE_SECURE_COOKIES) {
          const apiSession = await withTimeout(apiGetSession(), AUTH_TIMEOUT_MS, "session_timeout");
          if (apiSession?.access_token) {
            const { data: setData, error: setError } = await supabase.auth.setSession({
              access_token: apiSession.access_token,
              refresh_token: apiSession.refresh_token || "",
            });
            if (!setError) session = setData?.session || null;
          }
        } else {
          const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, "session_timeout");
          if (error) throw error;
          session = data.session;
        }
        if (!isMounted) return;
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
        if (!transientAuthFailure) console.error("Falha no bootstrap de autenticação:", err);
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
      if (event === "INITIAL_SESSION") return;
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
          if (recoveredSession?.user?.id) { await loadProfileAndRoute(recoveredSession); return; }
        } catch (_err) { /* falha transitória */ }
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
      ) return;

      if (
        event === "TOKEN_REFRESHED" &&
        telaRef.current === "app" &&
        currentProfileIdRef.current &&
        String(currentProfileIdRef.current) === String(nextSession?.user?.id || "")
      ) {
        if (USE_SECURE_COOKIES && nextSession?.access_token && nextSession?.refresh_token) {
          apiSyncSession(nextSession.access_token, nextSession.refresh_token, nextSession.expires_at);
        }
        return;
      }

      if (
        event === "USER_UPDATED" &&
        currentProfileIdRef.current &&
        String(currentProfileIdRef.current) === String(nextSession?.user?.id || "") &&
        (telaRef.current === "primeiro_acesso" || telaRef.current === "app")
      ) return;

      try {
        await loadProfileAndRoute(nextSession);
      } catch (err) {
        if (!isTransientAuthTimeout(err))
          console.error("Falha transitória ao atualizar sessão no listener de auth:", err);
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

  // ─── Route resolution ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tela !== "app" || typeof window === "undefined") return;
    const applyLocation = () => {
      const { pagina: nextPagina, adminAba: nextAdminAba, known, postSlug: nextPostSlug } = resolveRoute(window.location.pathname);
      if (!known) { navigateTo("dashboard", "colaboradores", { replace: true }); return; }
      if (nextPagina === "admin" && !isAdmin) { navigateTo("dashboard", "colaboradores", { replace: true }); return; }
      if (nextPagina === "admin" && !adminServerConfirmed) { setPagina("dashboard"); return; }
      setPagina(nextPagina);
      setAdminAba(nextAdminAba);
      setPostSlug(nextPagina === "post_detalhe" ? String(nextPostSlug || "") : "");
    };
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, [isAdmin, adminServerConfirmed, navigateTo, tela]);

  // ─── Panzap metrics ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__PANET_GET_PANZAP_METRICS = () => {
      try {
        const raw = localStorage.getItem(PANZAP_METRICS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_err) { return []; }
    };
    window.__PANET_CLEAR_PANZAP_METRICS = () => {
      try { localStorage.removeItem(PANZAP_METRICS_STORAGE_KEY); } catch (_err) { /* ignore */ }
    };
    return () => {
      delete window.__PANET_GET_PANZAP_METRICS;
      delete window.__PANET_CLEAR_PANZAP_METRICS;
    };
  }, []);

  // ─── Theme ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  // ─── Mobile nav overflow ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 900;
    document.body.style.overflow = mobileNavOpen && isMobile ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = async (email, password) => {
    if (!isSupabaseEnabled) { setTela("primeiro_acesso"); return; }

    let activeSession = null;
    if (USE_SECURE_COOKIES) {
      let apiData;
      try {
        apiData = await apiLogin(email, password);
      } catch (err) {
        throw new Error(friendlyLoginError(err));
      }
      const { data: setData, error: setError } = await supabase.auth.setSession({
        access_token: apiData.access_token,
        refresh_token: apiData.refresh_token || "",
      });
      if (setError) throw new Error(friendlyLoginError(setError));
      activeSession = setData?.session || null;
    } else {
      const { data, error } = await signInWithPasswordRetry(email, password);
      if (error) throw new Error(friendlyLoginError(error));
      activeSession = data?.session || null;
    }

    if (!activeSession) throw new Error("Sessão não iniciada. Tente novamente.");
    setSessionUserId(String(activeSession.user?.id || ""));
    await loadProfileAndRoute(activeSession);
  };

  const handleConcluirPrimeiroAcesso = async (novaSenha) => {
    if (!isSupabaseEnabled) { setTela("app"); return; }
    const fallbackUserId = currentProfile?.id || null;
    const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
    if (authError) {
      const authMessage = (authError.message || "").toLowerCase();
      if (authError.status === 422 || authMessage.includes("password")) {
        throw new Error("Senha rejeitada pelo Supabase. Use pelo menos 8 caracteres com maiúscula, minúscula, número e símbolo, e diferente da senha temporária.");
      }
      throw new Error(authError.message);
    }
    const userId = fallbackUserId || (await supabase.auth.getUser()).data?.user?.id || null;
    if (userId) firstAccessBypassRef.current = { userId, expiresAt: Date.now() + 60000 };
    setCurrentProfile((prev) => (prev ? { ...prev, primeiro_acesso: false } : prev));
    setTela("app");
    if (userId) {
      supabase.from("colaboradores").update({ primeiro_acesso: false }).eq("id", userId)
        .then(({ error }) => { if (error) console.warn("Falha ao persistir primeiro acesso:", error.message); })
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
      setCurrentProfile({ ...currentProfile, ...updatePayload });
      return;
    }
    const accessToken = await getFreshSessionAccessToken();
    let updatedProfile = { ...currentProfile, ...updatePayload };
    const previousAvatarPath = getAvatarStoragePathFromUrl(currentProfile?.foto_url || "");
    let uploadedAvatarPath = "";
    if (payload.avatarBlob instanceof Blob) {
      const optimizedAvatarBlob = await optimizeImageToWebp(payload.avatarBlob, 720, 0.88);
      uploadedAvatarPath = `${currentProfile.id}/${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from("avatares").upload(uploadedAvatarPath, optimizedAvatarBlob, { contentType: "image/webp" });
      if (uploadError) throw new Error(uploadError.message);
      updatePayload.foto_url = uploadedAvatarPath;
    }
    let fnData = null, fnError = null;
    try {
      fnData = await invokeEdgeFunctionHttp("update-profile", updatePayload, accessToken, "Não foi possível salvar o perfil.");
    } catch (error) { fnError = error; }
    if (fnError || fnData?.error) {
      const { data, error } = await supabase.from("colaboradores").update(updatePayload).eq("id", currentProfile.id).select("*").maybeSingle();
      if (error) throw new Error(error.message || fnData?.error || fnError?.message || "Não foi possível salvar o perfil.");
      updatedProfile = data || updatedProfile;
    } else if (fnData?.profile) {
      updatedProfile = fnData.profile;
    }
    if (updatePayload.foto_url && updatedProfile?.foto_url !== updatePayload.foto_url) {
      const { data: refreshed, error: refreshError } = await supabase.from("colaboradores").update({ foto_url: updatePayload.foto_url }).eq("id", currentProfile.id).select("*").maybeSingle();
      if (!refreshError && refreshed) updatedProfile = refreshed;
      else updatedProfile = { ...updatedProfile, foto_url: updatePayload.foto_url };
    }
    if (uploadedAvatarPath && previousAvatarPath && previousAvatarPath !== uploadedAvatarPath) {
      supabase.storage.from("avatares").remove([previousAvatarPath])
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
    if (typeof window !== "undefined") window.history.replaceState({}, "", PAGE_PATHS.dashboard);
    if (isSupabaseEnabled) {
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setTimeout(() => { supabase.auth.signOut().catch(() => {}); }, 0);
    }
    if (USE_SECURE_COOKIES) apiLogout();
  };

  const handleToggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  // ─── Context value ─────────────────────────────────────────────────────────
  const value = {
    tela, pagina, adminAba, postSlug,
    authLoading, currentProfile, sessionUserId, adminServerConfirmed,
    mobileNavOpen, setMobileNavOpen, theme,
    eu, isAdmin, effectiveUserId,
    navigateTo,
    handleLogin, handleLogout,
    handleConcluirPrimeiroAcesso, handleSalvarPerfil,
    handleOpenPost, handleToggleTheme,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
};

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, FileText, Users, Cake, Plane, Images, Settings, ChevronDown, ChevronUp, User, Sun, Moon, LogOut, Menu, X } from "lucide-react";
import {
  COLABORADORES,
  POSTAGENS_INIT,
  ANIVERSARIANTES_INIT,
  FERIAS_INIT,
  DAYOFF_INIT,
  GALERIA_EVENTOS,
  MURAL_INIT,
} from "../data/mockData.js";
import { supabase, isSupabaseEnabled } from "../lib/supabase.js";
import { readCachedDomain, runDedupedRequest, writeCachedDomain } from "../lib/businessCache.js";
import { Avatar } from "./Avatar";
import { LoginPage } from "../pages/LoginPage";
import { PrimeiroAcessoPage } from "../pages/PrimeiroAcesso";
import { DashboardPage } from "../pages/DashboardPage";
import { PostagensPage } from "../pages/PostagensPage";
import { PostDetalhePage } from "../pages/PostDetalhePage";
import { ColaboradoresPage } from "../pages/ColaboradoresPage";
import { AniversariosPage } from "../pages/AniversariosPage";
import { FeriasPage } from "../pages/FeriasPage";
import { GaleriaPage } from "../pages/GaleriaPage";
import { PerfilPage } from "../pages/PerfilPage";
import { AdminPage } from "../pages/admin/AdminPage";

const mockMe = COLABORADORES.find((c) => c.isMe);
const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;
const THEME_KEY = "panet.theme";
const PROFILE_CACHE_KEY = "panet.profile.cache";
const AUTH_TIMEOUT_MS = 12000;
const GALERIA_PUBLIC_BASE = "https://panet.agenciapan.com/galerias";
const DATA_CACHE_TTL = {
  colaboradores: 5 * 60 * 1000,
  postagens: 45 * 1000,
  ferias: 2 * 60 * 1000,
  aniversarios: 6 * 60 * 60 * 1000,
  galeria: 90 * 1000,
  mural: 20 * 1000,
};

const getGaleriaStoragePathFromUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || "");

    if (pathname.startsWith("/galerias/")) {
      return pathname.slice("/galerias/".length);
    }

    const markers = [
      "/storage/v1/object/public/galeria/",
      "/storage/v1/object/sign/galeria/",
      "/storage/v1/object/authenticated/galeria/",
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

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "postagens", label: "Postagens", icon: FileText },
  { id: "colaboradores", label: "Colaboradores", icon: Users },
  { id: "aniversarios", label: "Aniversários", icon: Cake },
  { id: "ferias", label: "Férias & Day Off", icon: Plane },
  { id: "galeria", label: "Galerias", icon: Images },
];

const PAGE_PATHS = {
  dashboard: "/",
  postagens: "/posts",
  colaboradores: "/colaboradores",
  aniversarios: "/aniversarios",
  ferias: "/folgas",
  galeria: "/galerias",
  perfil: "/perfil",
  admin: "/admin",
};

const ADMIN_TAB_PATHS = {
  colaboradores: "/admin/colaboradores",
  postagens: "/admin/posts",
  ferias: "/admin/folgas",
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
    case "/admin/posts":
      return { pagina: "admin", adminAba: "postagens", known: true };
    case "/admin/folgas":
      return { pagina: "admin", adminAba: "ferias", known: true };
    case "/admin/galeria":
      return { pagina: "admin", adminAba: "galeria", known: true };
    case "/admin/mural":
      return { pagina: "admin", adminAba: "mural", known: true };
    default:
      break;
  }

  const singleSegmentMatch = path.match(/^\/([^/]+)$/);
  if (singleSegmentMatch) {
    const slug = decodeURIComponent(singleSegmentMatch[1] || "").trim();
    if (slug) {
      return { pagina: "post_detalhe", adminAba: "colaboradores", known: true, postSlug: slug };
    }
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

const formatBrDate = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("pt-BR");
};

const daysUntilBirthday = (isoDate) => {
  const now = new Date();
  const target = new Date(`${isoDate}T12:00:00`);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const thisYearTarget = new Date(now.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  const next = thisYearTarget < todayNoon ? new Date(now.getFullYear() + 1, target.getMonth(), target.getDate(), 12, 0, 0) : thisYearTarget;
  const diffMs = next.getTime() - todayNoon.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

const mapDbPostToUi = (post, likesRows, commentsRows, currentUserId) => {
  const likes = (likesRows || []).map((c) => c.colaborador_id);
  const comments = (commentsRows || [])
    .map((c) => ({
      id: c.id,
      texto: c.texto,
      hora: new Date(c.created_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      autor: toAvatar(c.colaborador),
    }));
  return {
    id: post.id,
    titulo: post.titulo,
    descricao: post.descricao,
    imagem: post.imagem_url || postImg(post.id),
    categoria: post.categoria,
    data: post.data_post,
    curtidas: likes,
    comentarios: comments,
    userCurtiu: likes.includes(currentUserId),
  };
};

const mapDbFeriasToUi = (item) => ({
  id: item.id,
  inicio: formatBrDate(item.inicio),
  fim: formatBrDate(item.fim),
  status: item.status,
  tipo: item.tipo,
  colaborador: toAvatar(item.colaborador),
});

const mapColaboradorBirthdayToUi = (item) => {
  const date = new Date(`${item.aniversario}T12:00:00`);
  return {
    id: item.id,
    colaborador: toAvatar(item),
    data: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    diasRestantes: daysUntilBirthday(item.aniversario),
    reacoes: [],
  };
};

const mapDbMuralToUi = (item) => {
  const date = new Date(item.created_at);
  const hoje = new Date();
  const label =
    date.toDateString() === hoje.toDateString()
      ? "Hoje"
      : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1).toDateString() === date.toDateString()
        ? "Ontem"
        : date.toLocaleDateString("pt-BR");
  return {
    id: item.id,
    texto: item.texto,
    hora: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    data: label,
    colaborador: toAvatar(item.colaborador),
  };
};

const mergeColaboradorVisual = (baseCol, lookup) => {
  if (!baseCol?.id) return baseCol;
  const fresh = lookup.get(String(baseCol.id));
  if (!fresh) return baseCol;
  return {
    ...baseCol,
    ...fresh,
    fotoUrl: fresh.fotoUrl || fresh.foto_url || baseCol.fotoUrl || baseCol.foto_url || "",
    foto_url: fresh.foto_url || fresh.fotoUrl || baseCol.foto_url || baseCol.fotoUrl || "",
    redes: fresh.redes || baseCol.redes || {},
  };
};

const mapDbGaleriaToUi = (eventosRows, fotosRows = null) => {
  const fotosByEvento = new Map();

  if (Array.isArray(fotosRows)) {
    for (const foto of fotosRows || []) {
      const arr = fotosByEvento.get(foto.evento_id) || [];
      arr.push({
        id: foto.id,
        src: foto.foto_url,
        legenda: foto.legenda || "",
        ordem: foto.ordem || 0,
      });
      fotosByEvento.set(foto.evento_id, arr);
    }
  }

  return (eventosRows || []).map((evento) => {
    const nestedFotos = Array.isArray(evento?.galeria_fotos)
      ? evento.galeria_fotos.map((foto) => ({
          id: foto.id,
          src: foto.foto_url,
          legenda: foto.legenda || "",
          ordem: foto.ordem || 0,
        }))
      : [];
    const fromMap = fotosByEvento.get(evento.id) || [];
    const fotos = [...fromMap, ...nestedFotos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return {
      id: evento.id,
      evento: evento.titulo,
      mes: evento.mes_ano || "",
      capa: evento.capa_url || fotos[0]?.src || "https://picsum.photos/seed/galeria-empty/600/450",
      fotos,
    };
  });
};

const optimizeImageToWebp = async (file, maxWidth = 1080, quality = 0.92) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao processar imagem."));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha ao converter imagem para WebP."));
              return;
            }
            resolve(blob);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
    reader.readAsDataURL(file);
  });

const withTimeout = (promise, timeoutMs, timeoutMessage = "timeout") =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
  ]);

const toPostSlug = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isTransientAuthTimeout = (err) => {
  const msg = String(err?.message || "");
  return msg === "session_timeout" || msg === "profile_timeout" || msg === "session_recheck_timeout";
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

export default function PanetApp() {
  const [tela, setTela] = useState("login");
  const [pagina, setPagina] = useState("dashboard");
  const [adminAba, setAdminAba] = useState("colaboradores");
  const [postSlug, setPostSlug] = useState("");
  const [authLoading, setAuthLoading] = useState(isSupabaseEnabled);
  const [currentProfile, setCurrentProfile] = useState(null);

  const [colaboradores, setColaboradores] = useState(isSupabaseEnabled ? [] : COLABORADORES);
  const [postagens, setPostagens] = useState(isSupabaseEnabled ? [] : POSTAGENS_INIT);
  const [aniversariantes, setAniversariantes] = useState(isSupabaseEnabled ? [] : ANIVERSARIANTES_INIT);
  const [ferias, setFerias] = useState(isSupabaseEnabled ? [] : FERIAS_INIT);
  const [dayoff, setDayoff] = useState(isSupabaseEnabled ? [] : DAYOFF_INIT);
  const [galeriaEventos, setGaleriaEventos] = useState(isSupabaseEnabled ? [] : GALERIA_EVENTOS);
  const [muralMsgs, setMuralMsgs] = useState(isSupabaseEnabled ? [] : MURAL_INIT);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const userMenuRef = useRef(null);

  const eu = useMemo(() => (currentProfile ? toAvatar(currentProfile) : mockMe), [currentProfile]);
  const isAdmin = currentProfile?.perfil === "admin";
  const selectedPost = useMemo(
    () => postagens.find((p) => toPostSlug(p.titulo) === postSlug) || null,
    [postagens, postSlug]
  );
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

  const syncColaboradorReferences = useCallback((mappedCols) => {
    const byId = new Map((mappedCols || []).map((row) => [String(row.id), row]));

    setPostagens((prev) =>
      (prev || []).map((post) => ({
        ...post,
        comentarios: (post.comentarios || []).map((comment) => ({
          ...comment,
          autor: mergeColaboradorVisual(comment.autor, byId),
        })),
      }))
    );

    setMuralMsgs((prev) =>
      (prev || []).map((msg) => ({
        ...msg,
        colaborador: mergeColaboradorVisual(msg.colaborador, byId),
      }))
    );

    setFerias((prev) =>
      (prev || []).map((item) => ({
        ...item,
        colaborador: mergeColaboradorVisual(item.colaborador, byId),
      }))
    );

    setDayoff((prev) =>
      (prev || []).map((item) => ({
        ...item,
        colaborador: mergeColaboradorVisual(item.colaborador, byId),
      }))
    );

    setAniversariantes((prev) =>
      (prev || []).map((item) => ({
        ...item,
        colaborador: mergeColaboradorVisual(item.colaborador, byId),
      }))
    );
  }, []);

  const hydrateBusinessDataFromCache = useCallback((userId) => {
    if (!userId) return;
    const cachedColaboradores = readCachedDomain(userId, "colaboradores", Infinity);
    if (Array.isArray(cachedColaboradores) && cachedColaboradores.length > 0) {
      setColaboradores(cachedColaboradores);
      syncColaboradorReferences(cachedColaboradores);
    }

    const cachedPostagens = readCachedDomain(userId, "postagens", Infinity);
    if (Array.isArray(cachedPostagens)) setPostagens(cachedPostagens);

    const cachedFerias = readCachedDomain(userId, "ferias", Infinity);
    if (cachedFerias && Array.isArray(cachedFerias.ferias) && Array.isArray(cachedFerias.dayoff)) {
      setFerias(cachedFerias.ferias);
      setDayoff(cachedFerias.dayoff);
    }

    const cachedAniversarios = readCachedDomain(userId, "aniversarios", Infinity);
    if (Array.isArray(cachedAniversarios)) setAniversariantes(cachedAniversarios);

    const cachedGaleria = readCachedDomain(userId, "galeria", Infinity);
    if (Array.isArray(cachedGaleria)) setGaleriaEventos(cachedGaleria);

    const cachedMural = readCachedDomain(userId, "mural", Infinity);
    if (Array.isArray(cachedMural)) setMuralMsgs(cachedMural);
  }, [syncColaboradorReferences]);

  const loadColaboradores = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;

    if (!force) {
      const cached = readCachedDomain(currentUserId, "colaboradores", DATA_CACHE_TTL.colaboradores);
      if (Array.isArray(cached)) {
        setColaboradores(cached);
        syncColaboradorReferences(cached);
        return cached;
      }
    }

    return runDedupedRequest(`colaboradores:${currentUserId}`, async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github,aniversario")
        .order("nome", { ascending: true });
      if (error) throw error;
      const mapped = (data || []).map((row) => ({ ...toAvatar(row), isMe: row.id === currentUserId }));
      setColaboradores(mapped);
      syncColaboradorReferences(mapped);
      writeCachedDomain(currentUserId, "colaboradores", mapped);
      return mapped;
    });
  }, [syncColaboradorReferences]);

  const loadPostagens = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "postagens", DATA_CACHE_TTL.postagens);
      if (Array.isArray(cached)) {
        setPostagens(cached);
        return cached;
      }
    }

    return runDedupedRequest(`postagens:${currentUserId}`, async () => {
      const { data: posts, error: postsError } = await supabase
        .from("postagens")
        .select(
          "id,titulo,descricao,imagem_url,categoria,data_post,created_at,curtidas(colaborador_id),comentarios(id,postagem_id,texto,created_at,colaborador:colaboradores!comentarios_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github))"
        )
        .order("data_post", { ascending: false })
        .order("created_at", { ascending: false })
        .order("created_at", { foreignTable: "comentarios", ascending: true });
      if (postsError) throw postsError;

      const mapped = (posts || []).map((p) => mapDbPostToUi(p, p.curtidas || [], p.comentarios || [], currentUserId));
      setPostagens(mapped);
      writeCachedDomain(currentUserId, "postagens", mapped);
      return mapped;
    });
  }, []);

  const loadFerias = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return { ferias: [], dayoff: [] };
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "ferias", DATA_CACHE_TTL.ferias);
      if (cached && Array.isArray(cached.ferias) && Array.isArray(cached.dayoff)) {
        setFerias(cached.ferias);
        setDayoff(cached.dayoff);
        return cached;
      }
    }

    return runDedupedRequest(`ferias:${currentUserId}`, async () => {
      const { data, error } = await supabase
        .from("ferias")
        .select("id,inicio,fim,status,tipo,colaborador:colaboradores!ferias_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)")
        .order("inicio", { ascending: true });
      if (error) throw error;
      const mapped = (data || []).map(mapDbFeriasToUi);
      const mappedFerias = mapped.filter((x) => x.tipo === "ferias");
      const mappedDayoff = mapped.filter((x) => x.tipo === "dayoff");
      setFerias(mappedFerias);
      setDayoff(mappedDayoff);
      const payload = { ferias: mappedFerias, dayoff: mappedDayoff };
      writeCachedDomain(currentUserId, "ferias", payload);
      return payload;
    });
  }, []);

  const loadAniversarios = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "aniversarios", DATA_CACHE_TTL.aniversarios);
      if (Array.isArray(cached)) {
        setAniversariantes(cached);
        return cached;
      }
    }

    return runDedupedRequest(`aniversarios:${currentUserId}`, async () => {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase.rpc("get_aniversariantes_with_reacoes", { p_ano: currentYear });
      if (error) throw error;

      const mapped = (data || []).map((item) => ({
        ...mapColaboradorBirthdayToUi(item),
        reacoes: Array.isArray(item.reacoes) ? item.reacoes : [],
      }));
      mapped.sort((a, b) => a.diasRestantes - b.diasRestantes);
      setAniversariantes(mapped);
      writeCachedDomain(currentUserId, "aniversarios", mapped);
      return mapped;
    });
  }, []);

  const loadMural = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "mural", DATA_CACHE_TTL.mural);
      if (Array.isArray(cached)) {
        setMuralMsgs(cached);
        return cached;
      }
    }

    return runDedupedRequest(`mural:${currentUserId}`, async () => {
      const { data, error } = await supabase
        .from("mural")
        .select("id,texto,created_at,colaborador:colaboradores!mural_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(mapDbMuralToUi);
      setMuralMsgs(mapped);
      writeCachedDomain(currentUserId, "mural", mapped);
      return mapped;
    });
  }, []);

  const loadGaleria = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "galeria", DATA_CACHE_TTL.galeria);
      if (Array.isArray(cached)) {
        setGaleriaEventos(cached);
        return cached;
      }
    }

    return runDedupedRequest(`galeria:${currentUserId}`, async () => {
      const { data: eventos, error: eventosError } = await supabase
        .from("galeria_eventos")
        .select("id,titulo,mes_ano,capa_url,created_at,galeria_fotos(id,evento_id,foto_url,legenda,ordem,created_at)")
        .order("created_at", { ascending: false })
        .order("ordem", { foreignTable: "galeria_fotos", ascending: true });
      if (eventosError) throw eventosError;
      const mapped = mapDbGaleriaToUi(eventos);
      setGaleriaEventos(mapped);
      writeCachedDomain(currentUserId, "galeria", mapped);
      return mapped;
    });
  }, []);

  const loadAllBusinessData = useCallback(
    async (currentUserId, options = {}) => {
      if (!isSupabaseEnabled || !currentUserId) return;
      await Promise.all([
        loadColaboradores(currentUserId, options),
        loadPostagens(currentUserId, options),
        loadFerias(currentUserId, options),
        loadAniversarios(currentUserId, options),
        loadGaleria(currentUserId, options),
        loadMural(currentUserId, options),
      ]);
    },
    [loadAniversarios, loadColaboradores, loadFerias, loadGaleria, loadMural, loadPostagens]
  );

  const loadProfileAndRoute = useCallback(
    async (activeSession) => {
      if (!activeSession?.user?.id) {
        setCurrentProfile(null);
        writeCachedProfile(null);
        setTela("login");
        return;
      }
      const { data, error } = await withTimeout(
        supabase.from("colaboradores").select("*").eq("id", activeSession.user.id).maybeSingle(),
        AUTH_TIMEOUT_MS,
        "profile_timeout"
      );
      if (error) throw new Error("Não foi possível carregar o perfil do colaborador.");
      if (!data) throw new Error("Seu usuário não está vinculado na tabela de colaboradores.");
      setCurrentProfile(data);
      writeCachedProfile(data);
      setTela(data.primeiro_acesso ? "primeiro_acesso" : "app");
      hydrateBusinessDataFromCache(activeSession.user.id);
      loadAllBusinessData(activeSession.user.id).catch((err) => {
        console.error("Falha ao carregar dados de negócio:", err);
      });
    },
    [hydrateBusinessDataFromCache, loadAllBusinessData]
  );

  useEffect(() => {
    if (!isSupabaseEnabled) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    const bootstrapAuth = async () => {
      const hasLocalSession = hasStoredSupabaseSession();
      if (hasLocalSession && isMounted) {
        // Open immediately on refresh; confirm session/profile in background.
        const cachedProfile = readCachedProfile();
        if (cachedProfile) {
          setCurrentProfile(cachedProfile);
          hydrateBusinessDataFromCache(cachedProfile.id);
        }
        setTela("app");
        setAuthLoading(false);
      }
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, "session_timeout");
        if (error) throw error;
        if (!isMounted) return;
        const session = data.session;
        if (!session?.user?.id) {
          setCurrentProfile(null);
          writeCachedProfile(null);
          setTela("login");
          return;
        }
        await loadProfileAndRoute(session);
      } catch (err) {
        if (!isTransientAuthTimeout(err)) {
          console.error("Falha no bootstrap de autenticação:", err);
        }
        if (isMounted) {
          if (!hasLocalSession) {
            setTela("login");
            setCurrentProfile(null);
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
      if (!nextSession) {
        if (event === "SIGNED_OUT") {
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
          setCurrentProfile(null);
          writeCachedProfile(null);
          setTela("login");
        }
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
      subscriptionData.subscription.unsubscribe();
    };
  }, [hydrateBusinessDataFromCache, loadProfileAndRoute]);

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
      setPagina(nextPagina);
      setAdminAba(nextAdminAba);
      setPostSlug(nextPagina === "post_detalhe" ? String(nextPostSlug || "") : "");
    };
    applyLocation();
    const onPopState = () => applyLocation();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isAdmin, navigateTo, tela]);

  useEffect(() => {
    if (!isSupabaseEnabled || tela !== "app" || !currentProfile?.id) return;
    const channel = supabase
      .channel(`mural-live-${currentProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mural" }, () => {
        loadMural(currentProfile.id, { force: true }).catch((err) => {
          console.warn("Falha ao atualizar mural em tempo real:", err?.message || err);
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentProfile?.id, loadMural, tela]);

  useEffect(() => {
    if (!isSupabaseEnabled || tela !== "app" || !currentProfile?.id) return;
    const channel = supabase
      .channel(`colaboradores-live-${currentProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "colaboradores" }, () => {
        loadColaboradores(currentProfile.id, { force: true }).catch((err) => {
          console.warn("Falha ao atualizar avatares em tempo real:", err?.message || err);
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentProfile?.id, loadColaboradores, tela]);

  const handleLogin = async (email, password) => {
    if (!isSupabaseEnabled) {
      setTela("primeiro_acesso");
      return;
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message || "Não foi possível salvar o perfil.";
      throw new Error(msg);
    }
    const activeSession = data?.session || (await supabase.auth.getSession()).data.session;
    if (!activeSession) throw new Error("Sessão não iniciada. Tente novamente.");
    await loadProfileAndRoute(activeSession);
  };

  const handleConcluirPrimeiroAcesso = async (novaSenha) => {
    if (!isSupabaseEnabled) {
      setTela("app");
      return;
    }
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      throw new Error("Sessão inválida. Faça login novamente.");
    }

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

    setCurrentProfile((prev) => (prev ? { ...prev, primeiro_acesso: false } : prev));
    setTela("app");

    // Do not block navigation after password change. Persist first-access flag in background.
    supabase
      .from("colaboradores")
      .update({ primeiro_acesso: false })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) console.warn("Falha ao persistir primeiro acesso:", error.message);
      })
      .catch(() => {});

    supabase.auth.getSession().catch(() => {});
  };

  const handleToggleCurtida = async (postId) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const post = postagens.find((p) => p.id === postId);
    if (!post) return;
    const alreadyLiked = post.curtidas.includes(currentProfile.id);
    if (alreadyLiked) {
      const { error } = await supabase.from("curtidas").delete().eq("postagem_id", postId).eq("colaborador_id", currentProfile.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("curtidas").insert({ postagem_id: postId, colaborador_id: currentProfile.id });
      if (error) throw new Error(error.message);
    }
    await loadPostagens(currentProfile.id, { force: true });
  };

  const handleComentar = async (postId, texto) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase.from("comentarios").insert({ postagem_id: postId, colaborador_id: currentProfile.id, texto });
    if (error) throw new Error(error.message);
    await loadPostagens(currentProfile.id, { force: true });
  };

  const handleCreatePost = async (payload) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase.from("postagens").insert({
      titulo: payload.titulo,
      descricao: payload.descricao,
      imagem_url: payload.imagem || null,
      categoria: payload.categoria,
      data_post: payload.data,
      autor_id: currentProfile.id,
    });
    if (error) throw new Error(error.message);
    await loadPostagens(currentProfile.id, { force: true });
  };

  const handleUpdatePost = async (postId, payload) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase
      .from("postagens")
      .update({
        titulo: payload.titulo,
        descricao: payload.descricao,
        imagem_url: payload.imagem || null,
        categoria: payload.categoria,
        data_post: payload.data,
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);
    await loadPostagens(currentProfile.id, { force: true });
  };

  const handleDeletePost = async (postId) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase.from("postagens").delete().eq("id", postId);
    if (error) throw new Error(error.message);
    if (selectedPost?.id === postId) navigateTo("postagens");
    await loadPostagens(currentProfile.id, { force: true });
  };

  const handleCreateFerias = async (payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ferias").insert(payload);
    if (error) throw new Error(error.message);
    await loadFerias(currentProfile?.id, { force: true });
  };

  const handleUpdateFerias = async (id, payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ferias").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    await loadFerias(currentProfile?.id, { force: true });
  };

  const handleDeleteFerias = async (id) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ferias").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await loadFerias(currentProfile?.id, { force: true });
  };

  const handleCreateGaleriaEvento = async (payload) => {
    if (!isSupabaseEnabled) return;
    const { data, error } = await supabase
      .from("galeria_eventos")
      .insert({
        titulo: payload.titulo,
        mes_ano: payload.mes_ano || null,
      })
      .select("id,titulo,mes_ano,capa_url,created_at")
      .single();
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
    return data;
  };

  const handleUpdateGaleriaEvento = async (id, payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase
      .from("galeria_eventos")
      .update({
        titulo: payload.titulo,
        mes_ano: payload.mes_ano || null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleDeleteGaleriaEvento = async (id) => {
    if (!isSupabaseEnabled) return;

    const { data: fotos, error: fotosError } = await supabase.from("galeria_fotos").select("foto_url").eq("evento_id", id);
    if (fotosError) throw new Error(fotosError.message);

    const storagePaths = Array.from(
      new Set(
        (fotos || [])
          .map((foto) => getGaleriaStoragePathFromUrl(foto?.foto_url))
          .filter(Boolean)
      )
    );

    if (storagePaths.length > 0) {
      const { error: removeError } = await supabase.storage.from("galeria").remove(storagePaths);
      if (removeError) throw new Error(removeError.message);
    }

    const { error } = await supabase.from("galeria_eventos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleAddGaleriaFoto = async (eventoId, payload) => {
    if (!isSupabaseEnabled) return;
    const evento = galeriaEventos.find((x) => String(x.id) === String(eventoId));
    const nextOrdem = (evento?.fotos?.length || 0) + 1;
    const { error } = await supabase.from("galeria_fotos").insert({
      evento_id: eventoId,
      foto_url: payload.foto_url,
      legenda: payload.legenda || null,
      ordem: nextOrdem,
    });
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleUpdateGaleriaFoto = async (fotoId, payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase
      .from("galeria_fotos")
      .update({
        foto_url: payload.foto_url,
        legenda: payload.legenda || null,
      })
      .eq("id", fotoId);
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleDeleteGaleriaFoto = async (fotoId) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("galeria_fotos").delete().eq("id", fotoId);
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleSetGaleriaCapa = async (eventoId, fotoUrl) => {
    if (!isSupabaseEnabled || !eventoId || !fotoUrl) return;
    const { error } = await supabase.from("galeria_eventos").update({ capa_url: fotoUrl }).eq("id", eventoId);
    if (error) throw new Error(error.message);
    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleUploadGaleriaFotos = async (eventoId, files, opts = {}) => {
    if (!isSupabaseEnabled || !eventoId || !Array.isArray(files) || files.length === 0) return;
    const year = String(opts.year || "").replace(/\D/g, "").slice(0, 4);
    const monthNum = Number(opts.month);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      throw new Error("Ano e mês válidos são obrigatórios para organizar as fotos.");
    }

    const monthFolder = String(monthNum).padStart(2, "0");
    const basePath = `${year}/${monthFolder}/${eventoId}`;
    const currentEvento = galeriaEventos.find((e) => String(e.id) === String(eventoId));
    let ordemBase = currentEvento?.fotos?.length || 0;
    let firstUploadedPublicUrl = null;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!(file instanceof File)) continue;
      const webpBlob = await optimizeImageToWebp(file, 1080, 0.92);
      const filename = `${Date.now()}-${i + 1}.webp`;
      const storagePath = `${basePath}/${filename}`;

      const { error: uploadError } = await supabase.storage.from("galeria").upload(storagePath, webpBlob, {
        contentType: "image/webp",
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const publicUrl = `${GALERIA_PUBLIC_BASE}/${storagePath}`;
      if (!publicUrl) throw new Error("Não foi possível obter URL pública da imagem enviada.");
      if (!firstUploadedPublicUrl) firstUploadedPublicUrl = publicUrl;

      ordemBase += 1;
      const { error: insertFotoError } = await supabase.from("galeria_fotos").insert({
        evento_id: eventoId,
        foto_url: publicUrl,
        legenda: null,
        ordem: ordemBase,
      });
      if (insertFotoError) throw new Error(insertFotoError.message);
    }

    if (firstUploadedPublicUrl && (!currentEvento?.capa || currentEvento.capa.includes("galeria-empty"))) {
      await supabase.from("galeria_eventos").update({ capa_url: firstUploadedPublicUrl }).eq("id", eventoId);
    }

    await loadGaleria(currentProfile?.id, { force: true });
  };

  const handleEnviarMensagem = async (texto) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase.from("mural").insert({
      colaborador_id: currentProfile.id,
      texto,
    });
    if (error) throw new Error(error.message);
    await loadMural(currentProfile?.id, { force: true });
  };

  const handleDeleteMuralMensagem = async (id) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("mural").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await loadMural(currentProfile?.id, { force: true });
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
      setColaboradores((prev) =>
        prev.map((row) => (row.id === localUpdated.id ? { ...row, ...toAvatar(localUpdated), isMe: row.isMe } : row))
      );
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

    let updatedProfile = { ...currentProfile, ...updatePayload };

    if (payload.avatarBlob instanceof Blob) {
      const filePath = `${currentProfile.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("avatares").upload(filePath, payload.avatarBlob, {
        contentType: "image/jpeg",
      });
      if (uploadError) throw new Error(uploadError.message);
      const { data: publicData } = supabase.storage.from("avatares").getPublicUrl(filePath);
      if (publicData?.publicUrl) {
        updatePayload.foto_url = publicData.publicUrl;
      }
    }

    const { data: fnData, error: fnError } = await supabase.functions.invoke("update-profile", {
      body: updatePayload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

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

    // Edge Functions podem retornar um profile sem os campos mais recentes.
    // Se houve atualização de avatar, garantimos persistência e retorno do valor final.
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

    setCurrentProfile(updatedProfile);
    writeCachedProfile(updatedProfile);
    const updatedAvatar = toAvatar(updatedProfile);
    setColaboradores((prev) =>
      prev.map((row) => (row.id === updatedProfile.id ? { ...row, ...updatedAvatar, isMe: row.isMe } : row))
    );
    setPostagens((prev) =>
      prev.map((post) => ({
        ...post,
        comentarios: (post.comentarios || []).map((comment) =>
          comment?.autor?.id === updatedProfile.id ? { ...comment, autor: { ...comment.autor, ...updatedAvatar } } : comment
        ),
      }))
    );
    setMuralMsgs((prev) =>
      prev.map((msg) =>
        msg?.colaborador?.id === updatedProfile.id ? { ...msg, colaborador: { ...msg.colaborador, ...updatedAvatar } } : msg
      )
    );
    setFerias((prev) =>
      prev.map((item) =>
        item?.colaborador?.id === updatedProfile.id ? { ...item, colaborador: { ...item.colaborador, ...updatedAvatar } } : item
      )
    );
    setDayoff((prev) =>
      prev.map((item) =>
        item?.colaborador?.id === updatedProfile.id ? { ...item, colaborador: { ...item.colaborador, ...updatedAvatar } } : item
      )
    );
    setAniversariantes((prev) =>
      prev.map((item) =>
        item?.colaborador?.id === updatedProfile.id ? { ...item, colaborador: { ...item.colaborador, ...updatedAvatar } } : item
      )
    );

    if (isSupabaseEnabled) {
      loadAniversarios(currentProfile.id, { force: true }).catch((err) => {
        console.warn("Falha ao recarregar aniversariantes após salvar perfil:", err);
      });
    }
  };

  const handleOpenPost = (post) => {
    const slug = toPostSlug(post?.titulo || "");
    if (!slug) return;
    navigateTo("post_detalhe", "colaboradores", { path: `/${slug}`, postSlug: slug });
  };

  const handleParabenizarAniversario = async (aniversarianteId) => {
    if (!currentProfile?.id || !aniversarianteId) return;
    const currentYear = new Date().getFullYear();
    const existing = aniversariantes.find((a) => a.colaborador.id === aniversarianteId);
    const alreadyReacted = Boolean(existing?.reacoes?.includes(currentProfile.id));

    if (!isSupabaseEnabled) {
      setAniversariantes((prev) =>
        prev.map((a) => {
          if (a.colaborador.id !== aniversarianteId) return a;
          const already = (a.reacoes || []).includes(currentProfile.id);
          if (already) {
            return { ...a, reacoes: (a.reacoes || []).filter((id) => id !== currentProfile.id) };
          }
          return { ...a, reacoes: [...(a.reacoes || []), currentProfile.id] };
        })
      );
      return { added: !alreadyReacted };
    }

    const { error } = alreadyReacted
      ? await supabase
          .from("aniversario_parabenizacoes")
          .delete()
          .eq("aniversariante_id", aniversarianteId)
          .eq("colaborador_id", currentProfile.id)
          .eq("ano_ref", currentYear)
      : await supabase.from("aniversario_parabenizacoes").upsert(
          {
            aniversariante_id: aniversarianteId,
            colaborador_id: currentProfile.id,
            ano_ref: currentYear,
          },
          {
            onConflict: "aniversariante_id,colaborador_id,ano_ref",
            ignoreDuplicates: true,
          }
        );
    if (error) throw new Error(error.message);

    setAniversariantes((prev) =>
      prev.map((a) => {
        if (a.colaborador.id !== aniversarianteId) return a;
        const already = (a.reacoes || []).includes(currentProfile.id);
        if (already) {
          return { ...a, reacoes: (a.reacoes || []).filter((id) => id !== currentProfile.id) };
        }
        return { ...a, reacoes: [...(a.reacoes || []), currentProfile.id] };
      })
    );
    return { added: !alreadyReacted };
  };

  const handleLogout = async () => {
    if (isSupabaseEnabled) {
      await supabase.auth.signOut().catch(() => {});
    }
    setCurrentProfile(null);
    writeCachedProfile(null);
    setTela("login");
    setPagina("dashboard");
    setAdminAba("colaboradores");
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", PAGE_PATHS.dashboard);
    }
    setUserMenuOpen(false);
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
        onToggleCurtida={handleToggleCurtida}
        onParabenizar={handleParabenizarAniversario}
        onOpenAniversarios={() => navigateTo("aniversarios")}
        onOpenFolgas={() => navigateTo("ferias")}
        onEnviarMensagem={handleEnviarMensagem}
        postagens={postagens}
        aniversariantes={aniversariantes}
        colaboradores={colaboradores}
        muralMsgs={muralMsgs}
        currentUser={eu}
        currentUserId={currentProfile?.id || eu.id}
        ferias={ferias}
        dayoff={dayoff}
      />
    ),
    postagens: <PostagensPage onOpen={handleOpenPost} onToggleCurtida={handleToggleCurtida} postagens={postagens} />,
    post_detalhe: (
      <PostDetalhePage
        post={selectedPost}
        currentUser={eu}
        currentUserId={currentProfile?.id || eu.id}
        onVoltar={() => navigateTo("postagens")}
        onToggleCurtida={handleToggleCurtida}
        onComentar={handleComentar}
        onOpenAniversarios={() => navigateTo("aniversarios")}
        onOpenFolgas={() => navigateTo("ferias")}
        onEnviarMensagem={handleEnviarMensagem}
        aniversariantes={aniversariantes}
        colaboradores={colaboradores}
        muralMsgs={muralMsgs}
        ferias={ferias}
        dayoff={dayoff}
      />
    ),
    colaboradores: <ColaboradoresPage colaboradores={colaboradores} />,
    aniversarios: (
      <AniversariosPage
        aniversariantes={aniversariantes}
        currentUserId={currentProfile?.id || eu.id}
        colaboradores={colaboradores}
      />
    ),
    ferias: <FeriasPage ferias={ferias} dayoff={dayoff} />,
    galeria: <GaleriaPage eventos={galeriaEventos} />,
    perfil: <PerfilPage profile={currentProfile} onSalvar={handleSalvarPerfil} />,
    admin: (
      <AdminPage
        aba={adminAba}
        onChangeAba={(aba) => navigateTo("admin", aba)}
        postagens={postagens}
        setPostagens={setPostagens}
        ferias={ferias}
        dayoff={dayoff}
        colaboradores={colaboradores}
        onCreatePost={handleCreatePost}
        onUpdatePost={handleUpdatePost}
        onDeletePost={handleDeletePost}
        onCreateFerias={handleCreateFerias}
        onUpdateFerias={handleUpdateFerias}
        onDeleteFerias={handleDeleteFerias}
        galeriaEventos={galeriaEventos}
        onCreateGaleriaEvento={handleCreateGaleriaEvento}
        onUpdateGaleriaEvento={handleUpdateGaleriaEvento}
        onDeleteGaleriaEvento={handleDeleteGaleriaEvento}
        onAddGaleriaFoto={handleAddGaleriaFoto}
        onUpdateGaleriaFoto={handleUpdateGaleriaFoto}
        onDeleteGaleriaFoto={handleDeleteGaleriaFoto}
        onUploadGaleriaFotos={handleUploadGaleriaFotos}
        onSetGaleriaCapa={handleSetGaleriaCapa}
        muralMsgs={muralMsgs}
        onDeleteMuralMensagem={handleDeleteMuralMensagem}
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
              Painel Admin
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
        <div className="content">{PAGINAS[pagina]}</div>
      </div>
    </>
  );
}


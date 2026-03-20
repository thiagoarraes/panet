import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, FileText, Users, Cake, Plane, Images, Settings, ChevronDown, ChevronUp, User, Sun, Moon, LogOut, Menu, X, CalendarDays } from "lucide-react";
import {
  COLABORADORES,
  POSTAGENS_INIT,
  ANIVERSARIANTES_INIT,
  FERIAS_INIT,
  DAYOFF_INIT,
  PRESENCIAL_INIT,
  GALERIA_EVENTOS,
  MURAL_INIT,
} from "../data/mockData.js";
import { supabase, isSupabaseEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/supabase.js";
import { invalidateCachedDomain, mutateCachedDomain, readCachedDomain, runDedupedRequest, writeCachedDomain } from "../lib/businessCache.js";
import { getGaleriaStoragePathFromUrl, getAvatarStoragePathFromUrl, getPostStoragePathFromUrl, optimizeImageToWebp } from "../lib/imageUtils.js";
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
const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;
const THEME_KEY = "panet.theme";
const PROFILE_CACHE_KEY = "panet.profile.cache";
const AUTH_TIMEOUT_MS = 12000;
const GALERIA_PUBLIC_BASE = "https://panet.agenciapan.com/galerias";
const MURAL_INITIAL_LIMIT = 120;
const DATA_CACHE_TTL = {
  colaboradores: 5 * 60 * 1000,
  postagens: 2 * 60 * 1000,
  ferias: 2 * 60 * 1000,
  presencial: 45 * 1000,
  aniversarios: 6 * 60 * 60 * 1000,
  galeria: 90 * 1000,
  mural: 20 * 1000,
};
const ADMIN_LIST_CACHE_TTL = 30 * 1000;
const PANZAP_METRICS_STORAGE_KEY = "panet.metrics.panzap.v1";
const PANZAP_METRICS_LIMIT = 200;


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

const isDataImageUrl = (value) => /^data:image\//i.test(String(value || "").trim());

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
      editado: Boolean(c.editado),
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

const mapDbPresencialConfirmacaoToUi = (item) => ({
  id: item.id,
  status: item.status || "confirmado",
  observacao: item.observacao || "",
  createdAt: item.created_at || null,
  colaborador: toAvatar(item.colaborador),
});

const mapDbPresencialAgendaToUi = (item, confirmacoes = []) => ({
  id: item.id,
  titulo: item.titulo || "Dia presencial",
  dataIso: item.data_presencial,
  horaIso: String(item.hora_presencial || "").slice(0, 5),
  amigoSecretoAtivo: Boolean(item.amigo_secreto_ativo),
  amigoSecretoRegras: item.amigo_secreto_regras || "",
  amigoSecretoSorteadoAt: item.amigo_secreto_sorteado_at || null,
  local: item.local || "Escritorio Pan",
  mapsUrl: item.maps_url || "",
  vagas: Number(item.vagas || 0),
  observacao: item.observacao || "",
  status: item.status || "aberto",
  createdAt: item.created_at || null,
  confirmacoes,
});

const getPresencialConfirmedList = (agenda) =>
  (agenda?.confirmacoes || []).filter((item) => item.status === "confirmado" || item.status === "talvez");

const getPresencialSecretSantaParticipants = (agenda) =>
  (agenda?.confirmacoes || []).filter((item) => item.status === "talvez");

const sortPresencialAgendas = (items) =>
  [...(items || [])].sort((a, b) => {
    const byDate = String(a?.dataIso || "").localeCompare(String(b?.dataIso || ""));
    if (byDate !== 0) return byDate;
    const byTime = String(a?.horaIso || "").localeCompare(String(b?.horaIso || ""));
    if (byTime !== 0) return byTime;
    return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
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

const toDbLikeColaboradorFromUi = (item) => ({
  id: item?.id,
  nome: item?.nome || "",
  cargo: item?.cargo || "",
  email: item?.email || "",
  telefone: item?.telefone || "",
  cor_avatar: item?.cor_avatar || item?.cor || "#11E7E7",
  foto_url: item?.foto_url || item?.fotoUrl || "",
  instagram: item?.instagram || item?.redes?.instagram || "",
  linkedin: item?.linkedin || item?.redes?.linkedin || "",
  github: item?.github || item?.redes?.github || "",
});

const getUnknownColaboradorFallback = (id) => ({
  id,
  nome: "Colaborador",
  cargo: "",
  email: "",
  telefone: "",
  cor_avatar: "#11E7E7",
  foto_url: "",
  instagram: "",
  linkedin: "",
  github: "",
});

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

const escapeIlikeTerm = (value) => String(value || "").replace(/[\\%_]/g, (char) => `\\${char}`);
const escapePostgrestOrTerm = (value) =>
  String(value || "")
    .replace(/[,*().]/g, " ")
    .trim();

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
  const [tela, setTela] = useState("login");
  const [pagina, setPagina] = useState("dashboard");
  const [adminAba, setAdminAba] = useState("colaboradores");
  const [postSlug, setPostSlug] = useState("");
  const [authLoading, setAuthLoading] = useState(isSupabaseEnabled);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [adminServerConfirmed, setAdminServerConfirmed] = useState(false);

  const [colaboradores, setColaboradores] = useState(isSupabaseEnabled ? [] : COLABORADORES);
  const [postagens, setPostagens] = useState(isSupabaseEnabled ? [] : POSTAGENS_INIT);
  const [aniversariantes, setAniversariantes] = useState(isSupabaseEnabled ? [] : ANIVERSARIANTES_INIT);
  const [ferias, setFerias] = useState(isSupabaseEnabled ? [] : FERIAS_INIT);
  const [dayoff, setDayoff] = useState(isSupabaseEnabled ? [] : DAYOFF_INIT);
  const [ausencias, setAusencias] = useState([]);
  const [presencialAgendas, setPresencialAgendas] = useState(isSupabaseEnabled ? [] : PRESENCIAL_INIT);
  const [galeriaEventos, setGaleriaEventos] = useState(isSupabaseEnabled ? [] : GALERIA_EVENTOS);
  const [muralMsgs, setMuralMsgs] = useState(isSupabaseEnabled ? [] : MURAL_INIT);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const userMenuRef = useRef(null);
  const colaboradoresRef = useRef(colaboradores);
  const adminListCacheRef = useRef(new Map());
  const muralSyncTimerRef = useRef(null);
  const panzapPendingRef = useRef(new Map());
  const initialDataLoadRef = useRef({ userId: null, at: 0 });
  const firstAccessBypassRef = useRef({ userId: null, expiresAt: 0 });
  const telaRef = useRef(tela);
  const currentProfileIdRef = useRef(currentProfile?.id || null);

  useEffect(() => {
    colaboradoresRef.current = colaboradores;
  }, [colaboradores]);

  useEffect(() => {
    telaRef.current = tela;
  }, [tela]);

  useEffect(() => {
    currentProfileIdRef.current = currentProfile?.id || null;
  }, [currentProfile?.id]);

  const getAdminListCache = useCallback((key) => {
    const hit = adminListCacheRef.current.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > ADMIN_LIST_CACHE_TTL) {
      adminListCacheRef.current.delete(key);
      return null;
    }
    return hit.value;
  }, []);

  const setAdminListCache = useCallback((key, value) => {
    adminListCacheRef.current.set(key, { at: Date.now(), value });
  }, []);

  const invalidateAdminListCache = useCallback(() => {
    adminListCacheRef.current.clear();
  }, []);

  const logPanzapMetric = useCallback((event, payload = {}) => {
    const entry = {
      event,
      at: new Date().toISOString(),
      ...payload,
    };
    try {
      const raw = localStorage.getItem(PANZAP_METRICS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(parsed) ? parsed : [];
      next.push(entry);
      while (next.length > PANZAP_METRICS_LIMIT) next.shift();
      localStorage.setItem(PANZAP_METRICS_STORAGE_KEY, JSON.stringify(next));
    } catch (_err) {
      // ignore metric persistence failure
    }
    if (typeof window !== "undefined") {
      window.__PANET_PANZAP_METRICS_LAST = entry;
    }
  }, []);

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
    const hasColaborador = (colaborador) => byId.has(String(colaborador?.id || ""));

    setPostagens((prev) =>
      (prev || []).map((post) => ({
        ...post,
        curtidas: (post.curtidas || []).filter((id) => byId.has(String(id || ""))),
        comentarios: (post.comentarios || [])
          .filter((comment) => hasColaborador(comment?.autor))
          .map((comment) => ({
            ...comment,
            autor: mergeColaboradorVisual(comment.autor, byId),
          })),
      }))
    );

    setMuralMsgs((prev) =>
      (prev || [])
        .filter((msg) => hasColaborador(msg?.colaborador))
        .map((msg) => ({
          ...msg,
          colaborador: mergeColaboradorVisual(msg.colaborador, byId),
        }))
    );

    setFerias((prev) =>
      (prev || [])
        .filter((item) => hasColaborador(item?.colaborador))
        .map((item) => ({
          ...item,
          colaborador: mergeColaboradorVisual(item.colaborador, byId),
        }))
    );

    setDayoff((prev) =>
      (prev || [])
        .filter((item) => hasColaborador(item?.colaborador))
        .map((item) => ({
          ...item,
          colaborador: mergeColaboradorVisual(item.colaborador, byId),
        }))
    );

    setAniversariantes((prev) =>
      (prev || [])
        .filter((item) => hasColaborador(item?.colaborador))
        .map((item) => ({
          ...item,
          colaborador: mergeColaboradorVisual(item.colaborador, byId),
        }))
    );

    setPresencialAgendas((prev) =>
      (prev || []).map((agenda) => ({
        ...agenda,
        confirmacoes: (agenda.confirmacoes || [])
          .filter((item) => hasColaborador(item?.colaborador))
          .map((item) => ({
            ...item,
            colaborador: mergeColaboradorVisual(item.colaborador, byId),
          })),
      }))
    );
  }, []);

  const hydrateBusinessDataFromCache = useCallback((userId) => {
    if (!userId) return;
    const cachedColaboradores = readCachedDomain(userId, "colaboradores", Infinity);
    if (Array.isArray(cachedColaboradores)) {
      setColaboradores(cachedColaboradores);
      syncColaboradorReferences(cachedColaboradores);
    }

    const cachedFerias = readCachedDomain(userId, "ferias", Infinity);
    if (cachedFerias && Array.isArray(cachedFerias.ferias) && Array.isArray(cachedFerias.dayoff)) {
      setFerias(cachedFerias.ferias);
      setDayoff(cachedFerias.dayoff);
    }

    const cachedAusencias = readCachedDomain(userId, "ausencias", Infinity);
    if (Array.isArray(cachedAusencias)) setAusencias(cachedAusencias);

    const cachedAniversarios = readCachedDomain(userId, "aniversarios", Infinity);
    if (Array.isArray(cachedAniversarios)) setAniversariantes(cachedAniversarios);

    const cachedPresencial = readCachedDomain(userId, "presencial", Infinity);
    if (Array.isArray(cachedPresencial)) setPresencialAgendas(cachedPresencial);

    const cachedPostagens = readCachedDomain(userId, "postagens", Infinity);
    if (Array.isArray(cachedPostagens)) setPostagens(cachedPostagens);

    const cachedGaleria = readCachedDomain(userId, "galeria", Infinity);
    if (Array.isArray(cachedGaleria)) setGaleriaEventos(cachedGaleria);

    const cachedMural = readCachedDomain(userId, "mural", Infinity);
    if (Array.isArray(cachedMural)) setMuralMsgs(cachedMural);
  }, [syncColaboradorReferences]);

  const invalidateUserBusinessCaches = useCallback((userId) => {
    if (!userId) return;
    ["colaboradores", "ferias", "ausencias", "presencial", "aniversarios", "mural", "postagens", "galeria"].forEach((domain) => {
      invalidateCachedDomain(userId, domain);
    });
  }, []);

  const writePresencialState = useCallback((userId, updater) => {
    setPresencialAgendas((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = sortPresencialAgendas(typeof updater === "function" ? updater(base) : base);
      if (userId) writeCachedDomain(userId, "presencial", next);
      return next;
    });
  }, []);

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
          "id,titulo,descricao,imagem_url,categoria,data_post,created_at,curtidas(colaborador_id),comentarios(id,postagem_id,texto,editado,created_at,colaborador:colaboradores!comentarios_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github))"
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

  const loadAusencias = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "ausencias", DATA_CACHE_TTL.ferias);
      if (Array.isArray(cached)) {
        setAusencias(cached);
        return cached;
      }
    }
    return runDedupedRequest(`ausencias:${currentUserId}`, async () => {
      const { data, error } = await supabase
        .from("ausencias")
        .select("id,motivo,inicio,fim,estimativa,colaborador:colaboradores!ausencias_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)")
        .order("inicio", { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map((item) => ({
        id: item.id,
        motivo: item.motivo,
        inicio: item.inicio,
        fim: item.fim || null,
        estimativa: item.estimativa || null,
        colaborador: toAvatar(item.colaborador),
      }));
      setAusencias(mapped);
      writeCachedDomain(currentUserId, "ausencias", mapped);
      return mapped;
    });
  }, []);

  const loadPresencial = useCallback(async (currentUserId, options = {}) => {
    if (!isSupabaseEnabled || !currentUserId) return [];
    const { force = false } = options;
    if (!force) {
      const cached = readCachedDomain(currentUserId, "presencial", DATA_CACHE_TTL.presencial);
      if (Array.isArray(cached)) {
        setPresencialAgendas(cached);
        return cached;
      }
    }

    return runDedupedRequest(`presencial:${currentUserId}`, async () => {
      const { data: agendasRows, error: agendasError } = await supabase
        .from("presencial_agendas")
        .select("id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at")
        .order("data_presencial", { ascending: true })
        .order("created_at", { ascending: false });
      if (agendasError) throw agendasError;

      const agendaIds = (agendasRows || []).map((row) => row.id).filter(Boolean);

      const confirmacoesPromise = agendaIds.length > 0
        ? supabase
            .from("presencial_confirmacoes")
            .select(
              "id,agenda_id,status,observacao,created_at,colaborador:colaboradores!presencial_confirmacoes_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
            )
            .in("agenda_id", agendaIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null });

      const [confirmacoesResult, secretResult] = await Promise.all([
        confirmacoesPromise,
        supabase.rpc("get_my_amigo_secreto_results"),
      ]);
      if (confirmacoesResult.error) throw confirmacoesResult.error;
      if (secretResult.error) throw secretResult.error;

      const confirmacoesRows = confirmacoesResult.data || [];
      const secretRows = secretResult.data;

      const confirmacoesByAgenda = new Map();
      for (const row of confirmacoesRows) {
        const list = confirmacoesByAgenda.get(String(row.agenda_id)) || [];
        list.push(mapDbPresencialConfirmacaoToUi(row));
        confirmacoesByAgenda.set(String(row.agenda_id), list);
      }

      let secretResultsByAgenda = new Map();
      if (Array.isArray(secretRows)) {
        secretResultsByAgenda = new Map(
          secretRows.map((row) => [
            String(row.agenda_id),
            {
              id: row.tirou_colaborador_id,
              nome: row.nome,
              cargo: row.cargo,
              email: row.email,
              telefone: row.telefone,
              cor_avatar: row.cor_avatar,
              foto_url: row.foto_url,
              instagram: row.instagram,
              linkedin: row.linkedin,
              github: row.github,
            },
          ])
        );
      }

      const mapped = (agendasRows || []).map((row) => ({
        ...mapDbPresencialAgendaToUi(row, confirmacoesByAgenda.get(String(row.id)) || []),
        meuAmigoSecreto: secretResultsByAgenda.has(String(row.id))
          ? toAvatar(secretResultsByAgenda.get(String(row.id)))
          : null,
      }));
      setPresencialAgendas(mapped);
      writeCachedDomain(currentUserId, "presencial", mapped);
      return mapped;
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
    const { force = false, limit = MURAL_INITIAL_LIMIT } = options;
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
        .select("id,texto,created_at,colaborador_id")
        .order("created_at", { ascending: false })
        .limit(Math.max(20, Number(limit) || MURAL_INITIAL_LIMIT));
      if (error) throw error;

      const localLookup = new Map((colaboradoresRef.current || []).map((col) => [String(col.id), toDbLikeColaboradorFromUi(col)]));
      const missingIds = Array.from(
        new Set((data || []).map((row) => String(row.colaborador_id || "")).filter((id) => id && !localLookup.has(id)))
      );

      if (missingIds.length > 0) {
        const { data: missingCols, error: missingColsError } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
          .in("id", missingIds);
        if (!missingColsError) {
          (missingCols || []).forEach((row) => {
            localLookup.set(String(row.id), row);
          });
        }
      }

      const mapped = (data || []).map((row) =>
        mapDbMuralToUi({
          ...row,
          colaborador: localLookup.get(String(row.colaborador_id || "")) || toDbLikeColaboradorFromUi({ id: row.colaborador_id, nome: "Colaborador" }),
        })
      );
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
      if (!eventosError) {
        const mapped = mapDbGaleriaToUi(eventos);
        setGaleriaEventos(mapped);
        writeCachedDomain(currentUserId, "galeria", mapped);
        return mapped;
      }

      // Fallback: if embedded relation fails, at least load gallery events.
      console.warn("Fallback loadGaleria sem embed de fotos:", eventosError?.message || eventosError);
      const { data: eventosOnly, error: eventosOnlyError } = await supabase
        .from("galeria_eventos")
        .select("id,titulo,mes_ano,capa_url,created_at")
        .order("created_at", { ascending: false });
      if (eventosOnlyError) throw eventosOnlyError;

      let fotosRows = [];
      const eventoIds = (eventosOnly || []).map((row) => row.id).filter(Boolean);
      if (eventoIds.length > 0) {
        const { data: fotos, error: fotosError } = await supabase
          .from("galeria_fotos")
          .select("id,evento_id,foto_url,legenda,ordem,created_at")
          .in("evento_id", eventoIds)
          .order("ordem", { ascending: true });
        if (!fotosError) fotosRows = fotos || [];
      }

      const mapped = mapDbGaleriaToUi(eventosOnly || [], fotosRows);
      setGaleriaEventos(mapped);
      writeCachedDomain(currentUserId, "galeria", mapped);
      return mapped;
    });
  }, []);

  const upsertMuralMessage = useCallback((nextMessage) => {
    if (!nextMessage?.id) return;
    setMuralMsgs((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const filtered = list.filter((row) => String(row.id) !== String(nextMessage.id));
      return [nextMessage, ...filtered].slice(0, 200);
    });
  }, []);

  const scheduleMuralSync = useCallback((delayMs = 1200) => {
    if (muralSyncTimerRef.current) clearTimeout(muralSyncTimerRef.current);
    muralSyncTimerRef.current = setTimeout(() => {
      loadMural(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar mural:", err));
    }, delayMs);
  }, [currentProfile?.id, loadMural]);

  const loadAllBusinessData = useCallback(
    async (currentUserId, options = {}) => {
      if (!isSupabaseEnabled || !currentUserId) return;
      const force = Boolean(options?.force);
      const hasCachedColaboradores = Array.isArray(readCachedDomain(currentUserId, "colaboradores", Infinity));

      // Keep first paint responsive on hard refresh.
      if (hasCachedColaboradores) {
        loadColaboradores(currentUserId, { force }).catch(() => {});
      } else {
        await loadColaboradores(currentUserId, { force });
      }

      // PanZap sync in background (bounded payload for faster initial data availability).
      setTimeout(() => {
        loadMural(currentUserId, { force, limit: MURAL_INITIAL_LIMIT }).catch(() => {});
      }, 0);

      // Secondary data: still important for dashboard cards, but non-blocking.
      setTimeout(() => {
        Promise.allSettled([
          loadFerias(currentUserId, { force }),
          loadAusencias(currentUserId, { force }),
          loadPresencial(currentUserId, { force }),
          loadAniversarios(currentUserId, { force }),
        ]).catch(() => {});
      }, 0);

      // Heavy domains in background to keep app interactive sooner.
      setTimeout(() => {
        Promise.allSettled([
          loadPostagens(currentUserId, { force }),
          loadGaleria(currentUserId, { force }),
        ]).catch(() => {});
      }, 120);
    },
    [loadAniversarios, loadAusencias, loadColaboradores, loadFerias, loadGaleria, loadMural, loadPostagens, loadPresencial]
  );

  const listAdminPostagens = useCallback(async ({ page = 1, pageSize = 20, search = "" } = {}) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { rows: [], count: 0 };
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const term = String(search || "").trim();
    const cacheKey = `postagens:${currentProfile.id}:${safePage}:${safePageSize}:${term.toLowerCase()}`;
    const cached = getAdminListCache(cacheKey);
    if (cached) return cached;

    return runDedupedRequest(`admin-list:${cacheKey}`, async () => {
      let rowsQuery = supabase
        .from("postagens")
        .select("id,titulo,descricao,imagem_url,categoria,data_post,created_at")
        .order("data_post", { ascending: false })
        .order("created_at", { ascending: false });

      let countQuery = supabase.from("postagens").select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapePostgrestOrTerm(term);
        const expression = `titulo.ilike.*${escaped}*,descricao.ilike.*${escaped}*,categoria.ilike.*${escaped}*`;
        rowsQuery = rowsQuery.or(expression);
        countQuery = countQuery.or(expression);
      }

      const [{ data, error }, { count }] = await Promise.all([
        rowsQuery.range(from, to),
        countQuery,
      ]);
      if (error) throw new Error(error.message);

      const postagemIds = (data || []).map((post) => post.id).filter(Boolean);
      const likesByPost = new Map();
      const commentsByPost = new Map();

      if (postagemIds.length > 0) {
        const [{ data: likesRows, error: likesError }, { data: commentsRows, error: commentsError }] = await Promise.all([
          supabase.from("curtidas").select("postagem_id,colaborador_id").in("postagem_id", postagemIds),
          supabase.from("comentarios").select("id,postagem_id").in("postagem_id", postagemIds),
        ]);
        if (likesError) throw new Error(likesError.message);
        if (commentsError) throw new Error(commentsError.message);

        (likesRows || []).forEach((row) => {
          const key = String(row.postagem_id);
          const list = likesByPost.get(key) || [];
          list.push(row.colaborador_id);
          likesByPost.set(key, list);
        });

        (commentsRows || []).forEach((row) => {
          const key = String(row.postagem_id);
          const list = commentsByPost.get(key) || [];
          list.push({ id: row.id });
          commentsByPost.set(key, list);
        });
      }

      const rows = (data || []).map((post) => {
        const key = String(post.id);
        return {
        id: post.id,
        titulo: post.titulo,
        descricao: post.descricao,
        imagem: post.imagem_url || postImg(post.id),
        categoria: post.categoria,
        data: post.data_post,
        curtidas: likesByPost.get(key) || [],
        comentarios: commentsByPost.get(key) || [],
        userCurtiu: false,
      };
      });
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const payload = { rows, count: safeCount };
      setAdminListCache(cacheKey, payload);
      return payload;
    });
  }, [currentProfile?.id, getAdminListCache, setAdminListCache]);

  const listAdminFerias = useCallback(async ({ tipo = "ferias", page = 1, pageSize = 20, search = "" } = {}) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { rows: [], count: 0 };
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const term = String(search || "").trim();
    const safeTipo = tipo === "dayoff" ? "dayoff" : "ferias";
    const cacheKey = `ferias:${currentProfile.id}:${safeTipo}:${safePage}:${safePageSize}:${term.toLowerCase()}`;
    const cached = getAdminListCache(cacheKey);
    if (cached) return cached;

    return runDedupedRequest(`admin-list:${cacheKey}`, async () => {
      let rowsQuery = supabase
        .from("ferias")
        .select("id,inicio,fim,status,tipo,colaborador_id")
        .eq("tipo", safeTipo)
        .order("inicio", { ascending: true });

      let countQuery = supabase
        .from("ferias")
        .select("id", { count: "exact", head: true })
        .eq("tipo", safeTipo);

      if (term) {
        const escaped = escapeIlikeTerm(term);
        const { data: cols, error: colsError } = await supabase
          .from("colaboradores")
          .select("id")
          .or(`nome.ilike.%${escaped}%,cargo.ilike.%${escaped}%`)
          .limit(300);
        if (colsError) throw new Error(colsError.message);
        const ids = (cols || []).map((row) => row.id);
        if (ids.length > 0) {
          rowsQuery = rowsQuery.in("colaborador_id", ids);
          countQuery = countQuery.in("colaborador_id", ids);
        } else {
          rowsQuery = rowsQuery.ilike("status", `%${escaped}%`);
          countQuery = countQuery.ilike("status", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([
        rowsQuery.range(from, to),
        countQuery,
      ]);
      if (error) throw new Error(error.message);

      const localLookup = new Map((colaboradores || []).map((col) => [String(col.id), toDbLikeColaboradorFromUi(col)]));
      const missingIds = Array.from(
        new Set((data || []).map((row) => String(row.colaborador_id || "")).filter((id) => id && !localLookup.has(id)))
      );
      if (missingIds.length > 0) {
        const { data: missingCols, error: missingColsError } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
          .in("id", missingIds);
        if (!missingColsError) {
          (missingCols || []).forEach((row) => {
            localLookup.set(String(row.id), row);
          });
        }
      }

      const rows = (data || []).map((row) =>
        mapDbFeriasToUi({
          ...row,
          colaborador:
            localLookup.get(String(row.colaborador_id || "")) ||
            getUnknownColaboradorFallback(row.colaborador_id),
        })
      );
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const payload = { rows, count: safeCount };
      setAdminListCache(cacheKey, payload);
      return payload;
    });
  }, [colaboradores, currentProfile?.id, getAdminListCache, setAdminListCache]);

  const listAdminAusencias = useCallback(async ({ page = 1, pageSize = 20, search = "" } = {}) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { rows: [], count: 0 };
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const term = String(search || "").trim();
    const cacheKey = `ausencias:${currentProfile.id}:${safePage}:${safePageSize}:${term.toLowerCase()}`;
    const cached = getAdminListCache(cacheKey);
    if (cached) return cached;

    return runDedupedRequest(`admin-list:${cacheKey}`, async () => {
      let rowsQuery = supabase
        .from("ausencias")
        .select("id,motivo,inicio,fim,estimativa,colaborador:colaboradores!ausencias_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)")
        .order("inicio", { ascending: false });

      let countQuery = supabase.from("ausencias").select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapeIlikeTerm(term);
        const { data: cols } = await supabase
          .from("colaboradores")
          .select("id")
          .ilike("nome", `%${escaped}%`)
          .limit(300);
        const ids = (cols || []).map((row) => row.id);
        if (ids.length > 0) {
          rowsQuery = rowsQuery.in("colaborador_id", ids);
          countQuery = countQuery.in("colaborador_id", ids);
        } else {
          rowsQuery = rowsQuery.ilike("motivo", `%${escaped}%`);
          countQuery = countQuery.ilike("motivo", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery.range(from, to), countQuery]);
      if (error) throw new Error(error.message);

      const rows = (data || []).map((item) => ({
        id: item.id,
        motivo: item.motivo,
        inicio: item.inicio,
        fim: item.fim || null,
        estimativa: item.estimativa || null,
        colaborador: toAvatar(item.colaborador),
      }));
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const payload = { rows, count: safeCount };
      setAdminListCache(cacheKey, payload);
      return payload;
    });
  }, [currentProfile?.id, getAdminListCache, setAdminListCache]);

  const listAdminPresencial = useCallback(async ({ page = 1, pageSize = 20, search = "" } = {}) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { rows: [], count: 0 };
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const term = String(search || "").trim();
    const cacheKey = `presencial:${currentProfile.id}:${safePage}:${safePageSize}:${term.toLowerCase()}`;
    const cached = getAdminListCache(cacheKey);
    if (cached) return cached;

    return runDedupedRequest(`admin-list:${cacheKey}`, async () => {
      let rowsQuery = supabase
        .from("presencial_agendas")
        .select("id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at")
        .order("data_presencial", { ascending: true })
        .range(from, to);

      let countQuery = supabase
        .from("presencial_agendas")
        .select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapePostgrestOrTerm(term);
        const expression = `titulo.ilike.*${escaped}*,local.ilike.*${escaped}*,observacao.ilike.*${escaped}*`;
        rowsQuery = rowsQuery.or(expression);
        countQuery = countQuery.or(expression);
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw new Error(error.message);

      const agendaIds = (data || []).map((row) => row.id).filter(Boolean);
      let confirmacoesRows = [];
      if (agendaIds.length > 0) {
        const { data: rows, error: confirmacoesError } = await supabase
          .from("presencial_confirmacoes")
          .select(
            "id,agenda_id,status,observacao,created_at,colaborador:colaboradores!presencial_confirmacoes_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github)"
          )
          .in("agenda_id", agendaIds)
          .order("created_at", { ascending: true });
        if (confirmacoesError) throw new Error(confirmacoesError.message);
        confirmacoesRows = rows || [];
      }

      const confirmacoesByAgenda = new Map();
      for (const row of confirmacoesRows) {
        const list = confirmacoesByAgenda.get(String(row.agenda_id)) || [];
        list.push(mapDbPresencialConfirmacaoToUi(row));
        confirmacoesByAgenda.set(String(row.agenda_id), list);
      }

      const rows = (data || []).map((row) =>
        mapDbPresencialAgendaToUi(row, confirmacoesByAgenda.get(String(row.id)) || [])
      );
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const payload = { rows, count: safeCount };
      setAdminListCache(cacheKey, payload);
      return payload;
    });
  }, [currentProfile?.id, getAdminListCache, setAdminListCache]);

  const listAdminGaleria = useCallback(async ({ page = 1, pageSize = 20, search = "" } = {}) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { rows: [], count: 0 };
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const term = String(search || "").trim();
    const cacheKey = `galeria:${currentProfile.id}:${safePage}:${safePageSize}:${term.toLowerCase()}`;
    const cached = getAdminListCache(cacheKey);
    if (cached) return cached;

    return runDedupedRequest(`admin-list:${cacheKey}`, async () => {
      let rowsQuery = supabase
        .from("galeria_eventos")
        .select("id,titulo,mes_ano,capa_url,created_at")
        .order("created_at", { ascending: false })
        .range(from, to);

      let countQuery = supabase
        .from("galeria_eventos")
        .select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapePostgrestOrTerm(term);
        const expression = `titulo.ilike.*${escaped}*,mes_ano.ilike.*${escaped}*`;
        rowsQuery = rowsQuery.or(expression);
        countQuery = countQuery.or(expression);
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw new Error(error.message);

      const eventoIds = (data || []).map((row) => row.id).filter(Boolean);
      let fotosRows = [];
      if (eventoIds.length > 0) {
        const { data: fotos, error: fotosError } = await supabase
          .from("galeria_fotos")
          .select("id,evento_id,foto_url,legenda,ordem")
          .in("evento_id", eventoIds)
          .order("ordem", { ascending: true });
        if (fotosError) throw new Error(fotosError.message);
        fotosRows = fotos || [];
      }

      const rows = mapDbGaleriaToUi(data || [], fotosRows);
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const payload = { rows, count: safeCount };
      setAdminListCache(cacheKey, payload);
      return payload;
    });
  }, [currentProfile?.id, getAdminListCache, setAdminListCache]);

  const listAdminMural = useCallback(async ({ page = 1, pageSize = 20, search = "" } = {}) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { rows: [], count: 0 };
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const term = String(search || "").trim();
    const cacheKey = `mural:${currentProfile.id}:${safePage}:${safePageSize}:${term.toLowerCase()}`;
    const cached = getAdminListCache(cacheKey);
    if (cached) return cached;

    return runDedupedRequest(`admin-list:${cacheKey}`, async () => {
      let rowsQuery = supabase
        .from("mural")
        .select("id,texto,created_at,colaborador_id")
        .order("created_at", { ascending: false })
        .range(from, to);

      let countQuery = supabase
        .from("mural")
        .select("id", { count: "exact", head: true });

      if (term) {
        const escaped = escapeIlikeTerm(term);
        const idsFromLocal = (colaboradores || [])
          .filter((row) => String(row?.nome || "").toLowerCase().includes(term.toLowerCase()))
          .map((row) => row.id)
          .filter(Boolean)
          .slice(0, 300);
        let ids = idsFromLocal;
        if (ids.length === 0) {
          const { data: cols, error: colsError } = await supabase
            .from("colaboradores")
            .select("id")
            .ilike("nome", `%${escaped}%`)
            .limit(300);
          if (colsError) throw new Error(colsError.message);
          ids = (cols || []).map((row) => row.id);
        }
        if (ids.length > 0) {
          rowsQuery = rowsQuery.in("colaborador_id", ids);
          countQuery = countQuery.in("colaborador_id", ids);
        } else {
          rowsQuery = rowsQuery.ilike("texto", `%${escaped}%`);
          countQuery = countQuery.ilike("texto", `%${escaped}%`);
        }
      }

      const [{ data, error }, { count }] = await Promise.all([rowsQuery, countQuery]);
      if (error) throw new Error(error.message);

      const localLookup = new Map((colaboradores || []).map((col) => [String(col.id), toDbLikeColaboradorFromUi(col)]));
      const missingIds = Array.from(
        new Set((data || []).map((row) => String(row.colaborador_id || "")).filter((id) => id && !localLookup.has(id)))
      );
      if (missingIds.length > 0) {
        const { data: missingCols, error: missingColsError } = await supabase
          .from("colaboradores")
          .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
          .in("id", missingIds);
        if (!missingColsError) {
          (missingCols || []).forEach((row) => {
            localLookup.set(String(row.id), row);
          });
        }
      }

      const rows = (data || []).map((row) =>
        mapDbMuralToUi({
          ...row,
          colaborador: localLookup.get(String(row.colaborador_id || "")) || toDbLikeColaboradorFromUi({ id: row.colaborador_id, nome: "Colaborador" }),
        })
      );
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      const payload = { rows, count: safeCount };
      setAdminListCache(cacheKey, payload);
      return payload;
    });
  }, [colaboradores, currentProfile?.id, getAdminListCache, setAdminListCache]);

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
      const bypass =
        firstAccessBypassRef.current.userId === activeSession.user.id &&
        Date.now() < Number(firstAccessBypassRef.current.expiresAt || 0);
      const resolvedProfile = bypass ? { ...data, primeiro_acesso: false } : data;
      setCurrentProfile(resolvedProfile);
      writeCachedProfile(resolvedProfile);
      setAdminServerConfirmed(resolvedProfile.perfil === "admin");
      setTela(resolvedProfile.primeiro_acesso ? "primeiro_acesso" : "app");
      hydrateBusinessDataFromCache(activeSession.user.id);
      const now = Date.now();
      const lastLoad = initialDataLoadRef.current;
      const shouldSkipDuplicate =
        lastLoad.userId === activeSession.user.id &&
        now - Number(lastLoad.at || 0) < 3000;
      if (!shouldSkipDuplicate) {
        initialDataLoadRef.current = { userId: activeSession.user.id, at: now };
        loadAllBusinessData(activeSession.user.id).catch((err) => {
          console.error("Falha ao carregar dados de negócio:", err);
        });
      }
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
    if (!isSupabaseEnabled || tela !== "app" || !currentProfile?.id) return;

    const resolveColaborador = async (colaboradorId) => {
      const local = (colaboradoresRef.current || []).find((row) => String(row.id) === String(colaboradorId));
      if (local) return toDbLikeColaboradorFromUi(local);
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github")
        .eq("id", colaboradorId)
        .maybeSingle();
      if (error || !data) return getUnknownColaboradorFallback(colaboradorId);
      return data;
    };

    const channel = supabase
      .channel(`mural-live-${currentProfile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mural" }, async (payload) => {
        const row = payload?.new || {};
        if (!row?.id) return;
        const col = await resolveColaborador(row.colaborador_id);
        const uiMsg = mapDbMuralToUi({
          id: row.id,
          texto: row.texto,
          created_at: row.created_at,
          colaborador: col,
        });
        setMuralMsgs((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const withoutSameId = list.filter((item) => String(item.id) !== String(row.id));
          const optimisticIdx = withoutSameId.findIndex(
            (item) =>
              String(item.id).startsWith("optimistic-") &&
              String(item.colaborador?.id) === String(row.colaborador_id) &&
              String(item.texto || "").trim() === String(row.texto || "").trim()
          );
          if (optimisticIdx >= 0) {
            const optimisticId = withoutSameId[optimisticIdx]?.id;
            const pending = panzapPendingRef.current.get(optimisticId);
            if (pending) {
              logPanzapMetric("send_realtime_confirmed", {
                optimistic_id: optimisticId,
                persisted_id: row.id,
                realtime_latency_ms: Math.round(performance.now() - pending.startedAt),
              });
              panzapPendingRef.current.delete(optimisticId);
            }
            withoutSameId.splice(optimisticIdx, 1);
          }
          return [uiMsg, ...withoutSameId].slice(0, 200);
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mural" }, async (payload) => {
        const row = payload?.new || {};
        if (!row?.id) return;
        const col = await resolveColaborador(row.colaborador_id);
        const uiMsg = mapDbMuralToUi({
          id: row.id,
          texto: row.texto,
          created_at: row.created_at,
          colaborador: col,
        });
        upsertMuralMessage(uiMsg);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mural" }, (payload) => {
        const oldRow = payload?.old || {};
        if (!oldRow?.id) return;
        setMuralMsgs((prev) => (prev || []).filter((row) => String(row.id) !== String(oldRow.id)));
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentProfile?.id, logPanzapMetric, tela, upsertMuralMessage]);

  useEffect(() => {
    if (!isSupabaseEnabled || tela !== "app" || !currentProfile?.id) return;
    const channel = supabase
      .channel(`colaboradores-live-${currentProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "colaboradores" }, () => {
        Promise.allSettled([
          loadColaboradores(currentProfile.id, { force: true }),
          loadFerias(currentProfile.id, { force: true }),
          loadAniversarios(currentProfile.id, { force: true }),
        ]).then((results) => {
          results.forEach((result) => {
            if (result.status === "rejected") {
              console.warn("Falha ao atualizar dados derivados de colaboradores:", result.reason?.message || result.reason);
            }
          });
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentProfile?.id, loadAniversarios, loadColaboradores, loadFerias, tela]);

  useEffect(
    () => () => {
      if (muralSyncTimerRef.current) clearTimeout(muralSyncTimerRef.current);
    },
    []
  );

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
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleComentar = async (postId, texto) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase.from("comentarios").insert({ postagem_id: postId, colaborador_id: currentProfile.id, texto });
    if (error) throw new Error(error.message);
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleEditarComentario = async (comentarioId, novoTexto) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase
      .from("comentarios")
      .update({ texto: novoTexto, editado: true, updated_at: new Date().toISOString() })
      .eq("id", comentarioId)
      .eq("colaborador_id", currentProfile.id);
    if (error) throw new Error(error.message);
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleDeletarComentario = async (comentarioId) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    const { error } = await supabase
      .from("comentarios")
      .delete()
      .eq("id", comentarioId)
      .eq("colaborador_id", currentProfile.id);
    if (error) throw new Error(error.message);
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleCreatePost = async (payload) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    let imagemUrl = payload.imagem || null;
    if (isDataImageUrl(imagemUrl)) {
      try {
        const sourceBlob = await fetch(imagemUrl).then((res) => res.blob());
        const storagePath = `${currentProfile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const { error: uploadError } = await supabase.storage.from("postagens").upload(storagePath, sourceBlob, {
          contentType: "image/webp",
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from("postagens").getPublicUrl(storagePath);
        if (publicData?.publicUrl) imagemUrl = publicData.publicUrl;
      } catch (err) {
        console.warn("Falha ao otimizar/upload da capa do post. Mantendo imagem original.", err?.message || err);
      }
    }
    const { error } = await supabase.from("postagens").insert({
      titulo: payload.titulo,
      descricao: payload.descricao,
      imagem_url: imagemUrl,
      categoria: payload.categoria,
      data_post: payload.data,
      autor_id: currentProfile.id,
    });
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleUpdatePost = async (postId, payload) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    let previousImageUrl = postagens.find((p) => p.id === postId)?.imagem || "";
    if (!previousImageUrl) {
      const { data: existingPost } = await supabase.from("postagens").select("imagem_url").eq("id", postId).maybeSingle();
      previousImageUrl = existingPost?.imagem_url || "";
    }

    let imagemUrl = payload.imagem || null;
    let uploadedPostPath = "";
    if (isDataImageUrl(imagemUrl)) {
      try {
        const sourceBlob = await fetch(imagemUrl).then((res) => res.blob());
        uploadedPostPath = `${currentProfile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const { error: uploadError } = await supabase.storage.from("postagens").upload(uploadedPostPath, sourceBlob, {
          contentType: "image/webp",
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from("postagens").getPublicUrl(uploadedPostPath);
        if (publicData?.publicUrl) imagemUrl = publicData.publicUrl;
      } catch (err) {
        uploadedPostPath = "";
        console.warn("Falha ao otimizar/upload da capa do post. Mantendo imagem original.", err?.message || err);
      }
    }

    const { error } = await supabase
      .from("postagens")
      .update({
        titulo: payload.titulo,
        descricao: payload.descricao,
        imagem_url: imagemUrl,
        categoria: payload.categoria,
        data_post: payload.data,
      })
      .eq("id", postId);
    if (error) {
      if (uploadedPostPath) {
        supabase.storage.from("postagens").remove([uploadedPostPath]).catch(() => {});
      }
      throw new Error(error.message);
    }

    const previousPath = getPostStoragePathFromUrl(previousImageUrl);
    const nextPath = getPostStoragePathFromUrl(imagemUrl);
    if (previousPath && previousPath !== nextPath) {
      supabase.storage
        .from("postagens")
        .remove([previousPath])
        .catch((err) => console.warn("Falha ao remover capa antiga do post:", err?.message || err));
    }

    invalidateAdminListCache();
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleDeletePost = async (postId) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return;
    let previousImageUrl = postagens.find((p) => p.id === postId)?.imagem || "";
    if (!previousImageUrl) {
      const { data: existingPost } = await supabase.from("postagens").select("imagem_url").eq("id", postId).maybeSingle();
      previousImageUrl = existingPost?.imagem_url || "";
    }

    const { error } = await supabase.from("postagens").delete().eq("id", postId);
    if (error) throw new Error(error.message);

    const previousPath = getPostStoragePathFromUrl(previousImageUrl);
    if (previousPath) {
      supabase.storage
        .from("postagens")
        .remove([previousPath])
        .catch((err) => console.warn("Falha ao remover capa do post excluído:", err?.message || err));
    }

    if (selectedPost?.id === postId) navigateTo("postagens");
    invalidateAdminListCache();
    loadPostagens(currentProfile.id, { force: true }).catch((err) => console.error("Falha ao atualizar postagens:", err));
  };

  const handleCreateFerias = async (payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ferias").insert(payload);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadFerias(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar férias:", err));
  };

  const handleUpdateFerias = async (id, payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ferias").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadFerias(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar férias:", err));
  };

  const handleDeleteFerias = async (id) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ferias").delete().eq("id", id);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadFerias(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar férias:", err));
  };

  const handleCreateAusencia = async (payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ausencias").insert(payload);
    if (error) throw new Error(error.message);
    loadAusencias(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar ausências:", err));
  };

  const handleUpdateAusencia = async (id, payload) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ausencias").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    loadAusencias(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar ausências:", err));
  };

  const handleDeleteAusencia = async (id) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("ausencias").delete().eq("id", id);
    if (error) throw new Error(error.message);
    loadAusencias(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar ausências:", err));
  };

  const handleCreatePresencialAgenda = async (payload) => {
    const normalized = {
      titulo: payload?.titulo || "Dia presencial",
      dataIso: payload?.dataIso || "",
      horaIso: String(payload?.horaIso || "").slice(0, 5),
      amigoSecretoAtivo: Boolean(payload?.amigoSecretoAtivo),
      amigoSecretoRegras: payload?.amigoSecretoRegras || "",
      local: payload?.local || "Escritorio Pan",
      mapsUrl: payload?.mapsUrl || "",
      vagas: Number(payload?.vagas || 0),
      observacao: payload?.observacao || "",
      status: payload?.status || "aberto",
    };

    if (!isSupabaseEnabled) {
      const created = { id: `presencial-${Date.now()}`, ...normalized, confirmacoes: [] };
      writePresencialState(currentProfile?.id, (prev) => [...prev, created]);
      invalidateAdminListCache();
      return created;
    }

    const { data, error } = await supabase
      .from("presencial_agendas")
      .insert({
        titulo: normalized.titulo,
        data_presencial: normalized.dataIso,
        hora_presencial: normalized.horaIso || null,
        amigo_secreto_ativo: normalized.amigoSecretoAtivo,
        amigo_secreto_regras: normalized.amigoSecretoRegras || null,
        local: normalized.local || null,
        maps_url: normalized.mapsUrl || null,
        vagas: normalized.vagas,
        observacao: normalized.observacao || null,
        status: normalized.status,
      })
      .select("id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    const created = mapDbPresencialAgendaToUi(data, []);
    writePresencialState(currentProfile?.id, (prev) => [...prev, created]);
    invalidateAdminListCache();
    return created;
  };

  const handleUpdatePresencialAgenda = async (id, payload) => {
    const normalized = {
      titulo: payload?.titulo || "Dia presencial",
      dataIso: payload?.dataIso || "",
      horaIso: String(payload?.horaIso || "").slice(0, 5),
      amigoSecretoAtivo: Boolean(payload?.amigoSecretoAtivo),
      amigoSecretoRegras: payload?.amigoSecretoRegras || "",
      local: payload?.local || "Escritorio Pan",
      mapsUrl: payload?.mapsUrl || "",
      vagas: Number(payload?.vagas || 0),
      observacao: payload?.observacao || "",
      status: payload?.status || "aberto",
    };

    if (!isSupabaseEnabled) {
      let updated = null;
      writePresencialState(currentProfile?.id, (prev) =>
        prev.map((agenda) => {
          if (String(agenda.id) !== String(id)) return agenda;
          updated = { ...agenda, ...normalized };
          return updated;
        })
      );
      invalidateAdminListCache();
      return updated;
    }

    const currentAgenda = (presencialAgendas || []).find((agenda) => String(agenda.id) === String(id));
    const { data, error } = await supabase
      .from("presencial_agendas")
      .update({
        titulo: normalized.titulo,
        data_presencial: normalized.dataIso,
        hora_presencial: normalized.horaIso || null,
        amigo_secreto_ativo: normalized.amigoSecretoAtivo,
        amigo_secreto_regras: normalized.amigoSecretoRegras || null,
        local: normalized.local || null,
        maps_url: normalized.mapsUrl || null,
        vagas: normalized.vagas,
        observacao: normalized.observacao || null,
        status: normalized.status,
      })
      .select("id,titulo,data_presencial,hora_presencial,amigo_secreto_ativo,amigo_secreto_regras,amigo_secreto_sorteado_at,local,maps_url,observacao,vagas,status,created_at")
      .eq("id", id);
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const updated = {
      ...mapDbPresencialAgendaToUi(row, currentAgenda?.confirmacoes || []),
      meuAmigoSecreto: currentAgenda?.meuAmigoSecreto || null,
    };
    writePresencialState(currentProfile?.id, (prev) =>
      prev.map((agenda) => (String(agenda.id) === String(id) ? updated : agenda))
    );
    invalidateAdminListCache();
    return updated;
  };

  const handleDeletePresencialAgenda = async (id) => {
    if (!isSupabaseEnabled) {
      writePresencialState(currentProfile?.id, (prev) => prev.filter((agenda) => String(agenda.id) !== String(id)));
      invalidateAdminListCache();
      return;
    }

    const { error } = await supabase.from("presencial_agendas").delete().eq("id", id);
    if (error) throw new Error(error.message);
    writePresencialState(currentProfile?.id, (prev) => prev.filter((agenda) => String(agenda.id) !== String(id)));
    invalidateAdminListCache();
  };

  const handleRespondPresencial = async (agendaId, status) => {
    const effectiveUserId = currentProfile?.id || eu.id;
    if (!effectiveUserId || !agendaId) return;

    const currentAgenda = (presencialAgendas || []).find((agenda) => String(agenda.id) === String(agendaId));
    const currentResponse = (currentAgenda?.confirmacoes || []).find(
      (item) => String(item.colaborador?.id || "") === String(effectiveUserId)
    );
    const nextStatus = status === "confirmado" && currentResponse?.status === "talvez" ? "talvez" : status;

    const applyResponse = (prev) =>
      prev.map((agenda) => {
        if (String(agenda.id) !== String(agendaId)) return agenda;
        const filtered = (agenda.confirmacoes || []).filter(
          (item) => String(item.colaborador?.id || "") !== String(effectiveUserId)
        );
        if (!nextStatus) return { ...agenda, confirmacoes: filtered, meuAmigoSecreto: null };
        return {
          ...agenda,
          confirmacoes: [
            ...filtered,
            {
              id: `${agendaId}-${effectiveUserId}`,
              status: nextStatus,
              observacao: currentResponse?.observacao || "",
              colaborador: eu,
            },
          ],
        };
      });

    const previousAgendas = presencialAgendas;
    writePresencialState(currentProfile?.id, applyResponse);
    invalidateAdminListCache();

    if (!isSupabaseEnabled) {
      return;
    }

    try {
      if (!nextStatus) {
        const { error } = await supabase
          .from("presencial_confirmacoes")
          .delete()
          .eq("agenda_id", agendaId)
          .eq("colaborador_id", effectiveUserId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("presencial_confirmacoes").upsert(
          {
            agenda_id: agendaId,
            colaborador_id: effectiveUserId,
            status: nextStatus,
          },
          {
            onConflict: "agenda_id,colaborador_id",
            ignoreDuplicates: false,
          }
        );
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      writePresencialState(currentProfile?.id, () => previousAgendas);
      throw error;
    }
  };

  const handleTogglePresencialSecretSanta = async (agendaId, shouldParticipate) => {
    const effectiveUserId = currentProfile?.id || eu.id;
    if (!effectiveUserId || !agendaId) return;

    const currentAgenda = (presencialAgendas || []).find((agenda) => String(agenda.id) === String(agendaId));
    const currentResponse = (currentAgenda?.confirmacoes || []).find(
      (item) => String(item.colaborador?.id || "") === String(effectiveUserId)
    );
    if (!currentResponse) return;
    if (currentAgenda?.amigoSecretoSorteadoAt) return;

    const nextStatus = shouldParticipate ? "talvez" : "confirmado";
    const previousAgendas = presencialAgendas;

    writePresencialState(currentProfile?.id, (prev) =>
      prev.map((agenda) => {
        if (String(agenda.id) !== String(agendaId)) return agenda;
        return {
          ...agenda,
          confirmacoes: (agenda.confirmacoes || []).map((item) =>
            String(item.colaborador?.id || "") === String(effectiveUserId)
              ? { ...item, status: nextStatus }
              : item
          ),
          meuAmigoSecreto: shouldParticipate ? agenda.meuAmigoSecreto : null,
        };
      })
    );
    invalidateAdminListCache();

    if (!isSupabaseEnabled) return;

    try {
      const { error } = await supabase.from("presencial_confirmacoes").upsert(
        {
          agenda_id: agendaId,
          colaborador_id: effectiveUserId,
          status: nextStatus,
        },
        {
          onConflict: "agenda_id,colaborador_id",
          ignoreDuplicates: false,
        }
      );
      if (error) throw new Error(error.message);
    } catch (error) {
      writePresencialState(currentProfile?.id, () => previousAgendas);
      throw error;
    }
  };

  const handleRunPresencialSecretSanta = async (agendaId) => {
    if (!agendaId) return;

    if (!isSupabaseEnabled) {
      const currentUserId = currentProfile?.id || eu.id;
      const currentLookup = new Map((colaboradoresRef.current || []).map((item) => [String(item.id), item]));
      writePresencialState(currentProfile?.id, (prev) =>
        prev.map((agenda) => {
          if (String(agenda.id) !== String(agendaId) || !agenda.amigoSecretoAtivo || agenda.amigoSecretoSorteadoAt) return agenda;
          const participants = getPresencialSecretSantaParticipants(agenda);
          if (participants.length < 2) return agenda;
          const shuffled = [...participants].sort(() => Math.random() - 0.5);
          const assignmentMap = new Map(
            shuffled.map((item, index) => [
              String(item.colaborador?.id || ""),
              shuffled[(index + 1) % shuffled.length]?.colaborador || null,
            ])
          );
          return {
            ...agenda,
            amigoSecretoSorteadoAt: new Date().toISOString(),
            meuAmigoSecreto: assignmentMap.has(String(currentUserId))
              ? currentLookup.get(String(assignmentMap.get(String(currentUserId))?.id || "")) || assignmentMap.get(String(currentUserId))
              : null,
          };
        })
      );
      invalidateAdminListCache();
      return;
    }

    const { error } = await supabase.rpc("run_amigo_secreto_draw", { p_agenda_id: agendaId });
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    await loadPresencial(currentProfile?.id, { force: true });
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
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
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
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
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
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
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
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
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
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
  };

  const handleDeleteGaleriaFoto = async (fotoId) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("galeria_fotos").delete().eq("id", fotoId);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
  };

  const handleSetGaleriaCapa = async (eventoId, fotoUrl) => {
    if (!isSupabaseEnabled || !eventoId || !fotoUrl) return;
    const { error } = await supabase.from("galeria_eventos").update({ capa_url: fotoUrl }).eq("id", eventoId);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
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

    invalidateAdminListCache();
    loadGaleria(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar galerias:", err));
  };

  const handleEnviarMensagem = (texto) => {
    if (!isSupabaseEnabled || !currentProfile?.id) return { queued: false };
    const now = new Date();
    const optimisticId = `optimistic-${now.getTime()}`;
    const startedAt = performance.now();
    panzapPendingRef.current.set(optimisticId, { startedAt });
    logPanzapMetric("send_queued", {
      optimistic_id: optimisticId,
      text_size: String(texto || "").length,
    });
    const optimisticRow = {
      id: optimisticId,
      texto,
      hora: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      data: "Hoje",
      colaborador: toAvatar(currentProfile),
    };

    setMuralMsgs((prev) => [optimisticRow, ...(prev || [])]);

    Promise.resolve()
      .then(async () => {
        const { error } = await supabase.from("mural").insert({
          colaborador_id: currentProfile.id,
          texto,
        });
        if (error) throw new Error(error.message);
      })
      .then(() => {
        const pending = panzapPendingRef.current.get(optimisticId);
        if (pending) {
          logPanzapMetric("send_persisted", {
            optimistic_id: optimisticId,
            persistence_latency_ms: Math.round(performance.now() - pending.startedAt),
          });
          pending.persistedAt = performance.now();
          panzapPendingRef.current.set(optimisticId, pending);
          setTimeout(() => {
            panzapPendingRef.current.delete(optimisticId);
          }, 60000);
        }
        setMuralMsgs((prev) =>
          (prev || []).map((row) => (row.id === optimisticId ? { ...row, pending: false } : row))
        );
      })
      .catch((error) => {
        console.error("Falha ao enviar PanZap:", error);
        const pending = panzapPendingRef.current.get(optimisticId);
        logPanzapMetric("send_failed", {
          optimistic_id: optimisticId,
          latency_ms: pending ? Math.round(performance.now() - pending.startedAt) : null,
          error: String(error?.message || error || "unknown_error"),
        });
        panzapPendingRef.current.delete(optimisticId);
        setMuralMsgs((prev) =>
          (prev || []).map((row) => (row.id === optimisticId ? { ...row, pending: false, erroEnvio: true } : row))
        );
      })
      .finally(() => {
        invalidateAdminListCache();
        scheduleMuralSync(5000);
      });

    return { queued: true };
  };

  const handleDeleteMuralMensagem = async (id) => {
    if (!isSupabaseEnabled) return;
    const { error } = await supabase.from("mural").delete().eq("id", id);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadMural(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar mural:", err));
  };

  const handleDeleteMuralMensagens = async (ids) => {
    if (!isSupabaseEnabled) return;
    const validIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (validIds.length === 0) return;
    const { error } = await supabase.from("mural").delete().in("id", validIds);
    if (error) throw new Error(error.message);
    invalidateAdminListCache();
    loadMural(currentProfile?.id, { force: true }).catch((err) => console.error("Falha ao atualizar mural:", err));
  };

  const handleDeleteColaborador = useCallback(
    async (colaboradorId, options = {}) => {
      if (!isSupabaseEnabled || !currentProfile?.id) return;
      const { optimisticOnly = false, rollback = false } = options || {};
      const targetId = String(colaboradorId || "").trim();

      if (targetId) {
        // Remove immediately from visible state to avoid stale ghost cards.
        setColaboradores((prev) => (prev || []).filter((row) => String(row.id) !== targetId));
        setFerias((prev) => (prev || []).filter((item) => String(item?.colaborador?.id || "") !== targetId));
        setDayoff((prev) => (prev || []).filter((item) => String(item?.colaborador?.id || "") !== targetId));
        setAniversariantes((prev) => (prev || []).filter((item) => String(item?.colaborador?.id || "") !== targetId));
        setPresencialAgendas((prev) =>
          (prev || []).map((agenda) => ({
            ...agenda,
            confirmacoes: (agenda.confirmacoes || []).filter((item) => String(item?.colaborador?.id || "") !== targetId),
          }))
        );
        setMuralMsgs((prev) => (prev || []).filter((item) => String(item?.colaborador?.id || "") !== targetId));
        setPostagens((prev) =>
          (prev || []).map((post) => ({
            ...post,
            comentarios: (post.comentarios || []).filter((comment) => String(comment?.autor?.id || "") !== targetId),
            curtidas: (post.curtidas || []).filter((id) => String(id) !== targetId),
          }))
        );

        // Keep local cache coherent after deletion to avoid slow full refetch on F5.
        mutateCachedDomain(currentProfile.id, "colaboradores", (prev) =>
          Array.isArray(prev) ? prev.filter((row) => String(row?.id || "") !== targetId) : []
        );
        mutateCachedDomain(currentProfile.id, "ferias", (prev) => {
          const payload = prev && typeof prev === "object" ? prev : { ferias: [], dayoff: [] };
          return {
            ferias: Array.isArray(payload.ferias)
              ? payload.ferias.filter((item) => String(item?.colaborador?.id || "") !== targetId)
              : [],
            dayoff: Array.isArray(payload.dayoff)
              ? payload.dayoff.filter((item) => String(item?.colaborador?.id || "") !== targetId)
              : [],
          };
        });
        mutateCachedDomain(currentProfile.id, "aniversarios", (prev) =>
          Array.isArray(prev) ? prev.filter((item) => String(item?.colaborador?.id || "") !== targetId) : []
        );
        mutateCachedDomain(currentProfile.id, "presencial", (prev) =>
          Array.isArray(prev)
            ? prev.map((agenda) => ({
              ...agenda,
              confirmacoes: (agenda.confirmacoes || []).filter((item) => String(item?.colaborador?.id || "") !== targetId),
            }))
            : []
        );
        mutateCachedDomain(currentProfile.id, "mural", (prev) =>
          Array.isArray(prev) ? prev.filter((item) => String(item?.colaborador?.id || "") !== targetId) : []
        );
        mutateCachedDomain(currentProfile.id, "postagens", (prev) =>
          Array.isArray(prev)
            ? prev.map((post) => ({
              ...post,
              comentarios: (post.comentarios || []).filter((comment) => String(comment?.autor?.id || "") !== targetId),
              curtidas: (post.curtidas || []).filter((id) => String(id) !== targetId),
            }))
            : []
        );
      }

      invalidateAdminListCache();
      if (!targetId || rollback) invalidateUserBusinessCaches(currentProfile.id);

      if (optimisticOnly && !rollback) return;

      Promise.allSettled([
        loadColaboradores(currentProfile.id, { force: true }),
        loadFerias(currentProfile.id, { force: true }),
        loadPresencial(currentProfile.id, { force: true }),
        loadAniversarios(currentProfile.id, { force: true }),
        loadMural(currentProfile.id, { force: true }),
        loadPostagens(currentProfile.id, { force: true }),
      ]).then((results) => {
        results.forEach((result) => {
          if (result.status === "rejected") {
            console.warn("Falha ao reconciliar dados após exclusão de colaborador:", result.reason?.message || result.reason);
          }
        });
      });
    },
    [
      currentProfile?.id,
      invalidateAdminListCache,
      invalidateUserBusinessCaches,
      loadAniversarios,
      loadColaboradores,
      loadFerias,
      loadPresencial,
      loadMural,
      loadPostagens,
    ]
  );

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
      const { data: publicData } = supabase.storage.from("avatares").getPublicUrl(uploadedAvatarPath);
      if (publicData?.publicUrl) {
        updatePayload.foto_url = publicData.publicUrl;
      }
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

    if (uploadedAvatarPath && previousAvatarPath && previousAvatarPath !== uploadedAvatarPath) {
      supabase.storage
        .from("avatares")
        .remove([previousAvatarPath])
        .catch((err) => console.warn("Falha ao remover avatar antigo:", err?.message || err));
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

  const handleLogout = () => {
    clearStoredSupabaseSession();
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
        currentUserId={currentProfile?.id || eu.id}
      />
    ),
    postagens: <PostagensPage onOpen={handleOpenPost} currentUserId={currentProfile?.id} />,
    post_detalhe: (
      <PostDetalhePage
        post={selectedPost}
        currentUser={eu}
        currentUserId={currentProfile?.id || eu.id}
        onVoltar={() => navigateTo("postagens")}
        onToggleCurtida={handleToggleCurtida}
        onComentar={handleComentar}
        onEditarComentario={handleEditarComentario}
        onDeletarComentario={handleDeletarComentario}
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
    colaboradores: <ColaboradoresPage currentUserId={currentProfile?.id} />,
    aniversarios: (
      <AniversariosPage
        currentUserId={currentProfile?.id || eu.id}
      />
    ),
    ferias: <FeriasPage currentUserId={currentProfile?.id} />,
    presencial: <PresencialPage currentUserId={currentProfile?.id || eu.id} />,
    galeria: <GaleriaPage currentUserId={currentProfile?.id} />,
    perfil: <PerfilPage profile={currentProfile} onSalvar={handleSalvarPerfil} />,
    admin: (
      <AdminPage
        aba={adminAba}
        onChangeAba={(aba) => navigateTo("admin", aba)}
        currentProfile={currentProfile}
        postagens={postagens}
        setPostagens={setPostagens}
        ferias={ferias}
        dayoff={dayoff}
        colaboradores={colaboradores}
        currentUserId={currentProfile?.id}
        onCreatePost={handleCreatePost}
        onUpdatePost={handleUpdatePost}
        onDeletePost={handleDeletePost}
        onListPostagens={listAdminPostagens}
        onCreateFerias={handleCreateFerias}
        onUpdateFerias={handleUpdateFerias}
        onDeleteFerias={handleDeleteFerias}
        onListFerias={listAdminFerias}
        ausencias={ausencias}
        onCreateAusencia={handleCreateAusencia}
        onUpdateAusencia={handleUpdateAusencia}
        onDeleteAusencia={handleDeleteAusencia}
        onListAusencias={listAdminAusencias}
        presencialAgendas={presencialAgendas}
        onCreatePresencialAgenda={handleCreatePresencialAgenda}
        onUpdatePresencialAgenda={handleUpdatePresencialAgenda}
        onDeletePresencialAgenda={handleDeletePresencialAgenda}
        onListPresencial={listAdminPresencial}
        onRunPresencialSecretSanta={handleRunPresencialSecretSanta}
        galeriaEventos={galeriaEventos}
        onCreateGaleriaEvento={handleCreateGaleriaEvento}
        onUpdateGaleriaEvento={handleUpdateGaleriaEvento}
        onDeleteGaleriaEvento={handleDeleteGaleriaEvento}
        onListGaleria={listAdminGaleria}
        onAddGaleriaFoto={handleAddGaleriaFoto}
        onUpdateGaleriaFoto={handleUpdateGaleriaFoto}
        onDeleteGaleriaFoto={handleDeleteGaleriaFoto}
        onUploadGaleriaFotos={handleUploadGaleriaFotos}
        onSetGaleriaCapa={handleSetGaleriaCapa}
        muralMsgs={muralMsgs}
        onDeleteMuralMensagem={handleDeleteMuralMensagem}
        onDeleteMuralMensagens={handleDeleteMuralMensagens}
        onDeleteColaborador={handleDeleteColaborador}
        onListMural={listAdminMural}
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





import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase.js";

// ─── Network ──────────────────────────────────────────────────────────────────
export const parseFunctionInvokeError = async (error, fallbackMessage) => {
  if (!error) return fallbackMessage;
  try {
    const context = error.context;
    if (context && typeof context.text === "function") {
      const raw = await context.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.error) return String(parsed.error);
          if (parsed?.message) return String(parsed.message);
        } catch (_err) {
          return raw;
        }
      }
    }
  } catch (_err) {
    // ignore
  }
  return error?.message || fallbackMessage;
};

export const isJwtSessionError = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("invalid jwt") || msg.includes("jwt expired") || msg.includes("session expired");
};

export const invokeAdminFunctionHttp = async (fnName, body, accessToken, fallbackMessage) => {
  const fnBaseUrl = String(SUPABASE_URL || "").replace(/\/$/, "");
  if (!fnBaseUrl) throw new Error(fallbackMessage || "Supabase URL ausente.");
  if (!SUPABASE_ANON_KEY) throw new Error(fallbackMessage || "Supabase anon key ausente.");
  const response = await fetch(`${fnBaseUrl}/functions/v1/${fnName}`, {
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
    try {
      parsed = JSON.parse(rawText);
    } catch (_err) {
      parsed = { message: rawText };
    }
  }

  if (!response.ok) {
    const message =
      parsed?.error || parsed?.message || rawText || fallbackMessage || "Não foi possível concluir a ação.";
    throw new Error(String(message));
  }
  return parsed || {};
};

// ─── Cache ────────────────────────────────────────────────────────────────────
export const ADMIN_COLABS_CACHE_KEY = "panet.admin.colaboradores.cache.v2";
export const PAGE_SIZE = 20;

export const escapePostgrestLike = (value) =>
  String(value || "")
    .replace(/[,*().]/g, " ")
    .trim();

export const readCachedAdminColaboradores = (queryKey) => {
  try {
    const raw = sessionStorage.getItem(ADMIN_COLABS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const entry = parsed[queryKey];
    if (!entry || typeof entry !== "object") return null;
    if (!Array.isArray(entry.rows)) return null;
    return { rows: entry.rows, total: Number(entry.total || 0) };
  } catch (_err) {
    return null;
  }
};

export const writeCachedAdminColaboradores = (queryKey, rows, total) => {
  try {
    if (!queryKey || !Array.isArray(rows)) return;
    const raw = sessionStorage.getItem(ADMIN_COLABS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === "object" ? parsed : {};
    next[queryKey] = { rows, total: Number(total || 0), at: Date.now() };
    sessionStorage.setItem(ADMIN_COLABS_CACHE_KEY, JSON.stringify(next));
  } catch (_err) {
    // ignore
  }
};

export const clearCachedAdminColaboradores = () => {
  try {
    sessionStorage.removeItem(ADMIN_COLABS_CACHE_KEY);
  } catch (_err) {
    // ignore
  }
};

// ─── Constants ────────────────────────────────────────────────────────────────
export const MODULES = [
  { id: "postagens", label: "PanNews" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "ferias", label: "PanOff" },
  { id: "presencial", label: "Eventos" },
  { id: "enquetes", label: "Enquetes" },
  { id: "galeria", label: "Galerias" },
  { id: "corridas", label: "Corridas" },
  { id: "panpass", label: "PanPass" },
];

export const MONTH_OPTIONS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

// ─── Data helpers ─────────────────────────────────────────────────────────────
export const getBirthdayParts = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { aniversarioDia: "", aniversarioMes: "" };
  const normalized = raw.slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return { aniversarioDia: match[3], aniversarioMes: match[2] };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { aniversarioDia: "", aniversarioMes: "" };
  return {
    aniversarioDia: String(parsed.getDate()).padStart(2, "0"),
    aniversarioMes: String(parsed.getMonth() + 1).padStart(2, "0"),
  };
};

export const toBirthdayIso = (dia, mes) => {
  if (!dia || !mes) return null;
  const year = new Date().getFullYear();
  return `${year}-${mes}-${dia}`;
};

export const mapProfileToRow = (profile, currentUserId) => {
  const iniciais = profile.nome
    ?.split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return {
    id: profile.id,
    nome: profile.nome,
    cargo: profile.cargo,
    aniversario: profile.aniversario || "",
    email: profile.email,
    telefone: profile.telefone || "",
    fotoUrl: profile.foto_url || "",
    cor: profile.cor_avatar || "#11E7E7",
    foto: iniciais || "U",
    perfil: profile.perfil || "colaborador",
    adminModulos: profile.admin_modulos ?? null,
    ativo: profile.ativo ?? true,
    isMe: profile.id === currentUserId,
    redes: {
      instagram: profile.instagram || "",
      linkedin: profile.linkedin || "",
      github: profile.github || "",
    },
  };
};

import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { resolvePublicMediaUrl } from "../../lib/storageMedia.js";
import { timeQuery } from "../../lib/queryTiming.js";

const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;

const toAvatar = (profile) => {
  const initials = profile?.nome
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return {
    id: profile?.id || null,
    nome: profile?.nome || "",
    cargo: profile?.cargo || "",
    email: profile?.email || "",
    telefone: profile?.telefone || "",
    aniversario: profile?.aniversario || null,
    fotoUrl: profile?.foto_url || "",
    foto_url: profile?.foto_url || "",
    foto: initials || "U",
    cor: profile?.cor_avatar || "#11E7E7",
    redes: {
      instagram: profile?.instagram || "",
      linkedin: profile?.linkedin || "",
      github: profile?.github || "",
    },
  };
};

const formatBrDate = (iso) => {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
};

const daysUntilBirthday = (isoDate) => {
  if (!isoDate) return Number.MAX_SAFE_INTEGER;
  const now = new Date();
  const target = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(target.getTime())) return Number.MAX_SAFE_INTEGER;
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const thisYearTarget = new Date(now.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  const next =
    thisYearTarget < todayNoon
      ? new Date(now.getFullYear() + 1, target.getMonth(), target.getDate(), 12, 0, 0)
      : thisYearTarget;
  const diffMs = next.getTime() - todayNoon.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

const mapDbPostSummaryToUi = (post, currentUserId) => {
  const likes = Array.isArray(post?.curtidas) ? post.curtidas.filter(Boolean) : [];
  return {
    id: post?.id,
    titulo: post?.titulo || "",
    descricao: post?.descricao || "",
    imagem: resolvePublicMediaUrl("postagens", post?.imagem_url, postImg(post?.id || "post")),
    categoria: post?.categoria || "Notícia",
    data: post?.data_post || null,
    curtidas: likes,
    comentarios: [],
    comentariosCount: Number(post?.comentarios_count || 0),
    userCurtiu:
      typeof post?.user_curtiu === "boolean"
        ? post.user_curtiu
        : likes.includes(currentUserId),
  };
};

const mapDbMuralToUi = (item) => {
  const date = new Date(item?.created_at || "");
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const hoje = new Date();
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  const label =
    validDate.toDateString() === hoje.toDateString()
      ? "Hoje"
      : validDate.toDateString() === ontem.toDateString()
        ? "Ontem"
        : validDate.toLocaleDateString("pt-BR");

  const rawColaborador = item?.colaborador || { id: item?.colaborador_id, nome: "Colaborador" };

  return {
    id: item?.id,
    texto: item?.texto || "",
    hora: validDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    data: label,
    colaborador: toAvatar(rawColaborador),
  };
};

const mapDbFeriasToUi = (item) => ({
  id: item?.id,
  inicio: formatBrDate(item?.inicio),
  fim: formatBrDate(item?.fim),
  status: item?.status || "marcado",
  tipo: item?.tipo || "ferias",
  colaborador: toAvatar(item?.colaborador),
});

const mapDbAusenciaToUi = (item) => ({
  id: item?.id,
  motivo: item?.motivo || "",
  inicio: item?.inicio || null,
  fim: item?.fim || null,
  diaTodo: Boolean(item?.dia_todo),
  colaborador: toAvatar(item?.colaborador),
});

const mapColaboradorBirthdayToUi = (item) => {
  const date = new Date(`${item?.aniversario}T12:00:00`);
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return {
    id: item?.id,
    colaborador: toAvatar(item),
    data: dateLabel,
    diasRestantes: daysUntilBirthday(item?.aniversario),
    reacoes: Array.isArray(item?.reacoes) ? item.reacoes.filter(Boolean) : [],
  };
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const isMissingExtendedSnapshotFunction = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("could not find the function public.get_dashboard_snapshot") ||
    (message.includes("get_dashboard_snapshot") && message.includes("does not exist"))
  );
};

// ─── Exportado para prefetch no login (AuthContext) ───────────────────────────
export function getDashboardSnapshotQueryOptions(userId, options = {}) {
  const safePostsLimit = Number.isFinite(Number(options?.postsLimit))
    ? Math.max(1, Math.min(100, Number(options.postsLimit)))
    : 20;
  const safeMuralLimit = Number.isFinite(Number(options?.muralLimit))
    ? Math.max(1, Math.min(200, Number(options.muralLimit)))
    : 60;
  const safeFeriasLimit = Number.isFinite(Number(options?.feriasLimit))
    ? Math.max(1, Math.min(500, Number(options.feriasLimit)))
    : 120;
  const safeAusenciasLimit = Number.isFinite(Number(options?.ausenciasLimit))
    ? Math.max(1, Math.min(500, Number(options.ausenciasLimit)))
    : 120;
  const safeColaboradoresLimit = Number.isFinite(Number(options?.colaboradoresLimit))
    ? Math.max(1, Math.min(1000, Number(options.colaboradoresLimit)))
    : 500;

  return {
    queryKey: [
      "dashboard-snapshot",
      userId,
      {
        postsLimit: safePostsLimit,
        muralLimit: safeMuralLimit,
        feriasLimit: safeFeriasLimit,
        ausenciasLimit: safeAusenciasLimit,
        colaboradoresLimit: safeColaboradoresLimit,
      },
    ],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let { data, error } = await timeQuery(`rpc get_dashboard_snapshot (posts=${safePostsLimit})`, () =>
        supabase.rpc("get_dashboard_snapshot", {
          p_posts_limit: safePostsLimit,
          p_mural_limit: safeMuralLimit,
          p_ferias_limit: safeFeriasLimit,
          p_ausencias_limit: safeAusenciasLimit,
          p_colaboradores_limit: safeColaboradoresLimit,
        })
      );
      if (error && isMissingExtendedSnapshotFunction(error)) {
        const fallback = await supabase.rpc("get_dashboard_snapshot", {
          p_posts_limit: safePostsLimit,
          p_mural_limit: safeMuralLimit,
        });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw new Error(error.message || "Não foi possível carregar o snapshot do dashboard.");

      let payload = data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch (_err) { payload = {}; }
      }
      if (!payload || typeof payload !== "object") payload = {};

      // Bucket "postagens" é público — URL direta de CDN, sem round-trip de assinatura.
      const postagens = safeArray(payload.postagens).map((post) =>
        mapDbPostSummaryToUi(post, userId)
      );
      const mural = safeArray(payload.mural).map(mapDbMuralToUi);
      const feriasRows = safeArray(payload.ferias).map(mapDbFeriasToUi);
      const ausencias = safeArray(payload.ausencias).map(mapDbAusenciaToUi);
      const aniversariantes = safeArray(payload.aniversarios)
        .map(mapColaboradorBirthdayToUi)
        .sort((a, b) => a.diasRestantes - b.diasRestantes);
      const colaboradores = safeArray(payload.colaboradores).map((item) => ({
        ...toAvatar(item),
        isMe: String(item?.id || "") === String(userId || ""),
      }));

      return {
        postagens,
        mural,
        feriasData: {
          ferias: feriasRows.filter((item) => item.tipo === "ferias"),
          dayoff: feriasRows.filter((item) => item.tipo === "dayoff"),
        },
        ausencias,
        aniversariantes,
        colaboradores,
      };
    },
  };
}

export function useDashboardSnapshot(userId, options = {}) {
  return useQuery({
    ...getDashboardSnapshotQueryOptions(userId, options),
    enabled: (options?.enabled ?? true) && Boolean(userId) && isSupabaseEnabled,
  });
}

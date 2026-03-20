import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { createSignedUrlMap, resolveSignedMediaUrl } from "../../lib/storageMedia.js";

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

const mapDbPostSummaryToUi = (post, currentUserId, signedUrlMap) => {
  const likes = Array.isArray(post?.curtidas) ? post.curtidas.filter(Boolean) : [];
  return {
    id: post?.id,
    titulo: post?.titulo || "",
    descricao: post?.descricao || "",
    imagem: resolveSignedMediaUrl("postagens", post?.imagem_url, signedUrlMap, postImg(post?.id || "post")),
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
  estimativa: item?.estimativa || null,
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

export function useDashboardSnapshot(userId, options = {}) {
  const safePostsLimit = Number.isFinite(Number(options?.postsLimit))
    ? Math.max(1, Math.min(100, Number(options.postsLimit)))
    : 20;
  const safeMuralLimit = Number.isFinite(Number(options?.muralLimit))
    ? Math.max(1, Math.min(200, Number(options.muralLimit)))
    : 60;

  return useQuery({
    queryKey: [
      "dashboard-snapshot",
      userId,
      { postsLimit: safePostsLimit, muralLimit: safeMuralLimit },
    ],
    enabled: Boolean(userId) && isSupabaseEnabled,
    staleTime: 45 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_snapshot", {
        p_posts_limit: safePostsLimit,
        p_mural_limit: safeMuralLimit,
      });
      if (error) throw new Error(error.message || "Não foi possível carregar o snapshot do dashboard.");

      let payload = data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (_err) {
          payload = {};
        }
      }
      if (!payload || typeof payload !== "object") payload = {};

      const signedUrlMap = await createSignedUrlMap(
        "postagens",
        safeArray(payload.postagens).map((post) => post?.imagem_url)
      );
      const postagens = safeArray(payload.postagens).map((post) =>
        mapDbPostSummaryToUi(post, userId, signedUrlMap)
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
  });
}

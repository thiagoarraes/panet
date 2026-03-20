import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { POSTAGENS_INIT } from "../../data/mockData.js";

const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;
const POST_CATEGORIES = new Set(["Notícia", "Comunicado", "Evento"]);
const escapeIlikeTerm = (value) => String(value || "").replace(/[\\%_]/g, (char) => `\\${char}`);

const mapDbPostSummaryToUi = (post, likesRows, commentsCount, currentUserId) => {
  const likes = (likesRows || []).map((c) => c.colaborador_id);
  return {
    id: post.id,
    titulo: post.titulo,
    descricao: post.descricao,
    imagem: post.imagem_url || postImg(post.id),
    categoria: post.categoria,
    data: post.data_post,
    curtidas: likes,
    comentarios: [],
    comentariosCount: Number(commentsCount || 0),
    userCurtiu: likes.includes(currentUserId),
  };
};

export function usePostagens(userId, options = {}) {
  const safeLimit = Number.isFinite(Number(options?.limit))
    ? Math.max(1, Math.min(200, Number(options.limit)))
    : null;
  const safeCategory = POST_CATEGORIES.has(String(options?.category || "")) ? String(options.category) : "";
  const safeSearch = String(options?.search || "").trim();
  const escapedSearch = safeSearch ? escapeIlikeTerm(safeSearch) : "";
  const summaryOnly = Boolean(options?.summaryOnly);
  const queryEnabled = options?.enabled ?? true;

  return useQuery({
    queryKey: [
      "postagens",
      userId,
      {
        limit: safeLimit,
        category: safeCategory,
        search: safeSearch.toLowerCase(),
        summaryOnly,
      },
    ],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return POSTAGENS_INIT;

      let postsQuery = supabase
        .from("postagens")
        .select("id,titulo,descricao,imagem_url,categoria,data_post,created_at")
        .order("data_post", { ascending: false })
        .order("created_at", { ascending: false });

      if (safeCategory) postsQuery = postsQuery.eq("categoria", safeCategory);
      if (escapedSearch) postsQuery = postsQuery.ilike("titulo", `%${escapedSearch}%`);
      if (safeLimit) postsQuery = postsQuery.limit(safeLimit);

      const { data: posts, error: postsError } = await postsQuery;
      if (postsError) throw new Error(postsError.message);

      const postagemIds = (posts || []).map((post) => post.id).filter(Boolean);
      if (postagemIds.length === 0) return [];

      if (summaryOnly) {
        return (posts || []).map((post) => mapDbPostSummaryToUi(post, [], 0, userId));
      }

      const [{ data: likesRows, error: likesError }, { data: commentsRows, error: commentsError }] =
        await Promise.all([
          supabase.from("curtidas").select("postagem_id,colaborador_id").in("postagem_id", postagemIds),
          supabase.from("comentarios").select("id,postagem_id").in("postagem_id", postagemIds),
        ]);

      if (likesError) throw new Error(likesError.message);
      if (commentsError) throw new Error(commentsError.message);

      const likesByPost = new Map();
      (likesRows || []).forEach((row) => {
        const key = String(row.postagem_id);
        likesByPost.set(key, [...(likesByPost.get(key) || []), row]);
      });

      const commentsCountByPost = new Map();
      (commentsRows || []).forEach((row) => {
        const key = String(row.postagem_id);
        commentsCountByPost.set(key, Number(commentsCountByPost.get(key) || 0) + 1);
      });

      return (posts || []).map((post) =>
        mapDbPostSummaryToUi(
          post,
          likesByPost.get(String(post.id)) || [],
          commentsCountByPost.get(String(post.id)) || 0,
          userId
        )
      );
    },
    staleTime: 2 * 60 * 1000,
    enabled: queryEnabled && (!!userId || !isSupabaseEnabled),
    placeholderData: (previousData) => previousData,
  });
}

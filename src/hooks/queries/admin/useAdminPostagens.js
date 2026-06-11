import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";
import { resolvePublicMediaUrl } from "../../../lib/storageMedia.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapePostgrestOrTerm = (value) =>
  String(value || "")
    .replace(/[,*().]/g, " ")
    .trim();

const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;

// ---------------------------------------------------------------------------
// useAdminPostagens
// ---------------------------------------------------------------------------

export function useAdminPostagens({ page = 1, pageSize = 20, search = "" } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const term = String(search || "").trim();

  return useQuery({
    queryKey: ["admin", "postagens", { page: safePage, pageSize: safePageSize, search: term }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return { rows: [], count: 0 };

      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;

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

      const [{ data, error }, { count }] = await Promise.all([rowsQuery.range(from, to), countQuery]);
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
          likesByPost.set(key, [...(likesByPost.get(key) || []), row.colaborador_id]);
        });
        (commentsRows || []).forEach((row) => {
          const key = String(row.postagem_id);
          commentsByPost.set(key, [...(commentsByPost.get(key) || []), { id: row.id }]);
        });
      }

      const rows = (data || []).map((post) => {
        const key = String(post.id);
        return {
          id: post.id,
          titulo: post.titulo,
          descricao: post.descricao,
          imagem: resolvePublicMediaUrl("postagens", post.imagem_url, postImg(post.id)),
          categoria: post.categoria,
          data: post.data_post,
          curtidas: likesByPost.get(key) || [],
          comentarios: commentsByPost.get(key) || [],
          userCurtiu: false,
        };
      });
      const safeCount = Number.isFinite(count) ? Number(count) : from + rows.length;
      return { rows, count: safeCount };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled,
  });
}

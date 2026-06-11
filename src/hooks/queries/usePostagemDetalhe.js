import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { POSTAGENS_INIT } from "../../data/mockData.js";
import { resolvePublicMediaUrl } from "../../lib/storageMedia.js";

const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;

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

const mapDbPostToUi = (post, currentUserId) => {
  const likes = (post?.curtidas || []).map((item) => item.colaborador_id);
  const comments = (post?.comentarios || []).map((item) => ({
    id: item.id,
    texto: item.texto,
    editado: Boolean(item.editado),
    hora: new Date(item.created_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    autor: toAvatar(item.colaborador),
  }));

  return {
    id: post.id,
    titulo: post.titulo,
    descricao: post.descricao,
    imagem: resolvePublicMediaUrl("postagens", post.imagem_url, postImg(post.id)),
    categoria: post.categoria,
    data: post.data_post,
    curtidas: likes,
    comentarios: comments,
    comentariosCount: comments.length,
    userCurtiu: likes.includes(currentUserId),
  };
};

export function usePostagemDetalhe(userId, postId) {
  return useQuery({
    queryKey: ["postagem", userId, postId],
    queryFn: async () => {
      if (!postId) return null;
      if (!isSupabaseEnabled || !supabase) {
        return POSTAGENS_INIT.find((post) => String(post.id) === String(postId)) || null;
      }

      const { data, error } = await supabase
        .from("postagens")
        .select(
          "id,titulo,descricao,imagem_url,categoria,data_post,curtidas(colaborador_id),comentarios(id,postagem_id,texto,editado,created_at,colaborador:colaboradores!comentarios_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github))"
        )
        .eq("id", postId)
        .order("created_at", { foreignTable: "comentarios", ascending: true })
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapDbPostToUi(data, userId);
    },
    enabled: (!!userId && !!postId) || !isSupabaseEnabled,
    staleTime: 30 * 1000,
  });
}

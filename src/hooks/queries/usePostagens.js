import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { POSTAGENS_INIT } from "../../data/mockData.js";

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

const mapDbPostToUi = (post, likesRows, commentsRows, currentUserId) => {
  const likes = (likesRows || []).map((c) => c.colaborador_id);
  const comments = (commentsRows || []).map((c) => ({
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

export function usePostagens(userId) {
  return useQuery({
    queryKey: ["postagens", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return POSTAGENS_INIT;

      const { data: posts, error: postsError } = await supabase
        .from("postagens")
        .select(
          "id,titulo,descricao,imagem_url,categoria,data_post,created_at,curtidas(colaborador_id),comentarios(id,postagem_id,texto,editado,created_at,colaborador:colaboradores!comentarios_colaborador_id_fkey(id,nome,cargo,email,telefone,cor_avatar,foto_url,instagram,linkedin,github))"
        )
        .order("data_post", { ascending: false })
        .order("created_at", { ascending: false })
        .order("created_at", { foreignTable: "comentarios", ascending: true });

      if (postsError) throw new Error(postsError.message);

      return (posts || []).map((post) =>
        mapDbPostToUi(post, post.curtidas, post.comentarios, userId)
      );
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!userId || !isSupabaseEnabled,
  });
}

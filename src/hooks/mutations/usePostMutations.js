import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { getPostStoragePathFromUrl } from "../../lib/imageUtils.js";
import { normalizeStoredMediaValue } from "../../lib/storageMedia.js";

const isDataImageUrl = (value) =>
  /^data:image\//i.test(String(value || "").trim());

const invalidatePostagens = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["postagens"] });
  queryClient.invalidateQueries({ queryKey: ["postagens-slug-index"] });
  queryClient.invalidateQueries({ queryKey: ["postagem"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "postagens"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
};

export function useToggleCurtida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, userId, alreadyLiked }) => {
      if (!isSupabaseEnabled || !supabase) return;
      if (alreadyLiked) {
        const { error } = await supabase
          .from("curtidas")
          .delete()
          .eq("postagem_id", postId)
          .eq("colaborador_id", userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("curtidas")
          .insert({ postagem_id: postId, colaborador_id: userId });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

export function useComentar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, userId, texto }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase
        .from("comentarios")
        .insert({ postagem_id: postId, colaborador_id: userId, texto });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

export function useEditarComentario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comentarioId, userId, novoTexto }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase
        .from("comentarios")
        .update({ texto: novoTexto, editado: true, updated_at: new Date().toISOString() })
        .eq("id", comentarioId)
        .eq("colaborador_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

export function useDeletarComentario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comentarioId, userId }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase
        .from("comentarios")
        .delete()
        .eq("id", comentarioId)
        .eq("colaborador_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ payload, userId }) => {
      if (!isSupabaseEnabled || !supabase) return;

      let imagemUrl = payload.imagem || null;
      if (isDataImageUrl(imagemUrl)) {
        try {
          const sourceBlob = await fetch(imagemUrl).then((res) => res.blob());
          const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
          const { error: uploadError } = await supabase.storage
            .from("postagens")
            .upload(storagePath, sourceBlob, { contentType: "image/webp" });
          if (uploadError) throw uploadError;
          imagemUrl = storagePath;
        } catch (err) {
          console.error(
            "Falha ao enviar a capa do post para o Storage:",
            err?.message || err
          );
          throw new Error(
            "Não foi possível enviar a imagem de capa. Verifique sua conexão e tente novamente."
          );
        }
      }

      imagemUrl = normalizeStoredMediaValue("postagens", imagemUrl);

      const { error } = await supabase.from("postagens").insert({
        titulo: payload.titulo,
        descricao: payload.descricao,
        imagem_url: imagemUrl,
        categoria: payload.categoria,
        data_post: payload.data,
        autor_id: userId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, payload, userId, previousImageUrl }) => {
      if (!isSupabaseEnabled || !supabase) return;

      let imagemUrl = payload.imagem || null;
      let uploadedPostPath = "";

      if (isDataImageUrl(imagemUrl)) {
        try {
          const sourceBlob = await fetch(imagemUrl).then((res) => res.blob());
          uploadedPostPath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
          const { error: uploadError } = await supabase.storage
            .from("postagens")
            .upload(uploadedPostPath, sourceBlob, { contentType: "image/webp" });
          if (uploadError) throw uploadError;
          imagemUrl = uploadedPostPath;
        } catch (err) {
          console.error(
            "Falha ao enviar a capa do post para o Storage:",
            err?.message || err
          );
          throw new Error(
            "Não foi possível enviar a imagem de capa. Verifique sua conexão e tente novamente."
          );
        }
      }

      imagemUrl = normalizeStoredMediaValue("postagens", imagemUrl);

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
          supabase.storage
            .from("postagens")
            .remove([uploadedPostPath])
            .catch(() => {});
        }
        throw new Error(error.message);
      }

      const previousPath = getPostStoragePathFromUrl(previousImageUrl);
      const nextPath = getPostStoragePathFromUrl(imagemUrl);
      if (previousPath && previousPath !== nextPath) {
        supabase.storage
          .from("postagens")
          .remove([previousPath])
          .catch((err) =>
            console.warn("Falha ao remover capa antiga do post:", err?.message || err)
          );
      }
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, previousImageUrl }) => {
      if (!isSupabaseEnabled || !supabase) return;

      const { error } = await supabase
        .from("postagens")
        .delete()
        .eq("id", postId);
      if (error) throw new Error(error.message);

      const previousPath = getPostStoragePathFromUrl(previousImageUrl);
      if (previousPath) {
        supabase.storage
          .from("postagens")
          .remove([previousPath])
          .catch((err) =>
            console.warn("Falha ao remover capa do post excluído:", err?.message || err)
          );
      }
    },
    onSuccess: () => invalidatePostagens(queryClient),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Helpers (mirrors Layout.jsx + useMural.js)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// useEnviarMensagem
// ---------------------------------------------------------------------------

export function useEnviarMensagem(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ texto, currentProfile }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("mural").insert({
        colaborador_id: currentProfile.id,
        texto,
      });
      if (error) throw new Error(error.message);
    },

    onMutate: async ({ texto, currentProfile }) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ["mural", userId] });

      // Snapshot previous state for rollback on error
      const previousMural = queryClient.getQueryData(["mural", userId]);

      const now = new Date();
      const optimisticId = `optimistic-${now.getTime()}`;
      const optimisticMsg = {
        id: optimisticId,
        texto,
        hora: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        data: "Hoje",
        colaborador: toAvatar(currentProfile),
        pending: true,
      };

      queryClient.setQueryData(["mural", userId], (prev) => {
        return [optimisticMsg, ...(Array.isArray(prev) ? prev : [])];
      });

      return { previousMural, optimisticId };
    },

    onError: (_err, { texto }, context) => {
      // Mark the optimistic message as failed instead of removing it
      if (context?.optimisticId) {
        queryClient.setQueryData(["mural", userId], (prev) =>
          (Array.isArray(prev) ? prev : []).map((row) =>
            row.id === context.optimisticId
              ? { ...row, pending: false, erroEnvio: true }
              : row
          )
        );
      }
    },

    onSettled: () => {
      // Fallback sync after 5s — mirrors scheduleMuralSync(5000)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["mural", userId] });
      }, 5000);
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteMuralMensagem
// ---------------------------------------------------------------------------

export function useDeleteMuralMensagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("mural").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteMuralMensagens
// ---------------------------------------------------------------------------

export function useDeleteMuralMensagens() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids) => {
      if (!isSupabaseEnabled || !supabase) return;
      const validIds = Array.from(new Set((ids || []).filter(Boolean)));
      if (validIds.length === 0) return;
      const { error } = await supabase.from("mural").delete().in("id", validIds);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });
}

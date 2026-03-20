import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

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

const pushMuralMessageToSnapshot = (snapshot, message) => {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const mural = Array.isArray(snapshot.mural) ? snapshot.mural : [];
  return {
    ...snapshot,
    mural: [message, ...mural].slice(0, 200),
  };
};

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
      await queryClient.cancelQueries({ queryKey: ["mural", userId] });
      await queryClient.cancelQueries({ queryKey: ["dashboard-snapshot", userId] });

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

      queryClient.setQueryData(["mural", userId], (prev) => [
        optimisticMsg,
        ...(Array.isArray(prev) ? prev : []),
      ]);
      queryClient.setQueriesData(
        { queryKey: ["dashboard-snapshot", userId] },
        (prev) => pushMuralMessageToSnapshot(prev, optimisticMsg)
      );

      return { previousMural, optimisticId };
    },
    onError: (_err, _vars, context) => {
      if (!context?.optimisticId) return;

      queryClient.setQueryData(["mural", userId], (prev) =>
        (Array.isArray(prev) ? prev : []).map((row) =>
          row.id === context.optimisticId
            ? { ...row, pending: false, erroEnvio: true }
            : row
        )
      );
      queryClient.setQueriesData({ queryKey: ["dashboard-snapshot", userId] }, (prev) => {
        if (!prev || typeof prev !== "object") return prev;
        const mural = Array.isArray(prev.mural) ? prev.mural : [];
        return {
          ...prev,
          mural: mural.map((row) =>
            row.id === context.optimisticId
              ? { ...row, pending: false, erroEnvio: true }
              : row
          ),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot", userId] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["mural", userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot", userId] });
      }, 5000);
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    },
  });
}

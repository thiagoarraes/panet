import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

const toggleBirthdayReaction = (items, aniversarianteId, userId) => {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (String(item.colaborador?.id || item.id) !== String(aniversarianteId)) return item;
    const reacoes = Array.isArray(item.reacoes) ? item.reacoes : [];
    const alreadyReacted = reacoes.includes(userId);
    return {
      ...item,
      reacoes: alreadyReacted
        ? reacoes.filter((id) => id !== userId)
        : [...reacoes, userId],
    };
  });
};

export function useParabenizarAniversario(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ aniversarianteId, alreadyReacted }) => {
      if (!isSupabaseEnabled || !supabase) return { added: !alreadyReacted };
      const currentYear = new Date().getFullYear();
      const { error } = alreadyReacted
        ? await supabase
            .from("aniversario_parabenizacoes")
            .delete()
            .eq("aniversariante_id", aniversarianteId)
            .eq("colaborador_id", userId)
            .eq("ano_ref", currentYear)
        : await supabase.from("aniversario_parabenizacoes").upsert(
            {
              aniversariante_id: aniversarianteId,
              colaborador_id: userId,
              ano_ref: currentYear,
            },
            {
              onConflict: "aniversariante_id,colaborador_id,ano_ref",
              ignoreDuplicates: true,
            }
          );
      if (error) throw new Error(error.message);
      return { added: !alreadyReacted };
    },
    onMutate: async ({ aniversarianteId }) => {
      await queryClient.cancelQueries({ queryKey: ["aniversarios", userId] });
      await queryClient.cancelQueries({ queryKey: ["dashboard-snapshot", userId] });

      const previous = queryClient.getQueryData(["aniversarios", userId]);
      const previousSnapshots = queryClient.getQueriesData({
        queryKey: ["dashboard-snapshot", userId],
      });

      queryClient.setQueryData(["aniversarios", userId], (prev) =>
        toggleBirthdayReaction(prev, aniversarianteId, userId)
      );
      queryClient.setQueriesData({ queryKey: ["dashboard-snapshot", userId] }, (prev) => {
        if (!prev || typeof prev !== "object") return prev;
        return {
          ...prev,
          aniversariantes: toggleBirthdayReaction(prev.aniversariantes, aniversarianteId, userId),
        };
      });

      return { previous, previousSnapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["aniversarios", userId], context.previous);
      }
      if (Array.isArray(context?.previousSnapshots)) {
        context.previousSnapshots.forEach(([key, value]) => {
          queryClient.setQueryData(key, value);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["aniversarios"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot", userId] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

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
      const previous = queryClient.getQueryData(["aniversarios", userId]);

      queryClient.setQueryData(["aniversarios", userId], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((item) => {
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
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["aniversarios", userId], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["aniversarios"] }),
  });
}

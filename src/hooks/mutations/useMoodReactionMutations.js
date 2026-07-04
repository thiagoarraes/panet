import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { getCurrentMoodDateKey } from "../../lib/dashboardMood.js";

const UNIQUE_VIOLATION = "23505";

export function useToggleMoodReaction(userId, options = {}) {
  const queryClient = useQueryClient();
  const dateKey = String(options?.dateKey || getCurrentMoodDateKey());

  return useMutation({
    mutationFn: async ({ checkinId, emoji, existingReactionId }) => {
      if (!isSupabaseEnabled || !supabase) {
        throw new Error("Reacoes disponiveis apenas com o Supabase configurado.");
      }

      if (existingReactionId) {
        const { error } = await supabase.from("humor_reacoes").delete().eq("id", existingReactionId);
        if (error) throw new Error(error.message || "Nao foi possivel remover a reacao.");
        return { removed: true, id: existingReactionId };
      }

      const { data, error } = await supabase
        .from("humor_reacoes")
        .insert({ checkin_id: checkinId, colaborador_id: userId, emoji })
        .select("id,checkin_id,colaborador_id,emoji")
        .single();

      if (error) {
        // Clique duplo: reação já existe — trata como sucesso silencioso.
        if (error.code === UNIQUE_VIOLATION) return { removed: false, duplicated: true };
        throw new Error(error.message || "Nao foi possivel reagir.");
      }

      return { removed: false, reaction: data };
    },
    onMutate: async ({ checkinId, emoji, existingReactionId }) => {
      const cacheKey = ["mood-reactions", dateKey];
      await queryClient.cancelQueries({ queryKey: cacheKey });

      const previousReactions = queryClient.getQueryData(cacheKey);

      queryClient.setQueryData(cacheKey, (reactions) => {
        const list = Array.isArray(reactions) ? reactions : [];
        if (existingReactionId) {
          return list.filter((reaction) => String(reaction.id) !== String(existingReactionId));
        }
        return [
          ...list,
          {
            id: `optimistic-reaction-${Date.now()}`,
            checkinId,
            colaboradorId: userId,
            emoji,
          },
        ];
      });

      return { cacheKey, previousReactions };
    },
    onError: (_error, _variables, context) => {
      if (!context?.cacheKey) return;
      queryClient.setQueryData(context.cacheKey, context.previousReactions);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context?.cacheKey) return;
      queryClient.invalidateQueries({ queryKey: context.cacheKey });
    },
  });
}

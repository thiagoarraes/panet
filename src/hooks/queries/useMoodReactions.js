import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { getCurrentMoodDateKey } from "../../lib/dashboardMood.js";

const normalizeReaction = (row) => ({
  id: row?.id,
  checkinId: row?.checkin_id ?? row?.checkinId ?? null,
  colaboradorId: row?.colaborador_id ?? row?.colaboradorId ?? null,
  emoji: String(row?.emoji || ""),
});

export function useMoodReactions(userId, options = {}) {
  const queryClient = useQueryClient();
  const queryEnabled = options?.enabled ?? true;
  const dateKey = String(options?.dateKey || getCurrentMoodDateKey());

  const query = useQuery({
    queryKey: ["mood-reactions", dateKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("humor_reacoes")
        .select("id,checkin_id,colaborador_id,emoji,humor_checkins!inner(data_ref)")
        .eq("humor_checkins.data_ref", dateKey);

      if (error) throw new Error(error.message || "Nao foi possivel carregar as reacoes.");

      return (data || []).map(normalizeReaction);
    },
    // ponytail: sem supabase, sem reações — o wall continua funcionando sem elas
    enabled: queryEnabled && isSupabaseEnabled && !!userId,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase || !userId) return;

    const channel = supabase
      .channel(`mood-reactions-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "humor_reacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mood-reactions", dateKey] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [dateKey, queryClient, queryEnabled, userId]);

  return query;
}

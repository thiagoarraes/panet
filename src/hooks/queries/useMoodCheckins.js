import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { getCurrentMoodDateKey, normalizeMoodEntry } from "../../lib/dashboardMood.js";
import { getStoredMoodCheckinsForDate } from "../../lib/dashboardMoodStorage.js";

const dedupeMoodEntriesByCollaborator = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  const seen = new Set();
  const deduped = [];

  for (const rawEntry of list) {
    const entry = normalizeMoodEntry(rawEntry);
    const key = entry.colaboradorId ? `col:${entry.colaboradorId}` : `id:${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
};

export function useMoodCheckins(userId, options = {}) {
  const queryClient = useQueryClient();
  const queryEnabled = options?.enabled ?? true;
  const dateKey = String(options?.dateKey || getCurrentMoodDateKey());
  const initialData = Array.isArray(options?.initialData)
    ? dedupeMoodEntriesByCollaborator(options.initialData)
    : undefined;

  const query = useQuery({
    queryKey: ["mood-checkins", userId, dateKey],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) {
        return getStoredMoodCheckinsForDate(dateKey);
      }

      const { data, error } = await supabase
        .from("humor_checkins")
        .select("id,colaborador_id,humor_id,energia,tags,data_ref,created_at,updated_at")
        .eq("data_ref", dateKey)
        .order("updated_at", { ascending: false });

      if (error) throw new Error(error.message || "Nao foi possivel carregar o painel de vibe.");

      return dedupeMoodEntriesByCollaborator(data || []);
    },
    enabled: queryEnabled && (!!userId || !isSupabaseEnabled),
    initialData,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase || !userId) return;

    const channel = supabase
      .channel(`mood-checkins-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "humor_checkins" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mood-checkins", userId, dateKey] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [dateKey, queryClient, queryEnabled, userId]);

  return query;
}

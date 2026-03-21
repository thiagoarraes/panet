import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { getCurrentMoodDateKey, getMoodWindowState, normalizeMoodEntry, upsertMoodEntry } from "../../lib/dashboardMood.js";
import { readStoredMoodCheckins, writeStoredMoodCheckins } from "../../lib/dashboardMoodStorage.js";

export function useSaveMoodCheckin(userId, options = {}) {
  const queryClient = useQueryClient();
  const dateKey = String(options?.dateKey || getCurrentMoodDateKey());

  return useMutation({
    mutationFn: async ({ colaboradorId, moodId, energy, tags }) => {
      const moodWindow = getMoodWindowState();
      if (!moodWindow.canSubmit) {
        throw new Error("O registro de vibes fica disponível das 08:00 às 18:00, no horário de Brasília.");
      }

      const activeDateKey = moodWindow.dateKey;
      const nowIso = new Date().toISOString();
      const baseEntry = normalizeMoodEntry({
        colaboradorId,
        moodId,
        energy,
        tags,
        dateKey: activeDateKey,
        updatedAt: nowIso,
      });

      if (!isSupabaseEnabled || !supabase) {
        const storedEntries = readStoredMoodCheckins();
        const existingEntry = storedEntries.find(
          (entry) =>
            String(entry.colaboradorId) === String(colaboradorId) &&
            String(entry.dateKey) === String(activeDateKey)
        );
        const localEntry = {
          ...baseEntry,
          id: existingEntry?.id || `local-mood-${colaboradorId}-${activeDateKey}`,
          createdAt: existingEntry?.createdAt || nowIso,
          updatedAt: nowIso,
        };

        writeStoredMoodCheckins(upsertMoodEntry(storedEntries, localEntry));
        return normalizeMoodEntry(localEntry);
      }

      const { data, error } = await supabase
        .from("humor_checkins")
        .upsert(
          {
            colaborador_id: colaboradorId,
            humor_id: baseEntry.moodId,
            energia: baseEntry.energy,
            tags: baseEntry.tags,
            data_ref: activeDateKey,
          },
          { onConflict: "colaborador_id,data_ref" }
        )
        .select("id,colaborador_id,humor_id,energia,tags,data_ref,created_at,updated_at")
        .single();

      if (error) throw new Error(error.message || "Nao foi possivel registrar sua vibe.");

      return normalizeMoodEntry(data);
    },
    onMutate: async ({ colaboradorId, moodId, energy, tags }) => {
      const cacheKey = ["mood-checkins", userId, dateKey];
      await queryClient.cancelQueries({ queryKey: cacheKey });

      const previousEntries = queryClient.getQueryData(cacheKey);
      const optimisticEntry = normalizeMoodEntry({
        id: `optimistic-mood-${Date.now()}`,
        colaboradorId,
        moodId,
        energy,
        tags,
        dateKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pending: true,
      });

      queryClient.setQueryData(cacheKey, (entries) => upsertMoodEntry(entries, optimisticEntry));
      return { cacheKey, previousEntries };
    },
    onError: (_error, _variables, context) => {
      if (!context?.cacheKey) return;
      queryClient.setQueryData(context.cacheKey, context.previousEntries);
    },
    onSuccess: (savedEntry, _variables, context) => {
      if (!context?.cacheKey) return;
      queryClient.setQueryData(context.cacheKey, (entries) => upsertMoodEntry(entries, savedEntry));
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context?.cacheKey) return;
      queryClient.invalidateQueries({ queryKey: context.cacheKey });
    },
  });
}

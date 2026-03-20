import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

const AUSENCIAS_KEYS = [["ausencias"], ["admin", "ausencias"]];

const invalidateAusencias = (queryClient) => {
  AUSENCIAS_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
};

export function useCreateAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("ausencias").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAusencias(queryClient),
  });
}

export function useUpdateAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("ausencias").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAusencias(queryClient),
  });
}

export function useDeleteAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("ausencias").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAusencias(queryClient),
  });
}

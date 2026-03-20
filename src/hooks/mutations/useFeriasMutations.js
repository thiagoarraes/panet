import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

const FERIAS_KEYS = [["ferias"], ["admin", "ferias"]];

const invalidateFerias = (queryClient) => {
  FERIAS_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
};

export function useCreateFerias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("ferias").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateFerias(queryClient),
  });
}

export function useUpdateFerias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("ferias").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateFerias(queryClient),
  });
}

export function useDeleteFerias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      if (!isSupabaseEnabled || !supabase) return;
      const { error } = await supabase.from("ferias").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateFerias(queryClient),
  });
}

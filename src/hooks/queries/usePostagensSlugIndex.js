import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { POSTAGENS_INIT } from "../../data/mockData.js";

export function usePostagensSlugIndex(userId) {
  return useQuery({
    queryKey: ["postagens-slug-index", userId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) {
        return (POSTAGENS_INIT || []).map((post) => ({
          id: post.id,
          titulo: post.titulo,
          data_post: post.data || null,
          created_at: null,
        }));
      }

      const { data, error } = await supabase
        .from("postagens")
        .select("id,titulo,data_post,created_at")
        .order("data_post", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId || !isSupabaseEnabled,
  });
}


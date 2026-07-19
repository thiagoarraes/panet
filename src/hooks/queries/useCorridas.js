import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";

// Corridas do próprio colaborador (widget do dashboard).
// Faz polling curto enquanto houver extração pendente para refletir o status.
export function useCorridas(currentUserId, { limit = 5 } = {}) {
  return useQuery({
    queryKey: ["corridas", currentUserId, { limit }],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase || !currentUserId) return [];
      const { data, error } = await supabase
        .from("corridas")
        .select("id,motivo,status_extracao,erro_extracao,origem,destino,horario,valor_total,created_at")
        .eq("colaborador_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: isSupabaseEnabled && Boolean(currentUserId),
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const rows = query.state.data;
      const hasPendente = Array.isArray(rows) && rows.some((r) => r.status_extracao === "pendente");
      return hasPendente ? 4000 : false;
    },
  });
}

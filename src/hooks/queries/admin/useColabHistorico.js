import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";

export function useColabHistorico(colaboradorId) {
  return useQuery({
    queryKey: ["admin", "colab-historico", colaboradorId],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase || !colaboradorId) {
        return { ferias: [], dayoff: [], ausencias: [] };
      }

      const [feriasResult, ausenciasResult] = await Promise.all([
        supabase
          .from("ferias")
          .select("id,inicio,fim,status,tipo")
          .eq("colaborador_id", colaboradorId)
          .order("inicio", { ascending: false }),
        supabase
          .from("ausencias")
          .select("id,motivo,inicio,fim,dia_todo,estimativa,created_at")
          .eq("colaborador_id", colaboradorId)
          .order("inicio", { ascending: false }),
      ]);

      if (feriasResult.error) throw feriasResult.error;
      if (ausenciasResult.error) throw ausenciasResult.error;

      const feriasAll = feriasResult.data || [];
      return {
        ferias: feriasAll.filter((x) => x.tipo === "ferias"),
        dayoff: feriasAll.filter((x) => x.tipo === "dayoff"),
        ausencias: ausenciasResult.data || [],
      };
    },
    staleTime: 30 * 1000,
    enabled: isSupabaseEnabled && Boolean(colaboradorId),
  });
}

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { buildEnqueteResult, isEnqueteEncerrada } from "../../lib/enquetes.js";

const mapEnqueteRow = (row) => ({
  id: row?.id || "",
  pergunta: row?.pergunta || "",
  mostrarResultadoParcial: Boolean(row?.mostrar_resultado_parcial),
  encerraEm: row?.encerra_em || null,
  encerradaEm: row?.encerrada_em || null,
  createdAt: row?.created_at || null,
});

export function useEnqueteAtiva(currentUserId, options = {}) {
  const queryClient = useQueryClient();
  const queryEnabled = options?.enabled ?? true;

  const query = useQuery({
    queryKey: ["enquete-ativa", currentUserId],
    enabled: queryEnabled && Boolean(currentUserId) && isSupabaseEnabled,
    // Realtime (postgres_changes abaixo) já mantém os dados atualizados;
    // o polling por refetchInterval era redundante e gerava carga extra.
    staleTime: 60 * 1000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data: enqueteAtivaRaw, error: enqueteError } = await supabase
        .from("enquetes")
        .select(
          `
            id,
            pergunta,
            mostrar_resultado_parcial,
            encerra_em,
            encerrada_em,
            created_at,
            enquete_opcoes(id,texto,ordem),
            enquete_votos(enquete_opcao_id,colaborador_id)
          `
        )
        .is("encerrada_em", null)
        .or(`encerra_em.is.null,encerra_em.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!enqueteError) {
        if (!enqueteAtivaRaw?.id) return null;
        const enquete = mapEnqueteRow(enqueteAtivaRaw);
        if (isEnqueteEncerrada(enquete)) return null;
        return buildEnqueteResult({
          enquete,
          opcoes: enqueteAtivaRaw.enquete_opcoes || [],
          votos: enqueteAtivaRaw.enquete_votos || [],
          currentUserId,
        });
      }

      const { data: enquetesRows, error: enquetesRowsError } = await supabase
        .from("enquetes")
        .select("id,pergunta,mostrar_resultado_parcial,encerra_em,encerrada_em,created_at")
        .is("encerrada_em", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (enquetesRowsError) throw new Error(enquetesRowsError.message);

      const legacyEnquete = (enquetesRows || []).find((row) => !isEnqueteEncerrada(mapEnqueteRow(row)));
      if (!legacyEnquete?.id) return null;

      const [opcoesResult, votosResult] = await Promise.all([
        supabase
          .from("enquete_opcoes")
          .select("id,enquete_id,texto,ordem")
          .eq("enquete_id", legacyEnquete.id)
          .order("ordem", { ascending: true }),
        supabase
          .from("enquete_votos")
          .select("id,enquete_id,enquete_opcao_id,colaborador_id")
          .eq("enquete_id", legacyEnquete.id),
      ]);

      if (opcoesResult.error) throw new Error(opcoesResult.error.message);
      if (votosResult.error) throw new Error(votosResult.error.message);

      const enquete = mapEnqueteRow(legacyEnquete);
      return buildEnqueteResult({
        enquete,
        opcoes: opcoesResult.data || [],
        votos: votosResult.data || [],
        currentUserId,
      });
    },
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase || !currentUserId) return;

    const channel = supabase
      .channel(`enquetes-live-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "enquetes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enquete_opcoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enquete_votos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, queryClient, queryEnabled]);

  return query;
}

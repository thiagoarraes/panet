import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../../lib/supabase.js";
import { buildEnqueteResult, isEnqueteEncerrada } from "../../../lib/enquetes.js";

const mapEnqueteRow = (row) => ({
  id: row?.id || "",
  pergunta: row?.pergunta || "",
  mostrarResultadoParcial: Boolean(row?.mostrar_resultado_parcial),
  encerraEm: row?.encerra_em || null,
  encerradaEm: row?.encerrada_em || null,
  createdAt: row?.created_at || null,
  updatedAt: row?.updated_at || null,
});

export function useAdminEnquetes({ status = "ativa" } = {}) {
  const queryClient = useQueryClient();
  const normalizedStatus = status === "encerrada" ? "encerrada" : "ativa";

  const query = useQuery({
    queryKey: ["admin", "enquetes", normalizedStatus],
    enabled: isSupabaseEnabled,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return [];

      const [enquetesResult, opcoesResult, votosResult] = await Promise.all([
        supabase
          .from("enquetes")
          .select("id,pergunta,mostrar_resultado_parcial,encerra_em,encerrada_em,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("enquete_opcoes")
          .select("id,enquete_id,texto,ordem")
          .order("ordem", { ascending: true }),
        supabase
          .from("enquete_votos")
          .select("id,enquete_id,enquete_opcao_id,colaborador_id")
          .limit(5000),
      ]);

      if (enquetesResult.error) throw new Error(enquetesResult.error.message);
      if (opcoesResult.error) throw new Error(opcoesResult.error.message);
      if (votosResult.error) throw new Error(votosResult.error.message);

      const opcoesByEnquete = (opcoesResult.data || []).reduce((acc, option) => {
        const key = String(option?.enquete_id || "");
        if (!key) return acc;
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(option);
        return acc;
      }, new Map());

      const votosByEnquete = (votosResult.data || []).reduce((acc, vote) => {
        const key = String(vote?.enquete_id || "");
        if (!key) return acc;
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(vote);
        return acc;
      }, new Map());

      const now = new Date();
      const rows = (enquetesResult.data || []).map((row) => {
        const enquete = mapEnqueteRow(row);
        const result = buildEnqueteResult({
          enquete,
          opcoes: opcoesByEnquete.get(String(enquete.id)) || [],
          votos: votosByEnquete.get(String(enquete.id)) || [],
          currentUserId: null,
        });
        const closed = isEnqueteEncerrada(enquete, now);
        return {
          ...result,
          createdAt: enquete.createdAt,
          updatedAt: enquete.updatedAt,
          status: closed ? "encerrada" : "ativa",
        };
      });

      return rows.filter((row) => row.status === normalizedStatus);
    },
  });

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;

    const channel = supabase
      .channel(`admin-enquetes-live-${normalizedStatus}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "enquetes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
        queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enquete_opcoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
        queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enquete_votos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "enquetes"] });
        queryClient.invalidateQueries({ queryKey: ["enquete-ativa"] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [normalizedStatus, queryClient]);

  return query;
}

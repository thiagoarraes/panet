import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { normalizarConfig } from "../../lib/gartic.js";

const iniciais = (nome) =>
  String(nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U";

// Monta o jogador respeitando o anonimato escolhido na partida.
const mapJogador = (row) => {
  const col = row.colaborador || {};
  const identificado = !row.anonimo;
  return {
    id: row.id,
    salaId: row.sala_id,
    colaboradorId: row.colaborador_id,
    apelido: row.apelido,
    anonimo: row.anonimo,
    isHost: row.is_host,
    conectado: row.conectado,
    pontosTotal: row.pontos_total,
    nome: row.apelido,
    nomeReal: identificado ? col.nome || "" : "",
    fotoUrl: identificado ? col.foto_url || "" : "",
    foto_url: identificado ? col.foto_url || "" : "",
    cor: identificado ? col.cor_avatar || "#11E7E7" : "#7c83ff",
    foto: identificado ? iniciais(col.nome) : "🎭",
  };
};

// Estado completo de uma sala de gartic: sala + jogadores + rodada atual +
// palavra (visivel so para desenhista/host via RLS) + palpites. Tempo real via
// um unico canal postgres_changes + polling de fallback.
export function useGarticSala(salaId, options = {}) {
  const queryClient = useQueryClient();
  const queryEnabled = (options?.enabled ?? true) && Boolean(salaId);

  const query = useQuery({
    queryKey: ["gartic-sala", salaId],
    enabled: queryEnabled && isSupabaseEnabled,
    staleTime: 2 * 1000,
    // Fallback de polling: o jogo nao pode depender 100% do realtime. Enquanto a
    // sala esta ativa, refaz o fetch a cada 2,5s para garantir avanco de fase.
    refetchInterval: (q) => {
      const fase = q.state.data?.sala?.fase;
      if (!fase || fase === "fim") return false;
      return 2500;
    },
    refetchIntervalInBackground: false,
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase || !salaId) return null;

      const { data: salaRow, error: salaError } = await supabase
        .from("jogo_salas")
        .select("*, host:colaboradores!host_id(nome)")
        .eq("id", salaId)
        .maybeSingle();
      if (salaError) throw new Error(salaError.message);
      if (!salaRow?.id) return null;

      const { data: jogadoresRows, error: jogadoresError } = await supabase
        .from("jogo_jogadores")
        .select("*, colaborador:colaboradores!colaborador_id(nome,foto_url,cor_avatar)")
        .eq("sala_id", salaId)
        .order("entrou_em", { ascending: true });
      if (jogadoresError) throw new Error(jogadoresError.message);
      const jogadores = (jogadoresRows || []).map(mapJogador);

      const sala = {
        id: salaRow.id,
        nome: salaRow.nome,
        jogo: salaRow.jogo,
        status: salaRow.status,
        fase: salaRow.fase,
        hostId: salaRow.host_id,
        hostNome: salaRow.host?.nome || "",
        config: normalizarConfig(salaRow.config),
        rodadaAtual: salaRow.rodada_atual,
        faseIniciadaEm: salaRow.fase_iniciada_em,
      };

      let rodada = null;
      let palavra = null;
      let palpites = [];
      if (salaRow.rodada_atual > 0) {
        const { data: rodadaRow } = await supabase
          .from("gartic_rodadas")
          .select("*")
          .eq("sala_id", salaId)
          .eq("numero", salaRow.rodada_atual)
          .maybeSingle();
        if (rodadaRow?.id) {
          rodada = {
            id: rodadaRow.id,
            numero: rodadaRow.numero,
            desenhistaId: rodadaRow.desenhista_id,
            fase: rodadaRow.fase,
            palavraTamanho: rodadaRow.palavra_tamanho,
            dica: rodadaRow.dica,
            palavraRevelada: rodadaRow.palavra_revelada,
            iniciadaEm: rodadaRow.iniciada_em,
            encerradaEm: rodadaRow.encerrada_em,
          };

          const [palavraRes, palpitesRes] = await Promise.all([
            // RLS so retorna a linha se o usuario for o desenhista ou o host.
            supabase
              .from("gartic_palavra")
              .select("palavra")
              .eq("rodada_id", rodadaRow.id)
              .maybeSingle(),
            supabase
              .from("gartic_palpites")
              .select("id,rodada_id,jogador_id,texto,acertou,ordem_acerto,pontos,criado_em")
              .eq("rodada_id", rodadaRow.id)
              .order("criado_em", { ascending: true }),
          ]);
          palavra = palavraRes.data?.palavra || null;
          palpites = (palpitesRes.data || []).map((p) => ({
            id: p.id,
            rodadaId: p.rodada_id,
            jogadorId: p.jogador_id,
            texto: p.texto,
            acertou: p.acertou,
            ordemAcerto: p.ordem_acerto,
            pontos: p.pontos,
            criadoEm: p.criado_em,
          }));
        }
      }

      return { sala, jogadores, rodada, palavra, palpites };
    },
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase || !salaId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["gartic-sala", salaId] });
    const filtroSala = `sala_id=eq.${salaId}`;
    const channel = supabase
      .channel(`gartic-sala-live-${salaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_salas", filter: `id=eq.${salaId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_jogadores", filter: filtroSala }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "gartic_rodadas", filter: filtroSala }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "gartic_palpites" }, invalidate)
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [salaId, queryClient, queryEnabled]);

  return query;
}

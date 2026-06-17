import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import { normalizarConfig } from "../../lib/adedonha.js";

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
    prontoRodada: row.pronto_rodada || 0,
    stopsTotal: row.stops_total || 0,
    ultimoStopEm: row.ultimo_stop_em,
    // Avatar: identificado mostra foto/cor reais; anonimo nao expoe foto.
    nome: row.apelido,
    nomeReal: identificado ? col.nome || "" : "",
    fotoUrl: identificado ? col.foto_url || "" : "",
    foto_url: identificado ? col.foto_url || "" : "",
    cor: identificado ? col.cor_avatar || "#11E7E7" : "#7c83ff",
    foto: identificado ? iniciais(col.nome) : "🎭",
  };
};

// Estado completo de uma sala: sala + jogadores + rodada atual + respostas +
// validacoes + pontuacoes. Mantido em tempo real via um unico canal.
export function useJogoSala(salaId, options = {}) {
  const queryClient = useQueryClient();
  const queryEnabled = (options?.enabled ?? true) && Boolean(salaId);

  const query = useQuery({
    queryKey: ["jogo-sala", salaId],
    enabled: queryEnabled && isSupabaseEnabled,
    staleTime: 2 * 1000,
    // Fallback de polling: o jogo não pode depender 100% do realtime (que pode
    // atrasar/cair). Enquanto a sala está ativa, refaz o fetch a cada 2,5s para
    // garantir que STOP/avanço de fase apareçam para todos os clientes.
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
        letraAtual: salaRow.letra_atual,
        faseIniciadaEm: salaRow.fase_iniciada_em,
      };

      // Rodada corrente (se houver).
      let rodada = null;
      let respostas = [];
      let validacoes = [];
      let pontuacoes = [];
      if (salaRow.rodada_atual > 0) {
        const { data: rodadaRow } = await supabase
          .from("jogo_rodadas")
          .select("*")
          .eq("sala_id", salaId)
          .eq("numero", salaRow.rodada_atual)
          .maybeSingle();
        if (rodadaRow?.id) {
          rodada = {
            id: rodadaRow.id,
            numero: rodadaRow.numero,
            letra: rodadaRow.letra,
            fase: rodadaRow.fase,
            iniciadaEm: rodadaRow.iniciada_em,
            stopEm: rodadaRow.stop_em,
            stopPor: rodadaRow.stop_por,
          };

          const [respRes, pontRes] = await Promise.all([
            supabase
              .from("jogo_respostas")
              .select("id,rodada_id,jogador_id,categoria,resposta")
              .eq("rodada_id", rodadaRow.id),
            supabase
              .from("jogo_pontuacoes")
              .select("id,rodada_id,jogador_id,pontos")
              .eq("rodada_id", rodadaRow.id),
          ]);
          respostas = (respRes.data || []).map((r) => ({
            id: r.id,
            rodadaId: r.rodada_id,
            jogadorId: r.jogador_id,
            categoria: r.categoria,
            resposta: r.resposta,
          }));
          pontuacoes = (pontRes.data || []).map((p) => ({
            jogadorId: p.jogador_id,
            pontos: p.pontos,
          }));

          if (respostas.length > 0) {
            const { data: valRows } = await supabase
              .from("jogo_validacoes")
              .select("id,resposta_id,votante_id,valido")
              .in("resposta_id", respostas.map((r) => r.id));
            validacoes = (valRows || []).map((v) => ({
              id: v.id,
              respostaId: v.resposta_id,
              votanteId: v.votante_id,
              valido: v.valido,
            }));
          }
        }
      }

      return { sala, jogadores, rodada, respostas, validacoes, pontuacoes };
    },
  });

  useEffect(() => {
    if (!queryEnabled || !isSupabaseEnabled || !supabase || !salaId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["jogo-sala", salaId] });
    const filtroSala = `sala_id=eq.${salaId}`;
    const channel = supabase
      .channel(`jogo-sala-live-${salaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_salas", filter: `id=eq.${salaId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_jogadores", filter: filtroSala }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_rodadas", filter: filtroSala }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_respostas" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_validacoes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "jogo_pontuacoes" }, invalidate)
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [salaId, queryClient, queryEnabled]);

  return query;
}

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import {
  CONFIG_PADRAO,
  calcularPontuacaoRodada,
  normalizarConfig,
  sortearLetra,
} from "../../lib/adedonha.js";

const guard = () => {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error("Banco indisponível — jogos exigem conexão.");
  }
};

const nowIso = () => new Date().toISOString();

// Conjunto de mutacoes da adedonha. Host-autoritativo: criar/iniciar/avancar
// rodada sao acoes do criador; responder/stop/votar sao do jogador.
export function useJogoMutations() {
  const queryClient = useQueryClient();

  const invalidarSalas = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["jogo-salas"] });
  }, [queryClient]);

  const invalidarSala = useCallback(
    (salaId) => {
      queryClient.invalidateQueries({ queryKey: ["jogo-sala", salaId] });
      queryClient.invalidateQueries({ queryKey: ["jogo-salas"] });
    },
    [queryClient]
  );

  // Cria sala + insere o host como primeiro jogador. Retorna salaId.
  const criarSala = useCallback(
    async ({ hostId, hostNome, apelido, anonimo = false, config }) => {
      guard();
      if (!hostId) throw new Error("Usuário inválido.");
      const cfg = normalizarConfig(config || CONFIG_PADRAO);
      const { data: sala, error } = await supabase
        .from("jogo_salas")
        .insert({
          nome: `Sala de ${hostNome || "colaborador"}`,
          jogo: "adedonha",
          host_id: hostId,
          status: "aguardando",
          fase: "lobby",
          config: cfg,
          rodada_atual: 0,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { error: jogadorError } = await supabase.from("jogo_jogadores").insert({
        sala_id: sala.id,
        colaborador_id: hostId,
        apelido: (apelido || hostNome || "Host").trim(),
        anonimo: Boolean(anonimo),
        is_host: true,
      });
      if (jogadorError) throw new Error(jogadorError.message);

      invalidarSalas();
      return sala.id;
    },
    [invalidarSalas]
  );

  // Entra numa sala existente (idempotente: se ja entrou, atualiza apelido).
  const entrarSala = useCallback(
    async ({ salaId, colaboradorId, apelido, anonimo = false }) => {
      guard();
      if (!salaId || !colaboradorId) throw new Error("Dados insuficientes.");
      const { error } = await supabase.from("jogo_jogadores").upsert(
        {
          sala_id: salaId,
          colaborador_id: colaboradorId,
          apelido: (apelido || "Jogador").trim(),
          anonimo: Boolean(anonimo),
          conectado: true,
        },
        { onConflict: "sala_id,colaborador_id" }
      );
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Sai da sala. Se for host, encerra a sala (limitacao MVP).
  const sairSala = useCallback(
    async ({ salaId, jogadorId, isHost }) => {
      guard();
      if (!salaId) return;
      if (isHost) {
        const { error } = await supabase
          .from("jogo_salas")
          .update({ status: "encerrada", fase: "fim" })
          .eq("id", salaId);
        if (error) throw new Error(error.message);
      } else if (jogadorId) {
        const { error } = await supabase.from("jogo_jogadores").delete().eq("id", jogadorId);
        if (error) throw new Error(error.message);
      }
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  const salvarConfig = useCallback(
    async ({ salaId, config }) => {
      guard();
      const cfg = normalizarConfig(config);
      const { error } = await supabase.from("jogo_salas").update({ config: cfg }).eq("id", salaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Host inicia o jogo: cria rodada 1 e move a sala para preenchimento.
  const iniciarJogo = useCallback(
    async ({ salaId, config }) => {
      guard();
      const cfg = normalizarConfig(config);
      const letra = sortearLetra(cfg.letras, []);
      const ts = nowIso();
      const { error: rodadaError } = await supabase.from("jogo_rodadas").insert({
        sala_id: salaId,
        numero: 1,
        letra,
        fase: "preenchimento",
        iniciada_em: ts,
      });
      if (rodadaError) throw new Error(rodadaError.message);

      const { error } = await supabase
        .from("jogo_salas")
        .update({
          status: "jogando",
          fase: "preenchimento",
          rodada_atual: 1,
          letra_atual: letra,
          fase_iniciada_em: ts,
        })
        .eq("id", salaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Jogador grava suas respostas (upsert por categoria).
  const enviarRespostas = useCallback(
    async ({ rodadaId, jogadorId, respostas }) => {
      guard();
      if (!rodadaId || !jogadorId) throw new Error("Rodada inválida.");
      const payload = Object.entries(respostas || {}).map(([categoria, resposta]) => ({
        rodada_id: rodadaId,
        jogador_id: jogadorId,
        categoria,
        resposta: String(resposta || "").trim(),
      }));
      if (payload.length === 0) return;
      const { error } = await supabase
        .from("jogo_respostas")
        .upsert(payload, { onConflict: "rodada_id,jogador_id,categoria" });
      if (error) throw new Error(error.message);
    },
    []
  );

  // Qualquer jogador pode dar STOP (grava stop_por/stop_em na rodada).
  const darStop = useCallback(
    async ({ salaId, rodadaId, jogadorId }) => {
      guard();
      if (!rodadaId) return;
      const { error } = await supabase
        .from("jogo_rodadas")
        .update({ stop_por: jogadorId, stop_em: nowIso() })
        .eq("id", rodadaId)
        .is("stop_em", null);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  const votarValidacao = useCallback(
    async ({ respostaId, votanteId, valido }) => {
      guard();
      if (!respostaId || !votanteId) throw new Error("Voto inválido.");
      const { error } = await supabase
        .from("jogo_validacoes")
        .upsert(
          { resposta_id: respostaId, votante_id: votanteId, valido: Boolean(valido) },
          { onConflict: "resposta_id,votante_id" }
        );
      if (error) throw new Error(error.message);
    },
    []
  );

  // Transicao preenchimento -> validacao (host).
  const irParaValidacao = useCallback(
    async ({ salaId, rodadaId }) => {
      guard();
      const ts = nowIso();
      await supabase.from("jogo_rodadas").update({ fase: "validacao" }).eq("id", rodadaId);
      const { error } = await supabase
        .from("jogo_salas")
        .update({ fase: "validacao", fase_iniciada_em: ts })
        .eq("id", salaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Transicao validacao -> ranking (host): calcula e persiste pontuacao.
  const fecharRodada = useCallback(
    async ({ sala, rodada, jogadores, respostas, validacoes }) => {
      guard();
      const totalVotantes = jogadores.length;
      const pontosMap = calcularPontuacaoRodada({
        respostas,
        validacoes,
        letra: rodada.letra,
        totalVotantes,
      });

      // Persiste pontuacao da rodada (zera quem nao pontuou tambem).
      const pontuacoesPayload = jogadores.map((j) => ({
        rodada_id: rodada.id,
        jogador_id: j.id,
        pontos: pontosMap.get(j.id) || 0,
      }));
      const { error: pontError } = await supabase
        .from("jogo_pontuacoes")
        .upsert(pontuacoesPayload, { onConflict: "rodada_id,jogador_id" });
      if (pontError) throw new Error(pontError.message);

      // Atualiza pontos acumulados de cada jogador.
      await Promise.all(
        jogadores.map((j) =>
          supabase
            .from("jogo_jogadores")
            .update({ pontos_total: (j.pontosTotal || 0) + (pontosMap.get(j.id) || 0) })
            .eq("id", j.id)
        )
      );

      await supabase.from("jogo_rodadas").update({ fase: "ranking" }).eq("id", rodada.id);
      const { error } = await supabase
        .from("jogo_salas")
        .update({ fase: "ranking", fase_iniciada_em: nowIso() })
        .eq("id", sala.id);
      if (error) throw new Error(error.message);
      invalidarSala(sala.id);
    },
    [invalidarSala]
  );

  // Jogador marca "Estou pronto" no ranking (grava a rodada atual).
  const marcarPronto = useCallback(
    async ({ salaId, jogadorId, rodadaAtual }) => {
      guard();
      if (!jogadorId) throw new Error("Jogador inválido.");
      const { error } = await supabase
        .from("jogo_jogadores")
        .update({ pronto_rodada: rodadaAtual })
        .eq("id", jogadorId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Transicao ranking -> proxima rodada ou fim (host).
  const proximaRodada = useCallback(
    async ({ sala, rodadaAtual, letrasUsadas }) => {
      guard();
      const cfg = normalizarConfig(sala.config);
      if (rodadaAtual >= cfg.rodadas) {
        const { error } = await supabase
          .from("jogo_salas")
          .update({ fase: "fim", status: "encerrada" })
          .eq("id", sala.id);
        if (error) throw new Error(error.message);
        invalidarSala(sala.id);
        return;
      }
      const proximo = rodadaAtual + 1;
      const letra = sortearLetra(cfg.letras, letrasUsadas);
      const ts = nowIso();
      const { error: rodadaError } = await supabase.from("jogo_rodadas").insert({
        sala_id: sala.id,
        numero: proximo,
        letra,
        fase: "preenchimento",
        iniciada_em: ts,
      });
      if (rodadaError) throw new Error(rodadaError.message);
      const { error } = await supabase
        .from("jogo_salas")
        .update({
          fase: "preenchimento",
          rodada_atual: proximo,
          letra_atual: letra,
          fase_iniciada_em: ts,
        })
        .eq("id", sala.id);
      if (error) throw new Error(error.message);
      invalidarSala(sala.id);
    },
    [invalidarSala]
  );

  const encerrarSala = useCallback(
    async ({ salaId }) => {
      guard();
      const { error } = await supabase
        .from("jogo_salas")
        .update({ status: "encerrada", fase: "fim" })
        .eq("id", salaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  return {
    criarSala,
    entrarSala,
    sairSala,
    salvarConfig,
    iniciarJogo,
    enviarRespostas,
    darStop,
    votarValidacao,
    irParaValidacao,
    fecharRodada,
    marcarPronto,
    proximaRodada,
    encerrarSala,
  };
}

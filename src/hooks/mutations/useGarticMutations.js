import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase.js";
import {
  CONFIG_PADRAO,
  acertou,
  desenhistaDaRodada,
  normalizarConfig,
  pontosAcerto,
  pontosDesenhista,
  segundosRestantes,
  tempoSegundos,
  totalRodadas,
} from "../../lib/gartic.js";

const guard = () => {
  if (!isSupabaseEnabled || !supabase) {
    throw new Error("Banco indisponível — jogos exigem conexão.");
  }
};

const nowIso = () => new Date().toISOString();

// Mutacoes do gartic. Host-autoritativo: criar/iniciar/avancar rodada e avaliar
// palpites sao acoes do host; escolher palavra e do desenhista; palpitar e do
// adivinhador.
export function useGarticMutations() {
  const queryClient = useQueryClient();

  const invalidarSalas = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["jogo-salas"] });
  }, [queryClient]);

  const invalidarSala = useCallback(
    (salaId) => {
      queryClient.invalidateQueries({ queryKey: ["gartic-sala", salaId] });
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
          jogo: "gartic",
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

  // Sai da sala. Se for host, tenta migrar o host para outro jogador (o mais
  // antigo) antes de encerrar — só encerra se ficar ninguém.
  const sairSala = useCallback(
    async ({ salaId, jogadorId, isHost }) => {
      guard();
      if (!salaId) return;
      if (isHost) {
        const { data: outros } = await supabase
          .from("jogo_jogadores")
          .select("id, colaborador_id")
          .eq("sala_id", salaId)
          .neq("id", jogadorId || "")
          .order("entrou_em", { ascending: true })
          .limit(1);
        const novo = outros?.[0];
        if (novo) {
          // Ordem importa para o RLS: promove o novo (enquanto ainda sou host),
          // depois passo host_id, depois saio.
          await supabase.from("jogo_jogadores").update({ is_host: true }).eq("id", novo.id);
          await supabase.from("jogo_salas").update({ host_id: novo.colaborador_id }).eq("id", salaId);
          if (jogadorId) await supabase.from("jogo_jogadores").delete().eq("id", jogadorId);
        } else {
          const { error } = await supabase
            .from("jogo_salas")
            .update({ status: "encerrada", fase: "fim" })
            .eq("id", salaId);
          if (error) throw new Error(error.message);
        }
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

  // Cria uma rodada: define o desenhista (round-robin) e poe a sala em 'escolha'.
  // As 3 opcoes de palavra NAO sao persistidas: o cliente do desenhista as sorteia
  // localmente (evita vazar as opcoes para os adivinhadores via API). `numero` 1-based.
  const criarRodada = useCallback(
    async ({ salaId, jogadores, numero }) => {
      const desenhista = desenhistaDaRodada(jogadores, numero);
      if (!desenhista) throw new Error("Sem jogadores para desenhar.");
      const ts = nowIso();
      const { error: rodadaError } = await supabase.from("gartic_rodadas").insert({
        sala_id: salaId,
        numero,
        desenhista_id: desenhista.id,
        fase: "escolha",
        iniciada_em: ts,
      });
      if (rodadaError) throw new Error(rodadaError.message);

      const { error } = await supabase
        .from("jogo_salas")
        .update({
          status: "jogando",
          fase: "escolha",
          rodada_atual: numero,
          fase_iniciada_em: ts,
        })
        .eq("id", salaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Host inicia o jogo: cria a rodada 1.
  const iniciarJogo = useCallback(
    async ({ salaId, jogadores }) => {
      guard();
      await criarRodada({ salaId, jogadores, numero: 1 });
    },
    [criarRodada]
  );

  // Desenhista (ou host no auto-pick) escolhe a palavra: grava o segredo + tamanho
  // (dica) e marca a rodada como 'desenho'. NAO toca em jogo_salas — a transicao
  // da sala e host-autoritativa (iniciarDesenho), pois o desenhista pode nao ser
  // o host e o RLS so deixa o host atualizar jogo_salas.
  const escolherPalavra = useCallback(
    async ({ salaId, rodadaId, palavra }) => {
      guard();
      if (!rodadaId || !palavra) throw new Error("Palavra inválida.");
      const { error: segredoError } = await supabase
        .from("gartic_palavra")
        .upsert({ rodada_id: rodadaId, palavra }, { onConflict: "rodada_id" });
      if (segredoError) throw new Error(segredoError.message);

      const { error } = await supabase
        .from("gartic_rodadas")
        .update({ fase: "desenho", palavra_tamanho: palavra.length })
        .eq("id", rodadaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Host confirma a transicao escolha -> desenho na sala e arma o cronometro.
  const iniciarDesenho = useCallback(
    async ({ salaId }) => {
      guard();
      const { error } = await supabase
        .from("jogo_salas")
        .update({ fase: "desenho", fase_iniciada_em: nowIso() })
        .eq("id", salaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Host publica a dica progressiva (letras parcialmente reveladas) da rodada.
  const atualizarDica = useCallback(
    async ({ salaId, rodadaId, dica }) => {
      guard();
      const { error } = await supabase
        .from("gartic_rodadas")
        .update({ dica })
        .eq("id", rodadaId);
      if (error) throw new Error(error.message);
      invalidarSala(salaId);
    },
    [invalidarSala]
  );

  // Adivinhador envia um palpite (acertou=false; o host avalia).
  const enviarPalpite = useCallback(
    async ({ rodadaId, jogadorId, texto }) => {
      guard();
      const limpo = String(texto || "").trim();
      if (!rodadaId || !jogadorId || !limpo) return;
      const { error } = await supabase.from("gartic_palpites").insert({
        rodada_id: rodadaId,
        jogador_id: jogadorId,
        texto: limpo.slice(0, 60),
      });
      if (error) throw new Error(error.message);
    },
    []
  );

  // Host avalia palpites pendentes: marca os que acertaram (ordem/pontos) e
  // acumula pontos no jogador. Idempotente (so toca em acertou=false que casam).
  const avaliarPalpites = useCallback(
    async ({ sala, rodada, palavra, palpites, jogadores }) => {
      guard();
      if (!palavra) return;
      const duracao = tempoSegundos(sala.config.tempo);

      // Jogadores que ja acertaram e a maior ordem ja atribuida.
      const jaAcertaram = new Set();
      let maxOrdem = 0;
      palpites.forEach((p) => {
        if (p.acertou) {
          jaAcertaram.add(p.jogadorId);
          if (p.ordemAcerto) maxOrdem = Math.max(maxOrdem, p.ordemAcerto);
        }
      });

      // Palpites pendentes em ordem cronológica que casam com a palavra.
      const pendentes = palpites
        .filter((p) => !p.acertou && p.jogadorId !== rodada.desenhistaId)
        .filter((p) => acertou(p.texto, palavra))
        .filter((p) => !jaAcertaram.has(p.jogadorId));

      if (pendentes.length === 0) return;

      const fracaoTempo = segundosRestantes(sala.faseIniciadaEm, duracao) / duracao;
      let ordem = maxOrdem;
      for (const p of pendentes) {
        if (jaAcertaram.has(p.jogadorId)) continue;
        ordem += 1;
        jaAcertaram.add(p.jogadorId);
        const pontos = pontosAcerto(ordem, fracaoTempo);
        await supabase
          .from("gartic_palpites")
          .update({ acertou: true, ordem_acerto: ordem, pontos })
          .eq("id", p.id);
        const jog = jogadores.find((j) => j.id === p.jogadorId);
        await supabase
          .from("jogo_jogadores")
          .update({ pontos_total: (jog?.pontosTotal || 0) + pontos })
          .eq("id", p.jogadorId);
      }
      invalidarSala(sala.id);
    },
    [invalidarSala]
  );

  // Transicao desenho -> revelacao (host): pontua o desenhista, revela a palavra
  // (campo publico) e encerra a rodada.
  const revelarRodada = useCallback(
    async ({ sala, rodada, palavra, palpites, jogadores }) => {
      guard();
      const acertosDistintos = new Set(
        palpites.filter((p) => p.acertou).map((p) => p.jogadorId)
      );
      const totalAdivinhadores = Math.max(0, jogadores.length - 1);
      const ptsDesenhista = pontosDesenhista(acertosDistintos.size, totalAdivinhadores);
      if (ptsDesenhista > 0) {
        const desenhista = jogadores.find((j) => j.id === rodada.desenhistaId);
        if (desenhista) {
          await supabase
            .from("jogo_jogadores")
            .update({ pontos_total: (desenhista.pontosTotal || 0) + ptsDesenhista })
            .eq("id", desenhista.id);
        }
      }

      const ts = nowIso();
      await supabase
        .from("gartic_rodadas")
        .update({ fase: "revelacao", encerrada_em: ts, palavra_revelada: palavra || null })
        .eq("id", rodada.id);
      const { error } = await supabase
        .from("jogo_salas")
        .update({ fase: "revelacao", fase_iniciada_em: ts })
        .eq("id", sala.id);
      if (error) throw new Error(error.message);
      invalidarSala(sala.id);
    },
    [invalidarSala]
  );

  // Transicao revelacao -> proxima rodada ou fim (host).
  const proximaRodada = useCallback(
    async ({ sala, jogadores }) => {
      guard();
      const total = totalRodadas(jogadores.length, sala.config.voltas);
      if (sala.rodadaAtual >= total) {
        const { error } = await supabase
          .from("jogo_salas")
          .update({ fase: "fim", status: "encerrada" })
          .eq("id", sala.id);
        if (error) throw new Error(error.message);
        invalidarSala(sala.id);
        return;
      }
      await criarRodada({ salaId: sala.id, jogadores, numero: sala.rodadaAtual + 1 });
    },
    [invalidarSala, criarRodada]
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
    escolherPalavra,
    iniciarDesenho,
    atualizarDica,
    enviarPalpite,
    avaliarPalpites,
    revelarRodada,
    proximaRodada,
    encerrarSala,
  };
}

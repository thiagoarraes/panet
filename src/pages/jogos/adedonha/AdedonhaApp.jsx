import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useJogoSala } from "../../../hooks/queries/useJogoSala.js";
import { useJogoMutations } from "../../../hooks/mutations/useJogoMutations.js";
import {
  estadoValidacao,
  segundosRestantes,
  tempoSegundos,
  TEMPO_RANKING_SEGUNDOS,
} from "../../../lib/adedonha.js";
import { AdedonhaLobby } from "./AdedonhaLobby.jsx";
import { SalaConfig } from "./SalaConfig.jsx";
import { SalaEspera } from "./SalaEspera.jsx";
import { Partida } from "./Partida.jsx";
import { Validacao } from "./Validacao.jsx";
import { Ranking } from "./Ranking.jsx";
import { SorteioLetra, StopAnim } from "./Animacoes.jsx";

// Orquestrador da adedonha: alterna lobby <-> sala e, quando o usuario e host,
// dispara as transicoes de fase (host-autoritativo).
export function AdedonhaApp({ currentUser, currentUserId, onSair }) {
  const [salaId, setSalaId] = useState(null);
  const mut = useJogoMutations();
  const { data, isLoading } = useJogoSala(salaId, { enabled: Boolean(salaId) });

  // Tick de 1s para recomputar cronometros.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!salaId) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [salaId]);

  const sala = data?.sala || null;
  const jogadores = data?.jogadores || [];
  const meuJogador = jogadores.find((j) => j.colaboradorId === currentUserId) || null;
  const isHost = sala ? sala.hostId === currentUserId : false;

  // ── Overlays de animação (sorteio da letra e STOP) ─────────────────────────
  const [overlay, setOverlay] = useState(null);
  const overlayTimerRef = useRef(null);
  const sorteioVistoRef = useRef("");
  const stopVistoRef = useRef("");

  const mostrarOverlay = (conteudo, ms) => {
    clearTimeout(overlayTimerRef.current);
    setOverlay(conteudo);
    overlayTimerRef.current = setTimeout(() => setOverlay(null), ms);
  };

  // Nova rodada em preenchimento → anima sorteio da letra.
  useEffect(() => {
    if (sala?.fase === "preenchimento" && data?.rodada?.id) {
      const chave = data.rodada.id;
      if (sorteioVistoRef.current !== chave) {
        sorteioVistoRef.current = chave;
        stopVistoRef.current = "";
        mostrarOverlay({ tipo: "sorteio", letra: data.rodada.letra }, 3600);
      }
    }
  }, [sala?.fase, data?.rodada?.id, data?.rodada?.letra]);

  // Alguém deu STOP → anima "GRITOU STOP!".
  useEffect(() => {
    if (data?.rodada?.stopEm && data?.rodada?.id) {
      const chave = `${data.rodada.id}-${data.rodada.stopEm}`;
      if (stopVistoRef.current !== chave) {
        stopVistoRef.current = chave;
        const quem = jogadores.find((j) => j.id === data.rodada.stopPor);
        mostrarOverlay({ tipo: "stop", nome: quem?.apelido }, 2000);
      }
    }
  }, [data?.rodada?.stopEm, data?.rodada?.id]);

  useEffect(() => () => clearTimeout(overlayTimerRef.current), []);

  // ── Logica de transicao do host ───────────────────────────────────────────
  const transicaoRef = useRef("");
  // Em caso de falha (ex.: timeout/lock transitório), liberar o ref só depois de
  // um intervalo evita re-disparo em loop a cada render (storm de writes).
  const liberarComBackoff = (chave) => {
    setTimeout(() => {
      if (transicaoRef.current === chave) transicaoRef.current = "";
    }, 3000);
  };
  useEffect(() => {
    if (!isHost || !sala || !data) return;
    const cfg = sala.config;

    if (sala.fase === "preenchimento" && data.rodada) {
      const restante = segundosRestantes(sala.faseIniciadaEm, tempoSegundos(cfg.tempo));
      const tempoEsgotou = restante <= 0;
      const alguemDeuStop = Boolean(data.rodada.stopEm);
      if (tempoEsgotou || alguemDeuStop) {
        const chave = `validacao-${data.rodada.id}`;
        if (transicaoRef.current !== chave) {
          transicaoRef.current = chave;
          mut.irParaValidacao({ salaId: sala.id, rodadaId: data.rodada.id }).catch(() => {
            liberarComBackoff(chave);
          });
        }
      }
    }

    if (sala.fase === "validacao" && data.rodada) {
      const { acabou } = estadoValidacao(sala.faseIniciadaEm, cfg.categorias.length);
      if (acabou) {
        const chave = `ranking-${data.rodada.id}`;
        if (transicaoRef.current !== chave) {
          transicaoRef.current = chave;
          mut
            .fecharRodada({
              sala,
              rodada: data.rodada,
              jogadores,
              respostas: data.respostas,
              validacoes: data.validacoes,
            })
            .catch(() => {
              liberarComBackoff(chave);
            });
        }
      }
    }

    // Ranking: avança quando todos marcam "Estou pronto" ou o tempo esgota.
    // Na última rodada, vai direto pro placar final (sem esperar "Estou pronto").
    if (sala.fase === "ranking" && data.rodada) {
      const ultimaRodada = sala.rodadaAtual >= cfg.rodadas;
      const restante = segundosRestantes(sala.faseIniciadaEm, TEMPO_RANKING_SEGUNDOS);
      const tempoEsgotou = restante <= 0;
      const todosProntos =
        jogadores.length > 0 &&
        jogadores.every((j) => j.prontoRodada === sala.rodadaAtual);
      if (ultimaRodada || tempoEsgotou || todosProntos) {
        const chave = `proxima-${data.rodada.id}`;
        if (transicaoRef.current !== chave) {
          transicaoRef.current = chave;
          mut
            .proximaRodada({
              sala,
              rodadaAtual: sala.rodadaAtual,
              letrasUsadas: [sala.letraAtual].filter(Boolean),
            })
            .catch(() => {
              liberarComBackoff(chave);
            });
        }
      }
    }
  });

  // ── Acoes do lobby ──────────────────────────────────────────────────────────
  const handleCriarSala = async ({ apelido, anonimo, config }) => {
    const novaSala = await mut.criarSala({
      hostId: currentUserId,
      hostNome: currentUser?.nome,
      apelido,
      anonimo,
      config,
    });
    setSalaId(novaSala);
  };

  const handleEntrarSala = async ({ sala: alvo, apelido, anonimo }) => {
    await mut.entrarSala({ salaId: alvo.id, colaboradorId: currentUserId, apelido, anonimo });
    setSalaId(alvo.id);
  };

  const handleSairSala = async () => {
    if (sala && meuJogador) {
      await mut.sairSala({ salaId: sala.id, jogadorId: meuJogador.id, isHost }).catch(() => {});
    }
    setSalaId(null);
    transicaoRef.current = "";
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!salaId) {
    return (
      <AdedonhaLobby
        currentUser={currentUser}
        onCriar={handleCriarSala}
        onEntrar={handleEntrarSala}
        onVoltar={onSair}
      />
    );
  }

  if (isLoading || !sala) {
    return (
      <div className="card">
        <div className="card-body" style={{ padding: 24 }}>
          <button className="btn-ghost" onClick={onSair} style={{ marginBottom: 12 }}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="section-sub">Carregando sala...</div>
        </div>
      </div>
    );
  }

  // Sala encerrada e fase != fim: voltar ao lobby.
  if (sala.status === "encerrada" && sala.fase !== "fim") {
    return (
      <div className="card">
        <div className="card-body" style={{ padding: 24, textAlign: "center" }}>
          <p className="section-sub" style={{ marginBottom: 12 }}>Esta sala foi encerrada.</p>
          <button className="btn-primary" onClick={handleSairSala}>Voltar ao lobby</button>
        </div>
      </div>
    );
  }

  const sharedProps = { sala, jogadores, meuJogador, isHost, mut, currentUserId, onSair: handleSairSala };

  let conteudo;
  if (sala.fase === "lobby") {
    conteudo = isHost ? <SalaConfig {...sharedProps} /> : <SalaEspera {...sharedProps} />;
  } else if (sala.fase === "preenchimento") {
    conteudo = <Partida {...sharedProps} rodada={data.rodada} respostas={data.respostas} />;
  } else if (sala.fase === "validacao") {
    conteudo = (
      <Validacao
        {...sharedProps}
        rodada={data.rodada}
        respostas={data.respostas}
        validacoes={data.validacoes}
      />
    );
  } else {
    conteudo = (
      <Ranking
        {...sharedProps}
        rodada={data.rodada}
        respostas={data.respostas}
        pontuacoes={data.pontuacoes}
        finalizado={sala.fase === "fim" || sala.rodadaAtual >= sala.config.rodadas}
      />
    );
  }

  return (
    <>
      {conteudo}
      {overlay?.tipo === "sorteio" && <SorteioLetra letra={overlay.letra} />}
      {overlay?.tipo === "stop" && <StopAnim nome={overlay.nome} />}
    </>
  );
}

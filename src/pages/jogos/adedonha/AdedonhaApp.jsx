import { useEffect, useMemo, useRef, useState } from "react";
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
  // useMemo p/ estabilizar a identidade do array entre renders (usado em deps de useEffect).
  const jogadores = useMemo(() => data?.jogadores || [], [data?.jogadores]);
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
    // stopVistoRef evita reanimar; deps incluem stopPor/jogadores p/ resolver o nome.
  }, [data?.rodada?.stopEm, data?.rodada?.id, data?.rodada?.stopPor, jogadores]);

  useEffect(() => () => clearTimeout(overlayTimerRef.current), []);

  // ── Logica de transicao do host ───────────────────────────────────────────
  // Guarda de reentrância + backoff exponencial + teto de tentativas. Sem isso,
  // o useEffect (que roda a cada tick) re-dispara a mutation que falha em loop,
  // gerando storm de writes que satura o pool de conexões do banco.
  const transicaoRef = useRef({ chave: "", emVoo: false, tentativas: 0, bloqueadoAte: 0 });
  const MAX_TENTATIVAS_TRANSICAO = 4;

  const resetTransicao = () => {
    transicaoRef.current = { chave: "", emVoo: false, tentativas: 0, bloqueadoAte: 0 };
  };

  const tentarTransicao = (chave, executar) => {
    const st = transicaoRef.current;
    const agora = Date.now();
    if (st.chave === chave) {
      if (st.emVoo) return; // já rodando esta transição
      if (st.tentativas >= MAX_TENTATIVAS_TRANSICAO) return; // desistiu após N falhas
      if (agora < st.bloqueadoAte) return; // aguardando backoff
    } else {
      transicaoRef.current = { chave, emVoo: false, tentativas: 0, bloqueadoAte: 0 };
    }
    transicaoRef.current.emVoo = true;
    Promise.resolve()
      .then(executar)
      .then(() => {
        // Sucesso: a sala muda de fase e a chave deixa de casar; só libera o flag.
        if (transicaoRef.current.chave === chave) transicaoRef.current.emVoo = false;
      })
      .catch(() => {
        const s = transicaoRef.current;
        if (s.chave !== chave) return;
        s.emVoo = false;
        s.tentativas += 1;
        s.bloqueadoAte = Date.now() + Math.min(3000 * 2 ** s.tentativas, 30000);
      });
  };

  // Sem array de deps de propósito: precisa reavaliar a cada render (o tick de
  // 1s força isso) para checar as transições por tempo. O storm é evitado pelo
  // guard de reentrância + backoff em tentarTransicao, não pelas deps.
  useEffect(() => {
    if (!isHost || !sala || !data) return;
    const cfg = sala.config;

    if (sala.fase === "preenchimento" && data.rodada) {
      const restante = segundosRestantes(sala.faseIniciadaEm, tempoSegundos(cfg.tempo));
      if (restante <= 0 || Boolean(data.rodada.stopEm)) {
        tentarTransicao(`validacao-${data.rodada.id}`, () =>
          mut.irParaValidacao({ salaId: sala.id, rodadaId: data.rodada.id })
        );
      }
    }

    if (sala.fase === "validacao" && data.rodada) {
      const { acabou } = estadoValidacao(sala.faseIniciadaEm, cfg.categorias.length);
      if (acabou) {
        tentarTransicao(`ranking-${data.rodada.id}`, () =>
          mut.fecharRodada({
            sala,
            rodada: data.rodada,
            jogadores,
            respostas: data.respostas,
            validacoes: data.validacoes,
          })
        );
      }
    }

    // Ranking: avança quando todos marcam "Estou pronto" ou o tempo esgota.
    // Na última rodada, vai direto pro placar final (sem esperar "Estou pronto").
    if (sala.fase === "ranking" && data.rodada) {
      const ultimaRodada = sala.rodadaAtual >= cfg.rodadas;
      const restante = segundosRestantes(sala.faseIniciadaEm, TEMPO_RANKING_SEGUNDOS);
      const todosProntos =
        jogadores.length > 0 &&
        jogadores.every((j) => j.prontoRodada === sala.rodadaAtual);
      if (ultimaRodada || restante <= 0 || todosProntos) {
        tentarTransicao(`proxima-${data.rodada.id}`, () =>
          mut.proximaRodada({
            sala,
            rodadaAtual: sala.rodadaAtual,
            letrasUsadas: [sala.letraAtual].filter(Boolean),
          })
        );
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
    resetTransicao();
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

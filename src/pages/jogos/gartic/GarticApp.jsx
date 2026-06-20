import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useGarticSala } from "../../../hooks/queries/useGarticSala.js";
import { usePresencaSala } from "../../../hooks/queries/usePresencaSala.js";
import { useGarticMutations } from "../../../hooks/mutations/useGarticMutations.js";
import {
  TEMPO_ESCOLHA_SEGUNDOS,
  TEMPO_REVELACAO_SEGUNDOS,
  revelarDica,
  segundosRestantes,
  sortearPalavras,
  tempoSegundos,
} from "../../../lib/gartic.js";
import { GarticLobby } from "./GarticLobby.jsx";
import { GarticConfig } from "./GarticConfig.jsx";
import "../../../styles/gartic.css";
import { GarticEspera } from "./GarticEspera.jsx";
import { EscolhaPalavra } from "./EscolhaPalavra.jsx";
import { Desenho } from "./Desenho.jsx";
import { Revelacao } from "./Revelacao.jsx";

// Orquestrador do gartic: alterna lobby <-> sala e, quando o usuario e host,
// dispara as transicoes de fase (host-autoritativo) com guard de reentrancia.
export function GarticApp({ currentUser, currentUserId, onSair }) {
  const [salaId, setSalaId] = useState(null);
  const mut = useGarticMutations();
  const { data, isLoading } = useGarticSala(salaId, { enabled: Boolean(salaId) });
  const onlineIds = usePresencaSala(salaId, currentUserId, Boolean(salaId));

  // Tick de 1s para recomputar cronometros e reavaliar transicoes.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!salaId) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [salaId]);

  const sala = data?.sala || null;
  const jogadores = data?.jogadores || [];
  const rodada = data?.rodada || null;
  const palavra = data?.palavra || null;
  const palpites = data?.palpites || [];
  const meuJogador = jogadores.find((j) => j.colaboradorId === currentUserId) || null;
  const isHost = sala ? sala.hostId === currentUserId : false;
  const isDesenhista = Boolean(rodada && meuJogador && rodada.desenhistaId === meuJogador.id);

  // ── Logica de transicao do host (guard de reentrancia + backoff) ───────────
  // Mesmo padrao da adedonha: sem isso o useEffect (que roda a cada tick) re-
  // dispara a mutation que falha em loop, gerando storm de writes no pool.
  const transicaoRef = useRef({ chave: "", emVoo: false, tentativas: 0, bloqueadoAte: 0 });
  const MAX_TENTATIVAS_TRANSICAO = 4;

  const resetTransicao = () => {
    transicaoRef.current = { chave: "", emVoo: false, tentativas: 0, bloqueadoAte: 0 };
  };

  const tentarTransicao = (chave, executar) => {
    const st = transicaoRef.current;
    const agora = Date.now();
    if (st.chave === chave) {
      if (st.emVoo) return;
      if (st.tentativas >= MAX_TENTATIVAS_TRANSICAO) return;
      if (agora < st.bloqueadoAte) return;
    } else {
      transicaoRef.current = { chave, emVoo: false, tentativas: 0, bloqueadoAte: 0 };
    }
    transicaoRef.current.emVoo = true;
    Promise.resolve()
      .then(executar)
      .then(() => {
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

  // Sem array de deps de propósito: reavalia a cada render (tick de 1s) para
  // checar transicoes por tempo. O storm e evitado pelo guard, nao pelas deps.
  useEffect(() => {
    if (!isHost || !sala || !data || !rodada) return;
    const cfg = sala.config;

    if (sala.fase === "escolha") {
      // Desenhista ja escolheu (rodada virou 'desenho') → host arma o desenho.
      if (rodada.fase === "desenho") {
        tentarTransicao(`desenho-${rodada.id}`, () =>
          mut.iniciarDesenho({ salaId: sala.id })
        );
      } else {
        // Timeout de escolha → host sorteia uma palavra e escolhe por ele.
        const restante = segundosRestantes(sala.faseIniciadaEm, TEMPO_ESCOLHA_SEGUNDOS);
        if (restante <= 0) {
          tentarTransicao(`autopick-${rodada.id}`, () =>
            mut.escolherPalavra({
              salaId: sala.id,
              rodadaId: rodada.id,
              palavra: sortearPalavras([], 1)[0],
            })
          );
        }
      }
    }

    if (sala.fase === "desenho") {
      // Avalia palpites pendentes (chave muda a cada novo palpite → roda 1x).
      tentarTransicao(`avaliar-${rodada.id}-${palpites.length}`, () =>
        mut.avaliarPalpites({ sala, rodada, palavra, palpites, jogadores })
      );

      const duracao = tempoSegundos(cfg.tempo);
      const restante = segundosRestantes(sala.faseIniciadaEm, duracao);

      // Dica progressiva: host conhece a palavra (RLS) e publica a versão parcial
      // quando ela muda. Chave inclui a dica → só grava a cada nova letra revelada.
      if (palavra) {
        const dica = revelarDica(palavra, 1 - restante / duracao);
        if (dica !== (rodada.dica || "")) {
          tentarTransicao(`dica-${rodada.id}-${dica}`, () =>
            mut.atualizarDica({ salaId: sala.id, rodadaId: rodada.id, dica })
          );
        }
      }

      const adivinhadores = jogadores.filter((j) => j.id !== rodada.desenhistaId);
      const acertaram = new Set(palpites.filter((p) => p.acertou).map((p) => p.jogadorId));
      const todosAcertaram =
        adivinhadores.length > 0 && adivinhadores.every((j) => acertaram.has(j.id));
      if (restante <= 0 || todosAcertaram) {
        tentarTransicao(`revelacao-${rodada.id}`, () =>
          mut.revelarRodada({ sala, rodada, palavra, palpites, jogadores })
        );
      }
    }

    if (sala.fase === "revelacao") {
      const restante = segundosRestantes(sala.faseIniciadaEm, TEMPO_REVELACAO_SEGUNDOS);
      if (restante <= 0) {
        tentarTransicao(`proxima-${rodada.id}`, () =>
          mut.proximaRodada({ sala, jogadores })
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
      <GarticLobby
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

  const sharedProps = {
    sala,
    jogadores,
    meuJogador,
    isHost,
    isDesenhista,
    mut,
    currentUserId,
    rodada,
    palavra,
    palpites,
    onlineIds,
    onSair: handleSairSala,
  };

  if (sala.fase === "lobby") {
    return isHost ? <GarticConfig {...sharedProps} /> : <GarticEspera {...sharedProps} />;
  }
  if (sala.fase === "escolha") {
    return <EscolhaPalavra {...sharedProps} />;
  }
  if (sala.fase === "desenho") {
    return <Desenho {...sharedProps} />;
  }
  return (
    <Revelacao
      {...sharedProps}
      finalizado={sala.fase === "fim"}
    />
  );
}

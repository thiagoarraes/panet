import { useMemo } from "react";
import { Check, Flag } from "lucide-react";
import {
  comecaComLetra,
  estadoValidacao,
  TEMPO_VALIDACAO_CATEGORIA,
} from "../../../lib/adedonha.js";
import { JogadoresPanel } from "./JogadoresPanel.jsx";

// Fase de validação StopotS: uma categoria por vez, com timer próprio que
// auto-avança para a próxima (sem precisar clicar em nada).
export function Validacao({ sala, rodada, respostas, validacoes, jogadores, meuJogador, mut }) {
  const categorias = sala.config.categorias;
  const { indiceVisivel, restante } = estadoValidacao(sala.faseIniciadaEm, categorias.length);
  const categoriaAtual = categorias[indiceVisivel];
  const pct = Math.max(0, Math.min(100, (restante / TEMPO_VALIDACAO_CATEGORIA) * 100));

  // Meu voto por resposta.
  const meusVotos = useMemo(() => {
    const map = {};
    (validacoes || [])
      .filter((v) => meuJogador && v.votanteId === meuJogador.id)
      .forEach((v) => { map[v.respostaId] = v.valido; });
    return map;
  }, [validacoes, meuJogador]);

  const respostasCategoria = (respostas || []).filter((r) => r.categoria === categoriaAtual);

  const votar = (respostaId, valido) => {
    if (!meuJogador) return;
    mut.votarValidacao({ respostaId, votanteId: meuJogador.id, valido }).catch(() => {});
  };

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div className="ade-badge-letra">{rodada?.letra}</div>
        <div style={{ flex: 1 }}>
          <h1 className="section-title">Valide as respostas</h1>
          <p className="ade-rodada-info">
            Rodada {sala.rodadaAtual}/{sala.config.rodadas} · categoria {indiceVisivel + 1}/{categorias.length} · {restante}s
          </p>
        </div>
      </div>

      <div className="ade-timer">
        <div className={`ade-timer-fill ${pct < 25 ? "danger" : ""}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="ade-grid">
        <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} />
        <div className="card">
          <div className="card-body" style={{ padding: 18 }}>
            <div className="ade-valida-cat">
              <h4 className="ade-valida-titulo">{categoriaAtual}</h4>
              {respostasCategoria.length === 0 ? (
                <div className="ade-resp-row"><span className="ade-resp-vazia">Ninguém respondeu</span></div>
              ) : (
                respostasCategoria.map((r) => {
                  const vazia = !(r.resposta || "").trim();
                  const foraLetra = !vazia && !comecaComLetra(r.resposta, rodada.letra);
                  const ehMinha = meuJogador && r.jogadorId === meuJogador.id;
                  const meuVoto = meusVotos[r.id];
                  return (
                    <div key={r.id} className="ade-resp-row">
                      <span className={vazia ? "ade-resp-vazia" : "ade-resp-texto"}>
                        {vazia ? "(vazio)" : r.resposta}
                        {foraLetra && !vazia && (
                          <span className="section-sub" style={{ fontSize: 11, marginLeft: 6 }}>
                            não começa com {rodada.letra}
                          </span>
                        )}
                      </span>
                      {!vazia && !ehMinha && (
                        <div className="ade-vote-btns">
                          <button
                            className={`ade-vote-btn valido ${meuVoto === true ? "active" : ""}`}
                            onClick={() => votar(r.id, true)}
                          >
                            <Check size={12} /> Validar
                          </button>
                          <button
                            className={`ade-vote-btn invalido ${meuVoto === false ? "active" : ""}`}
                            onClick={() => votar(r.id, false)}
                          >
                            <Flag size={12} /> Denunciar
                          </button>
                        </div>
                      )}
                      {ehMinha && <span className="section-sub" style={{ marginLeft: "auto", fontSize: 12 }}>sua resposta</span>}
                    </div>
                  );
                })
              )}
            </div>
            <p className="section-sub" style={{ marginTop: 14, fontSize: 12, textAlign: "center" }}>
              Avança automático quando o tempo da categoria acaba.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

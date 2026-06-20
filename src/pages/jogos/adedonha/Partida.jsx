import { useEffect, useMemo, useRef, useState } from "react";
import { segundosRestantes, tempoSegundos } from "../../../lib/adedonha.js";
import { JogadoresPanel } from "./JogadoresPanel.jsx";

// Fase de preenchimento: letra, cronometro, inputs por categoria e STOP.
export function Partida({ sala, rodada, respostas, jogadores, meuJogador, mut, onlineIds }) {
  const categorias = sala.config.categorias;
  const total = tempoSegundos(sala.config.tempo);
  const restante = segundosRestantes(sala.faseIniciadaEm, total);
  const pct = Math.max(0, Math.min(100, (restante / total) * 100));

  // Respostas locais (semeadas com o que ja foi salvo pelo proprio jogador).
  const minhasSalvas = useMemo(() => {
    const map = {};
    (respostas || [])
      .filter((r) => meuJogador && r.jogadorId === meuJogador.id)
      .forEach((r) => { map[r.categoria] = r.resposta; });
    return map;
  }, [respostas, meuJogador]);

  const [valores, setValores] = useState(minhasSalvas);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && Object.keys(minhasSalvas).length > 0) {
      setValores((v) => ({ ...minhasSalvas, ...v }));
      seeded.current = true;
    }
  }, [minhasSalvas]);

  const salvarCategoria = (categoria) => {
    if (!meuJogador) return;
    mut
      .enviarRespostas({ rodadaId: rodada.id, jogadorId: meuJogador.id, respostas: { [categoria]: valores[categoria] || "" } })
      .catch(() => {});
  };

  const preenchidas = categorias.filter((c) => (valores[c] || "").trim().length > 0).length;
  const podeStop = sala.config.modoStop === "completo" ? preenchidas === categorias.length : preenchidas > 0;

  const darStop = async () => {
    if (!meuJogador) return;
    // Flush de todas as respostas antes do STOP.
    await mut
      .enviarRespostas({ rodadaId: rodada.id, jogadorId: meuJogador.id, respostas: valores })
      .catch(() => {});
    await mut.darStop({ salaId: sala.id, rodadaId: rodada.id, jogadorId: meuJogador.id }).catch(() => {});
  };

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div className="ade-badge-letra">{rodada?.letra || sala.letraAtual}</div>
        <div style={{ flex: 1 }}>
          <h1 className="section-title">Preencha as categorias</h1>
          <p className="ade-rodada-info">
            Rodada {sala.rodadaAtual}/{sala.config.rodadas} · {restante}s
          </p>
        </div>
      </div>

      <div className="ade-timer">
        <div className={`ade-timer-fill ${pct < 25 ? "danger" : ""}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="ade-grid">
        <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} onlineIds={onlineIds} />
        <div className="card">
          <div className="card-body" style={{ padding: 18 }}>
            <div className="ade-categorias">
              {categorias.map((cat) => (
                <div key={cat} className={`ade-cat ${(valores[cat] || "").trim() ? "filled" : ""}`}>
                  <label htmlFor={`cat-${cat}`}>{cat}</label>
                  <input
                    id={`cat-${cat}`}
                    value={valores[cat] || ""}
                    onChange={(e) => setValores((v) => ({ ...v, [cat]: e.target.value }))}
                    onBlur={() => salvarCategoria(cat)}
                  />
                </div>
              ))}
            </div>
            <div className="ade-stop-bar">
              <button className="ade-stop-btn" onClick={darStop} disabled={!podeStop}>
                <span className="ade-stop-ring">!</span> STOP!
              </button>
              <span className="ade-stop-hint">
                {sala.config.modoStop === "completo" && !podeStop
                  ? "Preencha todas as categorias para dar STOP."
                  : (
                    <>
                      <span className="ade-stop-progress">{preenchidas}/{categorias.length}</span> preenchidas · pare a rodada para avaliar
                    </>
                  )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

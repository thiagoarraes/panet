import { useState } from "react";
import { CheckCircle2, LogOut, Trophy } from "lucide-react";
import { Avatar } from "../../../components/Avatar.jsx";
import { segundosRestantes, TEMPO_RANKING_SEGUNDOS } from "../../../lib/adedonha.js";

// Fase de ranking (fim de rodada) e placar final.
export function Ranking({ sala, jogadores, pontuacoes, rodada, meuJogador, mut, finalizado, onSair }) {
  const [marcando, setMarcando] = useState(false);
  const deltaPorJogador = new Map((pontuacoes || []).map((p) => [p.jogadorId, p.pontos]));
  const ordenados = [...jogadores].sort((a, b) => (b.pontosTotal || 0) - (a.pontosTotal || 0));

  const estaPronto = (j) => j.prontoRodada === sala.rodadaAtual;
  const prontos = jogadores.filter(estaPronto).length;
  const euPronto = meuJogador ? estaPronto(meuJogador) : false;
  const restante = segundosRestantes(sala.faseIniciadaEm, TEMPO_RANKING_SEGUNDOS);

  const marcarPronto = async () => {
    if (!meuJogador || euPronto) return;
    setMarcando(true);
    try {
      await mut.marcarPronto({
        salaId: sala.id,
        jogadorId: meuJogador.id,
        rodadaAtual: sala.rodadaAtual,
      });
    } catch {
      setMarcando(false);
    }
  };

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Trophy size={28} color="var(--accent)" />
          <div>
            <h1 className="section-title">{finalizado ? "Placar final" : `Ranking da rodada ${sala.rodadaAtual}/${sala.config.rodadas}`}</h1>
            {rodada?.letra && !finalizado && <p className="ade-rodada-info">Letra {rodada.letra}</p>}
          </div>
        </div>
        {finalizado ? (
          <button className="btn-primary" onClick={onSair}><LogOut size={16} /> Sair</button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="section-sub">{prontos}/{jogadores.length} prontos · {restante}s</span>
            <button className="btn-primary" onClick={marcarPronto} disabled={euPronto || marcando}>
              <CheckCircle2 size={16} /> {euPronto ? "Pronto!" : "Estou pronto"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 18 }}>
          {ordenados.map((j, idx) => {
            const delta = deltaPorJogador.get(j.id) || 0;
            const pronto = !finalizado && estaPronto(j);
            return (
              <div key={j.id} className="ade-rank-row">
                <span className="ade-rank-pos">{idx + 1}</span>
                <Avatar col={j} size={34} />
                <span style={{ fontWeight: 700 }}>{j.apelido}</span>
                {pronto && (
                  <span className="ade-rank-pronto" title="Pronto">
                    <CheckCircle2 size={16} />
                  </span>
                )}
                {!finalizado && delta > 0 && <span className="ade-rank-delta">+{delta}</span>}
                <span style={{ marginLeft: "auto", fontWeight: 800, color: "var(--accent)" }}>{j.pontosTotal || 0}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

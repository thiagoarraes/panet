import { useState } from "react";
import { LogOut, Pencil } from "lucide-react";
import {
  OPCOES_PALAVRA,
  TEMPO_ESCOLHA_SEGUNDOS,
  segundosRestantes,
  sortearPalavras,
} from "../../../lib/gartic.js";
import { JogadoresPanel } from "../adedonha/JogadoresPanel.jsx";

// Fase 'escolha': o desenhista escolhe entre 3 palavras; os demais aguardam.
// As opcoes sao sorteadas localmente no cliente do desenhista (fixadas no mount)
// — nunca trafegam pelo banco, entao os adivinhadores nao conseguem espia-las.
export function EscolhaPalavra({ sala, jogadores, meuJogador, isDesenhista, rodada, mut, onlineIds, onSair }) {
  const [enviando, setEnviando] = useState(false);
  const [opcoes] = useState(() => sortearPalavras([], OPCOES_PALAVRA));
  const desenhista = jogadores.find((j) => j.id === rodada?.desenhistaId);
  const restante = segundosRestantes(sala.faseIniciadaEm, TEMPO_ESCOLHA_SEGUNDOS);

  const escolher = async (palavra) => {
    if (enviando) return;
    setEnviando(true);
    try {
      await mut.escolherPalavra({ salaId: sala.id, rodadaId: rodada.id, palavra });
    } catch {
      setEnviando(false);
    }
  };

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div>
          <h1 className="section-title">Rodada {rodada?.numero}</h1>
          <p className="section-sub">
            {isDesenhista ? "É a sua vez de desenhar!" : `${desenhista?.apelido || "Alguém"} está escolhendo…`}
          </p>
        </div>
        <button className="btn-ghost" onClick={onSair}>
          <LogOut size={16} /> Sair
        </button>
      </div>

      <div className="ade-grid">
        <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} onlineIds={onlineIds} />
        <div className="card">
          <div className="card-body gartic-escolha" style={{ padding: 28, textAlign: "center" }}>
            <div className="gartic-timer-badge" aria-hidden="true">{restante}s</div>
            {isDesenhista ? (
              <>
                <h3 style={{ marginBottom: 16 }}>
                  <Pencil size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
                  Escolha o que desenhar
                </h3>
                <div className="gartic-opcoes">
                  {opcoes.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="gartic-opcao"
                      onClick={() => escolher(p)}
                      disabled={enviando}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="gartic-aguardando">
                <span className="gartic-aguardando-emoji" aria-hidden="true">🎨</span>
                <h3>{desenhista?.apelido || "Alguém"} vai desenhar</h3>
                <p className="section-sub">Prepare seus chutes para quando o desenho começar!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

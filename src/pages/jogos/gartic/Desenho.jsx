import { LogOut, Clock } from "lucide-react";
import { segundosRestantes, tempoSegundos } from "../../../lib/gartic.js";
import { JogadoresPanel } from "../adedonha/JogadoresPanel.jsx";
import { GarticCanvas } from "./GarticCanvas.jsx";
import { ChatPalpites } from "./ChatPalpites.jsx";

// Fase 'desenho': desenhista desenha (canvas + broadcast), demais adivinham no chat.
export function Desenho(props) {
  const { sala, jogadores, meuJogador, isDesenhista, rodada, palavra, palpites, mut, onSair } = props;
  const desenhista = jogadores.find((j) => j.id === rodada?.desenhistaId);
  const restante = segundosRestantes(sala.faseIniciadaEm, tempoSegundos(sala.config.tempo));

  // Dica: desenhista/host veem a palavra; demais veem underscores pelo tamanho.
  const dica = palavra
    ? palavra.toUpperCase().split("").join(" ")
    : Array.from({ length: rodada?.palavraTamanho || 0 }, () => "_").join(" ");

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div>
          <h1 className="section-title">Rodada {rodada?.numero}</h1>
          <p className="section-sub">
            {isDesenhista ? "Você está desenhando" : `${desenhista?.apelido || "Alguém"} está desenhando`}
          </p>
        </div>
        <div className="gartic-header-right">
          <div className={`gartic-timer ${restante <= 10 ? "urgente" : ""}`}>
            <Clock size={16} /> {restante}s
          </div>
          <button className="btn-ghost" onClick={onSair}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>

      <div className="gartic-dica" aria-label="Palavra">
        {dica || "…"}
        {!palavra && rodada?.palavraTamanho ? (
          <span className="gartic-dica-cont"> ({rodada.palavraTamanho} letras)</span>
        ) : null}
      </div>

      <div className="gartic-play-grid">
        <div className="gartic-side">
          <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} />
        </div>
        <GarticCanvas key={rodada?.id} salaId={sala.id} isDesenhista={isDesenhista} />
        <ChatPalpites
          jogadores={jogadores}
          meuJogador={meuJogador}
          isDesenhista={isDesenhista}
          rodada={rodada}
          palpites={palpites}
          mut={mut}
        />
      </div>
    </div>
  );
}

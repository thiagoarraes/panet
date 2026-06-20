import { LogOut, Trophy } from "lucide-react";
import { Avatar } from "../../../components/Avatar.jsx";
import { JogadoresPanel } from "../adedonha/JogadoresPanel.jsx";

// Fase 'revelacao' (e 'fim'): mostra a palavra, os acertos da rodada e o ranking.
export function Revelacao({ jogadores, meuJogador, rodada, palavra, palpites, finalizado, onSair }) {
  const desenhista = jogadores.find((j) => j.id === rodada?.desenhistaId);
  const palavraFinal = palavra || rodada?.palavraRevelada || "";

  // Acertos desta rodada (ordenados por ordem de acerto).
  const acertos = palpites
    .filter((p) => p.acertou)
    .sort((a, b) => (a.ordemAcerto || 99) - (b.ordemAcerto || 99))
    .map((p) => ({
      jogador: jogadores.find((j) => j.id === p.jogadorId),
      pontos: p.pontos,
    }))
    .filter((a) => a.jogador);

  const ranking = [...jogadores].sort((a, b) => (b.pontosTotal || 0) - (a.pontosTotal || 0));
  const campeao = ranking[0];

  return (
    <div className="fade-up ade-wrap">
      <div className="ade-topbar">
        <div>
          <h1 className="section-title">{finalizado ? "Fim de jogo!" : `Rodada ${rodada?.numero}`}</h1>
          <p className="section-sub">
            {finalizado ? "Confira o placar final" : "Próxima rodada já já…"}
          </p>
        </div>
        {finalizado && (
          <button className="btn-ghost" onClick={onSair}>
            <LogOut size={16} /> Sair
          </button>
        )}
      </div>

      <div className="ade-grid">
        <JogadoresPanel jogadores={jogadores} meuJogador={meuJogador} />
        <div className="card">
          <div className="card-body gartic-revelacao" style={{ padding: 28 }}>
            {finalizado ? (
              <div className="gartic-campeao">
                <Trophy size={40} className="gartic-trophy" aria-hidden="true" />
                <h2>{campeao?.apelido || "—"} venceu!</h2>
                <p className="section-sub">{campeao?.pontosTotal || 0} pontos</p>
              </div>
            ) : (
              <>
                <p className="section-sub" style={{ marginBottom: 4 }}>A palavra era</p>
                <div className="gartic-palavra-revelada">{palavraFinal.toUpperCase()}</div>
                <p className="section-sub" style={{ marginBottom: 16 }}>
                  Desenhada por {desenhista?.apelido || "—"}
                </p>

                {acertos.length === 0 ? (
                  <p className="gartic-ninguem">Ninguém acertou desta vez 😅</p>
                ) : (
                  <div className="gartic-acertos">
                    {acertos.map(({ jogador, pontos }, i) => (
                      <div key={jogador.id} className="gartic-acerto-item">
                        <span className="gartic-acerto-pos">{i + 1}º</span>
                        <Avatar col={jogador} size={28} />
                        <span className="gartic-acerto-nome">{jogador.apelido}</span>
                        <span className="gartic-acerto-pts">+{pontos}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

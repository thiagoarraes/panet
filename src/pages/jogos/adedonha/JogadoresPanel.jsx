import { Avatar } from "../../../components/Avatar.jsx";

// Painel lateral com a lista de jogadores e pontuacao acumulada.
// `onlineIds` (Set de colaboradorId), quando informado, marca quem está offline.
export function JogadoresPanel({ jogadores, meuJogador, mostrarPontos = true, onlineIds }) {
  const ordenados = [...jogadores].sort((a, b) => (b.pontosTotal || 0) - (a.pontosTotal || 0));
  const usaPresenca = onlineIds instanceof Set;
  return (
    <div className="pan-card">
      <div className="card-header" style={{ padding: "10px 14px", fontWeight: 700 }}>
        Jogadores ({jogadores.length})
      </div>
      <div className="card-body ade-players" style={{ padding: 12 }}>
        {ordenados.map((j) => {
          const offline = usaPresenca && !onlineIds.has(j.colaboradorId);
          return (
            <div
              key={j.id}
              className={`ade-player ${meuJogador && j.id === meuJogador.id ? "me" : ""} ${offline ? "offline" : ""}`}
            >
              <span
                className={`ade-player-dot ${offline ? "off" : "on"}`}
                title={offline ? "Offline" : "Online"}
                aria-hidden="true"
              />
              <Avatar col={j} size={32} />
              <div>
                <div className="ade-player-nome">{j.apelido}</div>
                {j.isHost && <div className="ade-player-host">Host</div>}
              </div>
              {mostrarPontos && <span className="ade-player-pts">{j.pontosTotal || 0}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

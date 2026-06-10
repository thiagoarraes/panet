import { Avatar } from "../../../components/Avatar.jsx";

// Painel lateral com a lista de jogadores e pontuacao acumulada.
export function JogadoresPanel({ jogadores, meuJogador, mostrarPontos = true }) {
  const ordenados = [...jogadores].sort((a, b) => (b.pontosTotal || 0) - (a.pontosTotal || 0));
  return (
    <div className="card">
      <div className="card-header" style={{ padding: "10px 14px", fontWeight: 700 }}>
        Jogadores ({jogadores.length})
      </div>
      <div className="card-body ade-players" style={{ padding: 12 }}>
        {ordenados.map((j) => (
          <div key={j.id} className={`ade-player ${meuJogador && j.id === meuJogador.id ? "me" : ""}`}>
            <Avatar col={j} size={32} />
            <div>
              <div className="ade-player-nome">{j.apelido}</div>
              {j.isHost && <div className="ade-player-host">Host</div>}
            </div>
            {mostrarPontos && <span className="ade-player-pts">{j.pontosTotal || 0}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

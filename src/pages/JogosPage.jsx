import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AdedonhaApp } from "./jogos/adedonha/AdedonhaApp.jsx";
import "../styles/adedonha.css";

const JOGOS = [
  {
    id: "adedonha",
    nome: "Adedonha",
    desc: "Sorteia uma letra e corre pra preencher as categorias antes de gritar STOP!",
    letras: ["A", "B", "C", "D"],
    disponivel: true,
  },
];

export function JogosPage({ currentUser, currentUserId }) {
  const [jogoAtivo, setJogoAtivo] = useState(null);

  if (jogoAtivo === "adedonha") {
    return (
      <AdedonhaApp
        currentUser={currentUser}
        currentUserId={currentUserId}
        onSair={() => setJogoAtivo(null)}
      />
    );
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 className="section-title">Jogos</h1>
        <p className="section-sub">Multiplayer e em tempo real. Jogue com a galera da Pan — mais jogos em breve.</p>
      </div>
      <div className="jogos-hub">
        {JOGOS.map((jogo) => (
          <button
            key={jogo.id}
            type="button"
            className={`jogo-card ${jogo.disponivel ? "" : "disabled"}`}
            onClick={() => jogo.disponivel && setJogoAtivo(jogo.id)}
            disabled={!jogo.disponivel}
          >
            <span className="jogo-card-shine" aria-hidden="true" />
            <div className="jogo-card-letras" aria-hidden="true">
              {jogo.letras.map((l, i) => (
                <span key={l} style={{ "--i": i }}>{l}</span>
              ))}
            </div>
            <div className="jogo-card-top">
              <div className="jogo-card-icon">{jogo.letras[0]}</div>
            </div>
            <h3>{jogo.nome}</h3>
            <p>{jogo.desc}</p>
            <div className="jogo-card-foot">
              <span className="jogo-card-play">
                Jogar <ArrowRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

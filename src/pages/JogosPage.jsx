import { lazy, Suspense, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
// adedonha.css fica aqui: o hub de jogos usa as classes .jogos-hub/.jogo-card.
import "../styles/adedonha.css";

// Cada jogo vira um chunk separado, carregado só quando o jogador o abre.
const AdedonhaApp = lazy(() =>
  import("./jogos/adedonha/AdedonhaApp.jsx").then((m) => ({ default: m.AdedonhaApp }))
);
const GarticApp = lazy(() =>
  import("./jogos/gartic/GarticApp.jsx").then((m) => ({ default: m.GarticApp }))
);

const JOGOS = [
  {
    id: "adedonha",
    nome: "Adedonha",
    desc: "Sorteia uma letra e corre pra preencher as categorias antes de gritar STOP!",
    letras: ["A", "B", "C", "D"],
    disponivel: true,
  },
  {
    id: "gartic",
    nome: "Gartic",
    desc: "Desenhe a palavra secreta e deixe a galera adivinhar — ou seja o primeiro a chutar!",
    letras: ["🎨", "✏️", "🖌️", "❓"],
    disponivel: true,
  },
];

export function JogosPage({ currentUser, currentUserId }) {
  const [jogoAtivo, setJogoAtivo] = useState(null);

  if (jogoAtivo === "adedonha" || jogoAtivo === "gartic") {
    const JogoApp = jogoAtivo === "gartic" ? GarticApp : AdedonhaApp;
    return (
      <ErrorBoundary
        mensagem="O jogo travou. Volte para os jogos e tente de novo."
        onReset={() => setJogoAtivo(null)}
      >
        <Suspense
          fallback={
            <div className="card">
              <div className="card-body" style={{ padding: 24 }}>
                <div className="section-sub">Carregando jogo…</div>
              </div>
            </div>
          }
        >
          <JogoApp
            currentUser={currentUser}
            currentUserId={currentUserId}
            onSair={() => setJogoAtivo(null)}
          />
        </Suspense>
      </ErrorBoundary>
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

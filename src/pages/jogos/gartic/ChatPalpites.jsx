import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

// Chat de palpites. Quem acertou aparece como "acertou!" (nunca mostra o texto,
// para nao vazar a palavra). Desenhista e quem ja acertou ficam com input travado.
export function ChatPalpites({ jogadores, meuJogador, isDesenhista, rodada, palpites, mut }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef(null);

  const nomePor = (jogadorId) =>
    jogadores.find((j) => j.id === jogadorId)?.apelido || "Jogador";

  const jaAcertei = Boolean(
    meuJogador && palpites.some((p) => p.jogadorId === meuJogador.id && p.acertou)
  );
  const podeChutar = !isDesenhista && !jaAcertei && Boolean(meuJogador);

  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [palpites.length]);

  const enviar = async () => {
    const limpo = texto.trim();
    if (!limpo || enviando || !podeChutar) return;
    setEnviando(true);
    setTexto("");
    try {
      await mut.enviarPalpite({ rodadaId: rodada.id, jogadorId: meuJogador.id, texto: limpo });
    } catch {
      /* silencioso: realtime/poll reconciliam */
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card gartic-chat">
      <div className="card-header" style={{ padding: "10px 14px", fontWeight: 700 }}>
        Palpites
      </div>
      <div ref={listaRef} className="gartic-chat-lista">
        {palpites.length === 0 ? (
          <p className="section-sub" style={{ padding: 12, fontSize: 13 }}>
            Os chutes aparecem aqui…
          </p>
        ) : (
          palpites.map((p) => (
            <div key={p.id} className={`gartic-chat-msg ${p.acertou ? "acertou" : ""}`}>
              <strong>{nomePor(p.jogadorId)}</strong>
              {p.acertou ? <span className="gartic-acertou">✅ acertou!</span> : <span>{p.texto}</span>}
            </div>
          ))
        )}
      </div>
      <div className="gartic-chat-input">
        {isDesenhista ? (
          <span className="section-sub" style={{ fontSize: 13 }}>Você está desenhando…</span>
        ) : jaAcertei ? (
          <span className="gartic-acertou" style={{ fontSize: 13 }}>🎉 Você acertou!</span>
        ) : (
          <>
            <input
              value={texto}
              maxLength={60}
              placeholder="Digite seu chute"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              disabled={!podeChutar}
            />
            <button className="btn-primary" onClick={enviar} disabled={!podeChutar || !texto.trim()}>
              <Send size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

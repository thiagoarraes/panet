import { MessageSquare } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { useState } from "react";

export function MuralPage({ mensagens, currentUser, onEnviarMensagem }) {
  const [texto, setTexto] = useState("");

  const enviar = async () => {
    if (!texto.trim()) return;
    await onEnviarMensagem(texto.trim());
    setTexto("");
  };

  return (
    <div className="fade-up">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={20} /> PanZap da Pan
          </div>
          <div className="section-sub">Mensagens internas do time</div>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 700 }}>
        <div className="card-body">
          <div className="mural-input" style={{ marginBottom: 16 }}>
            <Avatar col={currentUser} size={36} />
            <input
              className="input-field"
              placeholder="Escreva uma mensagem no PanZap..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
            />
            <button className="btn-primary" onClick={enviar}>
              Enviar
            </button>
          </div>
          {mensagens.map((m) => (
            <div key={m.id} className="mural-msg">
              <Avatar col={m.colaborador} size={36} />
              <div className="mural-content">
                <div className="mural-header">
                  <span className="mural-name">{m.colaborador.nome}</span>
                  <span className="mural-time">
                    {m.data} · {m.hora}
                  </span>
                </div>
                <div className="mural-text">{m.texto}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

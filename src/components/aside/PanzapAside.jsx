import { MessageSquare, SendHorizonal } from "lucide-react";
import { Avatar } from "../Avatar";

export function PanzapAside({ mensagens, currentUser, currentUserId, textoMural, setTextoMural, enviandoMural, onEnviar, muralListRef }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={14} /> PanZap
        </span>
      </div>
      <div className="card-body" style={{ padding: "12px 12px 10px" }}>
        <div ref={muralListRef} style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
          {mensagens.map((m) => {
            const isMine = String(m.colaborador?.id) === String(currentUserId);
            return (
              <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                {!isMine && <Avatar col={m.colaborador} size={28} />}
                <div
                  style={{
                    maxWidth: "82%",
                    background: isMine ? "color-mix(in srgb, var(--accent) 22%, var(--surface))" : "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "7px 10px",
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>
                    {!isMine ? `${m.colaborador.nome.split(" ")[0]} · ` : ""}
                    {m.hora}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45 }}>{m.texto}</div>
                </div>
                {isMine && <Avatar col={m.colaborador} size={28} />}
              </div>
            );
          })}
          {mensagens.length === 0 && <div className="empty-state" style={{ padding: 14 }}>Sem mensagens no PanZap.</div>}
        </div>
        <div className="mural-input" style={{ marginTop: 10 }}>
          <Avatar col={currentUser} size={30} />
          <input
            className="input-field"
            placeholder="Escreva algo..."
            value={textoMural}
            onChange={(e) => setTextoMural(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onEnviar()}
            style={{ fontSize: 12, padding: "9px 11px" }}
          />
          <button
            className="btn-primary"
            style={{ padding: "9px 11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            onClick={onEnviar}
            disabled={enviandoMural}
          >
            <SendHorizonal size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

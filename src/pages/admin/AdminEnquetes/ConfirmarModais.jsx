import { AlertTriangle, BarChart3 } from "lucide-react";

export function ConfirmarEncerrarModal({ confirmEnd, pendingEndIds, onClose, onConfirm }) {
  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--accent)" }}>
            <BarChart3 size={36} />
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            Encerrar enquete agora?
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
            Os votos param imediatamente e o resultado final continua visível.
          </div>
          <div className="admin-modal-actions" style={{ justifyContent: "center" }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={onConfirm}
              disabled={pendingEndIds.has(confirmEnd.id)}
            >
              Encerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfirmarExcluirModal({ confirmDelete, pendingDeleteIds, onClose, onConfirm }) {
  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
            <AlertTriangle size={36} />
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            Excluir enquete?
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
            Esta ação remove pergunta, opções e votos.
          </div>
          <div className="admin-modal-actions" style={{ justifyContent: "center" }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button
              style={{
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={onConfirm}
              disabled={pendingDeleteIds.has(confirmDelete.id)}
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

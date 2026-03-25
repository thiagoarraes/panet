import { AlertTriangle } from "lucide-react";

export function ConfirmarExcluirModal({ title, onClose, onConfirm, disabled }) {
  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
            <AlertTriangle size={36} />
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
            Essa ação não pode ser desfeita.
          </div>
          <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button
              onClick={onConfirm}
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
              disabled={disabled}
            >
              Remover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

export function ConfirmarExcluirModal({ colaborador, loading, onClose, onConfirm }) {
  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div className="pan-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
            <AlertTriangle size={36} />
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
            Excluir colaborador?
          </div>
          <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
            <strong>{colaborador.nome}</strong> será removido(a) da Panet.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Button variant="tertiary" onPress={onClose}>Cancelar</Button>
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
              disabled={loading}
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

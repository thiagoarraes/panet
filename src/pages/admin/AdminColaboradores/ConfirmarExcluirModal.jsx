import { Button, Modal } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

export function ConfirmarExcluirModal({ colaborador, loading, onClose, onConfirm }) {
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog
          aria-label="Excluir colaborador"
          style={{ maxWidth: 400, border: "1px solid var(--border)" }}
        >
          <Modal.Body style={{ textAlign: "center", padding: 8 }}>
            <div style={{ marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
              <AlertTriangle size={36} />
            </div>
            <div
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: 17,
                marginBottom: 8,
                color: "var(--text)",
              }}
            >
              Excluir colaborador?
            </div>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              <strong>{colaborador.nome}</strong> será removido(a) da Panet.
            </div>
          </Modal.Body>
          <Modal.Footer style={{ justifyContent: "center" }}>
            <Button variant="tertiary" slot="close" isDisabled={loading}>
              Cancelar
            </Button>
            <Button variant="danger" onPress={onConfirm} isDisabled={loading}>
              Excluir
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

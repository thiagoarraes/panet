import { Button, Modal } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

export function ConfirmarExcluirModal({ title, onClose, onConfirm, disabled }) {
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog aria-label={title} style={{ maxWidth: 360, border: "1px solid var(--border)" }}>
          <Modal.Body style={{ textAlign: "center", padding: 8 }}>
            <div style={{ marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
              <AlertTriangle size={36} />
            </div>
            <div
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 8,
                color: "var(--text)",
              }}
            >
              {title}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Essa ação não pode ser desfeita.</div>
          </Modal.Body>
          <Modal.Footer style={{ justifyContent: "center" }}>
            <Button variant="tertiary" slot="close" isDisabled={disabled}>
              Cancelar
            </Button>
            <Button variant="danger" onPress={onConfirm} isDisabled={disabled}>
              Remover
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

import { Button, Modal } from "@heroui/react";
import { AlertTriangle, BarChart3 } from "lucide-react";

export function ConfirmarEncerrarModal({ confirmEnd, pendingEndIds, onClose, onConfirm }) {
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
          aria-label="Encerrar enquete"
          style={{ maxWidth: 360, border: "1px solid var(--border)" }}
        >
          <Modal.Body style={{ textAlign: "center", padding: 8 }}>
            <div style={{ marginBottom: 12, display: "inline-flex", color: "var(--accent)" }}>
              <BarChart3 size={36} />
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
              Encerrar enquete agora?
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Os votos param imediatamente e o resultado final continua visível.
            </div>
          </Modal.Body>
          <Modal.Footer style={{ justifyContent: "center" }}>
            <Button variant="tertiary" slot="close">
              Cancelar
            </Button>
            <Button onPress={onConfirm} isDisabled={pendingEndIds.has(confirmEnd.id)}>
              Encerrar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function ConfirmarExcluirModal({ confirmDelete, pendingDeleteIds, onClose, onConfirm }) {
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
          aria-label="Excluir enquete"
          style={{ maxWidth: 360, border: "1px solid var(--border)" }}
        >
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
              Excluir enquete?
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Esta ação remove pergunta, opções e votos.
            </div>
          </Modal.Body>
          <Modal.Footer style={{ justifyContent: "center" }}>
            <Button variant="tertiary" slot="close">
              Cancelar
            </Button>
            <Button variant="danger" onPress={onConfirm} isDisabled={pendingDeleteIds.has(confirmDelete.id)}>
              Excluir
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

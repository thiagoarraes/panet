import { Button, Modal } from "@heroui/react";

export function SenhaModal({ senhaGerada, senhaCopiada, onCopiar, onClose }) {
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog style={{ maxWidth: 420, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
              Senha temporária gerada
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Informe esta senha temporária ao colaborador. No próximo login, ele será obrigado a trocar para uma
              senha permanente.
            </div>
            <div
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{senhaGerada.email}</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                {senhaGerada.senha}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onCopiar}>
              {senhaCopiada ? "Copiado!" : "Copiar senha"}
            </Button>
            <Button slot="close">Fechar</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

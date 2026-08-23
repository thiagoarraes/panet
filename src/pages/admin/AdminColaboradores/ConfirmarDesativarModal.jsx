import { Button, Modal } from "@heroui/react";
import { UserMinus, UserCheck } from "lucide-react";
import { Avatar } from "../../../components/Avatar";

export function ConfirmarDesativarModal({ colaborador, action = "desativar", loading, onClose, onConfirm }) {
  const isDesativar = action === "desativar";

  const accentColor = isDesativar ? "#f59e0b" : "var(--accent)";
  const accentAlpha = isDesativar ? "rgba(245,158,11,0.12)" : "color-mix(in srgb, var(--accent) 12%, transparent)";
  const accentBorder = isDesativar ? "rgba(245,158,11,0.3)" : "color-mix(in srgb, var(--accent) 30%, transparent)";

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
          aria-label={isDesativar ? "Tornar Ex Panner" : "Reativar colaborador"}
          style={{ maxWidth: 420, border: "1px solid var(--border)" }}
        >
          <Modal.Body style={{ padding: 8, textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: accentAlpha,
                border: `1.5px solid ${accentBorder}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                color: accentColor,
              }}
            >
              {isDesativar ? <UserMinus size={26} /> : <UserCheck size={26} />}
            </div>

            <div
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: 17,
                marginBottom: 6,
                color: "var(--text)",
              }}
            >
              {isDesativar ? "Tornar Ex Panner?" : "Reativar colaborador?"}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "center",
                margin: "12px 0 16px",
                padding: "10px 16px",
                borderRadius: 10,
                background: "var(--surface2)",
                border: "1px solid var(--border)",
              }}
            >
              <Avatar col={colaborador} size={32} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{colaborador.nome}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{colaborador.cargo}</div>
              </div>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, padding: "0 4px" }}>
              {isDesativar ? (
                <>
                  O acesso de <strong style={{ color: "var(--text)" }}>{colaborador.nome}</strong> à Panet será
                  revogado imediatamente.
                  <br />
                  <span style={{ fontSize: 12, marginTop: 4, display: "inline-block" }}>
                    Os dados históricos serão preservados para consulta interna.
                  </span>
                </>
              ) : (
                <>
                  <strong style={{ color: "var(--text)" }}>{colaborador.nome}</strong> poderá acessar a Panet
                  novamente com as credenciais existentes.
                </>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer style={{ justifyContent: "center" }}>
            <Button variant="tertiary" slot="close" isDisabled={loading}>
              Cancelar
            </Button>
            <Button
              onPress={onConfirm}
              isDisabled={loading}
              style={{
                background: isDesativar ? "#f59e0b" : "var(--accent)",
                color: isDesativar ? "#111" : "var(--bg)",
              }}
            >
              {loading
                ? isDesativar ? "Desativando…" : "Reativando…"
                : isDesativar ? "Tornar Ex Panner" : "Reativar acesso"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

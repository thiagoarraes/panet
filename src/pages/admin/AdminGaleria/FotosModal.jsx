import { Button, Modal } from "@heroui/react";
import { ImageIcon, Trash2 } from "lucide-react";

export function FotosModal({ eventoAtual, saving, inputFotosMaisRef, onClose, onUploadMais, onSetCapa, onDeleteFoto }) {
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog style={{ maxWidth: 760, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: 17,
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <ImageIcon size={16} /> Fotos de {eventoAtual.evento}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div
              className="admin-galeria-fotos-toolbar"
              style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}
            >
              <input
                ref={inputFotosMaisRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => onUploadMais(e.target.files)}
              />
              <Button onPress={() => inputFotosMaisRef.current?.click()} isDisabled={saving}>
                {saving ? "Enviando..." : "+ Adicionar mais fotos"}
              </Button>
            </div>
            <div
              className="admin-galeria-fotos-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}
            >
              {(eventoAtual.fotos || []).map((foto) => (
                <div key={foto.id} className="pan-card admin-galeria-foto-card" style={{ padding: 8 }}>
                  {eventoAtual.capa === foto.src && (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--accent)",
                        marginBottom: 6,
                        letterSpacing: 0.4,
                      }}
                    >
                      CAPA ATUAL
                    </div>
                  )}
                  <img
                    src={foto.src}
                    alt={foto.legenda || "foto"}
                    style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8 }}
                  />
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, minHeight: 18 }}>
                    {foto.legenda || "Sem legenda"}
                  </div>
                  <div className="admin-galeria-foto-actions" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={() => onSetCapa({ eventoId: eventoAtual.id, fotoUrl: foto.src })}
                    >
                      Definir capa
                    </Button>
                    <button
                      className="admin-action-icon is-danger"
                      type="button"
                      onClick={() => onDeleteFoto(foto.id)}
                      aria-label="Excluir foto"
                      title="Excluir"
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))}
              {(eventoAtual.fotos || []).length === 0 && (
                <div className="empty-state">Nenhuma foto neste evento.</div>
              )}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

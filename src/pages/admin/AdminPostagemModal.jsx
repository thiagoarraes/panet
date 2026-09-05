import { Button, Modal } from "@heroui/react";
import { PanDatePicker } from "../../components/ui/PanDatePicker.jsx";
import { PostImageUploadCrop } from "../../components/PostImageUploadCrop";
import { RichTextEditor } from "../../components/RichTextEditor";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

export function AdminPostagemModal({ modal, form, setForm, setModal, onSalvar, saving, errorMsg, categorias, currentUserId }) {
  const { data: colaboradores = [] } = useColaboradores(currentUserId, { summaryOnly: true });
  if (modal === null) return null;

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) setModal(null);
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog style={{ maxWidth: 600, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
              {modal === "novo" ? "Nova postagem" : "Editar postagem"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
          <div className="form-group">
            <span className="form-label">IMAGEM DE DESTAQUE</span>
            <PostImageUploadCrop value={form.imagem} onChange={(v) => setForm((p) => ({ ...p, imagem: v }))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="postagem-titulo">TÍTULO *</label>
            <input
              id="postagem-titulo"
              className="form-input"
              value={form.titulo || ""}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Título da postagem"
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="postagem-categoria">CATEGORIA</label>
              <select id="postagem-categoria" className="form-input" value={form.categoria || "Notícia"} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <span className="form-label">DATA</span>
              <PanDatePicker
                value={form.data}
                onChange={(iso) => setForm((p) => ({ ...p, data: iso }))}
              />
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">DESCRIÇÃO *</span>
            <RichTextEditor
              value={form.descricao || ""}
              onChange={(html) => setForm((p) => ({ ...p, descricao: html }))}
              placeholder="Descreva o conteúdo da postagem..."
              colaboradores={colaboradores}
            />
          </div>
          {errorMsg && (
            <div className="admin-presencial-form-error" style={{ marginBottom: 4 }}>
              {errorMsg}
            </div>
          )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">Cancelar</Button>
            <Button onPress={onSalvar} isDisabled={saving}>
              {modal === "novo" ? "Publicar" : "Salvar"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

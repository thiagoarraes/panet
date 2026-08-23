import { X } from "lucide-react";
import { PanDatePicker } from "../../components/ui/PanDatePicker.jsx";
import { PostImageUploadCrop } from "../../components/PostImageUploadCrop";
import { RichTextEditor } from "../../components/RichTextEditor";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

export function AdminPostagemModal({ modal, form, setForm, setModal, onSalvar, saving, errorMsg, categorias, currentUserId }) {
  const { data: colaboradores = [] } = useColaboradores(currentUserId, { summaryOnly: true });
  if (modal === null) return null;

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
      <div className="pan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {modal === "novo" ? "Nova postagem" : "Editar postagem"}
          </div>
          <button className="modal-close" onClick={() => setModal(null)}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">IMAGEM DE DESTAQUE</label>
            <PostImageUploadCrop value={form.imagem} onChange={(v) => setForm((p) => ({ ...p, imagem: v }))} />
          </div>
          <div className="form-group">
            <label className="form-label">TÍTULO *</label>
            <input
              className="form-input"
              value={form.titulo || ""}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Título da postagem"
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">CATEGORIA</label>
              <select className="form-input" value={form.categoria || "Notícia"} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">DATA</label>
              <PanDatePicker
                value={form.data}
                onChange={(iso) => setForm((p) => ({ ...p, data: iso }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">DESCRIÇÃO *</label>
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
          <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={onSalvar} disabled={saving}>
              {modal === "novo" ? "Publicar" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

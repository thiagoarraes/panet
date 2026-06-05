import DatePicker from "react-datepicker";
import { X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { PostImageUploadCrop } from "../../components/PostImageUploadCrop";
import { RichTextEditor } from "../../components/RichTextEditor";
import { useColaboradores } from "../../hooks/queries/useColaboradores";

const parseIsoToDate = (isoDate) => {
  if (!isoDate) return null;
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
};

const formatDateForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function AdminPostagemModal({ modal, form, setForm, setModal, onSalvar, saving, categorias, currentUserId }) {
  const { data: colaboradores = [] } = useColaboradores(currentUserId, { summaryOnly: true });
  if (modal === null) return null;

  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
              <DatePicker
                selected={parseIsoToDate(form.data)}
                onChange={(date) => setForm((p) => ({ ...p, data: formatDateForStore(date) }))}
                locale={ptBR}
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/aaaa"
                className="form-input datepicker-input"
                calendarClassName="panet-datepicker"
                popperClassName="panet-datepicker-popper"
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

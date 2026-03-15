import { useState } from "react";
import { AlertTriangle, Heart, MessageCircle, X } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Badge } from "../../components/Badge";
import { PostImageUploadCrop } from "../../components/PostImageUploadCrop";
import { RichTextEditor } from "../../components/RichTextEditor";

const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;

const stripHtml = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

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

export function AdminPostagens({ postagens, setPostagens, onCreatePost, onUpdatePost, onDeletePost }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [saving, setSaving] = useState(false);
  const CATS = ["Notícia", "Comunicado", "Evento"];

  const abrirNovo = () => {
    setForm({
      titulo: "",
      categoria: "Notícia",
      data: new Date().toISOString().split("T")[0],
      descricao: "",
      imagem: postImg("nova-postagem"),
      curtidas: [],
      comentarios: [],
    });
    setModal("novo");
  };

  const abrirEditar = (post) => {
    setForm({ ...post });
    setModal(post);
  };

  const salvar = async () => {
    if (!form.titulo || !stripHtml(form.descricao)) return;
    try {
      setSaving(true);
      if (modal === "novo") {
        if (onCreatePost) {
          await onCreatePost(form);
        } else {
          setPostagens((p) => [{ ...form, id: Date.now() }, ...p]);
        }
      } else if (onUpdatePost) {
        await onUpdatePost(form.id, form);
      } else {
        setPostagens((p) => p.map((x) => (x.id === form.id ? form : x)));
      }
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (post) => {
    try {
      setSaving(true);
      if (onDeletePost) {
        await onDeletePost(post.id);
      } else {
        setPostagens((p) => p.filter((x) => x.id !== post.id));
      }
      setConfirmarExcluir(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-toolbar admin-toolbar-end" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn-primary" onClick={abrirNovo}>
          + Nova postagem
        </button>
      </div>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {postagens.map((post) => (
          <div key={post.id} className="card" style={{ padding: 16, transition: "border-color 0.2s" }}>
            <div className="admin-post-row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={post.imagem} alt={post.titulo} style={{ width: 72, height: 36, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              <div className="admin-post-main" style={{ flex: 1 }}>
                <div className="admin-post-meta" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Badge cat={post.categoria} />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(post.data)}</span>
                </div>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 14 }}>{post.titulo}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 2,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {stripHtml(post.descricao)}
                </div>
              </div>
              <div className="admin-post-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="admin-post-stats" style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Heart size={12} /> {post.curtidas.length} · <MessageCircle size={12} /> {post.comentarios.length}
                </span>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => abrirEditar(post)}>
                  Editar
                </button>
                <button
                  onClick={() => setConfirmarExcluir(post)}
                  style={{
                    background: "rgba(255,107,107,0.1)",
                    border: "1px solid rgba(255,107,107,0.3)",
                    color: "var(--danger)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
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
                    {CATS.map((c) => (
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
                />
              </div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>
                  {modal === "novo" ? "Publicar" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
                <AlertTriangle size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Excluir postagem?</div>
              <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>Esta ação não pode ser desfeita.</div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={() => excluir(confirmarExcluir)}
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
                  disabled={saving}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


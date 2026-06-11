import { Suspense, lazy, useEffect, useState } from "react";
import { AlertTriangle, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "../../components/Badge";
import { useAdminPostagens } from "../../hooks/queries/admin/useAdminPostagens.js";
import { useCreatePost, useUpdatePost, useDeletePost } from "../../hooks/mutations/usePostMutations.js";

const loadAdminPostagemModal = () => import("./AdminPostagemModal");
const AdminPostagemModal = lazy(() => loadAdminPostagemModal().then((m) => ({ default: m.AdminPostagemModal })));

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

export function AdminPostagens({ currentUserId }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const CATS = ["Notícia", "Comunicado", "Evento", "Reconhecimento"];
  const PAGE_SIZE = 20;

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useAdminPostagens({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm });
  const rows = data?.rows || [];
  const totalItems = data?.count || 0;
  const uiTotalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, uiTotalPages);

  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();

  const abrirNovo = () => {
    loadAdminPostagemModal().catch(() => {});
    setErrorMsg("");
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
    loadAdminPostagemModal().catch(() => {});
    setErrorMsg("");
    setForm({ ...post });
    setModal(post);
  };

  const salvar = async () => {
    if (!form.titulo || !stripHtml(form.descricao)) return;
    try {
      setSaving(true);
      setErrorMsg("");
      if (modal === "novo") {
        await createPost.mutateAsync({ payload: { ...form }, userId: currentUserId });
      } else {
        await updatePost.mutateAsync({
          postId: form.id,
          payload: { ...form },
          userId: currentUserId,
          previousImageUrl: modal?.imagem || null,
        });
      }
      setModal(null);
    } catch (error) {
      console.error(error);
      setErrorMsg(error?.message || "Não foi possível salvar a postagem.");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (post) => {
    try {
      setPendingDeleteIds((prev) => new Set(prev).add(post.id));
      await deletePost.mutateAsync({ postId: post.id, previousImageUrl: post.imagem || null });
      setConfirmarExcluir(null);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  return (
    <div>
      <div className="admin-toolbar admin-toolbar-end" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar por título, categoria ou descrição"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className="btn-primary" onClick={abrirNovo}>
          + Nova postagem
        </button>
      </div>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((post) => (
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
                <div className="admin-post-action-buttons">
                  <button
                    className="admin-action-icon"
                    type="button"
                    onClick={() => abrirEditar(post)}
                    aria-label={`Editar ${post.titulo}`}
                    title="Editar"
                  >
                    <Pencil />
                  </button>
                  <button
                    className="admin-action-icon is-danger"
                    type="button"
                    onClick={() => setConfirmarExcluir(post)}
                    disabled={pendingDeleteIds.has(post.id)}
                    aria-label={pendingDeleteIds.has(post.id) ? "Excluindo postagem" : `Excluir ${post.titulo}`}
                    title={pendingDeleteIds.has(post.id) ? "Excluindo..." : "Excluir"}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="empty-state">
            {isLoading ? "Carregando..." : searchTerm ? "Nenhuma postagem encontrada para este filtro." : "Sem postagens."}
          </div>
        )}
      </div>

      {totalItems > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {uiPage} de {uiTotalPages} · {totalItems} item(ns)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={uiPage <= 1}>
              Anterior
            </button>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.min(uiTotalPages, p + 1))} disabled={uiPage >= uiTotalPages}>
              Próxima
            </button>
          </div>
        </div>
      )}

      {modal !== null && (
        <Suspense
          fallback={
            <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }}>
              <div className="modal">
                <div className="modal-body">
                  <div className="section-sub">Carregando editor...</div>
                </div>
              </div>
            </div>
          }
        >
          <AdminPostagemModal
            modal={modal}
            form={form}
            setForm={setForm}
            setModal={setModal}
            onSalvar={salvar}
            saving={saving}
            errorMsg={errorMsg}
            categorias={CATS}
            currentUserId={currentUserId}
          />
        </Suspense>
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
                  disabled={pendingDeleteIds.has(confirmarExcluir.id)}
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

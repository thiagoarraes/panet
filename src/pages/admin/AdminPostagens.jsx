import { Suspense, lazy, useEffect, useState } from "react";
import { Button, Modal, toast } from "@heroui/react";
import { AlertTriangle, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "../../components/Badge";
import { useAdminPostagens } from "../../hooks/queries/admin/useAdminPostagens.js";
import { useCreatePost, useUpdatePost, useDeletePost } from "../../hooks/mutations/usePostMutations.js";
import { PanTooltip } from "../../components/ui/PanTooltip";
import "../../styles/admin-postagens.css";

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
      toast.success("Postagem excluída");
    } catch (error) {
      // Antes so ia para o console: o modal de confirmacao ficava aberto
      // sem dizer que a exclusao nao aconteceu.
      toast.danger("Não foi possível excluir", {
        description: error?.message || "Tente novamente em instantes.",
      });
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
      <div className="admin-toolbar admin-toolbar-end admin-postagens-toolbar">
        <input
          className="form-input admin-postagens-busca"
          placeholder="Buscar por título, categoria ou descrição"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className="btn-primary" onClick={abrirNovo}>
          + Nova postagem
        </button>
      </div>
      <div className="stagger admin-postagens-lista">
        {rows.map((post) => (
          <div key={post.id} className="pan-card admin-postagens-card">
            <div className="admin-post-row">
              <img src={post.imagem} alt={post.titulo} className="admin-post-thumb" />
              <div className="admin-post-main">
                <div className="admin-post-meta">
                  <Badge cat={post.categoria} />
                  <span className="admin-post-data">{fmtDate(post.data)}</span>
                </div>
                <div className="admin-post-titulo">{post.titulo}</div>
                <div className="admin-post-desc">{stripHtml(post.descricao)}</div>
              </div>
              <div className="admin-post-actions">
                <span className="admin-post-stats">
                  <Heart size={12} /> {post.curtidas.length} · <MessageCircle size={12} /> {post.comentarios.length}
                </span>
                <div className="admin-post-action-buttons">
                  <PanTooltip texto="Editar">
                    <button
                      className="admin-action-icon"
                      type="button"
                      onClick={() => abrirEditar(post)}
                      aria-label={`Editar ${post.titulo}`}
                    >
                      <Pencil />
                    </button>
                  </PanTooltip>
                  <PanTooltip texto={pendingDeleteIds.has(post.id) ? "Excluindo..." : "Excluir"}>
                    <button
                      className="admin-action-icon is-danger"
                      type="button"
                      onClick={() => setConfirmarExcluir(post)}
                      disabled={pendingDeleteIds.has(post.id)}
                      aria-label={pendingDeleteIds.has(post.id) ? "Excluindo postagem" : `Excluir ${post.titulo}`}
                    >
                      <Trash2 />
                    </button>
                  </PanTooltip>
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
        <div className="admin-postagens-paginacao">
          <div className="admin-postagens-contagem">
            Página {uiPage} de {uiTotalPages} · {totalItems} item(ns)
          </div>
          <div className="admin-postagens-paginacao-botoes">
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
            <div className="modal-overlay admin-postagens-loading-overlay">
              <div className="pan-modal">
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
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(aberto) => {
            if (!aberto) setConfirmarExcluir(null);
          }}
        >
          <Modal.Container>
            <Modal.Dialog
              aria-label="Excluir postagem"
              className="admin-postagens-confirm"
            >
              <Modal.Body className="admin-postagens-confirm-body">
                <div className="admin-postagens-confirm-icone">
                  <AlertTriangle size={36} />
                </div>
                <div className="admin-postagens-confirm-titulo">Excluir postagem?</div>
                <div className="admin-postagens-confirm-texto">Esta ação não pode ser desfeita.</div>
              </Modal.Body>
              <Modal.Footer className="admin-postagens-confirm-footer">
                <Button variant="tertiary" slot="close">Cancelar</Button>
                <Button
                  variant="danger"
                  onPress={() => excluir(confirmarExcluir)}
                  isDisabled={pendingDeleteIds.has(confirmarExcluir.id)}
                >
                  Excluir
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </div>
  );
}

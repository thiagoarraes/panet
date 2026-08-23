import { useMemo, useState } from "react";
import { Heart, MessageCircle, Send, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { RichContent } from "../components/RichContent";
import { Badge } from "../components/Badge";
import { AniversariosAside } from "../components/aside/AniversariosAside";
import { PanOffAside } from "../components/aside/PanOffAside";
import { usePostagemDetalhe } from "../hooks/queries/usePostagemDetalhe";
import { usePostagensSlugIndex } from "../hooks/queries/usePostagensSlugIndex";
import { useAniversarios } from "../hooks/queries/useAniversarios";
import { useColaboradores } from "../hooks/queries/useColaboradores";
import { useFerias } from "../hooks/queries/useFerias";
import { useAusencias } from "../hooks/queries/useAusencias";
import { useToggleCurtida, useComentar, useEditarComentario, useDeletarComentario } from "../hooks/mutations/usePostMutations";
import { getAusenciaEffectiveEnd } from "../lib/ausencias.js";
import { getFeriasStatusByDate, parseBrDate } from "../lib/panoff.js";
import { toPostSlug } from "../lib/postRouting.js";

const getDateBoxParts = (iso) => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "---", year: "----" };
  const day = String(date.getDate()).padStart(2, "0");
  const month = date
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
  const year = String(date.getFullYear());
  return { day, month, year };
};

const formatCountLabel = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

const formatDiasRestantes = (diasRestantes) => {
  if (diasRestantes === 0) return "Hoje";
  if (diasRestantes === 1) return "Amanhã";
  return `em ${diasRestantes} dias`;
};

const daysUntilBirthday = (isoDate) => {
  const now = new Date();
  const target = new Date(`${isoDate}T12:00:00`);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const thisYearTarget = new Date(now.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  const next = thisYearTarget < todayNoon ? new Date(now.getFullYear() + 1, target.getMonth(), target.getDate(), 12, 0, 0) : thisYearTarget;
  const diffMs = next.getTime() - todayNoon.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

export function PostDetalhePage({
  currentUser,
  currentUserId,
  postSlug,
  onOpenAniversarios,
  onOpenFolgas,
}) {
  const [texto, setTexto] = useState("");
  const [loadingComentario, setLoadingComentario] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [loadingEdicao, setLoadingEdicao] = useState(false);

  const postSlugIndexQuery = usePostagensSlugIndex(currentUserId);
  const postagensIndex = useMemo(() => postSlugIndexQuery.data || [], [postSlugIndexQuery.data]);
  const aniversariosQuery = useAniversarios(currentUserId);
  const aniversariantes = useMemo(() => aniversariosQuery.data || [], [aniversariosQuery.data]);
  const colaboradoresQuery = useColaboradores(currentUserId, { summaryOnly: true });
  const colaboradores = useMemo(() => colaboradoresQuery.data || [], [colaboradoresQuery.data]);
  const feriasQuery = useFerias(currentUserId, { summaryOnly: true });
  const feriasData = useMemo(() => feriasQuery.data || null, [feriasQuery.data]);
  const ferias = useMemo(() => feriasData?.ferias || [], [feriasData]);
  const dayoff = useMemo(() => feriasData?.dayoff || [], [feriasData]);
  const ausenciasQuery = useAusencias(currentUserId, { summaryOnly: true });
  const ausencias = useMemo(() => ausenciasQuery.data || [], [ausenciasQuery.data]);

  const toggleCurtidaMutation = useToggleCurtida();
  const comentarMutation = useComentar();
  const editarComentarioMutation = useEditarComentario();
  const deletarComentarioMutation = useDeletarComentario();

  const postResumo = useMemo(
    () => postagensIndex.find((p) => toPostSlug(p.titulo) === postSlug) || null,
    [postagensIndex, postSlug]
  );
  const postDetalheQuery = usePostagemDetalhe(currentUserId, postResumo?.id);
  const post = postDetalheQuery.data || null;
  const postLookupError = postSlugIndexQuery.error || postDetalheQuery.error;
  const postEmCarregamento =
    postSlugIndexQuery.isLoading || (Boolean(postResumo?.id) && postDetalheQuery.isLoading && !post);
  const postNaoEncontrado = !postEmCarregamento && !postLookupError && !post;

  const eu = useMemo(() => currentUser || { nome: "Você", foto: "U", cor: "#11E7E7" }, [currentUser]);
  const dateBox = useMemo(() => (post ? getDateBoxParts(post.data) : { day: "--", month: "---", year: "----" }), [post]);

  const aniversariantesTodos = useMemo(() => {
    const byId = new Map(aniversariantes.map((item) => [String(item?.colaborador?.id || item?.id), item]));
    const fromColaboradores = colaboradores
      .filter((col) => Boolean(col?.aniversario))
      .map((col) => {
        const existing = byId.get(String(col.id));
        if (existing) return existing;
        const date = new Date(`${col.aniversario}T12:00:00`);
        return {
          id: col.id,
          colaborador: col,
          data: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          diasRestantes: daysUntilBirthday(col.aniversario),
          reacoes: [],
        };
      });
    return fromColaboradores.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [aniversariantes, colaboradores]);

  const proximos = useMemo(
    () =>
      aniversariantesTodos
        .filter((a) => a.diasRestantes >= 0)
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
        .slice(0, 5),
    [aniversariantesTodos]
  );

  const proximasFolgas = useMemo(() => {
    const hoje = new Date();
    const hojeNoon = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0);
    const toSortable = (item, tipo) => {
      const inicioDate = parseBrDate(item.inicio);
      const fimDate = parseBrDate(item.fim || item.inicio);
      if (!inicioDate || !fimDate) return null;
      if (fimDate < hojeNoon) return null;
      const anchorDate = inicioDate < hojeNoon ? hojeNoon : inicioDate;
      return {
        ...item,
        tipo,
        _anchorDate: anchorDate,
        _effectiveStatus: tipo === "ferias" ? getFeriasStatusByDate(item) : item.status,
      };
    };
    return [
      ...ferias.map((f) => toSortable(f, "ferias")),
      ...dayoff.map((d) => toSortable(d, "dayoff")),
    ]
      .filter(Boolean)
      .sort((a, b) => a._anchorDate.getTime() - b._anchorDate.getTime())
      .slice(0, 5);
  }, [dayoff, ferias]);
  const ausentesAgora = useMemo(() => {
    const now = new Date();
    return (ausencias || [])
      .filter((item) => {
        if (!item?.inicio) return false;
        const fim = getAusenciaEffectiveEnd(item);
        return !fim || fim >= now;
      })
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
      .slice(0, 5);
  }, [ausencias]);
  const sideIssues = [
    { label: "Aniversários", error: aniversariosQuery.error },
    { label: "Colaboradores", error: colaboradoresQuery.error },
    { label: "PanOff", error: feriasQuery.error || ausenciasQuery.error },
  ].filter((item) => Boolean(item.error));

  const comentar = async () => {
    if (!post || !texto.trim()) return;
    try {
      setLoadingComentario(true);
      await comentarMutation.mutateAsync({ postId: post.id, userId: currentUserId, texto: texto.trim() });
      setTexto("");
    } finally {
      setLoadingComentario(false);
    }
  };

  const iniciarEdicao = (c) => {
    setEditandoId(c.id);
    setTextoEdicao(c.texto);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setTextoEdicao("");
  };

  const salvarEdicao = async () => {
    if (!textoEdicao.trim()) return;
    try {
      setLoadingEdicao(true);
      await editarComentarioMutation.mutateAsync({ comentarioId: editandoId, userId: currentUserId, novoTexto: textoEdicao.trim() });
      setEditandoId(null);
      setTextoEdicao("");
    } finally {
      setLoadingEdicao(false);
    }
  };

  const deletarComentario = async (comentarioId) => {
    await deletarComentarioMutation.mutateAsync({ comentarioId, userId: currentUserId });
  };

  const handleToggleCurtida = (postId) => {
    if (!post) return;
    const alreadyLiked = post.curtidas.includes(currentUserId);
    toggleCurtidaMutation.mutate({ postId, userId: currentUserId, alreadyLiked });
  };

  return (
    <div className="fade-up">
      {sideIssues.length > 0 && (
        <div className="pan-card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar dados auxiliares</div>
            <div className="section-sub">
              {sideIssues.map((item) => `${item.label}: ${item.error?.message || "erro de consulta"}`).join(" | ")}
            </div>
          </div>
        </div>
      )}
      <div className="dash-layout">
        <div>
          {postEmCarregamento ? (
            <div className="pan-card">
              <div className="card-body" style={{ padding: 24 }}>
                <div className="section-title" style={{ fontSize: 20, marginBottom: 6 }}>Carregando post...</div>
                <div className="section-sub">Buscando conteúdo da publicação selecionada.</div>
              </div>
            </div>
          ) : postLookupError ? (
            <div className="pan-card">
              <div className="card-body" style={{ padding: 24 }}>
                <div className="section-title" style={{ fontSize: 20, marginBottom: 6 }}>Falha ao carregar post</div>
                <div className="section-sub">{postLookupError?.message || "Não foi possível carregar esta publicação agora."}</div>
              </div>
            </div>
          ) : postNaoEncontrado ? (
            <div className="pan-card">
              <div className="card-body" style={{ padding: 24 }}>
                <div className="section-title" style={{ fontSize: 20, marginBottom: 6 }}>Post não encontrado</div>
                <div className="section-sub">Esse conteúdo pode ter sido removido ou a URL está incorreta.</div>
              </div>
            </div>
          ) : (
            <div className="pan-card" style={{ overflow: "hidden" }}>
              <div style={{ width: "100%", aspectRatio: "2 / 1", overflow: "hidden" }}>
                <img src={post.imagem} alt={post.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div className="card-body" style={{ padding: 20 }}>
                <div className="post-detalhe-head">
                  <div className="post-detalhe-datebox">
                    <div className="post-detalhe-date-day">{dateBox.day}</div>
                    <div className="post-detalhe-date-month">{dateBox.month}</div>
                    <div className="post-detalhe-date-year">{dateBox.year}</div>
                  </div>
                  <div className="post-detalhe-head-content">
                    <div className="post-detalhe-head-meta">
                      <Badge cat={post.categoria} />
                    </div>
                    <div className="post-detalhe-title">{post.titulo}</div>
                  </div>
                </div>

                <RichContent html={post.descricao} colaboradores={colaboradores} style={{ marginTop: 20, marginBottom: 20 }} />

                <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                  <button className={`post-action ${post.userCurtiu ? "liked" : ""}`} onClick={() => handleToggleCurtida(post.id)}>
                    <Heart size={14} fill={post.userCurtiu ? "currentColor" : "none"} />{" "}
                    {formatCountLabel(post.curtidas.length, "curtida", "curtidas")}
                  </button>
                  <button className="post-action">
                    <MessageCircle size={14} /> {formatCountLabel(post.comentarios.length, "comentário", "comentários")}
                  </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  {post.comentarios.map((c) => {
                    const isAuthor = String(c.autor.id) === String(currentUserId);
                    const isEditing = editandoId === c.id;
                    return (
                      <div key={c.id} className="comment">
                        <Avatar col={c.autor} size={32} />
                        <div className="comment-body">
                          <div className="comment-head">
                            <div className="comment-author">{c.autor.nome}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {c.editado && <span className="comment-edited">editado</span>}
                              <div className="comment-time">{c.hora}</div>
                              {isAuthor && !isEditing && (
                                <div className="comment-actions">
                                  <button className="comment-action-btn" onClick={() => iniciarEdicao(c)} title="Editar">
                                    <Pencil size={11} />
                                  </button>
                                  <button className="comment-action-btn comment-action-del" onClick={() => deletarComentario(c.id)} title="Excluir">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="comment-edit-wrap">
                              <input
                                className="input-field"
                                value={textoEdicao}
                                onChange={(e) => setTextoEdicao(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") salvarEdicao();
                                  if (e.key === "Escape") cancelarEdicao();
                                }}
                                autoFocus
                              />
                              <div className="comment-edit-actions">
                                <button className="btn-primary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={salvarEdicao} disabled={loadingEdicao}>Salvar</button>
                                <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={cancelarEdicao}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="comment-text">{c.texto}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mural-input">
                  <Avatar col={eu} size={32} />
                  <input
                    className="input-field"
                    placeholder="Escreva um comentário..."
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && comentar()}
                  />
                  <button className="btn-primary" onClick={comentar} disabled={loadingComentario}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dash-aside">
          <AniversariosAside
            proximos={proximos}
            isLoading={aniversariosQuery.isLoading}
            onVerTodos={onOpenAniversarios}
            formatDiasRestantes={formatDiasRestantes}
          />
          <PanOffAside
            ausentesAgora={ausentesAgora}
            proximasFolgas={proximasFolgas}
            isLoading={feriasQuery.isLoading || ausenciasQuery.isLoading}
            onVerTodos={onOpenFolgas}
          />
        </div>
      </div>
    </div>
  );
}

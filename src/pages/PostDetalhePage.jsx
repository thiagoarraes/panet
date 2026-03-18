import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Send, Cake, CalendarDays, Plane, MessageSquare, SendHorizonal, Pencil, Trash2 } from "lucide-react";
import DOMPurify from "dompurify";
import { Avatar } from "../components/Avatar";
import { Badge } from "../components/Badge";

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

const parseBrDate = (brDate) => {
  const [day, month, year] = String(brDate || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

const getFeriasStatusByDate = (item) => {
  if (!item) return "marcado";
  if (item.status === "em_andamento") return "em_andamento";
  const inicioDate = parseBrDate(item.inicio);
  const fimDate = parseBrDate(item.fim || item.inicio);
  if (!inicioDate || !fimDate) return item.status || "marcado";
  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  return todayNoon >= inicioDate && todayNoon <= fimDate ? "em_andamento" : (item.status || "marcado");
};

const getPeriodoFolgaLabel = (item) => {
  const inicio = item?.inicio || "";
  const fim = item?.fim || item?.inicio || "";
  const toDayMonth = (brDate) => {
    const [day, month] = String(brDate || "").split("/");
    if (!day || !month) return String(brDate || "");
    return `${day}/${month}`;
  };
  if (!inicio) return "";
  if (!fim || inicio === fim) return toDayMonth(inicio);
  return `${toDayMonth(inicio)} a ${toDayMonth(fim)}`;
};

export function PostDetalhePage({
  post,
  currentUser,
  currentUserId,
  onToggleCurtida,
  onComentar,
  onEditarComentario,
  onDeletarComentario,
  onOpenAniversarios,
  onOpenFolgas,
  onEnviarMensagem,
  aniversariantes = [],
  colaboradores = [],
  muralMsgs = [],
  ferias = [],
  dayoff = [],
}) {
  const [texto, setTexto] = useState("");
  const [loadingComentario, setLoadingComentario] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [loadingEdicao, setLoadingEdicao] = useState(false);
  const [textoMural, setTextoMural] = useState("");
  const [enviandoMural, setEnviandoMural] = useState(false);
  const muralListRef = useRef(null);

  const eu = useMemo(() => currentUser || { nome: "Você", foto: "U", cor: "#11E7E7" }, [currentUser]);
  const dateBox = useMemo(() => (post ? getDateBoxParts(post.data) : { day: "--", month: "---", year: "----" }), [post]);

  const aniversariantesTodos = useMemo(() => {
    const byId = new Map((aniversariantes || []).map((item) => [String(item?.colaborador?.id || item?.id), item]));
    const fromColaboradores = (colaboradores || [])
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

  const muralOrdenado = useMemo(() => [...(muralMsgs || [])].slice(0, 20).reverse(), [muralMsgs]);

  useEffect(() => {
    const el = muralListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [muralOrdenado.length]);

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
      ...(ferias || []).map((f) => toSortable(f, "ferias")),
      ...(dayoff || []).map((d) => toSortable(d, "dayoff")),
    ]
      .filter(Boolean)
      .sort((a, b) => a._anchorDate.getTime() - b._anchorDate.getTime())
      .slice(0, 5);
  }, [dayoff, ferias]);

  const comentar = async () => {
    if (!post || !texto.trim()) return;
    try {
      setLoadingComentario(true);
      await onComentar(post.id, texto.trim());
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
    if (!textoEdicao.trim() || !onEditarComentario) return;
    try {
      setLoadingEdicao(true);
      await onEditarComentario(editandoId, textoEdicao.trim());
      setEditandoId(null);
      setTextoEdicao("");
    } finally {
      setLoadingEdicao(false);
    }
  };

  const deletarComentario = async (comentarioId) => {
    if (!onDeletarComentario) return;
    await onDeletarComentario(comentarioId);
  };

  const handleEnviarMural = async () => {
    const valor = textoMural.trim();
    if (!valor || enviandoMural) return;
    setEnviandoMural(true);
    setTextoMural("");
    Promise.resolve(onEnviarMensagem?.(valor))
      .catch(() => {
        setTextoMural((prev) => prev || valor);
      })
      .finally(() => {
        setEnviandoMural(false);
      });
  };

  return (
    <div className="fade-up">
      <div className="dash-layout">
        <div>
          {!post ? (
            <div className="card">
              <div className="card-body" style={{ padding: 24 }}>
                <div className="section-title" style={{ fontSize: 20, marginBottom: 6 }}>Post não encontrado</div>
                <div className="section-sub">Esse conteúdo pode ter sido removido ou a URL está incorreta.</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ overflow: "hidden" }}>
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

                <div className="rich-content" style={{ marginTop: 20, marginBottom: 20 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.descricao || "") }} />

                <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                  <button className={`post-action ${post.userCurtiu ? "liked" : ""}`} onClick={() => onToggleCurtida(post.id)}>
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
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Cake size={14} /> Próximos aniversariantes
              </span>
            </div>
            <div className="card-body" style={{ padding: "8px 16px" }}>
              {proximos.map((a) => (
                <div key={a.colaborador.id} className="aniv-item">
                  <div className="aniv-date">
                    <div className="aniv-day">{a.data.split("/")[0]}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>/ {a.data.split("/")[1]}</div>
                  </div>
                  <Avatar col={a.colaborador} size={36} />
                  <div className="aniv-info">
                    <div className="aniv-name">{a.colaborador.nome.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatDiasRestantes(a.diasRestantes)}</div>
                  </div>
                </div>
              ))}
              <button className="btn-aniversarios-ver-todos" onClick={onOpenAniversarios}>
                Ver todos
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plane size={14} /> Férias & Day Off
              </span>
            </div>
            <div className="card-body" style={{ padding: "8px 16px" }}>
              <div style={{ marginTop: 10, marginBottom: 12 }}>
                {proximasFolgas.map((item) => {
                  const badge = item.tipo === "ferias" ? (
                    <span
                      className={`status-chip ${item._effectiveStatus === "em_andamento" ? "status-andamento" : "status-marcado"}`}
                      style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      {item._effectiveStatus === "em_andamento" ? "De férias" : "Agendado"}
                    </span>
                  ) : (
                    <span
                      className="status-chip"
                      style={{ background: "rgba(232,75,122,0.15)", color: "#E84B7A", whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      Day Off
                    </span>
                  );
                  return (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      className={`folga-entry ${item.tipo === "dayoff" ? "is-dayoff" : "is-ferias"}`}
                    >
                      <div className="folga-avatar-wrap">
                        <Avatar col={item.colaborador} size={32} />
                      </div>
                      <div className="folga-content">
                        <div className="folga-user">{item.colaborador.nome.split(" ")[0]}</div>
                        <div className="folga-status">{badge}</div>
                        <div className="folga-date-line">
                          <CalendarDays size={12} /> {getPeriodoFolgaLabel(item)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="btn-aniversarios-ver-todos" onClick={onOpenFolgas}>
                  Ver todos
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={14} /> PanZap
              </span>
            </div>
            <div className="card-body" style={{ padding: "12px 12px 10px" }}>
              <div ref={muralListRef} style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
                {muralOrdenado.map((m) => {
                  const isMine = String(m.colaborador?.id) === String(currentUserId);
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                      {!isMine && <Avatar col={m.colaborador} size={28} />}
                      <div
                        style={{
                          maxWidth: "82%",
                          background: isMine ? "color-mix(in srgb, var(--accent) 22%, var(--surface))" : "var(--surface2)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: "7px 10px",
                        }}
                      >
                        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>
                          {!isMine ? `${m.colaborador.nome.split(" ")[0]} · ` : ""}
                          {m.hora}
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.45 }}>{m.texto}</div>
                      </div>
                      {isMine && <Avatar col={m.colaborador} size={28} />}
                    </div>
                  );
                })}
                {muralOrdenado.length === 0 && <div className="empty-state" style={{ padding: 14 }}>Sem mensagens no PanZap.</div>}
              </div>
              <div className="mural-input" style={{ marginTop: 10 }}>
                <Avatar col={currentUser} size={30} />
                <input
                  className="input-field"
                  placeholder="Escreva algo..."
                  value={textoMural}
                  onChange={(e) => setTextoMural(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEnviarMural()}
                  style={{ fontSize: 12, padding: "9px 11px" }}
                />
                <button
                  className="btn-primary"
                  style={{ padding: "9px 11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  onClick={handleEnviarMural}
                  disabled={enviandoMural}
                >
                  <SendHorizonal size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




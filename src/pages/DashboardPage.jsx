import { useEffect, useMemo, useRef, useState } from "react";
import { Cake, CalendarDays, Heart, MessageSquare, SendHorizonal, Plane } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PostCard } from "../components/PostCard";
import useConfetti from "../hooks/useConfetti";

const formatDiasRestantes = (diasRestantes) => {
  if (diasRestantes === 0) return "Hoje";
  if (diasRestantes === 1) return "Amanhã";
  return `em ${diasRestantes} dias`;
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

const getFolgaTotalDias = (item) => {
  const inicioDate = parseBrDate(item?.inicio);
  const fimDate = parseBrDate(item?.fim || item?.inicio);
  if (!inicioDate || !fimDate) return null;
  const diffMs = fimDate.getTime() - inicioDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : null;
};

const getPeriodoFolgaLabel = (item) => {
  const inicio = item?.inicio || "";
  const fim = item?.fim || item?.inicio || "";
  if (!inicio) return "";
  if (!fim || inicio === fim) return inicio;
  return `${inicio} a ${fim}`;
};

export function DashboardPage({
  onOpenPost,
  onToggleCurtida,
  onParabenizar,
  onOpenAniversarios,
  onOpenFolgas,
  onEnviarMensagem,
  postagens,
  aniversariantes,
  colaboradores,
  muralMsgs,
  currentUser,
  currentUserId,
  ferias,
  dayoff,
}) {
  const [pagina, setPagina] = useState(1);
  const [parabenizando, setParabenizando] = useState(false);
  const [textoMural, setTextoMural] = useState("");
  const [enviandoMural, setEnviandoMural] = useState(false);
  const muralListRef = useRef(null);
  const { canvasRef, launch } = useConfetti();
  const POR_PAGINA = 5;
  const totalPags = Math.ceil(postagens.length / POR_PAGINA);
  const postsPag = postagens.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const today = aniversariantes.find((a) => a.diasRestantes === 0);
  const proximos = aniversariantes
    .filter((a) => a.diasRestantes >= 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

  const parabenizadores = useMemo(() => {
    if (!today?.reacoes?.length) return [];
    const byId = new Map((colaboradores || []).map((c) => [String(c.id), c]));
    return today.reacoes.map((id) => byId.get(String(id))).filter(Boolean);
  }, [colaboradores, today]);

  const userJaParabenizou = Boolean(today?.reacoes?.includes(currentUserId));
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
    const todos = [
      ...(ferias || []).map((f) => toSortable(f, "ferias")),
      ...(dayoff || []).map((d) => toSortable(d, "dayoff")),
    ]
      .filter(Boolean)
      .sort((a, b) => a._anchorDate.getTime() - b._anchorDate.getTime())
      .slice(0, 5);
    return todos;
  }, [dayoff, ferias]);

  const handleParabenizarClick = async () => {
    if (!today?.colaborador?.id || parabenizando) return;
    try {
      setParabenizando(true);
      const result = await onParabenizar?.(today.colaborador.id);
      if (result?.added) launch();
    } finally {
      setParabenizando(false);
    }
  };

  const handleEnviarMural = async () => {
    const texto = textoMural.trim();
    if (!texto || enviandoMural) return;
    setEnviandoMural(true);
    setTextoMural("");
    Promise.resolve(onEnviarMensagem?.(texto))
      .catch(() => {
        setTextoMural((prev) => prev || texto);
      })
      .finally(() => {
        setEnviandoMural(false);
      });
  };

  return (
    <div className="fade-up">
      <canvas ref={canvasRef} className="confetti-canvas" />
      {today && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(0,160,157,0.18), rgba(0,160,157,0.07))",
            border: "1px solid rgba(0,160,157,0.32)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            animation: "fadeUp 0.35s ease",
          }}
        >
          <Cake size={28} color="var(--accent)" />
          <div
            style={{
              minWidth: 220,
              display: "flex",
              flexDirection: "column",
              justifyContent: parabenizadores.length > 0 ? "flex-start" : "center",
            }}
          >
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16 }}>
              Hoje é aniversário de <span style={{ color: "var(--accent)" }}>{today.colaborador.nome.split(" ")[0]}</span>!
            </div>
            {parabenizadores.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {parabenizadores.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "3px 8px 3px 4px",
                      background: "var(--surface)",
                    }}
                  >
                    <Avatar col={c} size={20} />
                    <span style={{ fontSize: 11, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {c.nome.split(" ")[0]} <span aria-hidden="true">🎉</span>
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-primary"
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
            disabled={parabenizando}
            onClick={handleParabenizarClick}
          >
            <Heart size={14} />
            {parabenizando ? "Enviando..." : userJaParabenizou ? "Você parabenizou" : "Parabenizar"}
          </button>
        </div>
      )}
      <div className="dash-layout">
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Feed da Pan</div>
              <div className="section-sub">Últimas notícias, comunicados e eventos</div>
            </div>
          </div>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {postsPag.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={onOpenPost}
                curtido={post.userCurtiu}
                onToggleCurtida={() => onToggleCurtida(post.id)}
                showVerMais={true}
              />
            ))}
          </div>
          {totalPags > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
                ‹
              </button>
              {Array.from({ length: totalPags }, (_, i) => (
                <button key={i} className={`page-btn ${pagina === i + 1 ? "active" : ""}`} onClick={() => setPagina(i + 1)}>
                  {i + 1}
                </button>
              ))}
              <button className="page-btn" onClick={() => setPagina((p) => Math.min(totalPags, p + 1))} disabled={pagina === totalPags}>
                ›
              </button>
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
              {proximasFolgas.map((item, idx) => {
                const totalDias = getFolgaTotalDias(item);
                return (
                <div
                  key={`${item.tipo}-${item.id}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: idx === proximasFolgas.length - 1 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <Avatar col={item.colaborador} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{item.colaborador.nome.split(" ")[0]}</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CalendarDays size={12} /> {getPeriodoFolgaLabel(item)}
                    </div>
                    {totalDias && (
                      <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted)" }}>
                        {totalDias}{" "}
                        {item.tipo === "ferias"
                          ? totalDias === 1
                            ? "dia de férias"
                            : "dias de férias"
                          : totalDias === 1
                            ? "dia de day off"
                            : "dias de day off"}
                      </div>
                    )}
                  </div>
                  {item.tipo === "ferias" ? (
                    <span
                      className={`status-chip ${item._effectiveStatus === "em_andamento" ? "status-andamento" : "status-marcado"}`}
                      style={{ marginTop: 2, whiteSpace: "nowrap" }}
                    >
                      {item._effectiveStatus === "em_andamento" ? "De férias" : "Agendado"}
                    </span>
                  ) : (
                    <span
                      className="status-chip"
                      style={{ background: "rgba(232,75,122,0.15)", color: "#E84B7A", marginTop: 2, whiteSpace: "nowrap" }}
                    >
                      Day Off
                    </span>
                  )}
                </div>
                );
              })}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 8 }}>
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




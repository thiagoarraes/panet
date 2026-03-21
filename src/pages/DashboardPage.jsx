import { useEffect, useMemo, useRef, useState } from "react";
import { SkeletonPostCard, SkeletonAnivItem, SkeletonFolgaEntry } from "../components/Skeleton";
import { Cake, CalendarDays, Clock, Heart, MessageSquare, Plane, SendHorizonal } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { PostCard } from "../components/PostCard";
import useConfetti from "../hooks/useConfetti";
import { useMural } from "../hooks/queries/useMural";
import { useEnviarMensagem } from "../hooks/mutations/useMuralMutations";
import { usePostagens } from "../hooks/queries/usePostagens";
import { useToggleCurtida } from "../hooks/mutations/usePostMutations";
import { useFerias } from "../hooks/queries/useFerias";
import { useAusencias } from "../hooks/queries/useAusencias";
import { useAniversarios } from "../hooks/queries/useAniversarios";
import { useColaboradores } from "../hooks/queries/useColaboradores";
import { useParabenizarAniversario } from "../hooks/mutations/useAniversarioMutations";
import { useDashboardSnapshot } from "../hooks/queries/useDashboardSnapshot";
import { isSupabaseEnabled } from "../lib/supabase.js";

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

export function DashboardPage({
  onOpenPost,
  onOpenAniversarios,
  onOpenFolgas,
  currentUser,
  currentUserId,
}) {
  const dashboardSnapshotQuery = useDashboardSnapshot(currentUserId, {
    postsLimit: 20,
    muralLimit: 60,
  });
  const hasSnapshotData = Boolean(dashboardSnapshotQuery.data);
  const useLegacyQueries = !isSupabaseEnabled || dashboardSnapshotQuery.isError;

  const postagensQuery = usePostagens(currentUserId, { limit: 20, enabled: useLegacyQueries });
  const toggleCurtida = useToggleCurtida();
  const muralQuery = useMural(currentUserId, { enabled: useLegacyQueries });
  const enviarMensagem = useEnviarMensagem(currentUserId);
  const feriasQuery = useFerias(currentUserId, { summaryOnly: true, enabled: useLegacyQueries });
  const ausenciasQuery = useAusencias(currentUserId, { summaryOnly: true, enabled: useLegacyQueries });
  const aniversariosQuery = useAniversarios(currentUserId, { enabled: useLegacyQueries });
  const colaboradoresQuery = useColaboradores(currentUserId, {
    summaryOnly: true,
    enabled: useLegacyQueries,
  });

  const postagens = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotQuery.data?.postagens || [] : postagensQuery.data || []),
    [hasSnapshotData, dashboardSnapshotQuery.data, postagensQuery.data]
  );
  const muralMsgs = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotQuery.data?.mural || [] : muralQuery.data || []),
    [hasSnapshotData, dashboardSnapshotQuery.data, muralQuery.data]
  );
  const feriasData = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotQuery.data?.feriasData || null : feriasQuery.data || null),
    [hasSnapshotData, dashboardSnapshotQuery.data, feriasQuery.data]
  );
  const ferias = useMemo(() => feriasData?.ferias || [], [feriasData]);
  const dayoff = useMemo(() => feriasData?.dayoff || [], [feriasData]);
  const ausencias = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotQuery.data?.ausencias || [] : ausenciasQuery.data || []),
    [hasSnapshotData, dashboardSnapshotQuery.data, ausenciasQuery.data]
  );
  const aniversariantes = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotQuery.data?.aniversariantes || [] : aniversariosQuery.data || []),
    [hasSnapshotData, dashboardSnapshotQuery.data, aniversariosQuery.data]
  );
  const colaboradores = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotQuery.data?.colaboradores || [] : colaboradoresQuery.data || []),
    [hasSnapshotData, dashboardSnapshotQuery.data, colaboradoresQuery.data]
  );

  const parabenizarMutation = useParabenizarAniversario(currentUserId);
  const [pagina, setPagina] = useState(1);
  const [parabenizando, setParabenizando] = useState(false);
  const [textoMural, setTextoMural] = useState("");
  const [enviandoMural, setEnviandoMural] = useState(false);
  const muralListRef = useRef(null);
  const { canvasRef, launch } = useConfetti();
  const POR_PAGINA = 5;
  const totalPags = Math.ceil(postagens.length / POR_PAGINA);
  const postsPag = postagens.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const dashboardIssues = useLegacyQueries
    ? [
        { label: "PanNews", error: postagensQuery.error },
        { label: "PanZap", error: muralQuery.error },
        { label: "PanOff", error: feriasQuery.error || ausenciasQuery.error },
        { label: "Aniversários", error: aniversariosQuery.error },
        { label: "Colaboradores", error: colaboradoresQuery.error },
      ].filter((item) => Boolean(item.error))
    : [];

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

  const today = aniversariantesTodos.find((a) => a.diasRestantes === 0);
  const proximos = aniversariantesTodos
    .filter((a) => a.diasRestantes >= 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

  const parabenizadores = useMemo(() => {
    if (!today?.reacoes?.length) return [];
    const byId = new Map(colaboradores.map((c) => [String(c.id), c]));
    return today.reacoes.map((id) => byId.get(String(id))).filter(Boolean);
  }, [colaboradores, today]);

  const userJaParabenizou = Boolean(today?.reacoes?.includes(currentUserId));
  const muralOrdenado = useMemo(() => [...muralMsgs].slice(0, 20).reverse(), [muralMsgs]);

  useEffect(() => {
    const el = muralListRef.current;
    if (!el) return;
    const frameId = window.requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [muralOrdenado.length]);
  const ausentesAgora = useMemo(() => {
    const now = new Date();
    return ausencias
      .filter((a) => {
        if (!a.inicio) return false;
        const fim = a.fim ? new Date(a.fim) : null;
        // mostra ausências que ainda não terminaram (ativas ou futuras próximas)
        return !fim || fim >= now;
      })
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  }, [ausencias]);

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
      ...ferias.map((f) => toSortable(f, "ferias")),
      ...dayoff.map((d) => toSortable(d, "dayoff")),
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
      const result = await parabenizarMutation.mutateAsync({
        aniversarianteId: today.colaborador.id,
        alreadyReacted: userJaParabenizou,
      });
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
    enviarMensagem.mutate(
      { texto, currentProfile: currentUser },
      {
        onError: () => {
          setTextoMural((prev) => prev || texto);
        },
        onSettled: () => {
          setEnviandoMural(false);
        },
      }
    );
  };

  return (
    <div className="fade-up">
      <canvas ref={canvasRef} className="confetti-canvas" />
      {dashboardIssues.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>Falha ao carregar parte dos dados</div>
            <div className="section-sub">
              {dashboardIssues.map((item) => `${item.label}: ${item.error?.message || "erro de consulta"}`).join(" | ")}
            </div>
          </div>
        </div>
      )}
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
          {postagens.length === 0 && (dashboardSnapshotQuery.isLoading || (useLegacyQueries && postagensQuery.isLoading)) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 12 }}>
              {Array.from({ length: 3 }, (_, i) => <SkeletonPostCard key={i} />)}
            </div>
          )}
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {postsPag.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={onOpenPost}
                curtido={post.userCurtiu}
                onToggleCurtida={() =>
                  toggleCurtida.mutate({
                    postId: post.id,
                    userId: currentUserId,
                    alreadyLiked: post.userCurtiu,
                  })
                }
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
              {proximos.length === 0 && (dashboardSnapshotQuery.isLoading || (useLegacyQueries && aniversariosQuery.isLoading))
                ? Array.from({ length: 4 }, (_, i) => <SkeletonAnivItem key={i} />)
                : proximos.map((a) => (
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
                <Plane size={14} /> PanOff
              </span>
            </div>
            <div className="card-body" style={{ padding: "8px 16px" }}>
              {proximasFolgas.length === 0 && ausentesAgora.length === 0 && (dashboardSnapshotQuery.isLoading || (useLegacyQueries && (feriasQuery.isLoading || ausenciasQuery.isLoading))) && (
                <div style={{ marginTop: 10, marginBottom: 12 }}>
                  {Array.from({ length: 3 }, (_, i) => <SkeletonFolgaEntry key={i} />)}
                </div>
              )}
              {ausentesAgora.length > 0 && (
                <div style={{ marginTop: 10, marginBottom: 8 }}>
                  {ausentesAgora.map((a) => (
                    <div key={`ausente-${a.id}`} className="folga-entry is-ausencia">
                      <div className="folga-avatar-wrap">
                        <Avatar col={a.colaborador} size={32} />
                      </div>
                      <div className="folga-content">
                        <div className="folga-user">{a.colaborador.nome.split(" ")[0]}</div>
                        <div className="folga-status">
                          <span className="status-chip" style={{ background: "rgba(255,160,50,0.15)", color: "#FFA032", border: "1px solid rgba(255,160,50,0.3)", whiteSpace: "nowrap", flexShrink: 0 }}>
                            Ausente
                          </span>
                        </div>
                        <div className="folga-date-line">
                          <Clock size={12} />
                          {a.fim
                            ? `${new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} – ${new Date(a.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : a.estimativa ? `${new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ~${a.estimativa}` : `${new Date(a.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · sem previsão`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: ausentesAgora.length === 0 ? 10 : 0, marginBottom: 12 }}>
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

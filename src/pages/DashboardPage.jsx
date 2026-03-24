import { useEffect, useMemo, useRef, useState } from "react";
import { SkeletonPostCard, SkeletonAnivItem, SkeletonFolgaEntry } from "../components/Skeleton";
import { Suspense, lazy } from "react";
import { BarChart3, Cake, CalendarDays, CheckCircle2, Clock, Heart, MessageSquare, Plane, SendHorizonal, Sparkles } from "lucide-react";
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
import { useEnqueteAtiva } from "../hooks/queries/useEnqueteAtiva";
import { useVoteEnquete } from "../hooks/mutations/useEnquetesMutations";
import { getAusenciaEffectiveEnd } from "../lib/ausencias.js";
import { formatEnqueteDateTime } from "../lib/enquetes.js";
import { getAusenciaMeta, getFeriasStatusByDate, getPeriodoFolgaLabel, parseBrDate } from "../lib/panoff.js";
import { isSupabaseEnabled } from "../lib/supabase.js";

const DashboardMoodBoard = lazy(() =>
  import("../components/DashboardMoodBoard").then((module) => ({
    default: module.DashboardMoodBoard,
  }))
);

const scheduleIdleTask = (callback, timeoutMs = 1800) => {
  if (typeof window === "undefined") return () => {};
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, timeoutMs);
  return () => window.clearTimeout(id);
};

const MoodBoardFallback = () => (
  <section className="card mood-check-card" style={{ marginBottom: 14 }}>
    <div className="card-body" style={{ padding: 16 }}>
      <div className="section-sub">Carregando painel de vibes...</div>
    </div>
  </section>
);

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

const DASHBOARD_SNAPSHOT_INITIAL_LIMITS = {
  postsLimit: 5,
  muralLimit: 12,
  feriasLimit: 12,
  ausenciasLimit: 12,
  colaboradoresLimit: 80,
};

const DASHBOARD_SNAPSHOT_FULL_LIMITS = {
  postsLimit: 20,
  muralLimit: 60,
  feriasLimit: 120,
  ausenciasLimit: 120,
  colaboradoresLimit: 500,
};

const BIRTHDAY_BANNER_START_HOUR = 7;
const BIRTHDAY_BANNER_END_HOUR = 23;

export function DashboardPage({
  onOpenPost,
  onOpenAniversarios,
  onOpenFolgas,
  currentUser,
  currentUserId,
}) {
  const [fullSnapshotEnabled, setFullSnapshotEnabled] = useState(false);
  const [moodBoardReady, setMoodBoardReady] = useState(false);
  const dashboardInitialSnapshotQuery = useDashboardSnapshot(currentUserId, DASHBOARD_SNAPSHOT_INITIAL_LIMITS);
  const hasInitialSnapshotData = Boolean(dashboardInitialSnapshotQuery.data);
  const shouldLoadFullSnapshot = fullSnapshotEnabled && hasInitialSnapshotData && !dashboardInitialSnapshotQuery.isError;
  const dashboardFullSnapshotQuery = useDashboardSnapshot(currentUserId, {
    ...DASHBOARD_SNAPSHOT_FULL_LIMITS,
    enabled: shouldLoadFullSnapshot,
  });
  const dashboardSnapshotData = dashboardFullSnapshotQuery.data || dashboardInitialSnapshotQuery.data || null;
  const hasSnapshotData = Boolean(dashboardSnapshotData);
  const snapshotIsLoading = !hasSnapshotData && dashboardInitialSnapshotQuery.isLoading;
  const useLegacyQueries = !isSupabaseEnabled || dashboardInitialSnapshotQuery.isError;

  useEffect(() => {
    if (!hasInitialSnapshotData || dashboardInitialSnapshotQuery.isError) {
      setFullSnapshotEnabled(false);
      return;
    }
    const cancel = scheduleIdleTask(() => {
      setFullSnapshotEnabled(true);
    }, 1800);
    return cancel;
  }, [hasInitialSnapshotData, dashboardInitialSnapshotQuery.isError, currentUserId]);

  useEffect(() => {
    setMoodBoardReady(false);
    const cancel = scheduleIdleTask(() => {
      setMoodBoardReady(true);
    }, 350);
    return cancel;
  }, [currentUserId]);

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
    () => (hasSnapshotData ? dashboardSnapshotData?.postagens || [] : postagensQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, postagensQuery.data]
  );
  const muralMsgs = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.mural || [] : muralQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, muralQuery.data]
  );
  const feriasData = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.feriasData || null : feriasQuery.data || null),
    [hasSnapshotData, dashboardSnapshotData, feriasQuery.data]
  );
  const ferias = useMemo(() => feriasData?.ferias || [], [feriasData]);
  const dayoff = useMemo(() => feriasData?.dayoff || [], [feriasData]);
  const ausencias = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.ausencias || [] : ausenciasQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, ausenciasQuery.data]
  );
  const aniversariantes = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.aniversariantes || [] : aniversariosQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, aniversariosQuery.data]
  );
  const colaboradores = useMemo(
    () => (hasSnapshotData ? dashboardSnapshotData?.colaboradores || [] : colaboradoresQuery.data || []),
    [hasSnapshotData, dashboardSnapshotData, colaboradoresQuery.data]
  );

  const parabenizarMutation = useParabenizarAniversario(currentUserId);
  const enqueteQuery = useEnqueteAtiva(currentUserId, { enabled: Boolean(currentUserId) });
  const voteEnquete = useVoteEnquete();
  const [pagina, setPagina] = useState(1);
  const [parabenizando, setParabenizando] = useState(false);
  const [textoMural, setTextoMural] = useState("");
  const [enviandoMural, setEnviandoMural] = useState(false);
  const [enqueteSelectedOptionId, setEnqueteSelectedOptionId] = useState("");
  const [enqueteError, setEnqueteError] = useState("");
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
        const fim = getAusenciaEffectiveEnd(a);
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

  useEffect(() => {
    setEnqueteSelectedOptionId("");
  }, [enqueteQuery.data?.id, enqueteQuery.data?.hasVoted, enqueteQuery.data?.isClosed]);

  const handleVoteEnquete = async (optionId = enqueteSelectedOptionId) => {
    const enquete = enqueteQuery.data;
    if (!enquete?.id || !optionId || !currentUserId) return;

    try {
      setEnqueteError("");
      await voteEnquete.mutateAsync({
        enqueteId: enquete.id,
        optionId,
        colaboradorId: currentUserId,
      });
    } catch (error) {
      setEnqueteError(error?.message || "Nao foi possivel registrar seu voto.");
    }
  };

  const activeEnquete = enqueteQuery.data;
  const shouldShowEnqueteResults = Boolean(
    activeEnquete && (activeEnquete.isClosed || (activeEnquete.hasVoted && activeEnquete.showPartial))
  );
  const shouldShowEnqueteVoting = Boolean(activeEnquete && !activeEnquete.isClosed && !activeEnquete.hasVoted);
  const shouldShowEnqueteHiddenResultNotice = Boolean(
    activeEnquete && !activeEnquete.isClosed && activeEnquete.hasVoted && !activeEnquete.showPartial
  );
  const currentHour = new Date().getHours();
  const shouldShowBirthdayBanner =
    Boolean(today) &&
    currentHour >= BIRTHDAY_BANNER_START_HOUR &&
    currentHour < BIRTHDAY_BANNER_END_HOUR;
  const birthdayFirstName = String(today?.colaborador?.nome || "").split(" ")[0] || "";

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
      {shouldShowBirthdayBanner && (
        <div className="birthday-hero">
          <div className="birthday-hero-icon-wrap" aria-hidden="true">
            <Cake size={26} />
            <span className="birthday-hero-icon-spark">
              <Sparkles size={12} />
            </span>
          </div>
          <div className="birthday-hero-copy">
            <div className="birthday-hero-badge">
              <Sparkles size={12} />
              Dia especial
            </div>
            <div className="birthday-hero-title">
              Hoje a Pan está em festa: <span className="birthday-hero-name">{birthdayFirstName}</span> faz aniversário!
            </div>
            <div className="birthday-hero-sub">Mande seu parabéns e ajude a tornar esse dia ainda mais inesquecível.</div>
            {parabenizadores.length > 0 && (
              <div className="birthday-hero-cheers">
                {parabenizadores.map((c) => (
                  <span key={c.id} className="birthday-hero-cheer-chip">
                    <Avatar col={c} size={20} />
                    <span className="birthday-hero-cheer-name">
                      {c.nome.split(" ")[0]} <span aria-hidden="true">🎉</span>
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-primary birthday-hero-action"
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
          {moodBoardReady ? (
            <Suspense fallback={<MoodBoardFallback />}>
              <DashboardMoodBoard currentUser={currentUser} currentUserId={currentUserId} />
            </Suspense>
          ) : (
            <MoodBoardFallback />
          )}
          <div className="section-header">
            <div>
              <div className="section-title">Feed da Pan</div>
              <div className="section-sub">Últimas notícias, comunicados e eventos</div>
            </div>
          </div>
          {postagens.length === 0 && (snapshotIsLoading || (useLegacyQueries && postagensQuery.isLoading)) && (
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
          {(enqueteQuery.isLoading || enqueteQuery.data) && (
            <div className="card dashboard-enquete-card">
              <div className="card-header">
                <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <BarChart3 size={14} /> Enquete
                </span>
              </div>
              <div className="card-body dashboard-enquete-body">
                {enqueteQuery.isLoading ? (
                  <div className="dashboard-enquete-loading">
                    <span className="dashboard-enquete-loading-line" />
                    <span className="dashboard-enquete-loading-line is-short" />
                  </div>
                ) : (
                  <>
                    <div className="dashboard-enquete-question">{activeEnquete.question}</div>
                    {activeEnquete.endsAt ? (
                      <div className="dashboard-enquete-note">
                        Encerra em {formatEnqueteDateTime(activeEnquete.endsAt)}
                      </div>
                    ) : null}
                    {shouldShowEnqueteResults ? (
                      <div className="dashboard-enquete-results">
                        {activeEnquete.options.map((option) => (
                          <div key={option.id} className="dashboard-enquete-result-row">
                            <div className="dashboard-enquete-result-head">
                              <span className="dashboard-enquete-result-label">{option.text}</span>
                              <span className="dashboard-enquete-result-value">{option.percent}%</span>
                            </div>
                            <div className="dashboard-enquete-result-track">
                              <span className="dashboard-enquete-result-fill" style={{ width: `${option.percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : shouldShowEnqueteVoting ? (
                      <>
                        <div className="dashboard-enquete-options" role="radiogroup" aria-label="Opções da enquete">
                          {activeEnquete.options.map((option) => {
                            const isSelected = enqueteSelectedOptionId === option.id;
                            return (
                              <label
                                key={option.id}
                                className={`dashboard-enquete-radio ${isSelected ? "is-selected" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name={`enquete-${activeEnquete.id}`}
                                  value={option.id}
                                  checked={isSelected}
                                  onChange={() => setEnqueteSelectedOptionId(option.id)}
                                  disabled={voteEnquete.isPending || !currentUserId}
                                />
                                <span className="dashboard-enquete-radio-dot" aria-hidden="true">
                                  <span className="dashboard-enquete-radio-dot-inner" />
                                </span>
                                <span className="dashboard-enquete-radio-text">{option.text}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="dashboard-enquete-actions">
                          <button
                            className="btn-aniversarios-ver-todos dashboard-enquete-vote-btn"
                            onClick={() => handleVoteEnquete()}
                            disabled={!enqueteSelectedOptionId || voteEnquete.isPending || !currentUserId}
                          >
                            {voteEnquete.isPending ? "Enviando..." : "Votar"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {shouldShowEnqueteHiddenResultNotice ? (
                      <div className="dashboard-enquete-confirmation" role="status" aria-live="polite">
                        <span className="dashboard-enquete-confirmation-icon">
                          <CheckCircle2 size={14} />
                        </span>
                        <span className="dashboard-enquete-confirmation-copy">
                          <strong>Voto registrado com sucesso.</strong>
                          <span>Resultado final em breve, após o encerramento da enquete.</span>
                        </span>
                      </div>
                    ) : null}

                    {shouldShowEnqueteResults ? (
                      <div className="dashboard-enquete-footer">
                        <span>{activeEnquete.totalVotes} voto(s)</span>
                        <span>
                          {activeEnquete.hasVoted ? "Voto registrado." : "Enquete encerrada."}
                        </span>
                      </div>
                    ) : null}

                    {enqueteError ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: "var(--danger)",
                          border: "1px solid rgba(255,107,107,0.28)",
                          borderRadius: 8,
                          padding: "6px 8px",
                          background: "rgba(255,107,107,0.08)",
                        }}
                      >
                        {enqueteError}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Cake size={14} /> Próximos aniversariantes
              </span>
            </div>
            <div className="card-body" style={{ padding: "8px 16px" }}>
              {proximos.length === 0 && (snapshotIsLoading || (useLegacyQueries && aniversariosQuery.isLoading))
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
              {proximasFolgas.length === 0 && ausentesAgora.length === 0 && (snapshotIsLoading || (useLegacyQueries && (feriasQuery.isLoading || ausenciasQuery.isLoading))) && (
                <div style={{ marginTop: 10, marginBottom: 12 }}>
                  {Array.from({ length: 3 }, (_, i) => <SkeletonFolgaEntry key={i} />)}
                </div>
              )}
              {ausentesAgora.length > 0 && (
                <div style={{ marginTop: 10, marginBottom: 8 }}>
                  {ausentesAgora.map((a) => {
                    const ausenciaMeta = getAusenciaMeta(a);
                    return (
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
                          <div className="folga-meta">
                            {ausenciaMeta.dateLabel ? (
                              <span className="folga-meta-chip">
                                <CalendarDays size={12} />
                                {ausenciaMeta.dateLabel}
                              </span>
                            ) : null}
                            {ausenciaMeta.timeLabel ? (
                              <span className="folga-meta-chip is-time">
                                <Clock size={12} />
                                {ausenciaMeta.timeLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                      <div className="folga-meta">
                        <span className="folga-meta-chip">
                          <CalendarDays size={12} /> {getPeriodoFolgaLabel(item)}
                        </span>
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

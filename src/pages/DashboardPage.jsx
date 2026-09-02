import { useDashboardData } from "../hooks/queries/useDashboardData.js";
import { useEffect, useState } from "react";
import { SkeletonPostCard } from "../components/Skeleton";
import { Suspense, lazy } from "react";
import { BarChart3, Cake, CheckCircle2, Heart, Sparkles } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { AniversariosAside } from "../components/aside/AniversariosAside";
import { PanOffAside } from "../components/aside/PanOffAside";
import { CorridasAside } from "../components/aside/CorridasAside";
import { PostCard } from "../components/PostCard";
import useConfetti from "../hooks/useConfetti";
import { useToggleCurtida } from "../hooks/mutations/usePostMutations";
import { useParabenizarAniversario } from "../hooks/mutations/useAniversarioMutations";
import { useVoteEnquete } from "../hooks/mutations/useEnquetesMutations";
import { formatEnqueteDateTime } from "../lib/enquetes.js";

const DashboardMoodBoard = lazy(() =>
  import("../components/DashboardMoodBoard").then((module) => ({
    default: module.DashboardMoodBoard,
  }))
);


const MoodBoardFallback = () => (
  <section className="pan-card mood-check-card" style={{ marginBottom: 14 }}>
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



const BIRTHDAY_BANNER_START_HOUR = 7;
const BIRTHDAY_BANNER_END_HOUR = 23;

export function DashboardPage({
  onOpenPost,
  onOpenAniversarios,
  onOpenFolgas,
  currentUser,
  currentUserId,
}) {
  const {
    snapshotIsLoading,
    moodBoardReady,
    postagens,
        dashboardIssues,
    today,
    proximos,
    parabenizadores,
    userJaParabenizou,
    ausentesAgora,
    proximasFolgas,
    enqueteQuery,
    useLegacyQueries,
    postagensLoading,
    aniversariosLoading,
    feriasLoading,
    ausenciasLoading
  } = useDashboardData(currentUserId);

  const parabenizarMutation = useParabenizarAniversario(currentUserId);
  const voteEnquete = useVoteEnquete();
  const [pagina, setPagina] = useState(1);
  const [parabenizando, setParabenizando] = useState(false);
  const [enqueteSelectedOptionId, setEnqueteSelectedOptionId] = useState("");
  const [enqueteError, setEnqueteError] = useState("");
  const { canvasRef, launch } = useConfetti();
  const toggleCurtida = useToggleCurtida();
  
  const POR_PAGINA = 5;
  const totalPags = Math.ceil(postagens.length / POR_PAGINA);
  const postsPag = postagens.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

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

  useEffect(() => {
    const id = setTimeout(() => setEnqueteSelectedOptionId(""), 0);
    return () => clearTimeout(id);
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
        <div className="pan-card" style={{ marginBottom: 14 }}>
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

          {parabenizadores.length >= 4 && (
            <div className="birthday-cheer-rows">
              {[0, 1, 2].map((rowIndex) => {
                const rowItems = parabenizadores.filter((_, i) => i % 3 === rowIndex);
                if (rowItems.length === 0) return null;
                const dir = rowIndex === 1 ? "right" : "left";
                const duration = Math.max(12, rowItems.length * 3);
                return (
                  <div
                    key={rowIndex}
                    className={`birthday-cheer-carousel birthday-cheer-carousel--${dir}`}
                    style={{ "--cheer-duration": `${duration}s` }}
                  >
                    <div className="birthday-cheer-track">
                      {[0, 1, 2].map((copy) =>
                        rowItems.map((c) => (
                          <span
                            key={`${copy}-${c.id}`}
                            aria-hidden={copy > 0 ? true : undefined}
                            className="birthday-hero-cheer-chip"
                          >
                            <Avatar col={c} size={20} />
                            <span className="birthday-hero-cheer-name">
                              {c.nome.split(" ")[0]} <span aria-hidden="true">🎉</span>
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
          {postagens.length === 0 && (snapshotIsLoading || (useLegacyQueries && postagensLoading)) && (
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
            <div className="pan-pagination">
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
            <div className="pan-card dashboard-enquete-card">
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
          <AniversariosAside
            proximos={proximos}
            isLoading={snapshotIsLoading || (useLegacyQueries && aniversariosLoading)}
            onVerTodos={onOpenAniversarios}
            formatDiasRestantes={formatDiasRestantes}
          />
          <PanOffAside
            ausentesAgora={ausentesAgora}
            proximasFolgas={proximasFolgas}
            isLoading={snapshotIsLoading || (useLegacyQueries && (feriasLoading || ausenciasLoading))}
            onVerTodos={onOpenFolgas}
          />
          <CorridasAside currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}

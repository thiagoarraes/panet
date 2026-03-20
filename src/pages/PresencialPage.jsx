import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Gift, Info, MapPin, Users } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { usePresencial } from "../hooks/queries/usePresencial";
import { useRespondPresencial, useToggleSecretSanta } from "../hooks/mutations/usePresencialMutations";

const formatDateLong = (isoDate, short = false) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: short ? "short" : "long",
    day: "2-digit",
    month: "long",
  });

const formatTimeLabel = (timeValue) => String(timeValue || "").slice(0, 5);

const getDayLabel = (isoDate) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
  });

const getMonthLabel = (isoDate) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
  });

const getStatusMeta = (status) => {
  if (status === "confirmado" || status === "talvez") {
    return {
      label: "Confirmado",
      style: {
        background: "rgba(86,211,100,0.14)",
        color: "var(--success)",
        border: "1px solid rgba(86,211,100,0.24)",
      },
    };
  }
  return {
    label: "Sem resposta",
    style: {
      background: "var(--surface2)",
      color: "var(--muted)",
      border: "1px solid var(--border)",
    },
  };
};

const getConfirmedParticipants = (agenda) =>
  (agenda?.confirmacoes || []).filter((item) => item.status === "confirmado" || item.status === "talvez");

const getSecretSantaParticipants = (agenda) =>
  (agenda?.confirmacoes || []).filter((item) => item.status === "talvez");

export function PresencialPage({ currentUserId }) {
  const { data: agendas = [] } = usePresencial(currentUserId);
  const respondMutation = useRespondPresencial(currentUserId);
  const toggleSecretSantaMutation = useToggleSecretSanta(currentUserId);

  const [savingState, setSavingState] = useState({ agendaId: "", status: "" });

  const proximasAgendas = useMemo(
    () =>
      [...agendas]
        .filter((agenda) => agenda.status !== "cancelado")
        .sort((a, b) => {
          const byDate = String(a.dataIso || "").localeCompare(String(b.dataIso || ""));
          if (byDate !== 0) return byDate;
          return String(a.horaIso || "").localeCompare(String(b.horaIso || ""));
        }),
    [agendas]
  );

  const handleRespond = async (agendaId, status) => {
    if (!agendaId) return;
    try {
      setSavingState({ agendaId, status });
      await respondMutation.mutateAsync({ agendaId, status });
    } finally {
      setSavingState({ agendaId: "", status: "" });
    }
  };

  const renderLocal = (agenda) => {
    const label = agenda?.local || "Escritorio Pan";
    const href = String(agenda?.mapsUrl || "").trim();
    if (!href) return label;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="link-primary-underline">
        {label}
      </a>
    );
  };

  return (
    <div className="fade-up presencial-page">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={22} /> Confirmar presença
          </div>
          <div className="section-sub" style={{ maxWidth: 720 }}>
            Um espaço para acompanhar os eventos da Pan e centralizar as confirmações de presença do time em um só lugar.
          </div>
        </div>
      </div>

      <div className="presencial-hero">
        <div className="presencial-hero-copy">
          <div className="presencial-hero-title">
            <Info size={16} /> Como funciona
          </div>
          <div className="presencial-hero-text">
            Cada evento reúne as confirmações do time em uma lista organizada, dando mais visibilidade para planejamento, logística e participação.
          </div>
        </div>
        <div className="presencial-hero-points">
          <div className="presencial-hero-point">
            <div className="presencial-hero-point-icon presencial-hero-point-icon-confirmado">
              <CheckCircle2 size={14} />
            </div>
            <div className="presencial-hero-point-content">
              <div className="presencial-hero-point-label">Passo 1 — Confirme presença</div>
              <div className="presencial-hero-point-text">Garanta sua participação no evento.</div>
            </div>
          </div>
          {proximasAgendas.some((a) => a.amigoSecretoAtivo) && (
            <div className="presencial-hero-point">
              <div className="presencial-hero-point-icon" style={{ background: "rgba(var(--accent-rgb, 99,102,241),0.14)", color: "var(--accent)" }}>
                <Gift size={14} />
              </div>
              <div className="presencial-hero-point-content">
                <div className="presencial-hero-point-label">Passo 2 — Amigo secreto</div>
                <div className="presencial-hero-point-text">Se o evento tiver sorteio, inscreva-se após confirmar presença.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {proximasAgendas.map((agenda) => {
          const confirmados = getConfirmedParticipants(agenda);
          const participantesSorteio = getSecretSantaParticipants(agenda);
          const minhaResposta = (agenda.confirmacoes || []).find(
            (item) => String(item.colaborador?.id || "") === String(currentUserId || "")
          );
          const statusMeta = getStatusMeta(minhaResposta?.status);
          const estouNoSorteio = minhaResposta?.status === "talvez";
          const vagas = Number(agenda.vagas || 0);
          const ocupacao = vagas > 0 ? Math.min(100, Math.round((confirmados.length / vagas) * 100)) : 0;
          const isSavingAgenda = savingState.agendaId === agenda.id;

          return (
            <div key={agenda.id} className="presencial-card presencial-card-flat">
              <div className="presencial-main">
                <div className="presencial-main-head">
                  <div>
                    <div className="presencial-title">{agenda.titulo}</div>
                    <div className="presencial-when-where">
                      <div className="presencial-ww-item">
                        <span className="presencial-ww-label">Quando?</span>
                        <span className="presencial-ww-value">
                          <CalendarDays size={15} />
                          <span className="hide-mobile">{formatDateLong(agenda.dataIso)}</span>
                          <span className="show-mobile">{formatDateLong(agenda.dataIso, true)}</span>
                          {agenda.horaIso ? ` às ${formatTimeLabel(agenda.horaIso).replace(":", "h").replace(/h00$/, "h")}` : ""}
                        </span>
                      </div>
                      <div className="presencial-ww-item">
                        <span className="presencial-ww-label">Onde?</span>
                        <span className="presencial-ww-value">
                          <MapPin size={15} /> {renderLocal(agenda)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="presencial-my-status" style={statusMeta.style}>
                    {statusMeta.label}
                  </span>
                </div>

                {agenda.observacao && <div className="presencial-note">{agenda.observacao}</div>}

                <div className="presencial-progress">
                  <div className="presencial-progress-head">
                    <span>
                      <Users size={13} /> {confirmados.length} confirmado(s)
                      {vagas > 0 ? ` de ${vagas} vaga(s)` : ""}
                    </span>
                    {agenda.amigoSecretoAtivo && (
                      <span>
                        <Gift size={13} /> {participantesSorteio.length} no sorteio
                      </span>
                    )}
                  </div>
                  {vagas > 0 && (
                    <div className="presencial-progress-track">
                      <div className="presencial-progress-bar" style={{ width: `${ocupacao}%` }} />
                    </div>
                  )}
                </div>

                {/* Step 1: Confirmação de presença */}
                <div className="presencial-step-section">
                  <div className="presencial-step-header">
                    <div className="presencial-step-badge" style={{ background: minhaResposta ? "var(--success)" : "var(--muted)" }}>1</div>
                    <span className="presencial-step-label">Confirme sua presença</span>
                    {minhaResposta && <CheckCircle2 size={16} style={{ color: "var(--success)" }} />}
                  </div>
                  <div className="presencial-actions">
                    <button
                      className={`btn-primary ${minhaResposta?.status === "confirmado" || minhaResposta?.status === "talvez" ? "is-active" : ""}`}
                      onClick={() => handleRespond(agenda.id, "confirmado")}
                      disabled={isSavingAgenda}
                    >
                      {isSavingAgenda && savingState.status === "confirmado" ? "Salvando..." : minhaResposta ? "Presença confirmada" : "Confirmar presença"}
                    </button>
                    {minhaResposta && (
                      <button
                        className="btn-ghost"
                        onClick={() => handleRespond(agenda.id, null)}
                        disabled={isSavingAgenda || (Boolean(agenda.amigoSecretoSorteadoAt) && estouNoSorteio)}
                      >
                        Remover resposta
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 2: Amigo secreto (always visible when active, gated by step 1) */}
                {agenda.amigoSecretoAtivo && (
                  <div className={`presencial-secret-santa-section ${!minhaResposta ? "presencial-secret-santa-locked" : ""}`}>
                    <div className="presencial-step-header">
                      <div className="presencial-step-badge" style={{ background: estouNoSorteio ? "var(--accent)" : "var(--muted)" }}>2</div>
                      <span className="presencial-step-label">
                        <Gift size={15} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
                        Amigo secreto
                      </span>
                      {estouNoSorteio && <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />}
                    </div>

                    {!minhaResposta && (
                      <div className="presencial-secret-santa-hint">
                        Confirme presença primeiro para participar do amigo secreto.
                      </div>
                    )}

                    {minhaResposta && (
                      <div className="presencial-secret-santa-content">
                        {agenda.amigoSecretoRegras && (
                          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                            {agenda.amigoSecretoRegras}
                          </div>
                        )}

                        <div className="presencial-actions">
                          <button
                            className={`presencial-secret-santa-btn ${estouNoSorteio ? "is-active" : ""}`}
                            onClick={() => toggleSecretSantaMutation.mutate({ agendaId: agenda.id, shouldParticipate: !estouNoSorteio })}
                            disabled={isSavingAgenda || Boolean(agenda.amigoSecretoSorteadoAt)}
                          >
                            <Gift size={16} />
                            {agenda.amigoSecretoSorteadoAt
                              ? estouNoSorteio
                                ? "Participação confirmada"
                                : "Sorteio já realizado"
                              : estouNoSorteio
                                ? "Participando — clique para sair"
                                : "Quero participar!"}
                          </button>
                        </div>

                        {agenda.amigoSecretoSorteadoAt && (
                          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                            Sorteio concluído — só você pode ver seu resultado.
                          </div>
                        )}

                        {agenda.amigoSecretoSorteadoAt && estouNoSorteio && agenda.meuAmigoSecreto && (
                          <div className="presencial-secret-santa-result">
                            <Avatar col={agenda.meuAmigoSecreto} size={42} />
                            <div>
                              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Você tirou</div>
                              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700 }}>{agenda.meuAmigoSecreto.nome}</div>
                              <div style={{ fontSize: 12, color: "var(--muted)" }}>{agenda.meuAmigoSecreto.cargo || "Colaborador Pan"}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="presencial-people-grid">
                  <div className="presencial-people-card">
                    <div className="presencial-people-title">Confirmados</div>
                    <div className="presencial-people-list">
                      {confirmados.length > 0 ? (
                        confirmados.map((item) => (
                          <div key={item.id} className="presencial-person-row">
                            <Avatar col={item.colaborador} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div className="presencial-person-name">{item.colaborador?.nome}</div>
                              <div className="presencial-person-note">{item.observacao || item.colaborador?.cargo || "Confirmou presença"}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state" style={{ padding: 18 }}>
                          Ninguém confirmou ainda.
                        </div>
                      )}
                    </div>
                  </div>

                  {agenda.amigoSecretoAtivo && (
                    <div className="presencial-people-card">
                    <div className="presencial-people-title">No amigo secreto</div>
                    <div className="presencial-people-list">
                      {participantesSorteio.length > 0 ? (
                        participantesSorteio.map((item) => (
                          <div key={item.id} className="presencial-person-row">
                            <Avatar col={item.colaborador} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div className="presencial-person-name">{item.colaborador?.nome}</div>
                              <div className="presencial-person-note">{item.observacao || "Participando do sorteio"}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state" style={{ padding: 18 }}>
                          Ninguém entrou no sorteio ainda.
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {proximasAgendas.length === 0 && (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                Nenhum evento aberto no momento.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

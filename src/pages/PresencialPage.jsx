import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Info, MapPin, Users } from "lucide-react";
import { Avatar } from "../components/Avatar";

const formatDateLong = (isoDate) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });

const getDayLabel = (isoDate) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
  });

const getMonthLabel = (isoDate) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
  });

const getStatusMeta = (status) => {
  if (status === "confirmado") {
    return {
      label: "Confirmado",
      style: {
        background: "rgba(86,211,100,0.14)",
        color: "var(--success)",
        border: "1px solid rgba(86,211,100,0.24)",
      },
    };
  }
  if (status === "talvez") {
    return {
      label: "Talvez",
      style: {
        background: "rgba(245, 158, 11, 0.14)",
        color: "#f59e0b",
        border: "1px solid rgba(245, 158, 11, 0.24)",
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

export function PresencialPage({ agendas = [], currentUserId, onRespond }) {
  const [savingState, setSavingState] = useState({ agendaId: "", status: "" });

  const proximasAgendas = useMemo(
    () =>
      [...agendas]
        .filter((agenda) => agenda.status !== "cancelado")
        .sort((a, b) => String(a.dataIso || "").localeCompare(String(b.dataIso || ""))),
    [agendas]
  );

  const handleRespond = async (agendaId, status) => {
    if (!agendaId) return;
    try {
      setSavingState({ agendaId, status });
      await onRespond?.(agendaId, status);
    } finally {
      setSavingState({ agendaId: "", status: "" });
    }
  };

  return (
    <div className="fade-up presencial-page">
      <div className="section-header">
        <div>
          <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={22} /> Presencial Pan
          </div>
          <div className="section-sub" style={{ maxWidth: 720 }}>
            Um espaço para acompanhar os dias presenciais da Pan com mais clareza, previsibilidade e organização do time.
          </div>
        </div>
      </div>

      <div className="presencial-hero">
        <div className="presencial-hero-copy">
          <div className="presencial-hero-title">
            <Info size={16} /> Como funciona
          </div>
          <div className="presencial-hero-text">
            Escolha uma das respostas em cada data. Sua confirmação entra automaticamente na lista do dia para o time se organizar melhor.
          </div>
        </div>
        <div className="presencial-hero-points">
          <div className="presencial-hero-point">
            <div className="presencial-hero-point-icon presencial-hero-point-icon-confirmado">
              <CheckCircle2 size={14} />
            </div>
            <div className="presencial-hero-point-content">
              <div className="presencial-hero-point-label">Vou presencial</div>
              <div className="presencial-hero-point-text">Reserva sua presença na lista organizada do dia.</div>
            </div>
          </div>
          <div className="presencial-hero-point">
            <div className="presencial-hero-point-icon presencial-hero-point-icon-talvez">
              <Clock3 size={14} />
            </div>
            <div className="presencial-hero-point-content">
              <div className="presencial-hero-point-label">Talvez eu vá</div>
              <div className="presencial-hero-point-text">Sinaliza interesse sem confirmar totalmente.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {proximasAgendas.map((agenda) => {
          const confirmados = (agenda.confirmacoes || []).filter((item) => item.status === "confirmado");
          const talvez = (agenda.confirmacoes || []).filter((item) => item.status === "talvez");
          const minhaResposta = (agenda.confirmacoes || []).find(
            (item) => String(item.colaborador?.id || "") === String(currentUserId || "")
          );
          const statusMeta = getStatusMeta(minhaResposta?.status);
          const vagas = Number(agenda.vagas || 0);
          const ocupacao = vagas > 0 ? Math.min(100, Math.round((confirmados.length / vagas) * 100)) : 0;
          const isSavingAgenda = savingState.agendaId === agenda.id;

          return (
            <div key={agenda.id} className="presencial-card">
              <div className="presencial-datebox">
                <span className="presencial-date-day">{getDayLabel(agenda.dataIso)}</span>
                <span className="presencial-date-month">{getMonthLabel(agenda.dataIso)}</span>
              </div>

              <div className="presencial-main">
                <div className="presencial-main-head">
                  <div>
                    <div className="presencial-title">{agenda.titulo}</div>
                    <div className="presencial-subline">
                      <span>
                        <CalendarDays size={13} /> {formatDateLong(agenda.dataIso)}
                      </span>
                      <span>
                        <MapPin size={13} /> {agenda.local || "Escritorio Pan"}
                      </span>
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
                    {talvez.length > 0 && (
                      <span>
                        <Clock3 size={13} /> {talvez.length} talvez
                      </span>
                    )}
                  </div>
                  {vagas > 0 && (
                    <div className="presencial-progress-track">
                      <div className="presencial-progress-bar" style={{ width: `${ocupacao}%` }} />
                    </div>
                  )}
                </div>

                <div className="presencial-actions">
                  <button
                    className={`btn-primary ${minhaResposta?.status === "confirmado" ? "is-active" : ""}`}
                    onClick={() => handleRespond(agenda.id, "confirmado")}
                    disabled={isSavingAgenda}
                  >
                    {isSavingAgenda && savingState.status === "confirmado" ? "Salvando..." : "Vou presencial"}
                  </button>
                  <button
                    className={`btn-ghost ${minhaResposta?.status === "talvez" ? "is-active" : ""}`}
                    onClick={() => handleRespond(agenda.id, "talvez")}
                    disabled={isSavingAgenda}
                  >
                    Talvez eu vá
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => handleRespond(agenda.id, null)}
                    disabled={isSavingAgenda || !minhaResposta}
                  >
                    Remover resposta
                  </button>
                </div>

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

                  <div className="presencial-people-card">
                    <div className="presencial-people-title">Talvez</div>
                    <div className="presencial-people-list">
                      {talvez.length > 0 ? (
                        talvez.map((item) => (
                          <div key={item.id} className="presencial-person-row">
                            <Avatar col={item.colaborador} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div className="presencial-person-name">{item.colaborador?.nome}</div>
                              <div className="presencial-person-note">{item.observacao || "Ainda vai confirmar"}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state" style={{ padding: 18 }}>
                          Sem respostas em talvez.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {proximasAgendas.length === 0 && (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                Nenhum dia presencial aberto no momento. Quando a próxima data for criada, ela aparecerá aqui para o time confirmar.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

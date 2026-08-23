import { useMemo } from "react";
import { CalendarDays, Clock, Plane, UserMinus } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { SkeletonFolgaEntry } from "../components/Skeleton";
import { useFerias } from "../hooks/queries/useFerias";
import { useAusencias } from "../hooks/queries/useAusencias";
import { getAusenciaEffectiveEnd } from "../lib/ausencias.js";
import { getAusenciaMeta, getFeriasStatusByDate, getPeriodoFolgaLabel, parseBrDate } from "../lib/panoff.js";

const getFolgaTotalDias = (item) => {
  const inicioDate = parseBrDate(item?.inicio);
  const fimDate = parseBrDate(item?.fim || item?.inicio);
  if (!inicioDate || !fimDate) return null;

  const diffMs = fimDate.getTime() - inicioDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : null;
};

const getAusenciasVisiveis = (ausencias) => {
  const now = new Date();

  return (ausencias || [])
    .filter((item) => {
      if (!item.inicio) return false;
      const fim = getAusenciaEffectiveEnd(item);
      return !fim || fim >= now;
    })
    .sort((left, right) => {
      const leftFim = getAusenciaEffectiveEnd(left);
      const rightFim = getAusenciaEffectiveEnd(right);
      const leftOpen = !leftFim || leftFim >= now;
      const rightOpen = !rightFim || rightFim >= now;

      if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;

      const leftInicio = new Date(left.inicio);
      const rightInicio = new Date(right.inicio);
      return leftOpen ? leftInicio - rightInicio : rightInicio - leftInicio;
    });
};

const getAusenciaTimingState = (item, referenceDate = new Date()) => {
  if (!item?.inicio) return "agendada";

  const inicio = new Date(item.inicio);
  const fim = getAusenciaEffectiveEnd(item);

  if (Number.isNaN(inicio.getTime())) return "agendada";
  if (inicio > referenceDate) return "agendada";
  if (fim && fim < referenceDate) return "recente";
  return "em_andamento";
};

const getAusenciasResumoLabel = (counts) => {
  const parts = [];

  if (counts.ongoing > 0) {
    parts.push(`${counts.ongoing} em andamento`);
  }
  if (counts.scheduled > 0) {
    parts.push(`${counts.scheduled} ${counts.scheduled === 1 ? "agendada" : "agendadas"}`);
  }
  if (counts.recent > 0) {
    parts.push(`${counts.recent} ${counts.recent === 1 ? "recente" : "recentes"}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Nenhuma agendada ou em andamento";
};

function SectionHeader({ icon, title, subtitle, count, tone }) {
  return (
    <div className="panoff-column-head">
      <div className="panoff-column-copy">
        <div className={`panoff-column-title is-${tone}`}>
          {icon}
          <span>{title}</span>
        </div>
        <div className="panoff-column-sub">{subtitle}</div>
      </div>
      <div className={`panoff-count-pill is-${tone}`}>{count}</div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="panoff-empty">{children}</div>;
}

export function FeriasPage({ currentUserId }) {
  const feriasQuery = useFerias(currentUserId, { summaryOnly: true });
  const ausenciasQuery = useAusencias(currentUserId, { summaryOnly: true });

  const feriasData = feriasQuery.data;
  const ferias = feriasData?.ferias || [];
  const dayoff = feriasData?.dayoff || [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const feriasVisiveis = ferias.filter((f) => {
    const fimDate = parseBrDate(f.fim || f.inicio);
    return !fimDate || fimDate >= startOfToday;
  });
  const dayoffVisiveis = dayoff.filter((d) => {
    const fimDate = parseBrDate(d.fim || d.inicio);
    return !fimDate || fimDate >= startOfToday;
  });
  const ausencias = ausenciasQuery.data || [];
  const ausenciasVisiveis = getAusenciasVisiveis(ausencias);
  const ausenciaCounts = useMemo(() => {
    return ausenciasVisiveis.reduce(
      (acc, item) => {
        const state = getAusenciaTimingState(item);
        if (state === "agendada") acc.scheduled += 1;
        if (state === "em_andamento") acc.ongoing += 1;
        if (state === "recente") acc.recent += 1;
        return acc;
      },
      { ongoing: 0, scheduled: 0, recent: 0 }
    );
  }, [ausenciasVisiveis]);

  const isLoadingPage =
    (feriasQuery.isLoading || ausenciasQuery.isLoading) &&
    feriasVisiveis.length === 0 &&
    dayoffVisiveis.length === 0 &&
    ausenciasVisiveis.length === 0;

  return (
    <div className="fade-up panoff-page">
      {(feriasQuery.isError || ausenciasQuery.isError) && (
        <div className="pan-card" style={{ marginBottom: 4 }}>
          <div className="card-body">
            <div className="section-title" style={{ fontSize: 16 }}>
              Falha ao carregar PanOff
            </div>
            <div className="section-sub">
              {feriasQuery.error?.message || ausenciasQuery.error?.message || "Não foi possível carregar os dados agora."}
            </div>
          </div>
        </div>
      )}

      <section className="panoff-hero">
        <div className="panoff-hero-copy">
          <div className="panoff-hero-title">
            <Plane size={22} />
            <span>PanOff</span>
          </div>
          <div className="panoff-hero-sub">
            Consulte os períodos de férias, day off e ausências da equipe para acompanhar disponibilidades e se organizar melhor no dia a dia.
          </div>
        </div>

        <div className="panoff-hero-stats">
          <div className="panoff-stat is-ferias">
            <div className="panoff-stat-label">
              <Plane size={14} />
              Férias
            </div>
            <div className="panoff-stat-value">{feriasVisiveis.length}</div>
            <div className="panoff-stat-note">Agendadas ou em andamento</div>
          </div>

          <div className="panoff-stat is-dayoff">
            <div className="panoff-stat-label">
              <CalendarDays size={14} />
              Day Off
            </div>
            <div className="panoff-stat-value">{dayoffVisiveis.length}</div>
            <div className="panoff-stat-note">Folgas de um dia</div>
          </div>

          <div className="panoff-stat is-ausencia">
            <div className="panoff-stat-label">
              <UserMinus size={14} />
              Ausências
            </div>
            <div className="panoff-stat-value">{ausenciasVisiveis.length}</div>
            <div className="panoff-stat-note">{getAusenciasResumoLabel(ausenciaCounts)}</div>
          </div>
        </div>
      </section>

      <section className="panoff-board">
        <div className="panoff-column is-ferias">
          <SectionHeader
            icon={<Plane size={16} />}
            title="Férias"
            subtitle="Períodos completos, com status e duração."
            count={feriasVisiveis.length}
            tone="ferias"
          />

          <div className="panoff-list">
            {isLoadingPage &&
              Array.from({ length: 3 }, (_, index) => <SkeletonFolgaEntry key={`ferias-skeleton-${index}`} />)}

            {!isLoadingPage &&
              feriasVisiveis.map((item) => {
                const totalDias = getFolgaTotalDias(item);
                const status = getFeriasStatusByDate(item);

                return (
                  <div key={`ferias-${item.id}`} className="folga-entry is-ferias">
                    <div className="folga-avatar-wrap">
                      <Avatar col={item.colaborador} size={32} />
                    </div>
                    <div className="folga-content">
                      <div className="folga-user">{item.colaborador.nome}</div>
                      <div className="folga-status">
                        <span className={`status-chip ${status === "em_andamento" ? "status-andamento" : "status-marcado"}`}>
                          {status === "em_andamento" ? "De férias" : "Agendado"}
                        </span>
                      </div>
                      <div className="folga-meta">
                        <span className="folga-meta-chip">
                          <CalendarDays size={12} />
                          {getPeriodoFolgaLabel(item)}
                        </span>
                        {totalDias ? (
                          <span className="folga-meta-chip">
                            <Clock size={12} />
                            {totalDias} {totalDias === 1 ? "dia" : "dias"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}

            {!isLoadingPage && feriasVisiveis.length === 0 && <EmptyState>Nenhuma férias registrada.</EmptyState>}
          </div>
        </div>

        <div className="panoff-column is-dayoff">
          <SectionHeader
            icon={<CalendarDays size={16} />}
            title="Day Off"
            subtitle="Folgas pontuais de um único dia."
            count={dayoffVisiveis.length}
            tone="dayoff"
          />

          <div className="panoff-list">
            {isLoadingPage &&
              Array.from({ length: 3 }, (_, index) => <SkeletonFolgaEntry key={`dayoff-skeleton-${index}`} />)}

            {!isLoadingPage &&
              dayoffVisiveis.map((item) => (
                <div key={`dayoff-${item.id}`} className="folga-entry is-dayoff">
                  <div className="folga-avatar-wrap">
                    <Avatar col={item.colaborador} size={32} />
                  </div>
                  <div className="folga-content">
                    <div className="folga-user">{item.colaborador.nome}</div>
                    <div className="folga-status">
                      <span
                        className="status-chip"
                        style={{
                          background: "rgba(232,75,122,0.15)",
                          color: "#E84B7A",
                          border: "1px solid rgba(232,75,122,0.3)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Day Off
                      </span>
                    </div>
                    <div className="folga-meta">
                      <span className="folga-meta-chip">
                        <CalendarDays size={12} />
                        {getPeriodoFolgaLabel(item)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

            {!isLoadingPage && dayoffVisiveis.length === 0 && <EmptyState>Nenhum day off registrado.</EmptyState>}
          </div>
        </div>

        <div className="panoff-column is-ausencia">
          <SectionHeader
            icon={<UserMinus size={16} />}
            title="Ausências"
            subtitle="Agendadas, em andamento e recentes."
            count={ausenciasVisiveis.length}
            tone="ausencia"
          />

          <div className="panoff-list">
            {isLoadingPage &&
              Array.from({ length: 3 }, (_, index) => <SkeletonFolgaEntry key={`ausencia-skeleton-${index}`} />)}

            {!isLoadingPage &&
              ausenciasVisiveis.map((item) => {
                const ausenciaMeta = getAusenciaMeta(item);
                const ausenciaState = getAusenciaTimingState(item);
                const badgeLabel =
                  ausenciaState === "agendada" ? "Agendada" : ausenciaState === "recente" ? "Recente" : "Ausente";

                return (
                  <div key={`ausencia-${item.id}`} className="folga-entry is-ausencia">
                    <div className="folga-avatar-wrap">
                      <Avatar col={item.colaborador} size={32} />
                    </div>
                    <div className="folga-content">
                      <div className="folga-user">{item.colaborador.nome}</div>
                      <div className="folga-status">
                        <span
                          className="status-chip"
                          style={{
                            background:
                              ausenciaState === "agendada"
                                ? "rgba(255,160,50,0.1)"
                                : ausenciaState === "recente"
                                  ? "rgba(255,160,50,0.08)"
                                  : "rgba(255,160,50,0.15)",
                            color: ausenciaState === "agendada" ? "#FFB25C" : "#FFA032",
                            border:
                              ausenciaState === "recente"
                                ? "1px solid rgba(255,160,50,0.22)"
                                : "1px solid rgba(255,160,50,0.3)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {badgeLabel}
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

            {!isLoadingPage && ausenciasVisiveis.length === 0 && <EmptyState>Nenhuma ausência agendada, em andamento ou recente.</EmptyState>}
          </div>
        </div>
      </section>
    </div>
  );
}

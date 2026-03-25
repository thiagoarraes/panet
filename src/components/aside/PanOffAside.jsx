import { CalendarDays, Clock, Plane } from "lucide-react";
import { Avatar } from "../Avatar";
import { SkeletonFolgaEntry } from "../Skeleton";
import { getAusenciaMeta, getPeriodoFolgaLabel } from "../../lib/panoff.js";

export function PanOffAside({ ausentesAgora, proximasFolgas, isLoading, onVerTodos }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plane size={14} /> PanOff
        </span>
      </div>
      <div className="card-body" style={{ padding: "8px 16px" }}>
        {proximasFolgas.length === 0 && ausentesAgora.length === 0 && isLoading && (
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
          <button className="btn-aniversarios-ver-todos" onClick={onVerTodos}>
            Ver todos
          </button>
        </div>
      </div>
    </div>
  );
}

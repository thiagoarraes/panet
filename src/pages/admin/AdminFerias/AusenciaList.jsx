import { CalendarDays, Clock, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { getAusenciaMeta, getAusenciaMobileMeta } from "../../../lib/panoff.js";

export function AusenciaList({
  ausenciaRows, ausenciaLoading,
  ausenciaTotalItems, ausenciaPage, ausenciaTotalPages,
  ausenciaPendingDelete,
  onEditarAusencia, onConfirmarExcluirAusencia,
  setAusenciaPage,
}) {
  return (
    <>
      <div className="stagger admin-ausencia-grid">
        {ausenciaRows.map((item) => {
          const ausenciaMeta = getAusenciaMeta(item, { dateVariant: "full-date" });
          const ausenciaMobileMeta = getAusenciaMobileMeta(item, ausenciaMeta);

          return (
            <div key={item.id} className="card admin-ausencia-card" style={{ padding: 16 }}>
              <div className="admin-ferias-row admin-ausencia-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar col={item.colaborador} size={40} />

                <div className="admin-ferias-main admin-ausencia-main" style={{ flex: 1 }}>
                  <div className="admin-ausencia-header">
                    <div className="admin-ferias-name admin-ausencia-name">{item.colaborador.nome}</div>
                    <span
                      className="status-chip admin-ferias-status admin-ausencia-status admin-ausencia-status-inline"
                      style={{
                        background: "rgba(255,160,50,0.15)",
                        color: "#FFA032",
                        border: "1px solid rgba(255,160,50,0.3)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      Ausente
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{item.colaborador.cargo}</div>
                  <div className="folga-meta admin-ausencia-meta admin-ausencia-meta-desktop" style={{ marginTop: 8 }}>
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
                  <div className="folga-meta admin-ausencia-meta admin-ausencia-meta-mobile" style={{ marginTop: 8 }}>
                    {ausenciaMobileMeta.label ? (
                      <span className={`folga-meta-chip${ausenciaMobileMeta.isTime ? " is-time" : ""}`}>
                        {ausenciaMobileMeta.icon === "clock" ? <Clock size={12} /> : <CalendarDays size={12} />}
                        {ausenciaMobileMeta.label}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="admin-ausencia-motivo"
                    style={{
                      marginTop: 6,
                      padding: "6px 10px",
                      background: "var(--surface2)",
                      borderRadius: 6,
                      fontSize: 12,
                      borderLeft: "3px solid var(--accent)",
                    }}
                  >
                    <span
                      className="admin-ausencia-motivo-label"
                      style={{
                        color: "var(--muted)",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Motivo ·{" "}
                    </span>
                    {item.motivo}
                  </div>
                </div>

                <div className="admin-ferias-actions admin-ausencia-actions" style={{ display: "flex", gap: 6 }}>
                  <button
                    className="admin-action-icon"
                    type="button"
                    onClick={() => onEditarAusencia(item)}
                    aria-label="Editar ausência"
                    title="Editar"
                  >
                    <Pencil />
                  </button>
                  <button
                    className="admin-action-icon is-danger"
                    type="button"
                    onClick={() => onConfirmarExcluirAusencia(item)}
                    disabled={ausenciaPendingDelete.has(item.id)}
                    aria-label={ausenciaPendingDelete.has(item.id) ? "Removendo ausência" : "Remover ausência"}
                    title={ausenciaPendingDelete.has(item.id) ? "Removendo..." : "Remover"}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {ausenciaRows.length === 0 && (
          <div className="empty-state">{ausenciaLoading ? "Carregando..." : "Nenhuma ausência registrada."}</div>
        )}
      </div>

      {ausenciaTotalItems > 20 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {ausenciaPage} de {ausenciaTotalPages} · {ausenciaTotalItems} item(ns)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-ghost"
              onClick={() => setAusenciaPage((p) => Math.max(1, p - 1))}
              disabled={ausenciaPage <= 1}
            >
              Anterior
            </button>
            <button
              className="btn-ghost"
              onClick={() => setAusenciaPage((p) => Math.min(ausenciaTotalPages, p + 1))}
              disabled={ausenciaPage >= ausenciaTotalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </>
  );
}

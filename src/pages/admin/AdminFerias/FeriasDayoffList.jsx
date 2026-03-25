import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "../../../components/Avatar";

export function FeriasDayoffList({
  rows, feriasLoading, sub,
  totalItems, safePage, totalPages,
  pendingDeleteIds,
  onEditar, onConfirmarExcluir,
  setCurrentPage,
}) {
  return (
    <>
      <div
        className={`stagger ${sub === "dayoff" ? "admin-dayoff-grid" : ""}`}
        style={sub === "dayoff" ? undefined : { display: "flex", flexDirection: "column", gap: 10 }}
      >
        {rows.map((item) => (
          <div key={item.id} className={`card ${sub === "dayoff" ? "admin-dayoff-card" : ""}`} style={{ padding: 16 }}>
            <div
              className={`admin-ferias-row ${sub === "dayoff" ? "admin-dayoff-row" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <Avatar col={item.colaborador} size={40} />

              <div className="admin-ferias-main" style={{ flex: 1 }}>
                {sub === "dayoff" ? (
                  <div className="admin-dayoff-header">
                    <div className="admin-ferias-name">{item.colaborador.nome}</div>
                    <span className="status-chip admin-ferias-status admin-dayoff-chip admin-dayoff-chip-inline">
                      Day Off
                    </span>
                  </div>
                ) : (
                  <div className="admin-ferias-name">{item.colaborador.nome}</div>
                )}
                <div className="admin-ferias-role">{item.colaborador.cargo}</div>
                <div
                  className={`admin-ferias-dates admin-ferias-date-pill ${sub === "dayoff" ? "is-dayoff" : ""}`}
                  style={{ fontSize: 12, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <CalendarDays size={12} /> {sub === "dayoff" ? item.inicio : `${item.inicio} - ${item.fim}`}
                </div>
              </div>

              <div className="admin-ferias-side">
                {sub === "ferias" && (
                  <span
                    className={`status-chip admin-ferias-status ${
                      item.status === "em_andamento" ? "status-andamento" : "status-marcado"
                    }`}
                  >
                    {item.status === "em_andamento" ? "De férias" : "Agendado"}
                  </span>
                )}
                <div className="admin-ferias-actions" style={{ display: "flex", gap: 6 }}>
                  <button
                    className="admin-action-icon"
                    type="button"
                    onClick={() => onEditar(item)}
                    aria-label="Editar registro"
                    title="Editar"
                  >
                    <Pencil />
                  </button>
                  <button
                    className="admin-action-icon is-danger"
                    type="button"
                    onClick={() => onConfirmarExcluir(item)}
                    disabled={pendingDeleteIds.has(item.id)}
                    aria-label={pendingDeleteIds.has(item.id) ? "Removendo registro" : "Remover registro"}
                    title={pendingDeleteIds.has(item.id) ? "Removendo..." : "Remover"}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>

              {sub === "dayoff" && item.motivoReal ? (
                <div
                  className="admin-dayoff-motivo"
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    background: "var(--surface2)",
                    borderRadius: 6,
                    fontSize: 12,
                    borderLeft: "3px solid #E84B7A",
                  }}
                >
                  <span
                    className="admin-dayoff-motivo-label"
                    style={{
                      color: "var(--muted)",
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Motivo:{" "}
                  </span>
                  {item.motivoReal}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="empty-state">{feriasLoading ? "Carregando..." : "Nenhum registro encontrado."}</div>
        )}
      </div>

      {totalItems > 20 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {safePage} de {totalPages} · {totalItems} item(ns)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-ghost"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Anterior
            </button>
            <button
              className="btn-ghost"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </>
  );
}

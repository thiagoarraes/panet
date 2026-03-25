import { Pencil, Trash2 } from "lucide-react";
import { Avatar } from "../../../components/Avatar";
import { MODULES } from "../../../lib/adminColabUtils.js";

export function ColabTable({
  lista, loading,
  totalPages, currentPage, setCurrentPage,
  onAlterarSenha, onAbrirEditar, onConfirmarExcluir,
}) {
  return (
    <>
      <div className="card">
        <div className="admin-table-wrap">
          <table className="admin-users-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Colaborador", "Cargo", "E-mail", "Nível", "Ações"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      color: "var(--muted)",
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((col) => (
                <tr
                  key={col.id}
                  style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar col={col} size={32} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{col.nome}</div>
                        {col.isMe && <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>VOCÊ</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{col.cargo}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{col.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {col.perfil === "admin" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span
                          className="status-chip"
                          style={{
                            background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                            color: "var(--accent)",
                            border: "1px solid color-mix(in srgb, var(--accent) 36%, transparent)",
                          }}
                        >
                          Administrador
                        </span>
                        {col.adminModulos !== null && (
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>
                            {col.adminModulos.length === 0
                              ? "Sem módulos"
                              : col.adminModulos.length === MODULES.length
                              ? "Acesso total"
                              : `${col.adminModulos.length} módulo(s)`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="status-chip status-marcado">Colaborador</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => onAlterarSenha(col)}
                        disabled={loading}
                      >
                        Alterar senha
                      </button>
                      <button
                        className="admin-action-icon"
                        type="button"
                        onClick={() => onAbrirEditar(col)}
                        aria-label={`Editar ${col.nome}`}
                        title="Editar"
                      >
                        <Pencil />
                      </button>
                      {!col.isMe && (
                        <button
                          className="admin-action-icon is-danger"
                          type="button"
                          onClick={() => onConfirmarExcluir(col)}
                          aria-label={`Excluir ${col.nome}`}
                          title="Excluir"
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && lista.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13 }}>
                    Nenhum colaborador encontrado para o filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="page-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}

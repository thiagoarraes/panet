import { Table } from "@heroui/react";
import { Avatar } from "../../../components/Avatar";
import { MODULES } from "../../../lib/adminColabUtils.js";
import { ColabActionsMenu } from "./ColabActionsMenu.jsx";

/*
 * As classes legadas admin-table-wrap e admin-users-table continuam no
 * ScrollContainer e no Content: e delas que vem o min-width de 760px e o
 * white-space: nowrap das celulas, e o CSS da Panet nao esta em layer --
 * reescrever isso em utility do Tailwind so mudaria o lugar do problema.
 */
export function ColabTable({
  lista, loading,
  totalPages, currentPage, setCurrentPage,
  podeVerRh,
  onAlterarSenha, onAbrirEditar, onConfirmarExcluir, onVerHistorico,
  onAbrirDadosRh, onDesativar, onReativar,
}) {
  return (
    <>
      <div className="pan-card">
        <Table variant="secondary">
          <Table.ScrollContainer className="admin-table-wrap">
            <Table.Content aria-label="Colaboradores" className="admin-users-table">
              <Table.Header>
                <Table.Column isRowHeader>Colaborador</Table.Column>
                <Table.Column>Cargo</Table.Column>
                <Table.Column>E-mail</Table.Column>
                <Table.Column>Nível</Table.Column>
                <Table.Column>Ações</Table.Column>
              </Table.Header>

              <Table.Body
                renderEmptyState={() =>
                  loading ? "Carregando..." : "Nenhum colaborador encontrado para o filtro atual."
                }
              >
                {lista.map((col) => {
                  const isExPanner = col.ativo === false;
                  return (
                    <Table.Row key={col.id} id={col.id} style={{ opacity: isExPanner ? 0.65 : 1 }}>
                      <Table.Cell>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar col={col} size={32} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 500 }}>{col.nome}</span>
                              {isExPanner && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    letterSpacing: "0.5px",
                                    padding: "2px 7px",
                                    borderRadius: 20,
                                    background: "rgba(245,158,11,0.12)",
                                    color: "#f59e0b",
                                    border: "1px solid rgba(245,158,11,0.3)",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Ex Panner
                                </span>
                              )}
                            </div>
                            {col.isMe && <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>VOCÊ</span>}
                          </div>
                        </div>
                      </Table.Cell>

                      <Table.Cell style={{ fontSize: 13, color: "var(--muted)" }}>{col.cargo}</Table.Cell>

                      <Table.Cell style={{ fontSize: 13, color: "var(--muted)" }}>{col.email}</Table.Cell>

                      <Table.Cell>
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
                      </Table.Cell>

                      <Table.Cell>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <ColabActionsMenu
                            col={col}
                            loading={loading}
                            podeVerRh={podeVerRh}
                            onAlterarSenha={onAlterarSenha}
                            onAbrirEditar={onAbrirEditar}
                            onConfirmarExcluir={onConfirmarExcluir}
                            onVerHistorico={onVerHistorico}
                            onAbrirDadosRh={onAbrirDadosRh}
                            onDesativar={onDesativar}
                            onReativar={onReativar}
                          />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="pan-pagination">
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

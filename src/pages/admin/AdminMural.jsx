import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckSquare, MessageSquare, Minus, Trash2 } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { useAdminMural } from "../../hooks/queries/admin/useAdminMural.js";
import { useDeleteMuralMensagem, useDeleteMuralMensagens } from "../../hooks/mutations/useMuralMutations.js";

const getPanetCheckboxStyle = ({ checked = false, disabled = false }) => ({
  width: 20,
  height: 20,
  borderRadius: 6,
  border: checked ? "1px solid color-mix(in srgb, var(--accent) 55%, transparent)" : "1px solid var(--border)",
  background: checked
    ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 80%, #fff), var(--accent))"
    : "var(--surface)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: checked ? "0 0 0 2px color-mix(in srgb, var(--accent) 24%, transparent)" : "none",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
  transition: "all 0.18s ease",
  padding: 0,
});

export function AdminMural() {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [confirmarExcluirLote, setConfirmarExcluirLote] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useAdminMural({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm });
  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data?.rows]);
  const totalItems = data?.count || 0;
  const uiTotalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, uiTotalPages);

  const deleteMensagem = useDeleteMuralMensagem();
  const deleteMensagens = useDeleteMuralMensagens();

  const visibleIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = !allVisibleSelected && visibleIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds((prev) => {
      const available = new Set(rows.map((row) => row.id));
      const next = new Set();
      let changed = false;
      prev.forEach((id) => {
        if (available.has(id)) next.add(id);
        else changed = true;
      });
      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [rows]);

  const handleDelete = async () => {
    if (!confirmarExcluir) return;
    const id = confirmarExcluir.id;
    try {
      setDeletingId(id);
      await deleteMensagem.mutateAsync(id);
      setConfirmarExcluir(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = rows.map((row) => row.id);
    setSelectedIds(new Set(allIds));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      clearSelection();
      return;
    }
    selectAllVisible();
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteBulk = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setDeletingBulk(true);
      await deleteMensagens.mutateAsync(ids);
      setConfirmarExcluirLote(false);
      clearSelection();
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingBulk(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MessageSquare size={14} /> PanZap (Admin)
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por autor, texto ou data"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>
      {rows.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            margin: "10px 12px 0",
            padding: "10px 12px",
            border: "1px solid color-mix(in srgb, var(--accent) 24%, var(--border))",
            borderRadius: 12,
            background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--surface2)), var(--surface2))",
          }}
        >
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            <button
              type="button"
              aria-label="Selecionar todas da página"
              aria-pressed={allVisibleSelected || someVisibleSelected}
              onClick={toggleAllVisible}
              disabled={deletingBulk || deletingId !== null}
              style={getPanetCheckboxStyle({
                checked: allVisibleSelected || someVisibleSelected,
                disabled: deletingBulk || deletingId !== null,
              })}
            >
              {allVisibleSelected ? <Check size={13} /> : someVisibleSelected ? <Minus size={13} /> : null}
            </button>
            Selecionar todas da página
          </label>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {selectedIds.size > 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                  background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckSquare size={12} /> {selectedIds.size} selecionada(s)
              </span>
            )}
            <button
              className="btn-ghost"
              onClick={clearSelection}
              disabled={selectedIds.size === 0 || deletingBulk || deletingId !== null}
              style={{ padding: "6px 10px" }}
            >
              Limpar
            </button>
            <button
              className="btn-ghost"
              style={{
                color: "#fff",
                background: "linear-gradient(180deg, color-mix(in srgb, var(--danger) 88%, #fff), var(--danger))",
                borderColor: "transparent",
                padding: "6px 12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={() => setConfirmarExcluirLote(true)}
              disabled={selectedIds.size === 0 || deletingBulk || deletingId !== null}
            >
              <Trash2 size={13} />
              Excluir selecionadas
            </button>
          </div>
        </div>
      )}
      <div className="card-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((m) => (
            <div
              key={m.id}
              className="admin-mural-item"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 12px",
                background: selectedIds.has(m.id)
                  ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, var(--surface2)), var(--surface2))"
                  : "var(--surface2)",
                borderColor: selectedIds.has(m.id) ? "color-mix(in srgb, var(--accent) 45%, var(--border))" : "var(--border)",
                boxShadow: selectedIds.has(m.id) ? "0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)" : "none",
                cursor: "pointer",
              }}
              onClick={(e) => {
                if (e.target.closest("button,input,a,label")) return;
                toggleSelect(m.id);
              }}
            >
              <button
                type="button"
                aria-label="Selecionar mensagem"
                aria-pressed={selectedIds.has(m.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(m.id);
                }}
                disabled={deletingBulk || deletingId === m.id}
                style={getPanetCheckboxStyle({
                  checked: selectedIds.has(m.id),
                  disabled: deletingBulk || deletingId === m.id,
                })}
              >
                {selectedIds.has(m.id) ? <Check size={13} /> : null}
              </button>
              <Avatar col={m.colaborador} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="admin-mural-item-head" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.colaborador?.nome}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {m.data} · {m.hora}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text)" }}>{m.texto}</div>
              </div>
              <button
                className="btn-ghost admin-mural-item-delete"
                style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))" }}
                onClick={() => setConfirmarExcluir(m)}
                disabled={deletingId === m.id || deletingBulk}
                title="Excluir mensagem"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="empty-state">{isLoading && totalItems > 0 ? "Carregando..." : "Nenhuma mensagem no PanZap."}</div>
          )}
        </div>
      </div>

      {totalItems > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 16px" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Página {uiPage} de {uiTotalPages} · {totalItems} item(ns)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={uiPage <= 1}>
              Anterior
            </button>
            <button className="btn-ghost" onClick={() => setCurrentPage((p) => Math.min(uiTotalPages, p + 1))} disabled={uiPage >= uiTotalPages}>
              Próxima
            </button>
          </div>
        </div>
      )}

      {confirmarExcluir && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluir(null)}>
          <div className="modal collab-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                <AlertTriangle size={18} color="var(--danger)" /> Excluir mensagem?
              </div>
              <button className="modal-close" onClick={() => setConfirmarExcluir(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--surface2)",
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                  {confirmarExcluir.colaborador?.nome} · {confirmarExcluir.data} · {confirmarExcluir.hora}
                </div>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{confirmarExcluir.texto}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>
                Essa ação remove a mensagem do PanZap para todos os colaboradores.
              </div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    background: "linear-gradient(180deg, color-mix(in srgb, var(--danger) 88%, #fff), var(--danger))",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  disabled={deletingId === confirmarExcluir.id}
                >
                  {deletingId === confirmarExcluir.id ? "Excluindo..." : "Excluir mensagem"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluirLote && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluirLote(false)}>
          <div className="modal collab-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                <AlertTriangle size={18} color="var(--danger)" /> Excluir mensagens selecionadas?
              </div>
              <button className="modal-close" onClick={() => setConfirmarExcluirLote(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>
                Esta ação remove <strong>{selectedIds.size}</strong> mensagem(ns) do PanZap para todos os colaboradores.
              </div>
              <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluirLote(false)} disabled={deletingBulk}>
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteBulk}
                  style={{
                    background: "linear-gradient(180deg, color-mix(in srgb, var(--danger) 88%, #fff), var(--danger))",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  disabled={deletingBulk}
                >
                  {deletingBulk ? "Excluindo..." : "Excluir selecionadas"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

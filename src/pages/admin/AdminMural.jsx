import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageSquare, Trash2 } from "lucide-react";
import { Avatar } from "../../components/Avatar";

export function AdminMural({ mensagens = [], onDeleteMensagem, onListMural }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hiddenMensagemIds, setHiddenMensagemIds] = useState(new Set());
  const [serverRows, setServerRows] = useState([]);
  const [serverCount, setServerCount] = useState(0);
  const [serverLoading, setServerLoading] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const existingIds = new Set(mensagens.map((m) => String(m.id)));
    setHiddenMensagemIds((prev) => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (existingIds.has(String(id))) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [mensagens]);

  const mensagensVisiveis = useMemo(() => {
    const base = mensagens.filter((m) => !hiddenMensagemIds.has(m.id));
    if (!searchTerm) return base;
    return base.filter((m) => {
      const nome = String(m.colaborador?.nome || "").toLowerCase();
      const texto = String(m.texto || "").toLowerCase();
      const dataHora = `${m.data || ""} ${m.hora || ""}`.toLowerCase();
      return nome.includes(searchTerm) || texto.includes(searchTerm) || dataHora.includes(searchTerm);
    });
  }, [hiddenMensagemIds, mensagens, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(mensagensVisiveis.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);

  const mensagensPaginadas = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return mensagensVisiveis.slice(start, start + PAGE_SIZE);
  }, [mensagensVisiveis, page]);

  useEffect(() => {
    if (!onListMural) return;
    let active = true;
    setServerLoading(true);
    onListMural({ page: currentPage, pageSize: PAGE_SIZE, search: searchTerm })
      .then((result) => {
        if (!active) return;
        setServerRows(Array.isArray(result?.rows) ? result.rows : []);
        setServerCount(Number(result?.count || 0));
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setServerRows([]);
          setServerCount(0);
        }
      })
      .finally(() => {
        if (active) setServerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPage, onListMural, searchTerm]);

  const hasServerPagination = typeof onListMural === "function";
  const rows = hasServerPagination ? serverRows : mensagensPaginadas;
  const totalItems = hasServerPagination ? serverCount : mensagensVisiveis.length;
  const uiTotalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const uiPage = Math.min(currentPage, uiTotalPages);

  const handleDelete = async () => {
    if (!confirmarExcluir) return;
    const snapshotServerRows = [...serverRows];
    const snapshotServerCount = serverCount;
    const id = confirmarExcluir.id;
    try {
      setDeletingId(id);
      if (hasServerPagination) {
        setServerRows((prev) => prev.filter((row) => row.id !== id));
        setServerCount((prev) => Math.max(0, prev - 1));
      } else {
        setHiddenMensagemIds((prev) => new Set(prev).add(id));
      }
      await onDeleteMensagem?.(id);
      setConfirmarExcluir(null);
    } catch (error) {
      console.error(error);
      if (hasServerPagination) {
        setServerRows(snapshotServerRows);
        setServerCount(snapshotServerCount);
      } else {
        setHiddenMensagemIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={14} /> PanZap (Admin)
        </span>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar por autor, texto ou data"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>
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
                background: "var(--surface2)",
              }}
            >
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
                disabled={deletingId === m.id}
                title="Excluir mensagem"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {rows.length === 0 && <div className="empty-state">{serverLoading ? "Carregando..." : "Nenhuma mensagem no PanZap."}</div>}
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
    </div>
  );
}


import { useState } from "react";
import { AlertTriangle, MessageSquare, Trash2 } from "lucide-react";
import { Avatar } from "../../components/Avatar";

export function AdminMural({ mensagens = [], onDeleteMensagem }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);

  const handleDelete = async () => {
    if (!confirmarExcluir) return;
    try {
      setDeletingId(confirmarExcluir.id);
      await onDeleteMensagem?.(confirmarExcluir.id);
    } finally {
      setDeletingId(null);
      setConfirmarExcluir(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageSquare size={14} /> PanZap (Admin)
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mensagens.map((m) => (
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
          {mensagens.length === 0 && <div className="empty-state">Nenhuma mensagem no PanZap.</div>}
        </div>
      </div>

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

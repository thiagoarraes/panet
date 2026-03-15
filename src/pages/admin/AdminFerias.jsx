import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Plane } from "lucide-react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Avatar } from "../../components/Avatar";

const toIso = (brDate) => {
  const [d, m, y] = String(brDate || "").split("/");
  return `${y}-${m}-${d}`;
};

const parseIsoToDate = (isoDate) => {
  if (!isoDate) return null;
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
};

const formatDateForStore = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function AdminFerias({ ferias, dayoff, colaboradores, onCreateFerias, onUpdateFerias, onDeleteFerias }) {
  const [sub, setSub] = useState("ferias");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const [saving, setSaving] = useState(false);
  const lista = sub === "ferias" ? ferias : dayoff;

  const colaboradoresOpts = useMemo(() => colaboradores || [], [colaboradores]);

  const abrirNovo = () => {
    setForm({ colaboradorId: "", inicio: "", fim: "", status: "marcado" });
    setModal("novo");
  };

  const salvar = async () => {
    if (!form.colaboradorId || !form.inicio || !form.fim) return;
    try {
      setSaving(true);
      if (modal === "novo") {
        await onCreateFerias({
          colaborador_id: form.colaboradorId,
          inicio: form.inicio,
          fim: form.fim,
          status: form.status || "marcado",
          tipo: sub === "ferias" ? "ferias" : "dayoff",
        });
      } else {
        await onUpdateFerias(form.id, {
          colaborador_id: form.colaboradorId,
          inicio: form.inicio,
          fim: form.fim,
          status: form.status || "marcado",
          tipo: sub === "ferias" ? "ferias" : "dayoff",
        });
      }
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="filter-tabs">
          <button className={`filter-tab ${sub === "ferias" ? "active" : ""}`} onClick={() => setSub("ferias")}>
            <Plane size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> Férias
          </button>
          <button className={`filter-tab ${sub === "dayoff" ? "active" : ""}`} onClick={() => setSub("dayoff")}>
            <CalendarDays size={14} style={{ marginRight: 6, verticalAlign: "text-bottom" }} /> Day Off
          </button>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>
          + Adicionar
        </button>
      </div>

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((item) => (
          <div key={item.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar col={item.colaborador} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.colaborador.nome}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.colaborador.cargo}</div>
                <div style={{ fontSize: 12, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CalendarDays size={12} /> {item.inicio} - {item.fim}
                </div>
              </div>
              {sub === "ferias" && (
                <span className={`status-chip ${item.status === "em_andamento" ? "status-andamento" : "status-marcado"}`}>
                  {item.status === "em_andamento" ? "De férias" : "Agendado"}
                </span>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => {
                    setForm({
                      id: item.id,
                      colaboradorId: String(item.colaborador.id),
                      inicio: toIso(item.inicio),
                      fim: toIso(item.fim),
                      status: item.status || "marcado",
                    });
                    setModal(item.id);
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => setConfirmarExcluir(item)}
                  style={{
                    background: "rgba(255,107,107,0.1)",
                    border: "1px solid rgba(255,107,107,0.3)",
                    color: "var(--danger)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        ))}
        {lista.length === 0 && <div className="empty-state">Nenhum registro encontrado.</div>}
      </div>

      {modal !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modal === "novo" ? `Adicionar ${sub === "ferias" ? "Férias" : "Day Off"}` : "Editar registro"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">COLABORADOR *</label>
                <select className="form-input" value={form.colaboradorId || ""} onChange={(e) => setForm((p) => ({ ...p, colaboradorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {colaboradoresOpts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">INÍCIO *</label>
                  <DatePicker
                    selected={parseIsoToDate(form.inicio)}
                    onChange={(date) => setForm((p) => ({ ...p, inicio: formatDateForStore(date) }))}
                    locale={ptBR}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/aaaa"
                    className="form-input datepicker-input"
                    calendarClassName="panet-datepicker"
                    popperClassName="panet-datepicker-popper"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">FIM *</label>
                  <DatePicker
                    selected={parseIsoToDate(form.fim)}
                    onChange={(date) => setForm((p) => ({ ...p, fim: formatDateForStore(date) }))}
                    locale={ptBR}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/aaaa"
                    className="form-input datepicker-input"
                    calendarClassName="panet-datepicker"
                    popperClassName="panet-datepicker-popper"
                    minDate={parseIsoToDate(form.inicio)}
                  />
                </div>
              </div>
              {sub === "ferias" && (
                <div className="form-group">
                  <label className="form-label">STATUS</label>
                  <select className="form-input" value={form.status || "marcado"} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="marcado">Agendado</option>
                    <option value="em_andamento">De férias</option>
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={salvar} disabled={saving}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "inline-flex", color: "var(--danger)" }}>
                <AlertTriangle size={36} />
              </div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Remover registro?</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Essa ação não pode ser desfeita.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await onDeleteFerias(confirmarExcluir.id);
                    setConfirmarExcluir(null);
                  }}
                  style={{
                    background: "var(--danger)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  disabled={saving}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

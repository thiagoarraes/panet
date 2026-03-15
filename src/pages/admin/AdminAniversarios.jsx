import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "../../components/Avatar";

const ddmmToDate = (value) => {
  const [d, m] = value.split("/");
  if (!d || !m) return null;
  const year = new Date().getFullYear();
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

export function AdminAniversarios({ aniversariantes, colaboradores, onCreateAniversario, onUpdateAniversario, onDeleteAniversario }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const colaboradoresOpts = useMemo(() => colaboradores || [], [colaboradores]);

  const abrirNovo = () => {
    setForm({ colaboradorId: "", data: "", diasRestantes: 0, reacoes: [] });
    setModal("novo");
  };

  const salvar = async () => {
    if (!form.colaboradorId || !form.data) return;
    const dataIso = ddmmToDate(form.data);
    if (!dataIso) return;
    try {
      setSaving(true);
      if (modal === "novo") {
        await onCreateAniversario({ colaborador_id: form.colaboradorId, data_aniversario: dataIso });
      } else {
        await onUpdateAniversario(form.id, { colaborador_id: form.colaboradorId, data_aniversario: dataIso });
      }
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn-primary" onClick={abrirNovo}>
          + Adicionar aniversÃ¡rio
        </button>
      </div>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {aniversariantes.map((a) => (
          <div key={a.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar col={a.colaborador} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.colaborador.nome}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.colaborador.cargo}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 60 }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>{a.data}</div>
                {a.diasRestantes === 0 ? <span className="today-badge">HOJE</span> : <div style={{ fontSize: 11, color: "var(--muted)" }}>em {a.diasRestantes}d</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => {
                    setForm({ ...a, colaboradorId: String(a.colaborador.id) });
                    setModal(a.id);
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={async () => onDeleteAniversario(a.id)}
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
      </div>

      {modal !== null && (
        <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
                {modal === "novo" ? "Adicionar aniversÃ¡rio" : "Editar aniversÃ¡rio"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>
                <X size={18} />
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
                  <label className="form-label">DATA (DD/MM)</label>
                  <input className="form-input" value={form.data || ""} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} placeholder="Ex: 22/03" />
                </div>
                <div className="form-group">
                  <label className="form-label">DIAS RESTANTES</label>
                  <input className="form-input" type="number" min="0" value={form.diasRestantes || 0} readOnly />
                </div>
              </div>
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
    </div>
  );
}


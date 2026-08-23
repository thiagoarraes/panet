import { PanDatePicker } from "../../../components/ui/PanDatePicker.jsx";

export function FeriasModal({ modal, sub, form, setForm, saving, colaboradoresOpts, onClose, onSalvar }) {
  return (
    <div className="modal-overlay" style={{ alignItems: "center", justifyItems: "center" }} onClick={onClose}>
      <div className="pan-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {modal === "novo" ? `Adicionar ${sub === "ferias" ? "Férias" : "Day Off"}` : "Editar registro"}
          </div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">COLABORADOR *</label>
            <select
              className="form-input"
              value={form.colaboradorId || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, colaboradorId: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {colaboradoresOpts.map((col) => (
                <option key={col.id} value={col.id}>{col.nome}</option>
              ))}
            </select>
          </div>

          {sub === "dayoff" ? (
            <div className="form-group">
              <label className="form-label">DAY OFF *</label>
              <PanDatePicker
                value={form.inicio}
                onChange={(iso) => setForm((prev) => ({ ...prev, inicio: iso, fim: iso }))}
              />
            </div>
          ) : (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">INÍCIO *</label>
                <PanDatePicker
                  value={form.inicio}
                  onChange={(iso) => setForm((prev) => ({ ...prev, inicio: iso }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">FIM *</label>
                <PanDatePicker
                  value={form.fim}
                  onChange={(iso) => setForm((prev) => ({ ...prev, fim: iso }))}
                  minValue={form.inicio}
                />
              </div>
            </div>
          )}

          {sub === "dayoff" && (
            <div className="form-group">
              <label className="form-label">MOTIVO</label>
              <input
                className="form-input"
                placeholder="Ex: consulta, compromisso pessoal, resolver documento..."
                value={form.motivoReal || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, motivoReal: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Visível apenas para administradores.
              </div>
            </div>
          )}

          {sub === "ferias" && (
            <div className="form-group">
              <label className="form-label">STATUS</label>
              <select
                className="form-input"
                value={form.status || "marcado"}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="marcado">Agendado</option>
                <option value="em_andamento">De férias</option>
              </select>
            </div>
          )}

          <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={onSalvar} disabled={saving}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

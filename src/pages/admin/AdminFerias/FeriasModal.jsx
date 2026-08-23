import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { formatDateForStore } from "../../../lib/adminAusenciaForm.js";

const parseIsoToDate = (isoDate) => {
  if (!isoDate) return null;
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

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
              <DatePicker
                selected={parseIsoToDate(form.inicio)}
                onChange={(date) => {
                  const next = formatDateForStore(date);
                  setForm((prev) => ({ ...prev, inicio: next, fim: next }));
                }}
                locale={ptBR}
                dateFormat="dd/MM/yyyy"
                placeholderText="dd/mm/aaaa"
                className="form-input datepicker-input"
                calendarClassName="panet-datepicker"
                popperClassName="panet-datepicker-popper"
              />
            </div>
          ) : (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">INÍCIO *</label>
                <DatePicker
                  selected={parseIsoToDate(form.inicio)}
                  onChange={(date) => setForm((prev) => ({ ...prev, inicio: formatDateForStore(date) }))}
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
                  onChange={(date) => setForm((prev) => ({ ...prev, fim: formatDateForStore(date) }))}
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

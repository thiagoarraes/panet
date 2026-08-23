import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Trash2, X } from "lucide-react";

export function EnqueteModal({ modal, form, setForm, errorMsg, saving, onClose, onSave }) {
  const setOptionText = (index, value) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? { ...opt, text: value } : opt)),
    }));
  };

  const addOption = () => {
    setForm((prev) => {
      if (prev.optionsLocked || (prev.options || []).length >= 6) return prev;
      return { ...prev, options: [...(prev.options || []), { id: "", text: "" }] };
    });
  };

  const removeOption = (index) => {
    setForm((prev) => {
      if (prev.optionsLocked || (prev.options || []).length <= 2) return prev;
      return { ...prev, options: prev.options.filter((_, i) => i !== index) };
    });
  };

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div
        className="pan-modal admin-enquete-modal"
        style={{ maxWidth: 620 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {modal === "novo" ? "Criar enquete" : "Editar enquete"}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">PERGUNTA *</label>
            <textarea
              className="form-input"
              style={{ minHeight: 84, resize: "vertical" }}
              value={form.question || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
              placeholder="Ex: Qual horário você prefere para o alinhamento semanal?"
            />
          </div>

          <div className="form-group">
            <div className="admin-enquete-options-head">
              <label className="form-label" style={{ marginBottom: 0 }}>
                OPÇÕES (2 A 6) *
              </label>
              <button
                className="btn-ghost"
                type="button"
                style={{ padding: "6px 10px", fontSize: 12 }}
                onClick={addOption}
                disabled={form.optionsLocked || (form.options || []).length >= 6}
              >
                + Adicionar opção
              </button>
            </div>
            <div className="admin-enquete-options-editor">
              {(form.options || []).map((option, index) => (
                <div key={`${option.id || "new"}-${index}`} className="admin-enquete-option-editor-row">
                  <input
                    className="form-input"
                    value={option.text || ""}
                    onChange={(e) => setOptionText(index, e.target.value)}
                    placeholder={`Opção ${index + 1}`}
                    disabled={form.optionsLocked}
                  />
                  <button
                    className="admin-action-icon is-danger"
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={form.optionsLocked || (form.options || []).length <= 2}
                    aria-label="Remover opção"
                    title="Remover opção"
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
            {form.optionsLocked ? (
              <div className="admin-enquete-form-note">
                Esta enquete já possui votos. As opções ficam bloqueadas para preservar os votos registrados.
              </div>
            ) : null}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">ENCERRAR AUTOMATICAMENTE</label>
              <DatePicker
                selected={form.endsAtDate}
                onChange={(date) => setForm((prev) => ({ ...prev, endsAtDate: date || null }))}
                locale={ptBR}
                showTimeSelect
                timeFormat="HH:mm"
                timeCaption="Hora"
                dateFormat="dd/MM/yyyy HH:mm"
                placeholderText="dd/mm/aaaa --:--"
                className="form-input datepicker-input"
                calendarClassName="panet-datepicker panet-datepicker--datetime"
                popperClassName="panet-datepicker-popper"
                isClearable
              />
              <div className="admin-enquete-form-note">Deixe vazio para encerrar manualmente.</div>
            </div>
            <div className="form-group">
              <label className="form-label">MOSTRAR RESULTADO PARCIAL</label>
              <div className="filter-tabs">
                <button
                  type="button"
                  className={`filter-tab ${form.showPartial ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, showPartial: true }))}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className={`filter-tab ${form.showPartial ? "" : "active"}`}
                  onClick={() => setForm((prev) => ({ ...prev, showPartial: false }))}
                >
                  Não
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="admin-presencial-form-error" style={{ marginBottom: 4 }}>
              {errorMsg}
            </div>
          )}

          <div className="admin-modal-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={onSave} disabled={saving}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

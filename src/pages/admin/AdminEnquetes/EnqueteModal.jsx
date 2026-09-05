import { Button, Modal } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { PanDatePicker } from "../../../components/ui/PanDatePicker.jsx";
import { PanTooltip } from "../../../components/ui/PanTooltip";

/**
 * O form guarda endsAtDate como Date (o pai faz toISOString no salvar), mas o
 * PanDatePicker fala ISO local. A conversao e feita a mao, campo a campo, de
 * proposito: toISOString() converteria para UTC e deslocaria a hora escolhida.
 */
const dateParaIsoLocal = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
};

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
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="admin-enquete-modal" style={{ maxWidth: 620, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
              {modal === "novo" ? "Criar enquete" : "Editar enquete"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
          <div className="form-group">
            <label className="form-label" htmlFor="enquete-pergunta">PERGUNTA *</label>
            <textarea
              id="enquete-pergunta"
              className="form-input"
              style={{ minHeight: 84, resize: "vertical" }}
              value={form.question || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
              placeholder="Ex: Qual horário você prefere para o alinhamento semanal?"
            />
          </div>

          <div className="form-group">
            <div className="admin-enquete-options-head">
              <span className="form-label" style={{ marginBottom: 0 }}>
                OPÇÕES (2 A 6) *
              </span>
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
                  <PanTooltip texto="Remover opção">
                    <button
                      className="admin-action-icon is-danger"
                      type="button"
                      onClick={() => removeOption(index)}
                      disabled={form.optionsLocked || (form.options || []).length <= 2}
                      aria-label="Remover opção"
                    >
                      <Trash2 />
                    </button>
                  </PanTooltip>
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
              <span className="form-label">ENCERRAR AUTOMATICAMENTE</span>
              <PanDatePicker
                comHora
                value={dateParaIsoLocal(form.endsAtDate)}
                onChange={(iso) =>
                  setForm((prev) => ({ ...prev, endsAtDate: iso ? new Date(iso) : null }))
                }
              />
              <div className="admin-enquete-form-note">Deixe vazio para encerrar manualmente.</div>
            </div>
            <div className="form-group">
              <span className="form-label">MOSTRAR RESULTADO PARCIAL</span>
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

          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">Cancelar</Button>
            <Button onPress={onSave} isDisabled={saving}>Salvar</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

import { X } from "lucide-react";
import { PanDatePicker } from "../../components/ui/PanDatePicker.jsx";
import {
  AUSENCIA_TIME_OPTIONS,
  combineLocalDateAndTime,
  getAusenciaFormComputed,
  getLocalDatePart,
  getLocalTimePart,
  toggleAusenciaDiaTodoForm,
} from "../../lib/adminAusenciaForm.js";

export function AdminAusenciaModal({
  modal,
  form,
  setForm,
  colaboradoresOpts,
  saving,
  onClose,
  onSave,
}) {
  if (modal === null) return null;

  const {
    inicioDatePart,
    inicioTimePart,
    retornoDatePart,
    retornoTimePart,
    retornoObrigatorio,
    retornoInvalido,
  } = getAusenciaFormComputed(form);

  return (
    <div
      className="modal-overlay"
      style={{ alignItems: "center", justifyItems: "center" }}
      onClick={onClose}
    >
      <div className="pan-modal admin-ausencia-modal" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {modal === "novo" ? "Registrar ausência" : "Editar ausência"}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">COLABORADOR *</label>
            <select
              className="form-input"
              value={form.colaboradorId || ""}
              onChange={(event) => setForm((prev) => ({ ...prev, colaboradorId: event.target.value }))}
            >
              <option value="">Selecione...</option>
              {colaboradoresOpts.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">MOTIVO *</label>
            <input
              className="form-input"
              placeholder="Ex: Médico, problema no carro, buscar filho..."
              value={form.motivo || ""}
              onChange={(event) => setForm((prev) => ({ ...prev, motivo: event.target.value }))}
            />
            <div className="admin-ausencia-field-note">Só admins veem.</div>
          </div>

          <div className="form-group admin-ausencia-panel">
            <label className="form-label" style={{ marginBottom: 0 }}>
              INÍCIO
            </label>
            <div className="admin-ausencia-start-options">
              <label className={`admin-ausencia-return-option admin-ausencia-start-option ${!form.diaTodo ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="ausenciaInicioModo"
                  checked={!form.diaTodo}
                  onChange={() => setForm((prev) => toggleAusenciaDiaTodoForm(prev, false))}
                />
                <span className="admin-ausencia-return-option-title">Com hora</span>
                <span className="admin-ausencia-return-option-text">Escolher data e hora.</span>
              </label>
              <label className={`admin-ausencia-return-option admin-ausencia-start-option ${form.diaTodo ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="ausenciaInicioModo"
                  checked={Boolean(form.diaTodo)}
                  onChange={() => setForm((prev) => toggleAusenciaDiaTodoForm(prev, true))}
                />
                <span className="admin-ausencia-return-option-title">Dia todo</span>
                <span className="admin-ausencia-return-option-text">Escolher só a data.</span>
              </label>
            </div>

            {form.diaTodo ? (
              <div className="admin-ausencia-inline-field">
                <label className="form-label admin-ausencia-inline-label">DATA DE INÍCIO *</label>
                <PanDatePicker
                  value={form.inicio}
                  onChange={(iso) => setForm((prev) => ({ ...prev, inicio: iso }))}
                />
              </div>
            ) : (
              <div className="admin-ausencia-date-time-row">
                <div className="admin-ausencia-inline-field">
                  <label className="form-label admin-ausencia-inline-label">DATA DE INÍCIO *</label>
                  <PanDatePicker
                    value={form.inicio}
                    onChange={(iso) =>
                      setForm((prev) => ({
                        ...prev,
                        inicio: combineLocalDateAndTime(iso, getLocalTimePart(prev.inicio) || "00:00"),
                      }))
                    }
                  />
                </div>
                <div className="admin-ausencia-inline-field is-time">
                  <label className="form-label admin-ausencia-inline-label">Hora</label>
                  <select
                    className="form-input"
                    value={inicioTimePart || "00:00"}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        inicio: combineLocalDateAndTime(getLocalDatePart(prev.inicio), event.target.value),
                      }))
                    }
                    disabled={!inicioDatePart}
                  >
                    {AUSENCIA_TIME_OPTIONS.map((timeOption) => (
                      <option key={`inicio-${timeOption}`} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {form.diaTodo ? <div className="admin-ausencia-field-note">Sem horário.</div> : null}
          </div>

          <div className="form-group admin-ausencia-panel">
            <label className="form-label" style={{ marginBottom: 0 }}>
              RETORNO
            </label>
            <div className="admin-ausencia-return-options">
              <label className={`admin-ausencia-return-option ${form.tipoTempo === "especifico" ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="tipoTempo"
                  checked={form.tipoTempo === "especifico"}
                  onChange={() => setForm((prev) => ({ ...prev, tipoTempo: "especifico" }))}
                />
                <span className="admin-ausencia-return-option-title">Definido</span>
                <span className="admin-ausencia-return-option-text">
                  {form.diaTodo ? "Escolher data." : "Escolher data e hora."}
                </span>
              </label>
              <label className={`admin-ausencia-return-option ${form.tipoTempo === "indefinido" ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="tipoTempo"
                  checked={form.tipoTempo === "indefinido"}
                  onChange={() => setForm((prev) => ({ ...prev, tipoTempo: "indefinido", fim: "" }))}
                />
                <span className="admin-ausencia-return-option-title">Sem previsão</span>
                <span className="admin-ausencia-return-option-text">Atualizar depois.</span>
              </label>
            </div>

            {form.tipoTempo === "especifico" && (
              <>
                {form.diaTodo ? (
                  <>
                    <label className="form-label" style={{ marginBottom: 6 }}>
                      DATA DE RETORNO
                    </label>
                    <PanDatePicker
                      value={form.fim}
                      onChange={(iso) => setForm((prev) => ({ ...prev, fim: iso }))}
                      minValue={form.inicio}
                    />
                  </>
                ) : (
                  <>
                    <div className="admin-ausencia-date-time-row admin-ausencia-date-time-head">
                      <label className="form-label admin-ausencia-inline-label">DATA DE RETORNO</label>
                      <label className="form-label admin-ausencia-inline-label">Hora</label>
                    </div>
                    <div className="admin-ausencia-date-time-row">
                      <div className="admin-ausencia-inline-field">
                        <PanDatePicker
                          value={form.fim}
                          onChange={(iso) =>
                            setForm((prev) => ({
                              ...prev,
                              fim: combineLocalDateAndTime(
                                iso,
                                getLocalTimePart(prev.fim) || getLocalTimePart(prev.inicio) || "00:00"
                              ),
                            }))
                          }
                          minValue={form.inicio}
                        />
                      </div>
                      <div className="admin-ausencia-inline-field is-time">
                        <select
                          className="form-input"
                          value={retornoTimePart || ""}
                          aria-label="Hora de retorno"
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              fim: combineLocalDateAndTime(getLocalDatePart(prev.fim), event.target.value),
                            }))
                          }
                          disabled={!retornoDatePart}
                        >
                          <option value="">Selecione</option>
                          {AUSENCIA_TIME_OPTIONS.filter(
                            (timeOption) =>
                              !retornoDatePart ||
                              retornoDatePart !== inicioDatePart ||
                              !inicioTimePart ||
                              timeOption >= inicioTimePart
                          ).map((timeOption) => (
                            <option key={`retorno-${timeOption}`} value={timeOption}>
                              {timeOption}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {(retornoObrigatorio || retornoInvalido) && (
                  <div className="admin-presencial-form-error">
                    {retornoObrigatorio
                      ? form.diaTodo
                        ? "Escolha a data de retorno."
                        : "Escolha a data e hora de retorno."
                      : form.diaTodo
                      ? "A data de retorno não pode ser antes do início."
                      : "O retorno precisa ser depois do início."}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="admin-modal-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={onSave}
              disabled={saving || retornoObrigatorio || retornoInvalido}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

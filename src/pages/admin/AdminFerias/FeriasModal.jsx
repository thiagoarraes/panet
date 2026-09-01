import { Button, Modal } from "@heroui/react";
import { PanDatePicker } from "../../../components/ui/PanDatePicker.jsx";
import { PanColaboradorSelect } from "../../../components/ui/PanColaboradorSelect.jsx";

export function FeriasModal({ modal, sub, form, setForm, saving, colaboradoresOpts, onClose, onSalvar }) {
  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog style={{ maxWidth: 480, border: "1px solid var(--border)" }}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17 }}>
              {modal === "novo" ? `Adicionar ${sub === "ferias" ? "Férias" : "Day Off"}` : "Editar registro"}
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body>
          <div className="form-group">
            <PanColaboradorSelect
              label="COLABORADOR *"
              value={form.colaboradorId}
              onChange={(colaboradorId) => setForm((prev) => ({ ...prev, colaboradorId }))}
              colaboradores={colaboradoresOpts}
              isRequired
            />
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

          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" slot="close">Cancelar</Button>
            <Button onPress={onSalvar} isDisabled={saving}>Salvar</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
